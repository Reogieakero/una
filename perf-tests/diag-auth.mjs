/** Diag: do authed contexts actually stay authed? Log every request URL. */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PERF_BASE || "http://localhost:3100";

const browser = await chromium.launch();
for (const who of ["perf.head", "perf.counselor01"]) {
  const path = join(HERE, `.storage-${who}.json`);
  if (!existsSync(path)) {
    console.log(who, "no storage file");
    continue;
  }
  const state = JSON.parse(readFileSync(path, "utf8"));
  console.log(who, "cookies:", (state.cookies || []).map((c) => c.name).join(","));
  const ctx = await browser.newContext({ storageState: state });
  const page = await ctx.newPage();
  const urls = [];
  page.on("request", (r) => {
    const u = r.url();
    if (u.includes("/rest/") || u.includes("/auth/") || u.includes("/api/")) urls.push(`${r.method()} ${u.slice(0, 110)}`);
  });
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 30000 });
  try {
    await page.locator("h1").first().waitFor({ timeout: 10000 });
  } catch {}
  await page.waitForTimeout(4000);
  console.log(who, "final URL:", page.url());
  console.log(who, `api/rest/auth requests (${urls.length}):`);
  for (const u of urls.slice(0, 25)) console.log("   ", u);
  await ctx.close();
}
await browser.close();
