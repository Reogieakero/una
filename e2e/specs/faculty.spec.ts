import { expect, test } from "@playwright/test";
import { loadSeed, login } from "./helpers";

/**
 * Faculty flow: dashboard → refer-student, where the seeded referral must be
 * listed and the paper-form modal must open. We assert the alias only — real
 * student identity is never used in fixtures.
 */
test.describe("faculty role", () => {
  test("sees sent referral history and opens the referral form", async ({ page }) => {
    const seed = loadSeed();
    await login(page, seed.users.faculty.email, seed.password);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();

    await page.goto("/refer-student");
    await expect(page.getByRole("heading", { name: "Fill student referrals" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sent referrals history" })).toBeVisible();

    await expect(page.getByText(seed.studentAlias).first()).toBeVisible();
    await expect(page.getByText(seed.referralReason).first()).toBeVisible();

    await page.getByRole("button", { name: "Fill up referral form" }).click();
    const dialog = page.getByRole("dialog", { name: "Fill up referral form" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/FM-DOrSU-GCTC-02/)).toBeVisible();
  });
});
