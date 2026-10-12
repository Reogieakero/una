/** Pager smoke: head login → /referrals pager renders, page/size nav works. */
import { chromium } from "@playwright/test";

const BASE = process.env.PERF_BASE || "http://localhost:3100";
const PASSWORD = process.env.PERF_PASSWORD || "Perf#Seed2026!";

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.locator("#email").fill("perf.head@dorsu.edu.ph");
await page.locator("#password").fill(PASSWORD);
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }),
  page.getByRole("button", { name: /^log in$/i }).click(),
]);
console.log("login ok");

await page.goto(`${BASE}/referrals`, { waitUntil: "domcontentloaded" });
await page.locator("h1").first().waitFor({ timeout: 20000 });
await page.waitForTimeout(4000);
const pager = page.locator('nav[aria-label="Pagination"]');
console.log("pager visible:", await pager.isVisible().catch(() => false));
console.log("count line:", await page.locator("text=/Showing .* of/").first().textContent().catch(() => "(none)"));
console.log("stats total:", await page.locator('button:has-text("Stats")').isVisible().catch(() => false));

// Size switch to 50.
await page.locator('select[aria-label="Rows per page"]').selectOption("50");
await page.waitForTimeout(3000);
console.log("after size=50, url:", page.url());
console.log("count line:", await page.locator("text=/Showing .* of/").first().textContent().catch(() => "(none)"));

// Status filter resets to page 1.
await page.locator('button[aria-label="Filter by status"]').click();
await page.locator('[role="option"]').filter({ hasText: /^Pending$/ }).first().click().catch(async () => {
  await page.locator("text=Pending").first().click();
});
await page.waitForTimeout(3000);
console.log("after status filter, url:", page.url());

// Next page (if enabled).
const next = page.locator('nav[aria-label="Pagination"] button[aria-label="Next page"]');
if (await next.isEnabled().catch(() => false)) {
  await next.click();
  await page.waitForTimeout(3000);
  console.log("after next, url:", page.url());
} else {
  console.log("next disabled (single page — expected at this data volume)");
}
await browser.close();
console.log("SMOKE_DONE");
