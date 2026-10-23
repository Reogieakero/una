/**
 * Concurrency tests (STAGING ONLY — host gate enforced).
 * E1: 50 assigned appointments on DISTINCT slots are concurrently re-confirmed
 *     into the SAME counselor + target slot. The app-level overlap gate is
 *     check-then-write (racy); the 00059 exclusion constraint is the backstop.
 *     Expect EXACTLY 1 confirmed at the target slot and 49 rejected with 23P01.
 *
 *     Why distinct setup slots: the constraint also protects `assigned` rows,
 *     so seeding 50 assigned rows in one slot would fail before the race. The
 *     race being tested is the confirmation move into a contended slot.
 *
 * E2: 50 concurrent booking inserts on distinct slots (throughput sanity).
 * Cleans up: race rows + measurement bookings are cancelled afterwards
 * (keeps the staging board usable; verification queries run first).
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadEnv, assertStaging, stats, fmtMs, row } from "./lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(HERE, "seed", "seed-manifest.json"), "utf8"));
const PASSWORD = process.env.PERF_PASSWORD || "Perf#Seed2026!";
const N = 50;

const env = loadEnv();
assertStaging(env.host);

const MANILA = 8 * 3600 * 1000;
function futureWeekday10am(addDays) {
  const d = new Date(Date.now() + addDays * 86400000);
  for (let i = 0; i < 8; i++) {
    const m = new Date(d.getTime() + MANILA);
    if (m.getUTCDay() >= 1 && m.getUTCDay() <= 5) break;
    d.setTime(d.getTime() + 86400000);
  }
  const m = new Date(d.getTime() + MANILA);
  return new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), m.getUTCDate(), 2, 0, 0));
}

async function signIn(email) {
  const c = createClient(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return c;
}

// Mirror of confirmAppointment(..., scheduledAt, null, endsAt) query sequence.
async function confirmOnce(c, apptId, start, end) {
  const t0 = performance.now();
  try {
    const { data: current } = await c.from("appointments").select("mode, status, counselor_id").eq("id", apptId).single();
    if (!current || current.status !== "assigned") throw new Error(`bad-state:${current?.status}`);
    await c.from("counselor_availability").select("weekday, start_time, end_time, is_recurring, valid_from, valid_to").eq("counselor_id", current.counselor_id);
    await c.from("appointments").select("id, scheduled_at, ends_at").eq("counselor_id", current.counselor_id).in("status", ["assigned", "confirmed"]).lt("scheduled_at", end.toISOString());
    const { error } = await c.from("appointments").update({ status: "confirmed", scheduled_at: start.toISOString(), ends_at: end.toISOString() }).eq("id", apptId).eq("status", "assigned");
    if (error) throw error;
    return { ok: true, ms: performance.now() - t0 };
  } catch (e) {
    return { ok: false, ms: performance.now() - t0, code: e.code || null, msg: String(e.message || e).slice(0, 120) };
  }
}

async function main() {
  // Service key via env file (never logged).
  const { readFileSync: rf } = await import("node:fs");
  const rootEnv = rf(join(HERE, "..", ".env"), "utf8");
  const skey = rootEnv.split("\n").find((l) => l.startsWith("SUPABASE_SERVICE_ROLE_KEY=")).split("=").slice(1).join("=").trim();
  const svc = createClient(env.url, skey, { auth: { persistSession: false, autoRefreshToken: false } });

  const counselor = manifest.counselors[0];
  const cc = await signIn(counselor.email);
  const raceStart = futureWeekday10am(160);
  const raceEnd = new Date(raceStart.getTime() + 3600000);
  console.log(`E1: target slot ${raceStart.toISOString()} counselor ${counselor.id}`);

  // Target slot must be clear before the race; otherwise the result is not
  // attributable to the concurrent confirms.
  const { data: activeRows, error: activeErr } = await svc
    .from("appointments")
    .select("id, scheduled_at, ends_at, status")
    .eq("counselor_id", counselor.id)
    .in("status", ["assigned", "confirmed"]);
  if (activeErr) throw activeErr;
  const conflicts = (activeRows ?? []).filter((a) => {
    const s = new Date(a.scheduled_at).getTime();
    const e = a.ends_at ? new Date(a.ends_at).getTime() : s + 3600000;
    return s < raceEnd.getTime() && e > raceStart.getTime();
  });
  if (conflicts.length) {
    throw new Error(`target slot already has ${conflicts.length} active row(s); pick another day`);
  }

  // Setup: 50 assigned appointments on distinct, non-overlapping slots.
  // They are moved into the contended target slot by the concurrent confirms.
  const ids = [];
  for (let i = 0; i < N; i += 10) {
    const batch = manifest.students.slice(i, i + 10).map((s, j) => {
      const slot = new Date(raceStart.getTime() + (i + j + 1) * 3 * 3600000);
      return {
        student_id: s.id,
        counselor_id: counselor.id,
        scheduled_at: slot.toISOString(),
        ends_at: new Date(slot.getTime() + 3600000).toISOString(),
        mode: "in_person",
        status: "assigned",
        concern: "[perf] race confirm",
      };
    });
    const { data, error } = await svc.from("appointments").insert(batch).select("id");
    if (error) throw error;
    ids.push(...data.map((r) => r.id));
  }
  console.log(`  setup: ${ids.length} assigned rows on distinct slots`);

  const t0 = performance.now();
  const results = await Promise.all(ids.map((id) => confirmOnce(cc, id, raceStart, raceEnd)));
  const wall = performance.now() - t0;
  const ok = results.filter((r) => r.ok);
  const fail = results.filter((r) => !r.ok);
  const byCode = {};
  for (const f of fail) {
    const k = f.code || f.msg.slice(0, 40);
    byCode[k] = (byCode[k] || 0) + 1;
  }
  console.log(`  success=${ok.length} fail=${fail.length} wall=${fmtMs(wall)}`);
  console.log(`  fail breakdown: ${JSON.stringify(byCode)}`);
  console.log(`  confirm latency: ${row("confirm", stats(results.map((r) => r.ms)))}`);

  // Ground truth from service role.
  const { data: states } = await svc
    .from("appointments")
    .select("id, status, scheduled_at, ends_at")
    .in("id", ids);
  const confirmed = states.filter((r) => r.status === "confirmed");
  const atTarget = confirmed.filter(
    (r) => new Date(r.scheduled_at).getTime() === raceStart.getTime(),
  );
  const stillAssigned = states.filter((r) => r.status === "assigned");
  console.log(`  final: confirmed=${confirmed.length}, at-target=${atTarget.length} (expected exactly 1 at target)`);
  console.log(`  remaining assigned: ${stillAssigned.length} (expected ${N - 1})`);
  const pass =
    confirmed.length === 1 &&
    atTarget.length === 1 &&
    stillAssigned.length === N - 1 &&
    ok.length === 1 &&
    fail.length === N - 1;
  console.log(pass ? "  E1 PASS" : "  E1 FAIL — DOUBLE BOOKING OR LOST UPDATE (CRITICAL if >1 confirmed)");

  // Cleanup race rows.
  await svc.from("appointments").update({ status: "cancelled" }).in("id", ids);
  console.log("  race rows cancelled.");

  // E2: 50 concurrent inserts, distinct slots.
  console.log("E2: 50 concurrent booking inserts (distinct slots)…");
  const student = manifest.students[0];
  const sc = await signIn(student.email);
  const t1 = performance.now();
  const ins = await Promise.all(
    Array.from({ length: N }, (_, i) =>
      sc.from("appointments").insert({
        student_id: student.id,
        counselor_id: null,
        scheduled_at: new Date(raceStart.getTime() + (i + 1) * 3600000).toISOString(),
        mode: "in_person",
        status: "pending",
        concern: "[perf] race insert",
        is_anonymous: false,
        idempotency_key: crypto.randomUUID(),
      }).then(
        () => ({ ok: true }),
        (e) => ({ ok: false, msg: String(e.message).slice(0, 80) }),
      )
    ),
  );
  const wall2 = performance.now() - t1;
  const ok2 = ins.filter((r) => r.ok).length;
  console.log(`  success=${ok2}/${N} wall=${fmtMs(wall2)} ${ok2 === N ? "E2 PASS" : "E2 FAIL"}`);
  await svc.from("appointments").delete().like("concern", "[perf] race insert%");
  // Cancel measurement bookings too (keep staging board clean).
  await svc.from("appointments").update({ status: "cancelled" }).like("concern", "[perf] booking measurement%");
  console.log("  cleanup done.");

  mkdirSync(join(HERE, "results"), { recursive: true });
  writeFileSync(join(HERE, "results", "concurrency.json"), JSON.stringify({
    at: new Date().toISOString(),
    e1: { success: ok.length, fail: fail.length, byCode, confirmed: confirmed.length, pass, wallMs: wall, latency: stats(results.map((r) => r.ms)) },
    e2: { success: ok2, total: N, pass: ok2 === N, wallMs: wall2 },
  }, null, 2));
  console.log("wrote results/concurrency.json");
  if (!pass) process.exit(3);
}

main().catch((e) => {
  console.error("CONCURRENCY_FAILED:", e.message);
  process.exit(1);
});
