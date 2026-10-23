import { existsSync, readFileSync, rmSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { STATE_PATH, type SeedState } from "./global-setup";

/**
 * Best-effort cleanup: delete the seeded referral explicitly (the referral
 * requires at least one referrer, so cascading the faculty row to null would
 * violate its CHECK), then delete the disposable auth users.
 */
export default async function globalTeardown(): Promise<void> {
  if (!existsSync(STATE_PATH)) return;

  const url = process.env.TEST_SUPABASE_URL;
  const serviceRoleKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return;

  const state = JSON.parse(readFileSync(STATE_PATH, "utf8")) as SeedState;
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await admin.from("referrals").delete().eq("id", state.referralId);
  for (const user of Object.values(state.users)) {
    await admin.auth.admin.deleteUser(user.profileId);
  }

  rmSync(STATE_PATH, { force: true });
}
