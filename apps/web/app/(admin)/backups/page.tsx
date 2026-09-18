"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DatabaseBackup, Download, HardDriveDownload, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useBackupRuns, useRunBackup, fetchBackupDownloadUrl, type BackupRun } from "@/lib/hooks/use-backups";
import { Badge, Button, Card } from "@/components/ui/primitives";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { timeAgoLong } from "@/lib/format";

function formatBytes(n: number): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function statusTone(s: string): "info" | "success" | "warning" | "danger" | "muted" {
  if (s === "completed") return "success";
  if (s === "partial") return "warning";
  if (s === "failed") return "danger";
  return "info";
}

function statusLabel(s: string): string {
  if (s === "completed") return "Completed";
  if (s === "partial") return "Partial";
  if (s === "failed") return "Failed";
  return "Running";
}

/**
 * Head-only /backups — run + manage logical data backups.
 * The (admin) layout already hard-blocks non-heads; this page additionally
 * degrades to a notice when the role check disagrees.
 *
 * Backup = versioned gzipped JSON of the app tables in a private bucket
 * (run history below). Restore is deliberately NOT a button — recovery
 * follows the runbook (download the artifact, guided SQL restore) because a
 * live overwrite of counseling data must never be one click.
 */
export default function BackupsPage() {
  const { data, isPending, isError, error, refetch, isFetching } = useBackupRuns();
  const run = useRunBackup();
  const runs = data ?? [];
  const latest = runs[0] ?? null;
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (isError) toast.error("Couldn't load backup history right now.");
  }, [isError]);

  const handleRun = () => {
    run.mutate(undefined, {
      onSuccess: (r) => {
        toast.success(r.status === "partial" ? "Backup finished with warnings" : "Backup completed", {
          description: `${r.table_count} tables · ${r.total_rows.toLocaleString()} rows · ${formatBytes(r.bytes)}${r.warnings.length ? ` · ${r.warnings.length} warning${r.warnings.length === 1 ? "" : "s"}` : ""}`,
          position: "top-right",
        });
        void refetch().catch(() => {});
      },
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Backup failed.", { position: "top-right" });
      },
    });
  };

  const handleDownload = async (backup: BackupRun) => {
    if (downloadingId) return;
    setDownloadingId(backup.id);
    try {
      const url = await fetchBackupDownloadUrl(backup.id);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dorsu-backup-${backup.started_at.slice(0, 10)}-${backup.id.slice(0, 8)}.json.gz`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Download started — link expires in 30 minutes.", { position: "top-right" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't prepare the download.", { position: "top-right" });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-4" aria-busy={isFetching || run.isPending}>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Backups</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Backups</h1>
          <p className="mt-1 max-w-[600px] text-sm leading-relaxed text-ink-muted">
            Head-managed copies of office data — run one any time, plus the automatic nightly run. Artifacts are
            private, checksummed, and download-logged.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            Refresh
          </Button>
          <Button size="sm" variant="accent" onClick={handleRun} disabled={run.isPending}>
            {run.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <DatabaseBackup className="h-4 w-4" aria-hidden />}
            {run.isPending ? "Backing up…" : "Run backup now"}
          </Button>
        </div>
      </div>

      {latest && (
        <Card>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="inline-flex items-center gap-2 text-sm font-bold text-ink">
              <ShieldCheck className="h-4 w-4 text-primary-600" aria-hidden />
              Latest backup
            </span>
            <Badge tone={statusTone(latest.status)}>{statusLabel(latest.status)}</Badge>
            <span className="text-sm text-ink-muted">
              {timeAgoLong(latest.started_at)} · {latest.source === "cron" ? "automatic" : "manual"} ·{" "}
              {latest.total_rows.toLocaleString()} rows · {formatBytes(latest.bytes)}
            </span>
            {latest.checksum && (
              <span className="font-mono text-xs text-ink-faint" title={latest.checksum}>
                sha256:{latest.checksum.slice(0, 12)}…
              </span>
            )}
          </div>
          {!!latest.warnings.length && (
            <ul className="mt-2 space-y-1">
              {latest.warnings.map((w) => (
                <li key={w} className="text-xs font-medium text-amber-700">
                  ⚠ {w}
                </li>
              ))}
            </ul>
          )}
          {latest.status === "failed" && latest.error && (
            <p className="mt-2 text-xs font-semibold text-red-600">{latest.error}</p>
          )}
        </Card>
      )}

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-xs uppercase text-ink-muted">
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Tables · rows</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Artifact</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b border-ink/5 align-top transition-colors last:border-0 hover:bg-cream/60">
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{timeAgoLong(r.started_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{r.source === "cron" ? "Automatic" : "Manual"}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {Object.keys(r.tables ?? {}).length} · {(r.total_rows ?? 0).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{formatBytes(r.bytes ?? 0)}</td>
                  <td className="px-4 py-3">
                    {r.storage_path && (r.status === "completed" || r.status === "partial") ? (
                      <button
                        type="button"
                        onClick={() => void handleDownload(r)}
                        disabled={downloadingId === r.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800 transition hover:bg-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-50"
                      >
                        {downloadingId === r.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Download className="h-3.5 w-3.5" aria-hidden />
                        )}
                        Download
                      </button>
                    ) : (
                      <span className="text-xs font-medium text-ink-faint">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isPending && !runs.length && (
          <p className="px-4 py-8 text-center text-sm text-ink-muted">
            {isError
              ? ((error as Error)?.message ?? "Couldn't load backup history.")
              : "No backups yet — run the first one above. The nightly automatic run appears here too."}
          </p>
        )}
        {isPending && (
          <div className="animate-pulse space-y-3 p-4" aria-hidden>
            <div className="h-10 rounded-xl bg-ink/10" />
            <div className="h-10 rounded-xl bg-ink/10" />
          </div>
        )}
      </Card>

      <Card>
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
          <HardDriveDownload className="h-4 w-4 text-primary-600" aria-hidden />
          If data ever needs restoring
        </h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-ink-muted">
          <li>Download the newest <span className="font-bold text-ink">Completed</span> artifact above (link expires in 30 minutes; the download is audit-logged).</li>
          <li>Verify its sha256 checksum matches the run record before touching the database.</li>
          <li>Follow <span className="font-mono text-[12px]">docs/BACKUP_RESTORE.md</span> — guided table-ordered restore into a staging project first, then production.</li>
          <li>Recovery never overwrites from inside the app: there is deliberately no restore button.</li>
        </ol>
        <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
          Scope honesty: artifacts hold database tables only. File bytes (announcement covers, session-note images)
          stay in their private buckets — the backup records their paths so recovery can re-verify them.
        </p>
      </Card>
    </div>
  );
}
