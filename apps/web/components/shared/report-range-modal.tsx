"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { DateRangeCalendar } from "@/components/ui/date-range-calendar";
import { fmtDayCompact, isCustomRangeValid } from "@/lib/reports-scope";
import { cn } from "@/lib/utils";

const RANGE_PRESETS = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "all", label: "All time" },
] as const;

/** Date-range modal — Quick presets or a Custom shadcn-style range calendar. Never scrolls. */
export function ReportRangeModal({
  preset,
  tempFrom,
  tempTo,
  onClose,
  onPickPreset,
  onRangeChange,
  onApply,
  onClear,
}: {
  preset: string;
  tempFrom: string;
  tempTo: string;
  onClose: () => void;
  onPickPreset: (key: string) => void;
  onRangeChange: (from: string, to: string) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  const [tab, setTab] = useState<"quick" | "custom">(preset === "custom" ? "custom" : "quick");
  // Lock background scroll + Escape to dismiss while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const customActive = preset === "custom";
  const customValid = isCustomRangeValid(tempFrom, tempTo);
  const summary =
    tempFrom && tempTo
      ? `${fmtDayCompact(tempFrom)} – ${fmtDayCompact(tempTo)}`
      : tempFrom
        ? `${fmtDayCompact(tempFrom)} – pick an end date`
        : "Tap a start date, then an end date.";

  return (
    <div role="dialog" aria-modal="true" aria-label="Choose date range" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close date range" onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <div className="flex items-center gap-3">
          <h2 className="min-w-0 flex-1 font-display text-base font-bold text-ink">Date range</h2>
          <div role="tablist" aria-label="Range mode" className="flex shrink-0 rounded bg-cream p-1">
            {(
              [
                { key: "quick", label: "Quick" },
                { key: "custom", label: "Custom" },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "h-8 rounded px-3 text-[13px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                  tab === t.key ? "bg-white text-primary-700 shadow-card" : "text-ink-muted hover:text-ink"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label="Close date range"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-ink-soft transition hover:bg-cream-dark hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {tab === "quick" ? (
          <ul className="mt-3 space-y-0.5">
            {RANGE_PRESETS.map((r) => {
              const active = !customActive && preset === r.key;
              return (
                <li key={r.key}>
                  <button
                    type="button"
                    onClick={() => onPickPreset(r.key)}
                    aria-pressed={active}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                      active ? "bg-primary-50 font-bold text-primary-700" : "font-medium text-ink-soft hover:bg-cream hover:text-ink"
                    )}
                  >
                    {r.label}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-3">
            <DateRangeCalendar from={tempFrom} to={tempTo} onChange={onRangeChange} />
            <p aria-live="polite" className="mt-2 text-center text-[13px] font-semibold text-ink-soft">
              {summary}
            </p>
            {!customValid && tempFrom && tempTo && (
              <p className="mt-1 text-center text-xs font-semibold text-red-600">
                Keep the range within 12 months.
              </p>
            )}
            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onClear}
                className="inline-flex h-8 items-center rounded px-3 text-[13px] font-bold text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={onApply}
                disabled={!customValid}
                className="inline-flex h-8 items-center rounded bg-primary-600 px-4 text-[13px] font-bold text-white shadow-soft transition hover:bg-primary-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
