import type { DbClient } from "../platform";

/** Analytics reads the PII-free daily summary view (head/admin only via RLS-adjacent guard). */
export async function getDailySummary(db: DbClient, days = 30) {
  const { data, error } = await db
    .from("analytics_daily_summary")
    .select("*")
    .order("day", { ascending: false })
    .limit(days);
  if (error) throw error;
  return data;
}

/** Average PSS-10 by band for the reporting window (computed from summary view). */
export async function getStressOverview(db: DbClient, days = 30) {
  const rows = (await getDailySummary(db, days)) as Array<{
    total_appointments?: number | null;
    completed_appointments?: number | null;
    high_stress_count?: number | null;
    total_referrals?: number | null;
  }>;
  const totals = rows.reduce(
    (acc: { appointments: number; completed: number; high: number; referrals: number }, r) => ({
      appointments: acc.appointments + (r.total_appointments ?? 0),
      completed: acc.completed + (r.completed_appointments ?? 0),
      high: acc.high + (r.high_stress_count ?? 0),
      referrals: acc.referrals + (r.total_referrals ?? 0),
    }),
    { appointments: 0, completed: 0, high: 0, referrals: 0 },
  );
  return { days, ...totals };
}
