/**
 * Page-load measurement (Playwright, chromium headless shell, production
 * server on :3100). For each page: TTFB, FCP, LCP, CLS, JS bytes, request
 * count, Supabase REST count + time. 20 runs + 3 warm-ups, normal network
 * and (subset) Slow-4G + 4x CPU throttled.
 * NOTE: realtime websockets never idle, so readiness = domcontentloaded +
 * h1 visible + 3s settle (documented, not networkidle).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { stats, fmtMs, row } from "./lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PERF_BASE || "http://localhost:3100";
const PASSWORD = process.env.PERF_PASSWORD || "Perf#Seed2026!";
const RUNS = 20;
const WARMUP = 3;
const SETTLE_MS = 3000;

const VITALS_SRC = `
window.__wv = { fcp: 0, lcp: 0, cls: 0 };
try {
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) if (e.name === "first-contentful-paint") window.__wv.fcp = e.startTime;
  }).observe({ type: "paint", buffered: true });
  new PerformanceObserver((l) => {
    const es = l.getEntries();
    if (es.length) window.__wv.lcp = es[es.length - 1].startTime;
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) if (!e.hadRecentInput) window.__wv.cls += e.value;
  }).observe({ type: "layout-shift", buffered: true });
} catch (e) { window.__wv.err = String(e); }
`;

async function loginContext(browser, email) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }),
    page.getByRole("button", { name: /^log in$/i }).click(),
  ]);
  await ctx.storageState({ path: join(HERE, `.storage-${email.split("@")[0]}.json`) });
  await page.close();
  return ctx;
}

async function authedContext(browser, email) {
  const path = join(HERE, `.storage-${email.split("@")[0]}.json`);
  const { readFileSync, existsSync } = await import("node:fs");
  if (!existsSync(path)) await loginContext(browser, email);
  const state = JSON.parse(readFileSync(path, "utf8"));
  return browser.newContext({ storageState: state });
}

async function measureLoad(browser, ctxOpts, path, throttled) {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.addInitScript(VITALS_SRC);
  const page = await ctx.newPage();
  let cdp = null;
  if (throttled) {
    cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  }
  const supa = [];
  let reqs = 0;
  let jsBytes = 0;
  const bodies = [];
  page.on("request", () => reqs++);
  page.on("response", (r) => {
    try {
      const u = r.url();
      if (u.includes("/rest/v1/") || u.includes("/auth/v1/")) {
        const t = r.request().timing();
        supa.push(t.responseEnd > 0 ? t.responseEnd : 0);
      }
      const rt = r.request().resourceType();
      if (rt === "script" || rt === "document") bodies.push(r.body().then((b) => b.length).catch(() => 0));
    } catch {}
  });
  const resp = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const timing = resp ? resp.request().timing() : null;
  const ttfb = timing && timing.responseStart > 0 ? timing.responseStart : 0;
  try {
    await page.locator("h1").first().waitFor({ timeout: 20000 });
  } catch {}
  await page.waitForTimeout(SETTLE_MS);
  const wv = await page.evaluate(() => window.__wv || {});
  const bytes = (await Promise.all(bodies)).reduce((a, b) => a + b, 0);
  await ctx.close();
  return { ttfb, fcp: wv.fcp || 0, lcp: wv.lcp || 0, cls: wv.cls || 0, jsBytes: bytes, reqs, supaCount: supa.length, supaMs: supa.reduce((a, b) => a + b, 0) };
}

const MATRIX = [
  { role: null, email: null, path: "/login", label: "login" },
  { role: "head", email: "perf.head@dorsu.edu.ph", path: "/dashboard", label: "head dashboard" },
  { role: "head", email: "perf.head@dorsu.edu.ph", path: "/reports", label: "head reports" },
  { role: "head", email: "perf.head@dorsu.edu.ph", path: "/appointments", label: "head appointments" },
  { role: "head", email: "perf.head@dorsu.edu.ph", path: "/referrals", label: "head referrals" },
  { role: "head", email: "perf.head@dorsu.edu.ph", path: "/chat", label: "head chat" },
  { role: "head", email: "perf.head@dorsu.edu.ph", path: "/announcements", label: "announcements(events)" },
  { role: "head", email: "perf.head@dorsu.edu.ph", path: "/students", label: "students" },
  { role: "head", email: "perf.head@dorsu.edu.ph", path: "/sessions", label: "sessions" },
  { role: "counselor", email: "perf.counselor01@dorsu.edu.ph", path: "/dashboard", label: "counselor dashboard" },
  { role: "counselor", email: "perf.counselor01@dorsu.edu.ph", path: "/appointments", label: "counselor appointments" },
  { role: "counselor", email: "perf.counselor01@dorsu.edu.ph", path: "/chat", label: "counselor chat" },
  { role: "counselor", email: "perf.counselor01@dorsu.edu.ph", path: "/referrals", label: "counselor referrals" },
  { role: "counselor", email: "perf.counselor01@dorsu.edu.ph", path: "/sessions", label: "counselor sessions" },
  { role: "counselor", email: "perf.counselor01@dorsu.edu.ph", path: "/feedback", label: "feedback" },
  { role: "faculty", email: "perf.faculty01@dorsu.edu.ph", path: "/dashboard", label: "faculty dashboard" },
  { role: "faculty", email: "perf.faculty01@dorsu.edu.ph", path: "/referrals", label: "faculty referrals" },
];

async function runSet(browser, states, throttled, onlyLabels) {
  const out = {};
  for (const m of MATRIX) {
    if (onlyLabels && !onlyLabels.includes(m.label)) continue;
    const samples = { ttfb: [], fcp: [], lcp: [], cls: [], js: [], reqs: [], supa: [], supaMs: [] };
    const ctxOpts = m.email ? { storageState: states[m.email] } : {};
    for (let i = 0; i < RUNS + WARMUP; i++) {
      try {
        const r = await measureLoad(browser, ctxOpts, m.path, throttled);
        if (i >= WARMUP) {
          samples.ttfb.push(r.ttfb); samples.fcp.push(r.fcp); samples.lcp.push(r.lcp);
          samples.cls.push(r.cls); samples.js.push(r.jsBytes); samples.reqs.push(r.reqs);
          samples.supa.push(r.supaCount); samples.supaMs.push(r.supaMs);
        }
      } catch (e) {
        if (i >= WARMUP) console.error(`  ${m.label} run ${i} FAILED: ${String(e).slice(0, 120)}`);
      }
    }
    out[m.label] = {
      path: m.path, role: m.role,
      ttfb: stats(samples.ttfb), fcp: stats(samples.fcp), lcp: stats(samples.lcp),
      cls: { max: Math.max(...samples.cls, 0) },
      jsKB: stats(samples.js.map((v) => v / 1024)), reqs: stats(samples.reqs),
      supaCount: stats(samples.supa), supaMs: stats(samples.supaMs),
    };
    const o = out[m.label];
    console.log(`${throttled ? "[4G] " : ""}${m.label}: TTFB ${row("", o.ttfb).replace(": ", "")} | LCP p50 ${fmtMs(o.lcp.p50)} p95 ${fmtMs(o.lcp.p95)} | JS p50 ${o.jsKB.p50.toFixed(0)}KB | reqs p50 ${o.reqs.p50} | supaQ p50 ${o.supaCount.p50} (${fmtMs(o.supaMs.p50)})`);
  }
  return out;
}

async function main() {
  const browser = await chromium.launch();
  // Pre-login all roles once (writes storage files, no app change).
  const states = {};
  for (const email of ["perf.head@dorsu.edu.ph", "perf.counselor01@dorsu.edu.ph", "perf.faculty01@dorsu.edu.ph"]) {
    const ctx = await loginContext(browser, email);
    states[email] = await ctx.storageState();
    await ctx.close();
    console.log(`logged in ${email}`);
  }
  mkdirSync(join(HERE, "results"), { recursive: true });
  console.log("== normal ==");
  const normal = await runSet(browser, states, false, null);
  writeFileSync(join(HERE, "results", "pages.json"), JSON.stringify({ at: new Date().toISOString(), normal }, null, 2));
  console.log("== throttled (Slow4G+4xCPU, key pages) ==");
  const throttled = await runSet(browser, states, true, ["login", "head dashboard", "head reports", "counselor chat"]);
  writeFileSync(join(HERE, "results", "pages-throttled.json"), JSON.stringify({ at: new Date().toISOString(), throttled }, null, 2));
  await browser.close();
  console.log("wrote results/pages.json + pages-throttled.json");
}

main().catch((e) => {
  console.error("PAGES_FAILED:", e.message);
  process.exit(1);
});
