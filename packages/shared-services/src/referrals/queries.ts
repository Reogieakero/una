import type { DbClient } from "../platform";

/** List referrals visible to a counselor queue (pure read, RLS scopes rows). */
export async function listReferrals(db: DbClient, opts?: { status?: string }) {
  let q = db.from("referrals").select("*").order("created_at", { ascending: false });
  if (opts?.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

/** Fetch one referral with its action trail (pure read). */
export async function getReferralDetail(db: DbClient, referralId: string) {
  const { data, error } = await db
    .from("referrals")
    .select("*, actions:referral_actions(*)")
    .eq("id", referralId)
    .single();
  if (error) throw error;
  return data;
}
