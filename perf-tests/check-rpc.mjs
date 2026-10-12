/** One-off: confirm head-dashboard RPC failure mode on staging (00061 unapplied). */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, assertStaging } from "./lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const env = loadEnv();
assertStaging(env.host);
const rootEnv = readFileSync(join(HERE, "..", ".env"), "utf8");
const skey = rootEnv.split("\n").find((l) => l.startsWith("SUPABASE_SERVICE_ROLE_KEY=")).split("=").slice(1).join("=").trim();
const svc = createClient(env.url, skey, { auth: { persistSession: false, autoRefreshToken: false } });

const week = await svc.rpc("head_appointment_daily_counts", { from_ts: new Date().toISOString(), to_ts: new Date().toISOString() });
console.log("week rpc error:", week.error ? `${week.error.code} ${week.error.message.slice(0, 100)}` : "OK");
const status = await svc.rpc("head_referral_status_counts");
console.log("status rpc error:", status.error ? `${status.error.code} ${status.error.message.slice(0, 100)}` : "OK");
