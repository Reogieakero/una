import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { STATE_PATH, type SeedState } from "../global-setup";

export type { SeedState };

/** Fixtures written by global-setup.ts; every spec runs in the same worker. */
export function loadSeed(): SeedState {
  return JSON.parse(readFileSync(STATE_PATH, "utf8")) as SeedState;
}

/**
 * Signs in through the real form. Each test gets a fresh browser context, so
 * this exercises the staff cookie flow rather than injecting a session.
 */
export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login(\?|$)/);
}
