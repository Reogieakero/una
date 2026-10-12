/**
 * Idempotent perf seed (STAGING ONLY — host gate enforced).
 * Creates, all prefixed/identifiable as perf data:
 *   1 head, 3 counselors, 5 faculty, 100 students (+ auth users),
 *   availability slots (Mon–Fri 09:00–17:00 Manila) for counselors,
 *   100 fresh PSS-10 (1 per student), 100 appointments (mixed statuses),
 *   20 chat threads + 500 messages, 20 referrals (+40 trail rows),
 *   10 announcements.
 * Writes a manifest to seed-manifest.json for measurement scripts.
 *
 * Deviations from the brief (safety): NO direct writes to audit_logs or
 * break_glass_logs (rule: never write those tables in tests). audit_events
 * rows arrive automatically via triggers on appointment/referral writes.
 *
 * Usage: node seed/seed.mjs [--reseed]
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadEnv, assertStaging, adminClient } from "../lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const RESEED = process.argv.includes("--reseed");
const PASSWORD = process.env.PERF_PASSWORD || "Perf#Seed2026!";
const TAG = "[perf]";

const { url, host, serviceKey } = loadEnv();
assertStaging(host);
const db = adminClient({ url, serviceKey });

// Manila wall clock (UTC+8, no DST): 10:00+08:00 == 02:00Z.
const MANILA = 8 * 3600 * 1000;
function nextWeekday10am(fromMs, addDays) {
  const d = new Date(fromMs + addDays * 86400000);
  // Snap forward to Mon–Fri in Manila time.
  for (let i = 0; i < 8; i++) {
    const manila = new Date(d.getTime() + MANILA);
    const wd = manila.getUTCDay();
    if (wd >= 1 && wd <= 5) break;
    d.setTime(d.getTime() + 86400000);
  }
  const m = new Date(d.getTime() + MANILA);
  return new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), m.getUTCDate(), 2, 0, 0));
}

async function existingUserMap(emails) {
  const map = new Map();
  let page = 1;
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) if (emails.includes(u.email)) map.set(u.email, u.id);
    if (data.users.length < 1000) break;
    page++;
    if (page > 20) break;
  }
  return map;
}

async function ensureUser(email, fullName) {
  const map = await existingUserMap([email]);
  if (map.has(email)) return map.get(email);
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) {
    // Race/duplicate: re-list once.
    if (/already|exists/i.test(error.message)) {
      const m2 = await existingUserMap([email]);
      if (m2.has(email)) return m2.get(email);
    }
    throw error;
  }
  return data.user.id;
}

async function upsertProfile(id, email, role, fullName) {
  const { error } = await db.from("profiles").upsert(
    { id, email, role, full_name: fullName, is_active: true },
    { onConflict: "id" },
  );
  if (error) throw error;
}

async function wipePerf() {
  console.log("reseed: wiping existing perf rows…");
  const { data: students } = await db.from("students").select("id").like("student_no", "PERF-%");
  const sids = (students ?? []).map((s) => s.id);
  if (sids.length) {
    const { data: threads } = await db.from("chat_threads").select("id").in("student_id", sids);
    const tids = (threads ?? []).map((t) => t.id);
    if (tids.length) {
      for (let i = 0; i < tids.length; i += 100)
        await db.from("chat_messages").delete().in("thread_id", tids.slice(i, i + 100));
      await db.from("chat_threads").delete().in("id", tids);
    }
    const { data: refs } = await db.from("referrals").select("id").in("student_id", sids);
    const rids = (refs ?? []).map((r) => r.id);
    if (rids.length) {
      await db.from("referral_actions").delete().in("referral_id", rids);
      await db.from("referrals").delete().in("id", rids);
    }
    await db.from("pss10_assessments").delete().in("student_id", sids);
    await db.from("appointments").delete().in("student_id", sids);
    await db.from("students").delete().in("id", sids);
  }
  await db.from("announcements").delete().like("title", `${TAG}%`);
  // Role rows + profiles + auth users for perf accounts.
  for (const t of ["counselors", "faculty_members", "guidance_heads"]) {
    const { data: rows } = await db.from(t).select("profile_id").like("employee_no", "PERF-%");
    for (const r of rows ?? []) {
      await db.from("profiles").delete().eq("id", r.profile_id);
    }
    await db.from(t).delete().like("employee_no", "PERF-%");
  }
  const { data: heads } = await db.from("profiles").select("id").like("email", "perf.head@%");
  for (const h of heads ?? []) {
    await db.from("profiles").delete().eq("id", h.id);
  }
  const map = await existingUserMap([]);
  void map;
  // Delete auth users by listing perf emails.
  const { data: all } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of all.users) {
    if (u.email && (u.email.startsWith("perf.") || u.email.startsWith("perf\\u002e"))) {
      await db.auth.admin.deleteUser(u.id).catch(() => {});
    }
  }
  console.log("reseed: wipe done.");
}

async function main() {
  if (RESEED) await wipePerf();

  // Probe: skip if seed looks present.
  const { count: studentCount } = await db
    .from("students")
    .select("id", { count: "exact", head: true })
    .like("student_no", "PERF-%");
  const { count: apptCount } = await db
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .like("concern", `${TAG}%`);
  if (!RESEED && (studentCount ?? 0) >= 100 && (apptCount ?? 0) >= 100) {
    console.log(`seed present (students=${studentCount}, appointments=${apptCount}), skipping. Use --reseed to rebuild.`);
    return;
  }

  const manifest = { created_at: new Date().toISOString(), counselors: [], faculty: [], students: [] };

  // ── Users ──
  console.log("creating users…");
  const headEmail = "perf.head@dorsu.edu.ph";
  const headUid = await ensureUser(headEmail, "Perf Head");
  await upsertProfile(headUid, headEmail, "guidance_head", "Perf Head");
  await db.from("guidance_heads").upsert({ profile_id: headUid }, { onConflict: "profile_id" });
  manifest.head = { profile_id: headUid, email: headEmail };

  for (let i = 1; i <= 3; i++) {
    const email = `perf.counselor0${i}@dorsu.edu.ph`;
    const uid = await ensureUser(email, `Perf Counselor 0${i}`);
    await upsertProfile(uid, email, "counselor", `Perf Counselor 0${i}`);
    const { data: c } = await db
      .from("counselors")
      .upsert(
        { profile_id: uid, employee_no: `PERF-C${i}`, specialization: "General" },
        { onConflict: "profile_id" },
      )
      .select("id")
      .single();
    manifest.counselors.push({ id: c.id, profile_id: uid, email });
  }
  for (let i = 1; i <= 5; i++) {
    const email = `perf.faculty0${i}@dorsu.edu.ph`;
    const uid = await ensureUser(email, `Perf Faculty 0${i}`);
    await upsertProfile(uid, email, "faculty", `Perf Faculty 0${i}`);
    const { data: f } = await db
      .from("faculty_members")
      .upsert({ profile_id: uid, employee_no: `PERF-F${i}`, department: "Perf Dept" }, { onConflict: "profile_id" })
      .select("id")
      .single();
    manifest.faculty.push({ id: f.id, profile_id: uid, email });
  }
  for (let i = 1; i <= 100; i++) {
    const n = String(i).padStart(3, "0");
    const email = `perf.student${n}@dorsu.edu.ph`;
    const uid = await ensureUser(email, `Perf Student ${n}`);
    await upsertProfile(uid, email, "student", `Perf Student ${n}`);
    const { data: s } = await db
      .from("students")
      .upsert(
        {
          profile_id: uid,
          student_no: `PERF-${n}`,
          program: "BS Perf",
          year_level: `${(i % 4) + 1}`,
          anonymous_alias: `Perf-${1000 + i}`,
        },
        { onConflict: "profile_id" },
      )
      .select("id, profile_id")
      .single();
    manifest.students.push({ id: s.id, profile_id: s.profile_id, email });
    if (i % 25 === 0) console.log(`  ${i}/100 students`);
  }

  // ── Availability (Mon–Fri 09:00–17:00 recurring) ──
  console.log("availability…");
  for (const c of manifest.counselors) {
    await db.from("counselor_availability").delete().eq("counselor_id", c.id);
    await db.from("counselor_availability").insert(
      [1, 2, 3, 4, 5].map((weekday) => ({
        counselor_id: c.id,
        weekday,
        start_time: "09:00",
        end_time: "17:00",
        is_recurring: true,
      })),
    );
  }

  // ── PSS-10: 1 fresh row per student ──
  console.log("pss10…");
  const answers = [2, 1, 3, 2, 1, 2, 3, 1, 2, 2];
  const total = answers.reduce((a, b) => a + b, 0);
  const band = total >= 27 ? "high" : total >= 14 ? "moderate" : "low";
  for (let i = 0; i < manifest.students.length; i += 50) {
    await db.from("pss10_assessments").insert(
      manifest.students.slice(i, i + 50).map((s) => ({
        student_id: s.id,
        answers,
        item_scores: answers,
        total_score: total,
        band,
        stress_level: band,
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })),
    );
  }

  // ── Appointments: 100 mixed ──
  console.log("appointments…");
  const now = Date.now();
  const plan = [
    ...Array(30).fill("pending"),
    ...Array(20).fill("assigned"),
    ...Array(20).fill("confirmed"),
    ...Array(15).fill("completed"),
    ...Array(10).fill("cancelled"),
    ...Array(5).fill("no_show"),
  ];
  const rows = plan.map((status, k) => {
    const student = manifest.students[k % manifest.students.length];
    const counselor = manifest.counselors[k % manifest.counselors.length];
    const hasCounselor = status !== "pending";
    const past = ["completed", "cancelled", "no_show"].includes(status) || k % 3 === 2;
    const at = past
      ? new Date(now - (k + 1) * 86400000).toISOString()
      : nextWeekday10am(now, 7 + (k % 21)).toISOString();
    return {
      student_id: student.id,
      counselor_id: hasCounselor ? counselor.id : null,
      scheduled_at: at,
      ends_at: ["confirmed", "assigned"].includes(status) ? new Date(new Date(at).getTime() + 3600000).toISOString() : null,
      requested_datetime: at,
      mode: k % 2 ? "online" : "in_person",
      status,
      concern: `${TAG} seed concern ${k + 1}`,
      is_anonymous: false,
    };
  });
  for (let i = 0; i < rows.length; i += 25) {
    const { error } = await db.from("appointments").insert(rows.slice(i, i + 25));
    if (error) throw error;
  }

  // ── Chat: 20 threads × 25 messages ──
  console.log("chat…");
  const threadIds = [];
  for (let t = 0; t < 20; t++) {
    const student = manifest.students[t];
    const counselor = manifest.counselors[t % manifest.counselors.length];
    const { data: th, error } = await db
      .from("chat_threads")
      .insert({ student_id: student.id, counselor_id: counselor.id, status: t % 5 === 4 ? "closed" : "open" })
      .select("id")
      .single();
    if (error) throw error;
    threadIds.push({ id: th.id, student, counselor });
  }
  let msgCount = 0;
  for (const th of threadIds) {
    const batch = [];
    for (let m = 0; m < 25; m++) {
      const fromStudent = m % 2 === 0;
      batch.push({
        thread_id: th.id,
        sender_profile_id: fromStudent ? th.student.profile_id : th.counselor.profile_id,
        body: `${TAG} thread message ${m + 1}/25`,
        created_at: new Date(now - (25 - m) * 60000).toISOString(),
      });
    }
    const { error } = await db.from("chat_messages").insert(batch);
    if (error) throw error;
    msgCount += batch.length;
  }
  console.log(`  messages=${msgCount}`);

  // ── Referrals: 20 + trail ──
  console.log("referrals…");
  const refStatuses = ["pending", "pending", "pending", "pending", "pending", "pending", "assigned", "assigned", "assigned", "assigned", "assigned", "assigned", "confirmed", "confirmed", "confirmed", "resolved", "resolved", "resolved", "escalated", "escalated"];
  const priorities = ["low", "medium", "high", "urgent"];
  for (let r = 0; r < 20; r++) {
    const faculty = manifest.faculty[r % manifest.faculty.length];
    const student = manifest.students[20 + r];
    const status = refStatuses[r];
    const assigned = ["assigned", "confirmed", "resolved", "escalated"].includes(status)
      ? manifest.counselors[r % manifest.counselors.length].id
      : null;
    const { data: ref, error } = await db
      .from("referrals")
      .insert({
        referring_faculty_id: faculty.id,
        student_id: student.id,
        reason: `${TAG} referral reason ${r + 1}`,
        priority: priorities[r % priorities.length],
        status,
        assigned_counselor_id: assigned,
        case_classification: [],
      })
      .select("id")
      .single();
    if (error) throw error;
    await db.from("referral_actions").insert([
      { referral_id: ref.id, actor_profile_id: faculty.profile_id, action: "pending", action_taken: "pending", note: `${TAG} filed` },
      { referral_id: ref.id, actor_profile_id: assigned ? manifest.counselors[r % manifest.counselors.length].profile_id : headUid, action: status, action_taken: status, note: `${TAG} triaged to ${status}` },
    ]);
  }

  // ── Announcements: 10 ──
  console.log("announcements…");
  await db.from("announcements").insert(
    Array.from({ length: 10 }, (_, k) => ({
      author_profile_id: headUid,
      title: `${TAG} Announcement ${k + 1}`,
      body: `${TAG} seeded announcement body ${k + 1}.`,
      published_at: new Date(now - k * 86400000).toISOString(),
    })),
  );

  manifest.slot_iso = nextWeekday10am(now, 60).toISOString();
  writeFileSync(join(HERE, "seed-manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("seed complete. manifest.slot_iso =", manifest.slot_iso);
}

main().catch((e) => {
  console.error("SEED_FAILED:", e.message);
  process.exit(1);
});
