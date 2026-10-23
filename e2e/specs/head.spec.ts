import { expect, test } from "@playwright/test";
import { loadSeed, login } from "./helpers";

/**
 * Head flow: dashboard → office referral board → reports. The report assertion
 * checks that sections are populated (the empty-state copy is absent and the
 * KPI labels render), not merely that the page returned HTTP 200.
 */
test.describe("head role", () => {
  test("sees the pending referral and populated reports", async ({ page }) => {
    const seed = loadSeed();
    await login(page, seed.users.head.email, seed.password);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();

    await page.goto("/referrals");
    await expect(page.getByRole("heading", { name: "Referrals", exact: true })).toBeVisible();
    await expect(page.getByText(seed.studentAlias).first()).toBeVisible();
    await expect(page.getByText(seed.referralReason).first()).toBeVisible();

    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: "Reports", exact: true })).toBeVisible();

    // KPIs come from the same API the charts use; labels only render once data
    // resolves. The seeded completed session + pending referral keep these
    // populated regardless of which role specs ran first.
    await expect(page.getByText("Total sessions", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Open referrals", { exact: true })).toBeVisible();
    await expect(page.getByText("Sessions by status", { exact: true })).toBeVisible();
    await expect(page.getByText("Referrals by status", { exact: true })).toBeVisible();

    // Empty-state copy proves a section has no rows; these must be absent.
    await expect(page.getByText("No sessions in the last 14 days")).toHaveCount(0);
    await expect(page.getByText("No referrals yet")).toHaveCount(0);
  });
});
