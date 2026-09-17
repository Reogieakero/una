"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Check, ChevronDown, X } from "lucide-react";
import { DateRangeCalendar } from "@/components/ui/date-range-calendar";
import {
  REPORT_SECTIONS,
  fmtDayCompact,
  isCustomRangeValid,
  parseReportRange,
  parseReportSection,
  type ReportSection,
} from "@/lib/reports-scope";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "dorsu-reports-scope";

const RANGE_PRESETS = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "all", label: "All time" },
] as const;

type StoredScope = { section: string; preset: string; from: string; to: string };

function readStoredScope(): StoredScope | null {
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

function writeStoredScope(s: StoredScope) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Private mode etc. — persistence is best-effort, the URL still scopes.
  }
}

/**
 * Report scope controls — one right-aligned row, no card background:
 * a Section dropdown plus a Date-range button that opens a modal
 * (presets or a custom from/to range). URL-driven via replace() so the
 * server streams the scoped report and print/export see the same scope;
 * the last selection also persists locally so a refresh restores it.
 * Explicit URL params always win over the stored selection.
 */
export function ReportsFilters({
  section,
  preset,
  fromDay,
  toDay,
  rangeLabel,
}: {
  section: ReportSection;
  preset: string;
  fromDay: string;
  toDay: string;
  rangeLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sectionOpen, setSectionOpen] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const sectionCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState(fromDay);
  const [tempTo, setTempTo] = useState(toDay);
  const restored = useRef(false);

  const go = (patch: Record<string, string | null>) => {    const p = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  // Section menu — same hover/click floating-panel behavior as the dashboard
  // Stats button: opens on hover or click, closes on mouse leave (with a
  // short grace period), outside click, or Escape.
  const openSectionMenu = () => {
    if (sectionCloseTimer.current) clearTimeout(sectionCloseTimer.current);
    setSectionOpen(true);
  };
  const scheduleSectionClose = () => {
    if (sectionCloseTimer.current) clearTimeout(sectionCloseTimer.current);
    sectionCloseTimer.current = setTimeout(() => setSectionOpen(false), 150);
  };
  const toggleSectionMenu = () => {
    if (sectionCloseTimer.current) clearTimeout(sectionCloseTimer.current);
    setSectionOpen((v) => !v);
  };

  useEffect(() => {
    if (!sectionOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (sectionRef.current && !sectionRef.current.contains(e.target as Node)) setSectionOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSectionOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      if (sectionCloseTimer.current) clearTimeout(sectionCloseTimer.current);
    };
  }, [sectionOpen]);

  // Restore the last selection on first load — only when the URL carries
  // no scope of its own (shared/bookmarked links always win).
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
  const pickSection = (v: string) => {
    const s = v as ReportSection;
    // Always write the param explicitly — a missing ?section= now means the
    // "sessions" default, so "All" must be set, not deleted.
    go({ section: s });
    writeStoredScope({ section: s, preset, from: fromDay, to: toDay });
  };

  const pickPreset = (key: string) => {
    setTempFrom("");
    setTempTo("");
    go({ range: key === "all" ? null : key, from: null, to: null });
    writeStoredScope({ section, preset: key, from: "", to: "" });
    setRangeOpen(false);
  };

  const customValid = isCustomRangeValid(tempFrom, tempTo);

  const applyCustom = () => {
    if (!customValid) return;
    go({ range: null, from: tempFrom, to: tempTo });
    writeStoredScope({ section, preset: "custom", from: tempFrom, to: tempTo });
    setRangeOpen(false);
  };

  const clearRange = () => {
    setTempFrom("");
    setTempTo("");
    go({ range: null, from: null, to: null });
    writeStoredScope({ section, preset: "all", from: "", to: "" });
    setRangeOpen(false);
  };

  const openRangeModal = () => {
    setTempFrom(fromDay);
    setTempTo(toDay);
    setRangeOpen(true);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
        <div ref={sectionRef} className="relative" onMouseEnter={openSectionMenu} onMouseLeave={scheduleSectionClose}>
          <button
            type="button"
            onClick={toggleSectionMenu}
            onFocus={openSectionMenu}
            onBlur={scheduleSectionClose}
            aria-haspopup="listbox"
            aria-expanded={sectionOpen}
            aria-label="Report section"
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3.5 py-1.5 text-[13px] font-bold text-ink-soft shadow-card transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <span className="truncate">
              {REPORT_SECTIONS.find((s) => s.key === section)?.label ?? "All"}
            </span>
            <ChevronDown
              aria-hidden
              className={cn("h-4 w-4 transition-transform", sectionOpen && "rotate-180")}
            />
          </button>
          {sectionOpen && (
            <ul
              role="listbox"
              aria-label="Report section"
              className="absolute right-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-xl border border-ink/10 bg-white py-1 shadow-card"
            >
              {REPORT_SECTIONS.map((s) => {
                const active = s.key === section;
                return (
                  <li key={s.key} role="option" aria-selected={active}>
                    <button
                      type="button"
                      onClick={() => {
                        pickSection(s.key);
                        setSectionOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-[13px] transition hover:bg-cream focus-visible:outline-none focus-visible:bg-cream",
                        active ? "font-bold text-primary-700" : "font-medium text-ink-soft hover:text-ink"
                      )}
                    >
                      <span className="truncate">{s.label}</span>
                      {active && <Check aria-hidden className="h-4 w-4 shrink-0 text-primary-600" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={openRangeModal}
          aria-haspopup="dialog"
          className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3.5 py-1.5 text-[13px] font-bold text-ink-soft shadow-card transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          <CalendarDays className="h-4 w-4" aria-hidden />
          {rangeLabel}
        </button>
      </div>

      {rangeOpen && (
        <RangeModal
          preset={preset}
          tempFrom={tempFrom}
          tempTo={tempTo}
          onClose={() => setRangeOpen(false)}
          onPickPreset={pickPreset}
          onRangeChange={(from, to) => {
            setTempFrom(from);
            setTempTo(to);
          }}
          onApply={applyCustom}
          onClear={clearRange}
        />
      )}
    </>
  );
}

/** Date-range modal — Quick presets or a Custom shadcn-style range calendar. Never scrolls. */
function RangeModal({
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
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-ink/10 bg-white p-5 shadow-card">
        <div className="flex items-center gap-3">
          <h2 className="min-w-0 flex-1 font-display text-base font-bold text-ink">Date range</h2>
          <div role="tablist" aria-label="Range mode" className="flex shrink-0 rounded-full bg-cream p-1">
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
                  "rounded-full px-3 py-1 text-[13px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft transition hover:bg-cream-dark hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
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
                      "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                      active ? "bg-primary-50 font-bold text-primary-700" : "font-medium text-ink-soft hover:bg-cream hover:text-ink"
                    )}
                  >
                    {r.label}
                    {active && <Check aria-hidden className="h-4 w-4 shrink-0 text-primary-600" />}
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
                className="rounded-full px-3 py-1.5 text-[13px] font-bold text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={onApply}
                disabled={!customValid}
                className="rounded-full bg-primary-600 px-5 py-1.5 text-[13px] font-bold text-white shadow-soft transition hover:bg-primary-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
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

/** Slim exact-position skeleton for the filter row while it streams in. */
export function ReportsFiltersSkeleton() {
  return (
    <div aria-hidden className="flex animate-pulse items-center justify-end gap-2">
      <div className="h-9 w-32 rounded-full bg-ink/10" />
      <div className="h-9 w-40 rounded-full bg-ink/10" />
    </div>
  );
}
