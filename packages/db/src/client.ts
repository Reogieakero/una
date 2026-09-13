import { PrismaClient } from "@prisma/client";

/**
 * Trusted server-side Prisma client (`@dorsu/db`).
 *
 * - Use ONLY in trusted server contexts (Next.js Route Handlers / Server
 *   Actions, cron jobs, scripts with `SUPABASE_SERVICE_ROLE_KEY` / direct DB
 *   credentials). It connects with `DATABASE_URL` (Supabase pooler) and
 *   bypasses Row Level Security — enforce RBAC in code via
 *   `@dorsu/shared-services/rbac.ts` before every call.
 * - Client components / mobile screens keep using `@dorsu/supabase-client`
 *   (supabase-js) so Auth + Realtime + RLS stay enforced by Postgres.
 *
 * Env (see `.env.example`):
 * - `DATABASE_URL` — Supabase pooler URL (`...pooler.supabase.com...?pgbouncer=true`)
 * - `DIRECT_URL`   — direct Postgres URL (used by `prisma db push` / migrations)
 */

const globalForPrisma = globalThis as unknown as { __dorsuPrisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env["NODE_ENV"] === "development" ? ["warn", "error"] : ["error"],
  });
}

/** Singleton — avoids exhausting the pool during Next.js HMR. */
export const prisma: PrismaClient = globalForPrisma.__dorsuPrisma ?? createPrismaClient();

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.__dorsuPrisma = prisma;
}

export type { PrismaClient };
export default prisma;
