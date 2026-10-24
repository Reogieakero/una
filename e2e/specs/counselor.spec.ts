import { expect, test } from "@playwright/test";
import { loadSeed, login } from "./helpers";

/**
 * Counselor flow: dashboard → appointments board → complete a past confirmed
 * session → document it in the session-notes dialog. This is the real write
 * path (Supabase update + note insert), not a mocked click.
 */
test.describe("counselor role", () => {
  test("completes a past session and saves its private note", async ({ page }) => {
    const seed = loadSeed();
    await login(page, seed.users.counselor.email, seed.password);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();

    await page.goto("/appointments");
    await expect(page.getByRole("heading", { name: "Appointments" })).toBeVisible();

    const row = page.getByRole("row").filter({ hasText: seed.appointmentConcern });
    await expect(row).toBeVisible();
    await expect(row.getByText(seed.studentAlias)).toBeVisible();

    await row.getByRole("button", { name: "Complete" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm.getByText("Mark this session complete?")).toBeVisible();
    await confirm.getByRole("button", { name: "Mark complete" }).click();

    // Completing hands the counselor straight to the private record.
    const notes = page.getByRole("dialog", { name: "Session notes" });
    await expect(notes).toBeVisible();

    const noteContent = `E2E session note ${seed.runId}: student reflected on exam stress and agreed to a follow-up plan.`;
    await notes.getByPlaceholder(/Observations, interventions used/i).fill(noteContent);
    await notes.getByRole("button", { name: "Save note" }).click();

    await expect(page.getByText("Session note saved")).toBeVisible();
    await expect(notes).toBeHidden();
  });

  test("blocks completion without a check-in, then records an audited waiver", async ({ page }) => {
    const seed = loadSeed();
    await login(page, seed.users.counselor.email, seed.password);
    await page.goto("/appointments");

    const row = page.getByRole("row").filter({ hasText: seed.waiverAppointmentConcern });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Complete" }).click();

    const confirm = page.getByRole("alertdialog");
    await expect(confirm.getByText("Mark this session complete?")).toBeVisible();
    await confirm.getByRole("button", { name: "Mark complete" }).click();

    // No linked check-in: the counselor gets an explicit waiver path.
    const waiver = page.getByRole("alertdialog", { name: "Pre-session check-in missing" });
    await expect(waiver).toBeVisible();
    await waiver.getByLabel("Waiver reason").fill("Walk-in session documented on paper.");
    await waiver.getByRole("button", { name: "Record waiver & complete" }).click();

    const notes = page.getByRole("dialog", { name: "Session notes" });
    await expect(notes).toBeVisible();
    await notes.getByRole("button", { name: "Close" }).click();
  });
});
