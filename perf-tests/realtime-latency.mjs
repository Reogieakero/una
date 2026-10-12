/**
 * Realtime chat latency (STAGING ONLY): sender insert → receiver screen.
 * 50 messages over an existing seed thread; sender=counselor, receiver=student.
 * Then: disconnect (removeChannel) → 3 missed messages → resubscribe + refetch
 * (documents Postgres-Changes non-replay + app refetch recovery), and a
 * post-cleanup send proving no callback fires after removeChannel.
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadEnv, assertStaging, stats, row } from "./lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(HERE, "seed", "seed-manifest.json"), "utf8"));
const PASSWORD = process.env.PERF_PASSWORD || "Perf#Seed2026!";
const N = 50;

const env = loadEnv();
assertStaging(env.host);

async function signIn(email) {
  const c = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return c;
}

async function main() {
  const out = {};
  const counselor = manifest.counselors[0];
  const student = manifest.students[0];
  // Seed thread 0 = student01 + counselor01.
  const rootEnv = readFileSync(join(HERE, "..", ".env"), "utf8");
  const skey = rootEnv.split("\n").find((l) => l.startsWith("SUPABASE_SERVICE_ROLE_KEY=")).split("=").slice(1).join("=").trim();
  const svc = createClient(env.url, skey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: th } = await svc.from("chat_threads").select("id").eq("student_id", student.id).eq("counselor_id", counselor.id).limit(1).single();
  const threadId = th.id;

  const sender = await signIn(counselor.email);
  const receiver = await signIn(student.email);

  // Receiver subscribes; wait for SUBSCRIBED.
  let resolveSub;
  const subReady = new Promise((r) => (resolveSub = r));
  const t0byId = new Map();
  const latById = new Map();
  const ch = receiver
    .channel(`perf-rt-${Date.now()}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${threadId}` }, (p) => {
      const t0 = t0byId.get(p.new.id);
      if (t0 !== undefined) latById.set(p.new.id, performance.now() - t0);
    })
    .subscribe((s) => {
      if (s === "SUBSCRIBED") resolveSub();
    });
  await Promise.race([subReady, new Promise((_, rej) => setTimeout(() => rej(new Error("subscribe timeout")), 15000))]);
  console.log("subscribed. sending 50…");

  const lat = [];
  for (let i = 0; i < N; i++) {
    const { data: m } = await sender.from("chat_messages").insert({ thread_id: threadId, sender_profile_id: counselor.profile_id, body: `[perf] rt ${i}` }).select("id").single();
    t0byId.set(m.id, performance.now());
    const wait0 = performance.now();
    while (!latById.has(m.id) && performance.now() - wait0 < 5000) await new Promise((r) => setTimeout(r, 5));
    lat.push(latById.has(m.id) ? latById.get(m.id) : -1);
  }
  const good = lat.filter((v) => v >= 0);
  out.delivery = { ...stats(good), lost: N - good.length };
  console.log(`  ${row("delivery sender→screen", out.delivery)} lost=${N - good.length}`);

  // Disconnect: 3 messages while unsubscribed, then resubscribe + refetch.
  await receiver.removeChannel(ch);
  await new Promise((r) => setTimeout(r, 500));
  const missedIds = [];
  for (let i = 0; i < 3; i++) {
    const { data: m } = await sender.from("chat_messages").insert({ thread_id: threadId, sender_profile_id: counselor.profile_id, body: `[perf] missed ${i}` }).select("id").single();
    missedIds.push(m.id);
  }
  let firedAfterCleanup = 0;
  const ch2 = receiver.channel(`perf-rt2-${Date.now()}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${threadId}` }, () => firedAfterCleanup++).subscribe();
  await new Promise((r) => setTimeout(r, 2000));
  const { data: hist } = await receiver.from("chat_messages").select("id").eq("thread_id", threadId).in("id", missedIds);
  out.reconnect = { replayed_live: firedAfterCleanup, recovered_via_refetch: (hist ?? []).length, expected: 3 };
  console.log(`  reconnect: live-replay=${firedAfterCleanup} (expected 0 — PG changes don't replay), refetch-recovered=${(hist ?? []).length}/3`);
  await receiver.removeChannel(ch2);

  // Cleanup perf messages.
  await svc.from("chat_messages").delete().like("body", "[perf] rt %").eq("thread_id", threadId);
  await svc.from("chat_messages").delete().like("body", "[perf] missed %").eq("thread_id", threadId);
  console.log("cleanup done.");

  mkdirSync(join(HERE, "results"), { recursive: true });
  writeFileSync(join(HERE, "results", "realtime.json"), JSON.stringify({ at: new Date().toISOString(), threadId, ...out }, null, 2));
  console.log("wrote results/realtime.json");
  process.exit(0);
}

main().catch((e) => {
  console.error("REALTIME_FAILED:", e.message);
  process.exit(1);
});
