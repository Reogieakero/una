/**
 * P19: per-instance fixed-window rate limiter (defense in depth).
 *
 * Serverless instances don't share memory, so this blunts naive
 * single-source floods (registration spam from one bot) rather than
 * distributed abuse. The shared-bucket follow-up is Upstash Redis; until
 * then this is strictly better than nothing and fails OPEN (never blocks
 * legitimate traffic on limiter errors — it only tracks timestamps).
 *
 * Usage: `if (hitRateLimit(key, limit, windowMs).limited) return 429`.
 */

const buckets = new Map<string, number[]>();
const MAX_KEYS = 10_000;

export function hitRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): { limited: boolean; retryAfterSec: number } {
  // Memory guard — fail open by resetting rather than growing forever.
  if (buckets.size > MAX_KEYS) buckets.clear();
  const cutoff = now - windowMs;
  const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= limit) {
    const oldest = hits[0] ?? now;
    return { limited: true, retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) };
  }
  hits.push(now);
  buckets.set(key, hits);
  return { limited: false, retryAfterSec: 0 };
}

/** Client IP for rate-limit keys (Vercel/forwarded first, else direct). */
export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}
