import type { DbClient } from "../platform";
import { staffMessageSchema } from "@dorsu/shared-schemas";

/**
 * Staff DMs — direct office messages outside student threads.
 * RLS: parties read their own, head/admin supervise all, senders write
 * their own rows to staff recipients only.
 */

/** List my staff DMs (both directions), newest first. */
export async function listStaffMessages(db: DbClient, profileId: string, limit = 300) {
  const { data, error } = await db
    .from("staff_messages")
    .select("*")
    .or(`sender_profile_id.eq.${profileId},recipient_profile_id.eq.${profileId}`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

/** Send a staff DM (sender must be the caller — RLS enforces too). */
export async function sendStaffMessage(
  db: DbClient,
  input: { senderProfileId: string; recipientProfileId: string; body: string },
) {
  const parsed = staffMessageSchema.parse({
    recipientProfileId: input.recipientProfileId,
    body: input.body,
  });
  const { data, error } = await db
    .from("staff_messages")
    .insert({
      sender_profile_id: input.senderProfileId,
      recipient_profile_id: parsed.recipientProfileId,
      body: parsed.body,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Mark a counterpart's messages as read (recipient-only via RLS). */
export async function markStaffMessagesRead(
  db: DbClient,
  input: { readerProfileId: string; counterpartProfileId: string },
) {
  const { error } = await db
    .from("staff_messages")
    .update({ is_read: true })
    .eq("recipient_profile_id", input.readerProfileId)
    .eq("sender_profile_id", input.counterpartProfileId)
    .eq("is_read", false);
  if (error) throw error;
}
