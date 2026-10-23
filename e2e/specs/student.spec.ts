import { expect, test } from "@playwright/test";
import { loadSeed, login } from "./helpers";

/**
 * Students are mobile-first: the web portal has no student booking, PSS-10, or
 * chat screens, and staff clinical routes must fail closed for them. This test
 * asserts that boundary honestly instead of pretending a student web flow
 * exists.
 */
test.describe("student role", () => {
  test("lands on the public site and cannot open staff clinical routes", async ({ page }) => {
    const seed = loadSeed();
    await login(page, seed.users.student.email, seed.password);

    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { name: /Counseling that feels/i }),
    ).toBeVisible();

    // (staff) layout calls requireRole and redirects a student back to "/".
    await page.goto("/appointments");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Appointments" })).toHaveCount(0);

    // No clinical record leaks into the student's web session.
    await expect(page.getByText(seed.appointmentConcern)).toHaveCount(0);
    await expect(page.getByText(seed.completedConcern)).toHaveCount(0);
  });
});
