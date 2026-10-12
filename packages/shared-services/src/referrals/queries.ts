import type { DbClient } from "../platform";

export const REFERRAL_LIST_COLS =
  "id, referring_faculty_id, referring_personnel_id, student_id, student_name_text, student_no_text, reason, priority, student_gender, student_age, relation_to_client, case_classification, classification_other, status, assigned_counselor_id, created_at, updated_at";

/** Hard ceiling — the pager never asks for more (plan: 10/25/50, max 50). */
export const MAX_REFERRAL_PAGE_SIZE = 50;

export type ReferralCursor = { created_at: string; id: string };

export type ReferralsPage = {
  rows: unknown[];
  /** Cursor for the NEXT page (null when this was the last page). */
  nextCursor: ReferralCursor | null;
  hasMore: boolean;
};

/**
 * Keyset page of referrals (pure read, RLS scopes rows).
 * Ordering is (created_at DESC, id DESC) so pages are stable under realtime
 * inserts; silence about OFFSET — deep pages stay O(1).
 */
export async function listReferralPage(
  db: DbClient,
  opts?: {
    status?: string;
    priority?: string;
    /** Counselor id, or the literal "unassigned" for the null-assignee view. */
    assignee?: string;
    limit?: number;
    cursor?: ReferralCursor | null;
  },
): Promise<ReferralsPage> {
  const size = Math.min(Math.max(opts?.limit ?? 25, 1), MAX_REFERRAL_PAGE_SIZE);
  let q = db
    .from("referrals")
    .select(REFERRAL_LIST_COLS)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(size + 1);
  if (opts?.status && opts.status !== "all") q = q.eq("status", opts.status);
  if (opts?.priority && opts.priority !== "all") q = q.eq("priority", opts.priority);
  if (opts?.assignee && opts.assignee !== "all") {
    q = opts.assignee === "unassigned" ? q.is("assigned_counselor_id", null) : q.eq("assigned_counselor_id", opts.assignee);
  }
  if (opts?.cursor) {
    // (created_at, id) < (cursor) under DESC/DESC ordering. Values ride
    // URLSearchParams encoding, so ISO colons/offsets survive intact.
    q = q.or(
      `created_at.lt.${opts.cursor.created_at},and(created_at.eq.${opts.cursor.created_at},id.lt.${opts.cursor.id})`,
    );
  }
  const { data, error } = await q;
  if (error) throw error;
  const all = (data ?? []) as Array<{ id: string; created_at: string }>;
  const hasMore = all.length > size;
  const rows = hasMore ? all.slice(0, size) : all;
  const last = rows[rows.length - 1];
  return { rows, nextCursor: hasMore && last ? { created_at: last.created_at, id: last.id } : null, hasMore };
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
