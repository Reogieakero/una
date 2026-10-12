/**
 * API-level measurements through the Next.js production server (cookies).
 * - 50 concurrent GET /api/dashboard/head (burst latency + error rate)
 * - 20x POST /api/staff/notify (does the fan-out block the response?)
 * - 20x GET /api/session-notes (counselor reads own completed session notes)
 * - 5x POST + PATCH session-notes (full save path incl. follow-up sync)
 * Tagged notif rows are deleted afterwards.
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadEnv, assertStaging, stats, row } from "./lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PERF_BASE || "http://localhost:3100";
const PASSWORD = process.env.PERF_PASSWORD || "Perf#Seed2026!";
const manifest = JSON.parse(readFileSync(join(HERE, "seed", "seed-manifest.json"), "utf8"));

const env = loadEnv();
assertStaging(env.host);

async function apiContext(browser, email) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }),
    page.getByRole("button", { name: /^log in$/i }).click(),
  ]);
  const api = await ctx.newCDPSession(page);
  void api;
  const req = ctx.request;
  await page.close();
  return { ctx, req };
}

async function main() {
  const out = {};
  const browser = await chromium.launch();
  const head = await apiContext(browser, "perf.head@dorsu.edu.ph");
  const counselor = await apiContext(browser, manifest.counselors[0].email);

  // Burst: 50 concurrent dashboard loads.
  console.log("burst: 50x GET /api/dashboard/head…");
  {
    const t0 = performance.now();
    const rs = await Promise.all(
      Array.from({ length: 50 }, () =>
        head.req.get(`${BASE}/api/dashboard/head`).then(
          async (r) => ({ ok: r.ok(), ms: 0, status: r.status() }),
          (e) => ({ ok: false, ms: 0, status: 0, err: String(e).slice(0, 60) }),
        ),
      ),
    );
    const wall = performance.now() - t0;
    // Re-time sequentially for latency distribution (burst measures throughput).
    const lat = [];
    for (let i = 0; i < 20; i++) {
      const a = performance.now();
      await head.req.get(`${BASE}/api/dashboard/head`);
      lat.push(performance.now() - a);
    }
    const ok = rs.filter((r) => r.ok).length;
    out.burst = { n: 50, ok, errors: 50 - ok, wallMs: wall, latency: stats(lat) };
    console.log(`  ok=${ok}/50 wall=${wall.toFixed(0)}ms seq-latency: ${row("dashboard", stats(lat))}`);
  }

  // Notify blocking?
  console.log("notify: 20x POST /api/staff/notify…");
  {
    const lat = [];
    for (let i = 0; i < 20; i++) {
      const a = performance.now();
      const r = await head.req.post(`${BASE}/api/staff/notify`, {
        data: { to: [manifest.head.profile_id], type: "chat", title: `[perf] burst ${i}`, link: "/chat", dedupeKey: `[perf] burst ${i}` },
      });
      lat.push(performance.now() - a);
      if (!r.ok()) console.error(`  notify ${i} status ${r.status()}`);
    }
    out.notify = stats(lat);
    console.log(`  ${row("notify POST (blocks? = this number)", out.notify)}`);
  }

  // Session notes GET (head reading first completed seed appointment).
  console.log("session-notes GET…");
  {
    const rootEnv = readFileSync(join(HERE, "..", ".env"), "utf8");
    const skey = rootEnv.split("\n").find((l) => l.startsWith("SUPABASE_SERVICE_ROLE_KEY=")).split("=").slice(1).join("=").trim();
    const svc = createClient(env.url, skey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: appts } = await svc.from("appointments").select("id, counselor_id").eq("status", "completed").like("concern", "[perf]%").limit(5);
    const lat = [];
    for (const a of appts ?? []) {
      const t0 = performance.now();
      await head.req.get(`${BASE}/api/session-notes?appointmentId=${a.id}`);
      lat.push(performance.now() - t0);
    }
    out.notesGet = lat.length ? stats(lat) : { n: 0 };
    console.log(`  ${lat.length ? row("notes GET", out.notesGet) : "no completed seed appts"}`);
  }

  // Session notes POST + PATCH (counselor01's own completed appointments).
  console.log("session-notes POST+PATCH (5x)…");
  {
    const rootEnv = readFileSync(join(HERE, "..", ".env"), "utf8");
    const skey = rootEnv.split("\n").find((l) => l.startsWith("SUPABASE_SERVICE_ROLE_KEY=")).split("=").slice(1).join("=").trim();
    const svc = createClient(env.url, skey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: mine } = await svc.from("appointments").select("id").eq("status", "completed").eq("counselor_id", manifest.counselors[0].id).like("concern", "[perf]%").limit(5);
    const post = [], patch = [];
    for (const a of mine ?? []) {
      let t0 = performance.now();
      const pr = await counselor.req.post(`${BASE}/api/session-notes`, {
        data: { appointmentId: a.id, content: "[perf] note content for measurement save path.", followUpRequired: false, followUpAt: null },
      });
      post.push(performance.now() - t0);
      if (pr.ok()) {
        const body = await pr.json();
        t0 = performance.now();
        await counselor.req.patch(`${BASE}/api/session-notes`, {
          data: { noteId: body.note.id, content: "[perf] amended note content for measurement." },
        });
        patch.push(performance.now() - t0);
      } else console.error(`  notes POST ${pr.status()}`);
    }
    out.notesPost = post.length ? stats(post) : { n: 0 };
    out.notesPatch = patch.length ? stats(patch) : { n: 0 };
    console.log(`  ${post.length ? row("notes POST", out.notesPost) : "no eligible appts"}`);
    console.log(`  ${patch.length ? row("notes PATCH", out.notesPatch) : "no eligible appts"}`);
    // Cleanup test notes.
    const { data: notes } = await svc.from("session_notes").select("id").like("content", "[perf]%");
    for (const n of notes ?? []) {
      await svc.from("session_note_attachments").delete().eq("note_id", n.id);
      await svc.from("session_notes").delete().eq("id", n.id);
    }
  }

  // Cleanup burst notifications.
  {
    const rootEnv = readFileSync(join(HERE, "..", ".env"), "utf8");
    const skey = rootEnv.split("\n").find((l) => l.startsWith("SUPABASE_SERVICE_ROLE_KEY=")).split("=").slice(1).join("=").trim();
    const svc = createClient(env.url, skey, { auth: { persistSession: false, autoRefreshToken: false } });
    await svc.from("notifications").delete().like("title", "[perf] burst%");
    console.log("cleanup done.");
  }

  await browser.close();
  mkdirSync(join(HERE, "results"), { recursive: true });
  writeFileSync(join(HERE, "results", "api-burst.json"), JSON.stringify({ at: new Date().toISOString(), ...out }, null, 2));
  console.log("wrote results/api-burst.json");
}

main().catch((e) => {
  console.error("BURST_FAILED:", e.message);
  process.exit(1);
});
