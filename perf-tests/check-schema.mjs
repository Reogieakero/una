/**
 * Read-only schema regression check (STAGING ONLY).
 *
 * Guards the P0 deployment drift found on 2026-10-24:
 *   - `no_counselor_overlap` was missing because 00059 swallowed the error *and*
 *     used a STABLE index expression (`scheduled_at + interval`), so it could
 *     never be created even on clean data.
 *   - `00061` report RPCs were never applied.
 *   - the 00059 composite indexes were absent.
 *
 * Exit code 0 = all required objects exist. Non-zero = drift; deploy is unsafe.
 * Run after every migration: `node check-schema.mjs` / `npm run check:schema`.
 */
import { withPg, dbHost } from "./db.mjs";

const REQUIRED_INDEXES = [
  "appointments_counselor_status_sched_idx",
  "appointments_status_sched_idx",
  "appointments_student_sched_idx",
  "referrals_assigned_status_idx",
  "referrals_status_created_idx",
  "chat_messages_thread_created_idx",
  "notifications_profile_read_created_idx",
  "pss10_student_created_idx",
  "audit_logs_created_idx",
  "audit_events_created_idx",
  "referral_actions_referral_created_idx",
  "staff_messages_recipient_read_idx",
];

const REQUIRED_FUNCTIONS = [
  "head_appointment_daily_counts",
  "head_referral_status_counts",
];

const problems = [];

await withPg(async (pool) => {
  console.log("pg host:", dbHost());

  const constraint = await pool.query(
    `select conname, convalidated
       from pg_constraint
      where conname = 'no_counselor_overlap'`,
  );
  if (constraint.rowCount !== 1) {
    problems.push("no_counselor_overlap is missing");
  } else if (!constraint.rows[0].convalidated) {
    problems.push("no_counselor_overlap exists but is NOT VALID");
  } else {
    console.log("ok: no_counselor_overlap (validated)");
  }

  const ext = await pool.query(
    `select 1 from pg_extension where extname = 'btree_gist'`,
  );
  if (ext.rowCount !== 1) problems.push("btree_gist extension is missing");
  else console.log("ok: btree_gist");

  const fns = await pool.query(
    `select proname from pg_proc
      where proname = any($1::text[])`,
    [REQUIRED_FUNCTIONS],
  );
  const present = new Set(fns.rows.map((r) => r.proname));
  for (const name of REQUIRED_FUNCTIONS) {
    if (present.has(name)) console.log(`ok: function ${name}`);
    else problems.push(`function ${name} is missing`);
  }

  const idx = await pool.query(
    `select indexname from pg_indexes
      where schemaname = 'public' and indexname = any($1::text[])`,
    [REQUIRED_INDEXES],
  );
  const idxPresent = new Set(idx.rows.map((r) => r.indexname));
  for (const name of REQUIRED_INDEXES) {
    if (idxPresent.has(name)) console.log(`ok: index ${name}`);
    else problems.push(`index ${name} is missing`);
  }

  const trigger = await pool.query(
    `select tgname from pg_trigger
      where tgname = 'appointments_set_ends_at' and not tgisinternal`,
  );
  if (trigger.rowCount === 1) console.log("ok: appointments_set_ends_at trigger");
  else problems.push("appointments_set_ends_at trigger is missing");

  const nullEnds = await pool.query(
    `select count(*)::int as n from public.appointments where ends_at is null`,
  );
  if (nullEnds.rows[0].n > 0) {
    problems.push(`${nullEnds.rows[0].n} appointment(s) still have null ends_at`);
  } else {
    console.log("ok: every appointment has ends_at");
  }
}).catch((e) => {
  console.error("check-schema failed to query the database:", e.message);
  process.exit(2);
});

if (problems.length) {
  console.error("\nSCHEMA DRIFT:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("\nSCHEMA OK");
