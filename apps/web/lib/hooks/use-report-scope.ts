"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseReportRange, parseReportSection } from "@/lib/reports-scope";

/**
 * Report-scope persistence — URL ↔ localStorage sync for ReportsFilters.
 * Extracted from components/shared/reports-filters.tsx. Explicit URL params
 * always win over the stored selection; the stored selection restores only
 * when the URL carries no scope of its own.
 */

const STORAGE_KEY = "dorsu-reports-scope";

export type StoredScope = { section: string; preset: string; from: string; to: string };

export function readStoredScope(): StoredScope | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<StoredScope>;
    return {
      section: typeof s.section === "string" ? s.section : "all",
      preset: typeof s.preset === "string" ? s.preset : "all",
      from: typeof s.from === "string" ? s.from : "",
      to: typeof s.to === "string" ? s.to : "",
    };
  } catch {
    return null;
  }
}

export function writeStoredScope(s: StoredScope) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Private mode etc. — persistence is best-effort, the URL still scopes.
  }
}

/** Restore the last selection on first load — only when the URL carries no scope of its own. */
export function useRestoreReportScope() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const sp = new URLSearchParams(searchParams.toString());
    if (sp.has("section") || sp.has("range") || sp.has("from") || sp.has("to")) return;
    const stored = readStoredScope();
    if (!stored) return;
    const sec = parseReportSection(stored.section);
    const r = parseReportRange({
      range: stored.preset === "custom" ? undefined : stored.preset,
      from: stored.from,
      to: stored.to,
    });
    const patch: Record<string, string | null> = {
      section: sec !== "sessions" ? sec : null,
      range: r.preset !== "all" && r.preset !== "custom" ? r.preset : null,
      from: r.preset === "custom" && r.from ? r.from.slice(0, 10) : null,
      to: r.preset === "custom" && r.to ? r.to.slice(0, 10) : null,
    };
    if (patch.section || patch.range || patch.from) {
      const p = new URLSearchParams();
      for (const [k, v] of Object.entries(patch)) {
        if (v) p.set(k, v);
      }
      router.replace(`${pathname}?${p.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
