import type { DbClient } from "../platform";

/** Urgent referrals must be acknowledged within 24h (escalation candidate rule). */
export function isReferralOverdue(createdAt: string | Date, now = new Date()): boolean {
  return now.getTime() - new Date(createdAt).getTime() > 24 * 60 * 60 * 1000;
}

/** Auto-escalate stale urgent referrals from pending to escalated. */
export async function escalateStaleUrgent(db: DbClient, actorProfileId: string) {
  const { data, error } = await db
    .from("referrals")
    .select("id, created_at")
    .eq("status", "pending")
    .eq("priority", "urgent");
  if (error) throw error;
  const now = new Date();
  const stale = ((data ?? []) as Array<{ id: string; created_at: string }>).filter((r) =>
    isReferralOverdue(r.created_at, now),
  );
  for (const r of stale) {
    await db.from("referrals").update({ status: "escalated" }).eq("id", r.id);
    await db.from("referral_actions").insert({
      referral_id: r.id,
      actor_profile_id: actorProfileId,
      action: "escalated",
      note: "Auto-escalated: urgent referral unacknowledged > 24h",
    });
  }
  return stale.length;
}
