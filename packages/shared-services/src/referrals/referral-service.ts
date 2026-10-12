import type { DbClient } from "../platform";

/** Urgent referrals must be acknowledged within 24h (escalation candidate rule). */
export function isReferralOverdue(createdAt: string | Date, now = new Date()): boolean {
  return now.getTime() - new Date(createdAt).getTime() > 24 * 60 * 60 * 1000;
}

/** Auto-escalate stale urgent referrals from pending to escalated. */
export async function escalateStaleUrgent(db: DbClient, actorProfileId: string) {
  // P11: push the 24h cutoff into the query (no full-table pull into JS),
  // then bulk-update + bulk-insert instead of 2 awaits per row.
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("referrals")
    .select("id")
    .eq("status", "pending")
    .eq("priority", "urgent")
    .lt("created_at", cutoff)
    .limit(500);
  if (error) throw error;
  const ids = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
  if (!ids.length) return 0;
  const { error: upErr } = await db
    .from("referrals")
    .update({ status: "escalated" })
    .in("id", ids)
    .eq("status", "pending");
  if (upErr) throw upErr;
  const { error: actErr } = await db.from("referral_actions").insert(
    ids.map((id) => ({
      referral_id: id,
      actor_profile_id: actorProfileId,
      action: "escalated",
      note: "Auto-escalated: urgent referral unacknowledged > 24h",
    })),
  );
  if (actErr) throw actErr;
  return ids.length;
}
