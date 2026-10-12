/**
 * Database supplement (STAGING ONLY): EXPLAIN (ANALYZE, BUFFERS) for the 10
 * slowest-seen query shapes + pg_stat_statements top 20.
 * RLS-inclusive plans: SET ROLE authenticator + request.jwt.claims (falls
 * back to plain plans if the pooler role forbids it). Small-table caveat:
 * plan choice on tiny tables proves nothing about indexes — timings and
 * buffer counts are reported, index conclusions stay static (see report).
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { withPg, explain, topStatements } from "./db.mjs";
import { loadEnv, assertStaging } from "./lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(HERE, "seed", "seed-manifest.json"), "utf8"));
const env = loadEnv();
assertStaging(env.host);

const C = manifest.counselors[0];
const S = manifest.students[0];
const H = manifest.head;

const QUERIES = [
  ["appointments counselor queue", `select id, student_id, counselor_id, scheduled_at, ends_at, mode, status, concern from appointments where counselor_id = '${C.id}' order by scheduled_at asc limit 300`],
  ["chat messages by thread", `select id, thread_id, sender_profile_id, body, created_at from chat_messages where thread_id = (select id from chat_threads limit 1) order by created_at desc limit 50`],
  ["referrals open", `select id, status, priority, created_at from referrals where status in ('pending','assigned','acknowledged','in_progress','confirmed','escalated') order by created_at desc limit 200`],
  ["referrals unassigned", `select id from referrals where status in ('pending','assigned','acknowledged','in_progress','confirmed','escalated') and assigned_counselor_id is null order by created_at desc limit 5`],
  ["head week RPC", `select * from head_appointment_daily_counts(now() - interval '7 days', now() + interval '1 day')`],
  ["head status RPC", `select * from head_referral_status_counts()`],
  ["notifications unread", `select id from notifications where profile_id = '${H.profile_id}' and is_read = false order by created_at desc limit 200`],
  ["alias IN-list", `select id, anonymous_alias from students where id in (select student_id from appointments limit 100)`],
  ["pss10 latest", `select id, created_at from pss10_assessments where student_id = '${S.id}' order by created_at desc limit 1`],
  ["referral trail", `select id, action, created_at from referral_actions where referral_id = (select id from referrals limit 1) order by created_at desc`],
];

await withPg(async (pool) => {
  const out = { at: new Date().toISOString(), plans: [], rls: null, top: null };
  // RLS-inclusive context: PostgREST serves app traffic as role
  // `authenticated` (authenticator is only the login role), with the JWT
  // subject in request.jwt.claims — mirror that here.
  let rlsMode = "plain (pooler login role bypasses RLS)";
  try {
    await pool.query("SET ROLE authenticated");
    await pool.query(`SET request.jwt.claims = '{"sub":"${C.profile_id}","role":"authenticated"}'`);
    rlsMode = `authenticated as counselor profile ${C.profile_id}`;
  } catch (e) {
    console.log(`RLS context unavailable (${e.message.slice(0, 80)}); plain plans.`);
  }
  out.rls = rlsMode;
  for (const [name, sql] of QUERIES) {
    try {
      const r = await explain(pool, sql);
      const node = r.plan;
      out.plans.push({
        name,
        execMs: r.execMs,
        planningMs: r.planningMs,
        node: node["Node Type"],
        rows: node["Actual Rows"],
        buffers_hit: node["Shared Hit Blocks"] ?? null,
        buffers_read: node["Shared Read Blocks"] ?? null,
        index: node["Index Name"] ?? null,
      });
      const p = out.plans[out.plans.length - 1];
      console.log(`${name}: exec=${p.execMs}ms plan=${p.planningMs}ms node=${p.node} rows=${p.rows} idx=${p.index}`);
    } catch (e) {
      out.plans.push({ name, error: e.message.slice(0, 160) });
      console.log(`${name}: ERROR ${e.message.slice(0, 120)}`);
    }
  }
  try {
    await pool.query("RESET ROLE");
  } catch {}
  out.top = await topStatements(pool, 20);
  console.log("pg_stat_statements top5:", JSON.stringify((out.top ?? []).slice(0, 5)));
  mkdirSync(join(HERE, "results"), { recursive: true });
  writeFileSync(join(HERE, "results", "explain.json"), JSON.stringify(out, null, 2));
  console.log("wrote results/explain.json");
}).catch((e) => {
  console.error("EXPLAIN_FAILED:", e.message);
  process.exit(1);
});
