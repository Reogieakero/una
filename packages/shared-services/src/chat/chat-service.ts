import type { DbClient } from "../platform";
import { isUniqueViolation } from "../platform";
import { createThreadSchema, sendMessageSchema } from "@dorsu/shared-schemas";

/** A counselor the student may message, derived from a confirmed/completed session. */
export type MessageableCounselor = {
  counselorId: string;
  /** The session that unlocked the conversation (used for the card subtitle). */
  appointmentId: string;
  scheduledAt: string;
  status: "confirmed" | "completed";
};

type AppointmentLike = {
  id: string;
  counselor_id: string | null;
  status: string;
  scheduled_at: string;
};

/** Only a counselor who confirmed (or already held) a session can be messaged. */
const MESSAGEABLE_STATUSES = new Set(["confirmed", "completed"]);

function isUpcoming(iso: string, nowMs: number): boolean {
  const at = new Date(iso).getTime();
  return !Number.isNaN(at) && at >= nowMs;
}

function ranksAbove(candidate: MessageableCounselor, current: MessageableCounselor, nowMs: number) {
  const candidateUpcoming = isUpcoming(candidate.scheduledAt, nowMs);
  const currentUpcoming = isUpcoming(current.scheduledAt, nowMs);
  if (candidateUpcoming !== currentUpcoming) return candidateUpcoming;
  const candidateAt = new Date(candidate.scheduledAt).getTime();
  const currentAt = new Date(current.scheduledAt).getTime();
  // Upcoming: the soonest session wins. Past: the most recent session wins.
  return candidateUpcoming ? candidateAt < currentAt : candidateAt > currentAt;
}

/**
 * Collapse a student's appointments to one entry per messageable counselor
 * (the Messages screen shows one conversation per counselor). Prefers the
 * soonest upcoming confirmed session, then the most recent completed one.
 * Pure: no DB access, so the screen and any future staff view share it.
 */
export function messageableCounselors(
  appointments: AppointmentLike[],
  now: Date = new Date(),
): MessageableCounselor[] {
  const nowMs = now.getTime();
  const best = new Map<string, MessageableCounselor>();
  for (const a of appointments) {
    if (!a.counselor_id || !MESSAGEABLE_STATUSES.has(a.status)) continue;
    if (Number.isNaN(new Date(a.scheduled_at).getTime())) continue;
    const candidate: MessageableCounselor = {
      counselorId: a.counselor_id,
      appointmentId: a.id,
      scheduledAt: a.scheduled_at,
      status: a.status as MessageableCounselor["status"],
    };
    const current = best.get(candidate.counselorId);
    if (!current || ranksAbove(candidate, current, nowMs)) best.set(candidate.counselorId, candidate);
  }
  return [...best.values()].sort((a, b) => {
    const aUpcoming = isUpcoming(a.scheduledAt, nowMs);
    const bUpcoming = isUpcoming(b.scheduledAt, nowMs);
    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
    const delta = new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    return aUpcoming ? delta : -delta;
  });
}

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
export async function getThreadWithMessages(
  db: DbClient,
  threadId: string,
  opts?: { limit?: number; before?: string },
) {
  const { data: thread, error: tErr } = await db
    .from("chat_threads")
    .select("id, student_id, counselor_id, appointment_id, status, created_at, updated_at")
    .eq("id", threadId)
    .single();
  if (tErr) throw tErr;
  // P10: bounded history — latest N first, reversed to oldest-first for
  // render. Cursor (`before`) pages older messages instead of loading all.
  let mq = db
    .from("chat_messages")
    .select("id, thread_id, sender_profile_id, body, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(Math.min(opts?.limit ?? 50, 200));
  if (opts?.before) mq = mq.lt("created_at", opts.before);
  const { data: page, error: mErr } = await mq;
  if (mErr) throw mErr;
  const messages = (((page ?? []) as { id: string; created_at: string }[]).slice().reverse());
  return { thread, messages };
}

/**
 * Open a thread; one open thread per (student, counselor) and per appointment
 * (idempotency rules). Re-tapping the same contact in the student inbox must
 * reopen the existing conversation instead of minting a new one, and an
 * appointment always implies its counselor so a thread can never end up with
 * `counselor_id = null` (those rows are invisible to every counselor inbox).
 */
export async function openThread(
  db: DbClient,
  input: { studentId: string; counselorId?: string; appointmentId?: string },
) {
  createThreadSchema.parse({
    counselorId: input.counselorId,
    appointmentId: input.appointmentId,
  });

  let counselorId = input.counselorId ?? null;
  if (input.appointmentId) {
    const { data: existing } = await db
      .from("chat_threads")
      .select("*")
      .eq("appointment_id", input.appointmentId)
      .eq("status", "open")
      .maybeSingle();
    if (existing) return existing;
    if (!counselorId) {
      const { data: appointment } = await db
        .from("appointments")
        .select("counselor_id")
        .eq("id", input.appointmentId)
        .maybeSingle();
      counselorId = (appointment as { counselor_id: string | null } | null)?.counselor_id ?? null;
    }
  }

  if (counselorId) {
    const { data: existing } = await db
      .from("chat_threads")
      .select("*")
      .eq("student_id", input.studentId)
      .eq("counselor_id", counselorId)
      .eq("status", "open")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) return existing;
  }

  const { data, error } = await db
    .from("chat_threads")
    .insert({
      student_id: input.studentId,
      counselor_id: counselorId,
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
