/**
 * Platform boundary types.
 * Packages never touch localStorage/AsyncStorage/fetch directly (principle #1):
 * apps inject these adapters; services stay pure + testable.
 *
 * DbClient is intentionally structural (`from(table: any): any`) rather than
 * `SupabaseClient<Database>`: the strict postgrest-js generics (Relationships,
 * Functions, ExcessProperty checks) belong to the per-app typed wrappers, not
 * to shared business rules. Apps pass their real typed client — it is
 * assignable here — and services keep Zod + Row-type safety without coupling
 * to a specific supabase-js/postgrest-js version.
 */

/** Minimal key-value store (localStorage on web, AsyncStorage on mobile). */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** The DB handle every service accepts — real client injected per-app. */
export interface DbClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: any): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  auth?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  channel?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  removeChannel?: any;
}

/** Clock injection so expiry/gate rules are deterministic in tests. */
export interface Clock {
  now(): Date;
}
export const systemClock: Clock = { now: () => new Date() };

/**
 * Postgres unique-violation (SQLSTATE 23505) — the signal every
 * catch-and-return idempotency path keys off. postgrest-js surfaces it as
 * `error.code`; Prisma surfaces it as `P2002` (mapped separately there).
 */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "23505"
  );
}
