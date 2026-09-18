"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type BackupRun = {
  id: string;
  status: "running" | "completed" | "partial" | "failed";
  source: "manual" | "cron";
  tables: Record<string, number>;
  row_counts: Record<string, number>;
  total_rows: number;
  bytes: number;
  checksum: string | null;
  storage_path: string | null;
  warnings: string[];
  error: string | null;
  initiated_by: string | null;
  started_at: string;
  finished_at: string | null;
};

export type BackupRunCreated = {
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

export const BACKUPS_KEY = ["admin", "backups"] as const;

async function fetchBackupRuns(): Promise<BackupRun[]> {
  const res = await fetch("/api/admin/backups", { credentials: "same-origin" });
  const body = (await res.json().catch(() => null)) as { runs?: BackupRun[]; error?: string } | null;
  if (!res.ok) throw new Error(body?.error ?? "Couldn't load backup history.");
  return body?.runs ?? [];
}

export function useBackupRuns() {
  return useQuery({
    queryKey: [...BACKUPS_KEY],
    queryFn: fetchBackupRuns,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/**
 * Run-now mutation — exposes isPending for the button spinner. The export
 * can take a while (cold start + ~23 tables), so the page polls the history
 * after success rather than blocking on it.
 */
export function useRunBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<BackupRunCreated> => {
      const res = await fetch("/api/admin/backups", { method: "POST", credentials: "same-origin" });
      const body = (await res.json().catch(() => null)) as { run?: BackupRunCreated; error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? "Backup failed.");
      return (body as { run: BackupRunCreated }).run;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...BACKUPS_KEY] }).catch(() => {});
    },
  });
}

/** Short-lived (30 min) download URL for a finished artifact. */
export async function fetchBackupDownloadUrl(id: string): Promise<string> {
  const res = await fetch(`/api/admin/backups/download?id=${encodeURIComponent(id)}`, {
    credentials: "same-origin",
  });
  const body = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!res.ok) throw new Error(body?.error ?? "Couldn't prepare the download.");
  return (body as { url: string }).url;
}
