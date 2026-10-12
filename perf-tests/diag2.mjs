/** Diag2: is the dashboard hydrating + fetching? */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PERF_BASE || "http://localhost:3100";

const browser = await chromium.launch();
const state = JSON.parse(readFileSync(join(HERE, ".storage-perf.head.json"), "utf8"));
const ctx = await browser.newContext({ storageState: state });
const page = await ctx.newPage();
const all = [];
page.on("request", (r) => all.push(`${r.method()} ${r.url().slice(0, 100)}`));
page.on("requestfailed", (r) => console.log("FAILED:", r.url().slice(0, 100), r.failure()?.errorText));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE-ERR:", m.text().slice(0, 160));
});
page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 200)));
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(5000);
console.log(`total requests: ${all.length}`);
for (const u of all) console.log("  ", u);
console.log("scripts in DOM:", await page.evaluate(() => document.querySelectorAll("script").length));
console.log("h1:", await page.locator("h1").first().textContent().catch(() => "(none)"));
console.log("body text sample:", (await page.locator("main").textContent().catch(() => "(no main)")).slice(0, 200));
await browser.close();
