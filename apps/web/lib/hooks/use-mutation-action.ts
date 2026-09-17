"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { logEvent } from "@/lib/log-event";

export type MutationResult<T> = { ok: true; data: T } | { ok: false };

/**
 * Standard mutation lifecycle, generalized from the appointment page's
 * `confirmBusyRef` / `runConfirming` pattern.
 *
 * - Tracks which row is busy (`busyId`) so callers can disable + spinner it.
 * - Ref-guards against re-entry (double-clicks, Escape-resubmits).
 * - Resolves the busy state the moment `fn` settles — callers run
 *   notify/refetch/toast AFTER `await run()` returns, so the spinner never
 *   waits on notification delivery or full-board refetches.
 * - Maps errors consistently: friendly service messages pass through,
 *   everything else becomes a reload-and-retry prompt.
 *
 * Wraps busy-state + error-mapping ONLY. Per-mutation guards
 * (`.eq("status", …)`, role-gates, transition tables, audit inserts) stay
 * inside the service functions, untouched.
 */
export function useMutationAction() {
  const [busyId, setBusyId] = useState<string | null>(null);
  const busyRef = useRef<string | null>(null);

  const run = useCallback(
    async <T>(
      id: string,
      fn: () => Promise<T>,
      opts: { label: string; friendly?: RegExp }
    ): Promise<MutationResult<T>> => {
      if (busyRef.current) return { ok: false };
      busyRef.current = id;
      setBusyId(id);
      const startedAt = Date.now();
      logEvent("MUTATION_STARTED", { label: opts.label, rowId: id });
      try {
        const data = await fn();
        logEvent("MUTATION_SUCCESS", { label: opts.label, rowId: id, durationMs: Date.now() - startedAt });
        return { ok: true, data };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        logEvent("MUTATION_FAILED", { label: opts.label, rowId: id, durationMs: Date.now() - startedAt });
        toast.error(
          e instanceof Error && opts.friendly && opts.friendly.test(msg)
            ? msg
            : `Couldn't ${opts.label} — please reload and try again.`
        );
        return { ok: false };
      } finally {
        busyRef.current = null;
        setBusyId(null);
      }
    },
    []
  );

  return { busyId, run };
}
