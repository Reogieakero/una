import { defineConfig, devices } from "@playwright/test";

/**
 * Role smoke tests for the staff web portal.
 *
 * These run against a disposable local Supabase (the same stack the RLS job
 * uses) and `next start` — never staging or production. `global-setup.ts`
 * creates the four role accounts + fixtures; the specs assert each role's real
 * route boundary and one working flow.
 *
 * Run locally:
 *   1. supabase start && supabase db reset
 *   2. export TEST_SUPABASE_URL / TEST_SUPABASE_ANON_KEY /
 *      TEST_SUPABASE_SERVICE_ROLE_KEY (see tests/rls/README.md)
 *   3. pnpm e2e
 *
 * `pnpm test` never picks this package up: it only defines `test:e2e`.
 */

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.TEST_SUPABASE_URL ?? "";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.TEST_SUPABASE_ANON_KEY ??
  "";
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ??
  "";

export default defineConfig({
  testDir: "./specs",
  // One worker: the four role flows share a seeded database and the counselor
  // flow mutates the seeded appointment that the report flow also reads.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  outputDir: "test-results",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // The portal is a desktop staff workspace; mobile students use the Expo app.
    ...devices["Desktop Chrome"],
  },
  globalSetup: "./global-setup.ts",
  globalTeardown: "./global-teardown.ts",
  webServer: {
    // CI builds the app once before tests and sets E2E_WEB_COMMAND to a plain
    // `next start`. Locally the build is folded in so `pnpm e2e` just works.
    command:
      process.env.E2E_WEB_COMMAND ??
      "pnpm --filter @dorsu/web build && pnpm --filter @dorsu/web start",
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
      SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKey,
    },
  },
});
