import type { DbClient } from "../platform";
import { isUniqueViolation } from "../platform";
import { createThreadSchema, sendMessageSchema } from "@dorsu/shared-schemas";

/** List threads for a student (pure read, RLS scopes to participants). */
export async function listThreads(db: DbClient, studentId: string) {
  const { data, error } = await db
    .from("chat_threads")
    .select("*")
    .eq("student_id", studentId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Fetch a thread with messages ordered oldest-first (pure read). */
export async function getThreadWithMessages(db: DbClient, threadId: string) {
  const { data: thread, error: tErr } = await db
    .from("chat_threads")
    .select("*")
    .eq("id", threadId)
    .single();
  if (tErr) throw tErr;
  const { data: messages, error: mErr } = await db
    .from("chat_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (mErr) throw mErr;
  return { thread, messages };
}

/** Open a thread; one open thread per appointment (idempotency rule). */
export async function openThread(
  db: DbClient,
  input: { studentId: string; counselorId?: string; appointmentId?: string },
) {
  createThreadSchema.parse({
    counselorId: input.counselorId,
    appointmentId: input.appointmentId,
  });
  if (input.appointmentId) {
    const { data: existing } = await db
      .from("chat_threads")
      .select("id")
      .eq("appointment_id", input.appointmentId)
      .eq("status", "open")
      .maybeSingle();
    if (existing) return existing;
  }
  const { data, error } = await db
    .from("chat_threads")
    .insert({
      student_id: input.studentId,
      counselor_id: input.counselorId ?? null,
      appointment_id: input.appointmentId ?? null,
      status: "open",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Send a message; sender must be a thread participant (RLS enforces too).
 * Idempotent: `messageId` is a client-generated UUID v4 used as the row PK —
 * reuse it across retries of one send and a re-send resolves to the existing
 * row instead of duplicating. Scoped to (id, thread, sender) so a key can
 * never resolve to someone else's message.
 */
export async function sendMessage(
  db: DbClient,
  input: { threadId: string; senderProfileId: string; body: string; messageId?: string },
) {
  const parsed = sendMessageSchema.parse({
    threadId: input.threadId,
    body: input.body,
    messageId: input.messageId,
  });
  const { data, error } = await db
    .from("chat_messages")
    .insert({
      ...(parsed.messageId ? { id: parsed.messageId } : {}),
      thread_id: parsed.threadId,
      sender_profile_id: input.senderProfileId,
      body: parsed.body,
    })
    .select()
    .single();
  if (!error) {
    await db.from("chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", parsed.threadId);
    return data;
  }
  if (isUniqueViolation(error) && parsed.messageId) {
    const { data: existing, error: lookupError } = await db
      .from("chat_messages")
      .select()
      .eq("id", parsed.messageId)
      .eq("thread_id", parsed.threadId)
      .eq("sender_profile_id", input.senderProfileId)
      .single();
    if (!lookupError && existing) return existing;
  }
  throw error;
}
