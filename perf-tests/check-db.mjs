/** One-off: verify which perf migrations actually exist on staging. */
import { withPg, dbHost } from "./db.mjs";

await withPg(async (pool) => {
  console.log("pg host:", dbHost());
  const c = await pool.query(
    "select conname from pg_constraint where conname = 'no_counselor_overlap'",
  );
  console.log("exclusion constraint:", JSON.stringify(c.rows));
  const f = await pool.query(
    "select proname from pg_proc where proname in ('head_appointment_daily_counts','head_referral_status_counts','is_thread_participant')",
  );
  console.log("rpcs/helpers:", JSON.stringify(f.rows));
  const i = await pool.query(
    "select indexname from pg_indexes where indexname in ('appointments_counselor_status_sched_idx','chat_messages_thread_created_idx','referrals_assigned_status_idx','notifications_profile_read_created_idx')",
  );
  console.log("phase1 indexes:", JSON.stringify(i.rows));
  const g = await pool.query(
    "select count(*)::int as n from pg_policies where schemaname='public' and qual like '%(select auth.uid())%'",
  );
  console.log("policies using (select auth.uid()):", g.rows[0].n);
}).catch((e) => {
  console.error("PG_FAIL:", e.message);
  process.exit(1);
});
