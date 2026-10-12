/**
 * Direct Postgres access for server-side timings (EXPLAIN ANALYZE, pg_stat).
 * Uses DIRECT_URL (pooler session mode). Host is logged, password never is.
 */
import pg from "pg";
import { loadEnv } from "./lib.mjs";

const { directUrl, host } = loadEnv();

export function dbHost() {
  try {
    return new URL(directUrl).host;
  } catch {
    return "(unparsed)";
  }
}

export async function withPg(fn) {
  const pool = new pg.Pool({ connectionString: directUrl, max: 2 });
  try {
    return await fn(pool);
  } finally {
    await pool.end().catch(() => {});
  }
}

/** EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) — params supported. */
export async function explain(pool, sql, params = []) {
  const { rows } = await pool.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`, params);
  const plan = rows[0]["QUERY PLAN"][0];
  return {
    execMs: plan["Execution Time"],
    planningMs: plan["Planning Time"],
    plan: plan.Plan,
  };
}

/** Top statements by total time (needs pg_stat_statements). */
export async function topStatements(pool, limit = 20) {
  try {
    const { rows } = await pool.query(
      `select query, calls, round(total_exec_time::numeric,2) as total_ms,
              round(mean_exec_time::numeric,2) as mean_ms, rows
       from pg_stat_statements order by total_exec_time desc limit $1`,
      [limit],
    );
    return rows;
  } catch (e) {
    return [{ note: `pg_stat_statements unavailable: ${e.message}` }];
  }
}
