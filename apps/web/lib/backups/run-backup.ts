import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { createAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/log-event";

/**
 * Head-managed logical backup engine (server-only — service-role inside).
 *
 * WHAT: exports an explicit allowlist of public tables to one versioned,
 * gzipped JSON artifact in the private `system-backups` bucket, records the
 * run in `backup_runs`, and audit-logs it. Storage-bucket BYTES are not
 * embedded (session/announcement images stay in their private buckets);
 * attachment rows (with storage paths) are included so recovery can
 * re-verify them — see docs/BACKUP_RESTORE.md.
 *
 * SAFETY: export-only. Nothing here writes app tables (except the run row
 * and its audit row). Restore is a guided SQL procedure in the runbook, NOT
 * a button — a live overwrite of counseling data must never be one click.
 */

export const BACKUP_BUCKET = "system-backups";
export const BACKUP_VERSION = 1;
/** Per-table row cap — campus volumes sit far below it; overflows mark partial. */
export const BACKUP_ROW_LIMIT = 50_000;

/** Deterministic, reviewable export set (backup_runs tracks itself in the DB). */
export const BACKUP_TABLES = [
  "profiles",
  "students",
  "counselors",
  "faculty_members",
  "guidance_personnel",
  "counselor_availability",
  "appointments",
  "pss10_assessments",
  "session_notes",
  "session_note_attachments",
  "feedback",
  "referrals",
  "referral_actions",
  "chat_threads",
  "chat_messages",
  "staff_messages",
  "notifications",
  "announcements",
  "device_tokens",
  "workspace_settings",
  "audit_logs",
  "break_glass_logs",
  "audit_events",
] as const;

export type BackupRunResult = {
  id: string;
  status: string;
  source: string;
  total_rows: number;
  bytes: number;
  checksum: string | null;
  storage_path: string | null;
  warnings: string[];
  table_count: number;
};

function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function auditBackup(
  admin: ReturnType<typeof createAdminClient>,
  opts: {
    actorId: string | null;
    actorRole: string;
    action: string;
    runId: string;
    status: string;
    detail: Record<string, unknown>;
    ip: string | null;
  }
) {
  try {
    const { error } = await admin.from("audit_events").insert({
      actor_profile_id: opts.actorId,
      actor_role: opts.actorRole,
      action: opts.action,
      entity: "backup_runs",
      entity_id: opts.runId,
      status_before: null,
      status_after: opts.status,
      diff: opts.detail,
      source: "web",
      result: "success",
      ip: opts.ip,
    });
    if (error) logEvent("AUDIT_FAILED", { action: opts.action, entityId: opts.runId });
  } catch {
    logEvent("AUDIT_FAILED", { action: opts.action, entityId: opts.runId });
  }
}

/**
 * Run a full logical backup. Returns the finished run row. Throws on
 * infrastructure failure (after marking the run failed) — callers map to 500.
 */
export async function runLogicalBackup(opts: {
  initiatedBy: string | null;
  actorRole: string;
  source: "manual" | "cron";
  ip: string | null;
}): Promise<BackupRunResult> {
  const admin = createAdminClient();
  const { data: runRow, error: runError } = await admin
    .from("backup_runs")
    .insert({ status: "running", source: opts.source, initiated_by: opts.initiatedBy })
    .select("id")
    .single();
  if (runError || !runRow) throw new Error("Couldn't start the backup run.");
  const runId = (runRow as { id: string }).id;

  const fail = async (message: string): Promise<never> => {
    await admin
      .from("backup_runs")
      .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
      .eq("id", runId);
    throw new Error(message);
  };

  try {
    const tables: Record<string, Record<string, unknown>[]> = {};
    const rowCounts: Record<string, number> = {};
    const warnings: string[] = [];
    let partial = false;

    for (const table of BACKUP_TABLES) {
      const { count, error: countError } = await admin
        .from(table)
        .select("*", { count: "exact", head: true });
      if (countError) {
        // Table missing on this deploy (migration not applied yet) — skip
        // loudly instead of failing the whole backup.
        if ((countError as { code?: string }).code === "42P01") {
          warnings.push(`${table}: missing on this database, skipped`);
          continue;
        }
        await fail(`Couldn't count ${table}: ${(countError as Error).message ?? "unknown error"}`);
      }
      const expected = count ?? 0;
      const { data, error: readError } = await admin
        .from(table)
        .select("*")
        .limit(BACKUP_ROW_LIMIT + 1);
      if (readError) await fail(`Couldn't read ${table}: ${(readError as Error).message ?? "unknown error"}`);
      let rows = ((data ?? []) as Record<string, unknown>[]);
      if (rows.length > BACKUP_ROW_LIMIT) {
        rows = rows.slice(0, BACKUP_ROW_LIMIT);
        partial = true;
        warnings.push(`${table}: capped at ${BACKUP_ROW_LIMIT} of ${expected} rows`);
      }
      tables[table] = rows;
      rowCounts[table] = expected;
    }

    const totalRows = Object.values(rowCounts).reduce((a, b) => a + b, 0);
    const payload = JSON.stringify({
      version: BACKUP_VERSION,
      run_id: runId,
      exported_at: new Date().toISOString(),
      tables,
    });
    const gzipped = gzipSync(Buffer.from(payload, "utf8"));
    const checksum = sha256Hex(gzipped);
    const storagePath = `${runId}.json.gz`;

    const { error: uploadError } = await admin.storage.from(BACKUP_BUCKET).upload(storagePath, gzipped, {
      contentType: "application/gzip",
      upsert: false,
    });
    if (uploadError) await fail(`Couldn't store the backup artifact: ${uploadError.message}`);

    const status = partial ? "partial" : "completed";
    await admin
      .from("backup_runs")
      .update({
        status,
        tables: Object.fromEntries(Object.keys(tables).map((t) => [t, rowCounts[t] ?? 0])),
        row_counts: rowCounts,
        total_rows: totalRows,
        bytes: gzipped.length,
        checksum,
        storage_path: storagePath,
        warnings,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);

    await auditBackup(admin, {
      actorId: opts.initiatedBy,
      actorRole: opts.actorRole,
      action: "backup.completed",
      runId,
      status,
      detail: { total_rows: totalRows, tables: Object.keys(tables).length, warnings },
      ip: opts.ip,
    });

    return {
      id: runId,
      status,
      source: opts.source,
      total_rows: totalRows,
      bytes: gzipped.length,
      checksum,
      storage_path: storagePath,
      warnings,
      table_count: Object.keys(tables).length,
    };
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Couldn't ")) {
      // fail() already recorded the failed run — rethrow as-is.
      throw e;
    }
    const message = e instanceof Error ? e.message : "Backup failed.";
    try {
      await admin
        .from("backup_runs")
        .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
        .eq("id", runId);
    } catch {
      // The run row keeps its running status; the throw below still surfaces.
    }
    throw new Error(message);
  }
}
