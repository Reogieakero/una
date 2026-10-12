/**
 * Booking measurement (service-level, mirrors apps/mobile booking + shared
 * bookAppointment service step-for-step). Steps:
 *  1. screen-load sequence (getUser + student lookup + latest PSS-10)
 *  2. counselors + slots load
 *  3. PSS-10 submit (insert)
 *  4. booking gate fetch
 *  5. slot-gate validation (slots + overlap reads, counselor-assigned only)
 *  6. booking insert (with idempotency key)
 *  7. notify lower bound (direct insert; route-level timing in mutations run)
 *  8. counselor-side visibility poll (read-your-write)
 * Variants: unassigned (no counselor) and counselor-assigned.
 * 20 measured runs per variant after 3 warm-ups. Counts REST calls per step.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadEnv, assertStaging, stats, fmtMs, row, timed } from "./lib.mjs";
import { readFileSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(HERE, "seed", "seed-manifest.json"), "utf8"));
const PASSWORD = process.env.PERF_PASSWORD || "Perf#Seed2026!";
const RUNS = 20;
const WARMUP = 3;

const env = loadEnv();
assertStaging(env.host);

// Count + time every REST call made by these clients.
const calls = [];
const origFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  const url = String(args[0]);
  const t0 = performance.now();
  try {
    return await origFetch(...args);
  } finally {
    const ms = performance.now() - t0;
    if (url.includes("/rest/v1/") || url.includes("/auth/v1/")) calls.push({ url: url.split("?")[0].slice(-60), ms });
  }
};

const anon = (email) =>
  createClient(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function signIn(email) {
  const c = anon(email);
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`signin ${email}: ${error.message}`);
  return c;
}

const baseSlot = new Date(manifest.slot_iso).getTime();
const slotFor = (run) => new Date(baseSlot + run * 7 * 86400000); // weekly steps stay in-slot
const endFor = (run) => new Date(slotFor(run).getTime() + 3600000);

async function screenLoad(student) {
  calls.length = 0;
  const tAuth0 = performance.now();
  const c = await signIn(student.email);
  const authMs = performance.now() - tAuth0;
  const t0 = performance.now();
  const { data: s } = await c.from("students").select("id").eq("profile_id", (await c.auth.getUser()).data.user.id).single();
  const { data: latest } = await c
    .from("pss10_assessments")
    .select("id, created_at")
    .eq("student_id", s.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { ms: performance.now() - t0, authMs, queries: calls.length, gateOk: !!latest, studentId: s.id, client: c };
}

async function counselorsAndSlots(c) {
  calls.length = 0;
  const t0 = performance.now();
  const { data: counselors } = await c.from("counselors").select("id, profile_id").limit(100);
  const cid = manifest.counselors[0].id;
  const { data: slots } = await c
    .from("counselor_availability")
    .select("weekday, start_time, end_time, is_recurring, valid_from, valid_to")
    .eq("counselor_id", cid);
  return { ms: performance.now() - t0, queries: calls.length, nCounselors: counselors.length, nSlots: slots.length };
}

async function pss10Submit(c, studentId) {
  calls.length = 0;
  const answers = [2, 1, 3, 2, 1, 2, 3, 1, 2, 2];
  const t0 = performance.now();
  const { data, error } = await c
    .from("pss10_assessments")
    .insert({ student_id: studentId, answers, item_scores: answers, total_score: 20, band: "moderate", stress_level: "moderate" })
    .select("id, created_at")
    .single();
  if (error) throw error;
  return { ms: performance.now() - t0, queries: calls.length, id: data.id, created_at: data.created_at };
}

async function bookingGate(c, studentId, gateId) {
  calls.length = 0;
  const t0 = performance.now();
  let gateDate;
  if (gateId) {
    const { data } = await c.from("pss10_assessments").select("id, created_at, student_id").eq("id", gateId).single();
    gateDate = data.created_at;
  } else {
    const { data } = await c
      .from("pss10_assessments")
      .select("id, created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    gateDate = data.created_at;
  }
  return { ms: performance.now() - t0, queries: calls.length, gateDate };
}

async function slotGate(c, counselorId, start, end) {
  calls.length = 0;
  const t0 = performance.now();
  await c.from("counselor_availability").select("weekday, start_time, end_time, is_recurring, valid_from, valid_to").eq("counselor_id", counselorId);
  const overlap = await c
    .from("appointments")
    .select("id, scheduled_at, ends_at")
    .eq("counselor_id", counselorId)
    .in("status", ["assigned", "confirmed"])
    .lt("scheduled_at", end.toISOString())
    .gt("scheduled_at", new Date(start.getTime() - 12 * 3600000).toISOString());
  void overlap;
  return { ms: performance.now() - t0, queries: calls.length };
}

async function bookingInsert(c, studentId, counselorId, start, end, gateId) {
  calls.length = 0;
  const t0 = performance.now();
  const key = crypto.randomUUID();
  const { data, error } = await c
    .from("appointments")
    .insert({
      student_id: studentId,
      counselor_id: counselorId,
      scheduled_at: start.toISOString(),
      ...(counselorId ? { ends_at: end.toISOString() } : {}),
      mode: "in_person",
      concern: "[perf] booking measurement",
      is_anonymous: false,
      pss10_id: gateId,
      idempotency_key: key,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw error;
  return { ms: performance.now() - t0, queries: calls.length, id: data.id };
}

async function counselorSees(counselorClient, apptId) {
  const t0 = performance.now();
  let polls = 0;
  for (;;) {
    polls++;
    const { data } = await counselorClient
      .from("appointments")
      .select("id")
      .eq("id", apptId)
      .maybeSingle();
    if (data) break;
    if (polls > 40) throw new Error("visibility timeout");
    await new Promise((r) => setTimeout(r, 100));
  }
  return { ms: performance.now() - t0, polls };
}

async function variant(assigned, runs) {
  const out = { screen: [], auth: [], slots: [], pss10: [], gate: [], slotgate: [], insert: [], visible: [], insertQueries: [] };
  const counselorClient = await signIn(manifest.counselors[0].email);
  const headClient = await signIn(manifest.head.email);
  const viewer = assigned ? counselorClient : headClient;
  for (let run = 0; run < runs + WARMUP; run++) {
    const measured = run >= WARMUP;
    const student = manifest.students[run % 20];
    try {
      const s = await screenLoad(student);
      const sl = await counselorsAndSlots(s.client);
      const p = await pss10Submit(s.client, s.studentId);
      const g = await bookingGate(s.client, s.studentId, p.id);
      let sg = { ms: 0, queries: 0 };
      const start = assigned ? slotFor(run) : new Date(baseSlot + run * 3600000);
      const end = endFor(run);
      if (assigned) sg = await slotGate(s.client, manifest.counselors[0].id, start, end);
      const ins = await bookingInsert(s.client, s.studentId, assigned ? manifest.counselors[0].id : null, start, end, p.id);
      const vis = await counselorSees(viewer, ins.id);
      if (measured) {
        out.screen.push(s.ms); out.auth.push(s.authMs); out.slots.push(sl.ms); out.pss10.push(p.ms);
        out.gate.push(g.ms); out.slotgate.push(sg.ms); out.insert.push(ins.ms);
        out.visible.push(vis.ms); out.insertQueries.push(ins.queries);
      }
    } catch (e) {
      if (measured) console.error(`  run ${run} FAILED: ${e.message}`);
    }
  }
  return out;
}

async function main() {
  console.log(`booking measurement: ${RUNS} runs × 2 variants (warmup ${WARMUP})`);
  const un = await variant(false, RUNS);
  const as = await variant(true, RUNS);
  mkdirSync(join(HERE, "results"), { recursive: true });
  const report = { at: new Date().toISOString(), unassigned: {}, assigned: {} };
  for (const [name, v] of [["unassigned", un], ["assigned", as]]) {
    console.log(`\n== ${name} ==`);
    for (const step of ["auth", "screen", "slots", "pss10", "gate", "slotgate", "insert", "visible"]) {
      if (!v[step].length) continue;
      const st = stats(v[step]);
      report[name][step] = st;
      console.log(`  ${row(step, st)}`);
    }
    const total = v.screen.map((_, i) => v.screen[i] + v.slots[i] + v.pss10[i] + v.gate[i] + v.slotgate[i] + v.insert[i]);
    const tst = stats(total);
    report[name].total_service = tst;
    console.log(`  ${row("TOTAL(service, excl. visibility poll)", tst)}`);
    console.log(`  insert REST calls/run: ${v.insertQueries.join(",")}`);
  }
  writeFileSync(join(HERE, "results", "booking.json"), JSON.stringify(report, null, 2));
  console.log("\nwrote results/booking.json");
}

main().catch((e) => {
  console.error("BOOKING_FAILED:", e.message);
  process.exit(1);
});
