import { logEvent } from "./log-event";

type NotifyType = "appointment" | "referral" | "announcement" | "chat" | "assessment" | "system";

export type NotifyTone = "success" | "info" | "error";

/**
 * Fire-and-forget transaction notification via /api/staff/notify.
 * Never blocks or throws — a missed ping must never break the action itself.
 *
 * Pass `dedupeKey` (one per event, e.g. `appt:<id>:assigned:<counselorId>`)
 * so retried or double-fired events collapse into the existing inbox row
 * via UNIQUE(notifications.profile_id, dedupe_key) instead of duplicating.
 * Callers MUST NOT await this — success reflects the DB write, not delivery.
 *
 * Empty recipient lists still POST: the server is the authority on
 * recipients. Faculty cannot read other profiles via RLS, so their `headIds`
 * is always empty — the route resolves heads server-side for them. Skipping
 * the POST here would silently notify nobody.
 */
export async function notifyStaff(
  to: (string | null | undefined)[],
  input: { type: NotifyType; title: string; body?: string; link?: string; dedupeKey?: string; tone?: NotifyTone }
): Promise<void> {
  try {
    const targets = [...new Set(to.filter((id): id is string => !!id))];
    if (!input.title.trim()) return;
    const res = await fetch("/api/staff/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: targets, ...input }),
    }).catch(() => null);
    logEvent("REALTIME_EVENT_PUBLISHED", {
      type: input.type,
      targets: targets.length,
      link: input.link ?? null,
      deduped: Boolean(input.dedupeKey),
      delivered: res?.ok ?? false,
    });
  } catch {
    // Intentionally silent.
  }
}
