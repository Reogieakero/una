/**
 * Mutation timing (service-level, signed-in clients mirroring the exact
 * service query sequences). 20 runs each after 3 warm-ups:
 *  chat thread send, staff DM send, faculty referral submit, referral
 *  triage (update + trail), feedback submit, student reschedule, counselor
 *  reschedule (full gate), student cancel, announcement create/delete.
 * Tagged '[perf-m]' rows are cleaned up at the end.
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadEnv, assertStaging, stats, row, timed } from "./lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(HERE, "seed", "seed-manifest.json"), "utf8"));
const PASSWORD = process.env.PERF_PASSWORD || "Perf#Seed2026!";
const RUNS = 20;
const WARMUP = 3;
const TAG = "[perf-m]";

const env = loadEnv();
assertStaging(env.host);
const rootEnv = readFileSync(join(HERE, "..", ".env"), "utf8");
const skey = rootEnv.split("\n").find((l) => l.startsWith("SUPABASE_SERVICE_ROLE_KEY=")).split("=").slice(1).join("=").trim();
const svc = createClient(env.url, skey, { auth: { persistSession: false, autoRefreshToken: false } });

async function signIn(email) {
  const c = createClient(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return c;
}

async function loop(name, n, fn, cleanup) {
  const samples = [];
  for (let i = 0; i < n + WARMUP; i++) {
    try {
      const { ms } = await timed(() => fn(i));
      if (i >= WARMUP) samples.push(ms);
    } catch (e) {
      if (i >= WARMUP) console.error(`  ${name} run ${i} FAILED: ${String(e.message || e).slice(0, 120)}`);
    }
  }
  const st = stats(samples);
  console.log(`  ${row(name, st)}`);
  if (cleanup) await cleanup().catch((e) => console.error(`  ${name} cleanup: ${e.message}`));
  return st;
}

async function main() {
  const out = {};
  const counselor = await signIn(manifest.counselors[1].email);
  const counselorId = manifest.counselors[1].id;
  const faculty = await signIn(manifest.faculty[0].email);
  const facultyId = manifest.faculty[0].id;
  const student = await signIn(manifest.students[50].email);
  const studentId = manifest.students[50].id;
  const head = await signIn(manifest.head.email);

  // Thread for chat sends (seed thread of counselor01/student01 — visible to counselor02? NO.
  // Use own thread: create one for counselor02 + student51).
  const { data: th } = await svc.from("chat_threads").insert({ student_id: studentId, counselor_id: counselorId, status: "open" }).select("id").single();
  const threadId = th.id;

  console.log("mutations (20 runs each):");
  out.chatSend = await loop("chat thread send (insert+bump)", RUNS, async () => {
    const { data: m } = await counselor.from("chat_messages").insert({ thread_id: threadId, sender_profile_id: manifest.counselors[1].profile_id, body: `${TAG} send` }).select("id").single();
    await counselor.from("chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
    return m;
  });

  out.dmSend = await loop("staff DM send", RUNS, async () => {
    await counselor.from("staff_messages").insert({ sender_profile_id: manifest.counselors[1].profile_id, recipient_profile_id: manifest.head.profile_id, body: `${TAG} dm` });
  });

  const refIds = [];
  out.referralSubmit = await loop("faculty referral submit", RUNS, async (i) => {
    const { data } = await faculty.from("referrals").insert({
      referring_faculty_id: facultyId, student_id: manifest.students[60 + (i % 20)].id,
      reason: `${TAG} referral ${i}`, priority: "medium", status: "pending", case_classification: [],
    }).select("id").single();
    refIds.push(data.id);
  });

  out.referralTriage = await loop("referral triage (update+trail)", RUNS, async (i) => {
    const id = refIds[i % refIds.length] ?? refIds[0];
    // Assign as head (head client triages): use head for realism.
    await head.from("referrals").update({ status: "assigned", assigned_counselor_id: counselorId }).eq("id", id);
    await head.from("referral_actions").insert({ referral_id: id, actor_profile_id: manifest.head.profile_id, action: "assigned", action_taken: "assigned", note: `${TAG} triage` });
  });

  out.feedback = await loop("feedback submit", RUNS, async (i) => {
    const { data: appts } = await svc.from("appointments").select("id").eq("student_id", studentId).eq("status", "completed").limit(1);
    void appts;
    // Each run needs a fresh completed appointment (unique feedback/appointment).
    const { data: a } = await svc.from("appointments").insert({
      student_id: studentId, counselor_id: counselorId,
      scheduled_at: new Date(Date.now() - 86400000).toISOString(),
      mode: "in_person", status: "completed", concern: `${TAG} feedback appt ${i}`,
    }).select("id").single();
    await student.from("feedback").insert({ appointment_id: a.id, student_id: studentId, rating: 4, comment: `${TAG} good` });
  });

  out.studentReschedule = await loop("student reschedule", RUNS, async () => {
    const { data: a } = await svc.from("appointments").insert({
      student_id: studentId, counselor_id: null,
      scheduled_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      mode: "in_person", status: "pending", concern: `${TAG} resched`,
    }).select("id").single();
    await student.from("appointments").update({ scheduled_at: new Date(Date.now() + 8 * 86400000).toISOString() }).eq("id", a.id).in("status", ["pending", "assigned", "confirmed"]);
  });

  out.cancel = await loop("student cancel", RUNS, async () => {
    const { data: a } = await svc.from("appointments").insert({
      student_id: studentId, counselor_id: null,
      scheduled_at: new Date(Date.now() + 9 * 86400000).toISOString(),
      mode: "in_person", status: "pending", concern: `${TAG} cancel`,
    }).select("id").single();
    await student.from("appointments").update({ status: "cancelled" }).eq("id", a.id).in("status", ["pending", "assigned", "confirmed"]);
  });

  out.announce = await loop("announcement create", RUNS, async (i) => {
    await head.from("announcements").insert({ author_profile_id: manifest.head.profile_id, title: `${TAG} announce ${i}`, body: `${TAG} body`, published_at: new Date().toISOString() });
  });

  console.log("cleanup [perf-m] rows…");
  await svc.from("chat_messages").delete().like("body", `${TAG}%`);
  await svc.from("chat_threads").delete().eq("id", threadId);
  await svc.from("staff_messages").delete().like("body", `${TAG}%`);
  for (const id of refIds) {
    await svc.from("referral_actions").delete().eq("referral_id", id);
    await svc.from("referrals").delete().eq("id", id);
  }
  await svc.from("feedback").delete().like("comment", `${TAG}%`);
  await svc.from("appointments").delete().like("concern", `${TAG}%`);
  await svc.from("announcements").delete().like("title", `${TAG}%`);
  console.log("cleanup done.");

  mkdirSync(join(HERE, "results"), { recursive: true });
  writeFileSync(join(HERE, "results", "mutations.json"), JSON.stringify({ at: new Date().toISOString(), ...out }, null, 2));
  console.log("wrote results/mutations.json");
}

main().catch((e) => {
  console.error("MUTATIONS_FAILED:", e.message);
  process.exit(1);
});
