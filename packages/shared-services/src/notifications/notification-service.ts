import type { DbClient } from "../platform";
import { isUniqueViolation } from "../platform";

/**
 * Notifications are service-written only (no client insert policy in RLS).
 *
 * Idempotency: pass `dedupeKey` (one per event, e.g. `appt:<id>:<status>`).
 * A replayed event hits UNIQUE(notifications.profile_id, dedupe_key) and
 * resolves to the existing row instead of duplicating the inbox.
 */
export async function createNotification(
  db: DbClient,
  input: {
    profileId: string;
    type: "appointment" | "referral" | "announcement" | "chat" | "assessment" | "system";
    title: string;
    body?: string | null;
    link?: string | null;
    dedupeKey?: string | null;
  },
) {
  const { data, error } = await db
    .from("notifications")
    .insert({
      profile_id: input.profileId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      dedupe_key: input.dedupeKey ?? null,
    })
    .select()
    .single();
  if (!error) return data;
  if (isUniqueViolation(error) && input.dedupeKey) {
    const { data: existing, error: lookupError } = await db
      .from("notifications")
      .select()
      .eq("profile_id", input.profileId)
      .eq("dedupe_key", input.dedupeKey)
      .single();
    if (!lookupError && existing) return existing;
  }
  throw error;
}

/** Notify a student that their appointment status changed. */
export async function notifyAppointmentChange(
  db: DbClient,
  input: { studentProfileId: string; appointmentId: string; status: string },
) {
  return createNotification(db, {
    profileId: input.studentProfileId,
    type: "appointment",
    title: `Appointment ${input.status}`,
    body: `Your appointment is now ${input.status}.`,
    link: `/appointments/${input.appointmentId}`,
    // One event = one row: replays of the same status change dedupe.
    dedupeKey: `appt:${input.appointmentId}:${input.status}`,
  });
}

/** Mark one notification read (owner-only via RLS). */
export async function markNotificationRead(db: DbClient, notificationId: string) {
  const { data, error } = await db
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** List a user's notifications newest-first (pure read). */
export async function listNotifications(db: DbClient, profileId: string) {
  const { data, error } = await db
    .from("notifications")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

/**
 * Push fan-out ledger (exactly-once boundary per device per event).
 *
 * Contract for the push worker: for each active `device_tokens` row, insert
 * a `notification_deliveries` row FIRST, then send. A replayed worker run
 * hits UNIQUE(notification_deliveries.notification_id, push_token) and must
 * SKIP the send, returning the existing row. Expo/FCM delivery itself is
 * at-least-once — this table, not the provider, is the dedupe point.
 */
export async function recordDelivery(
  db: DbClient,
  input: {
    notificationId: string;
    pushToken: string;
    status?: "queued" | "sent" | "failed" | "skipped";
    providerResponse?: Record<string, unknown> | null;
  },
) {
  const { data, error } = await db
    .from("notification_deliveries")
    .insert({
      notification_id: input.notificationId,
      push_token: input.pushToken,
      status: input.status ?? "queued",
      provider_response: input.providerResponse ?? null,
    })
    .select()
    .single();
  if (!error) return { row: data, duplicate: false as const };
  if (isUniqueViolation(error)) {
    const { data: existing, error: lookupError } = await db
      .from("notification_deliveries")
      .select()
      .eq("notification_id", input.notificationId)
      .eq("push_token", input.pushToken)
      .single();
    // Already recorded → the send already happened (or was claimed by a
    // concurrent worker): caller MUST skip sending.
    if (!lookupError && existing) return { row: existing, duplicate: true as const };
  }
  throw error;
}
