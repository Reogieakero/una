/**
 * Shared helpers for perf-tests scripts (dev-only, staging only).
 * - Loads env from repo root .env (never prints secrets; logs host only).
 * - min/p50/p95/max stats; ms/s formatting; sleep.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT_ENV = join(HERE, "..", ".env");

function parseEnv(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i > 0) out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

export function loadEnv() {
  const env = parseEnv(readFileSync(ROOT_ENV, "utf8"));
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const directUrl = env.DIRECT_URL;
  if (!url || !serviceKey) throw new Error("Missing Supabase env in root .env");
  let host = "(unparsed)";
  try {
    host = new URL(url).host;
  } catch {}
  return { url, host, serviceKey, anonKey, directUrl };
}

/** Refuse to run writes against anything that is not the approved staging host. */
export function assertStaging(host, expectedRef = "xueqvjozlyayggsyfzsq") {
  console.log(`DB host: ${host}`);
  if (!host.includes(expectedRef)) {
    console.error(`STOP: host does not match approved staging ref (${expectedRef}). Refusing writes.`);
    process.exit(2);
  }
}

/** Service-role client (bypasses RLS — seed/measurement setup only). */
export function adminClient(env) {
  return createClient(env.url, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function stats(samples) {
  const s = [...samples].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return {
    n: s.length,
    min: s[0],
    p50: q(0.5),
    p95: q(0.95),
    max: s[s.length - 1],
  };
}

/** Format ms: ms under 1000, seconds (2 decimals) at/over. */
export function fmtMs(v) {
  return v < 1000 ? `${v.toFixed(1)} ms` : `${(v / 1000).toFixed(2)} s`;
}

export function row(label, st) {
  return `${label}: min ${fmtMs(st.min)} / p50 ${fmtMs(st.p50)} / p95 ${fmtMs(st.p95)} / max ${fmtMs(st.max)} (n=${st.n})`;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Wrap an async fn with wall-clock timing. Returns {ms, value}. */
export async function timed(fn) {
  const t0 = performance.now();
  const value = await fn();
  return { ms: performance.now() - t0, value };
}
