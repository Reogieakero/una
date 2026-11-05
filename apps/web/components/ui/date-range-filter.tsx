"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarRange, Check, ChevronDown, Loader2, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { DateRangeCalendar } from "./date-range-calendar";

export type DateRangeFilterPreset = { key: string; label: string };

export type DateRangeSelection = {
  /** Selected preset key, or "custom". */
  preset: string;
  /** YYYY-MM-DD; empty unless preset === "custom". */
  from: string;
  to: string;
};

const TONE = {
  dark: {
    trigger:
      "border-white/15 bg-white/[0.05] text-white hover:border-white/30 hover:bg-white/[0.09] focus-visible:ring-yellow-300/70",
    triggerIcon: "text-yellow-300",
    triggerMuted: "text-blue-100/50",
    panel:
      "border-white/10 bg-[#07101D]/95 shadow-[0_28px_80px_-20px_rgba(0,0,0,0.95)] backdrop-blur-xl",
    heading: "text-blue-100/40",
    presetActive: "border-yellow-300/40 bg-yellow-400/10 text-yellow-200",
    presetIdle:
      "border-white/10 bg-white/[0.03] text-blue-100/60 hover:border-white/20 hover:text-white",
    customPanel: "border-white/10 bg-white/[0.03]",
    customLabel: "text-blue-100/50",
    customValue: "text-blue-100/60",
    customSeparator: "text-blue-100/30",
    calendarWrap: "border-white/10 bg-[#07101D]/60",
    apply:
      "bg-yellow-400 text-ink hover:bg-yellow-300 focus-visible:ring-yellow-200",
    clear: "text-yellow-200 hover:text-yellow-100",
    error: "text-red-300",
    footer: "text-blue-100/30",
  },
  light: {
    trigger:
      "border-ink/10 bg-white text-ink-soft shadow-card hover:border-primary-300 hover:text-primary-700 focus-visible:ring-primary-400",
    triggerIcon: "text-primary-600",
    triggerMuted: "text-ink-faint",
    panel: "border-ink/10 bg-white shadow-[0_24px_60px_-18px_rgba(15,23,42,0.35)]",
    heading: "text-ink-faint",
    presetActive: "border-primary-300 bg-primary-50 text-primary-700",
    presetIdle:
      "border-ink/10 bg-cream/50 text-ink-muted hover:border-primary-300 hover:text-primary-700",
    customPanel: "border-ink/10 bg-cream/40",
    customLabel: "text-ink-faint",
    customValue: "text-ink-muted",
    customSeparator: "text-ink-faint",
    calendarWrap: "border-ink/10 bg-white",
    apply:
      "bg-primary-600 text-white shadow-soft hover:bg-primary-700 focus-visible:ring-primary-400",
    clear: "text-primary-700 hover:underline",
    error: "text-red-600",
    footer: "text-ink-faint",
  },
} as const;

/**
 * Shared date-range filter — the "Stats · <range>" pill and its popover.
 *
 * One implementation serves the dark dashboard hero and the light reports
 * header. Presets apply immediately; "Custom" reveals an inline range
 * calendar and an Apply button. The parent owns the applied value and decides
 * what a selection means (dashboard state vs. URL params on /reports).
 */
export function DateRangeFilter({
  presets,
  preset,
  from,
  to,
  rangeLabel,
  pending = false,
  tone = "light",
  size = "md",
  labelPrefix = "Stats",
  dialogLabel = "Date range",
  footer,
  customDefaults,
  disableFuture = false,
  validateCustom,
  onApply,
  onClear,
}: {
  /** Preset buttons, including a final `{ key: "custom" }` entry. */
  presets: DateRangeFilterPreset[];
  /** Currently applied preset key (or "custom"). */
  preset: string;
  /** Applied custom start day (YYYY-MM-DD), "" when not custom. */
  from: string;
  /** Applied custom end day (YYYY-MM-DD), "" when not custom. */
  to: string;
  /** Human-readable label for the trigger. */
  rangeLabel: string;
  /** Shows a spinner in the trigger while the scoped data refetches. */
  pending?: boolean;
  /** Dark dashboard canvas or light staff-shell surface. */
  tone?: "dark" | "light";
  size?: "sm" | "md";
  /** Prefix shown before the range label on wider screens. */
  labelPrefix?: string;
  dialogLabel?: string;
  /** Optional caption at the bottom of the popover. */
  footer?: string;
  /** Seed days for an empty custom range. */
  customDefaults?: { from: string; to: string };
  /** Prevent picking days after today (dashboard has no future data). */
  disableFuture?: boolean;
  /** Returns an error message when the custom window is not allowed. */
  validateCustom?: (from: string, to: string) => string | null;
  onApply: (selection: DateRangeSelection) => void;
  /** When provided, renders a Clear action inside the custom panel. */
  onClear?: () => void;
}) {
  const t = TONE[tone];
  const [open, setOpen] = useState(false);
  const [draftPreset, setDraftPreset] = useState(preset);
  const [draftFrom, setDraftFrom] = useState(from || customDefaults?.from || "");
  const [draftTo, setDraftTo] = useState(to || customDefaults?.to || "");
  const ref = useRef<HTMLDivElement>(null);

  // Re-seed the drafts whenever the menu opens, so it always reflects the
  // currently applied selection rather than a half-finished one.
  useEffect(() => {
    if (!open) return;
    setDraftPreset(preset);
    setDraftFrom(from || customDefaults?.from || "");
    setDraftTo(to || customDefaults?.to || "");
    // `customDefaults` is a deliberate seed, not a dependency to track.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preset, from, to]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const customOpen = draftPreset === "custom";

  const pickPreset = (key: string) => {
    if (key === "custom") {
      setDraftPreset("custom");
      return;
    }
    onApply({ preset: key, from: "", to: "" });
    setOpen(false);
  };

  const applyCustom = () => {
    if (!draftFrom || !draftTo) return;
    const nextFrom = draftFrom <= draftTo ? draftFrom : draftTo;
    const nextTo = draftFrom <= draftTo ? draftTo : draftFrom;
    if (validateCustom?.(nextFrom, nextTo)) return;
    onApply({ preset: "custom", from: nextFrom, to: nextTo });
    setOpen(false);
  };

  const customError =
    draftFrom && draftTo ? validateCustom?.(draftFrom, draftTo) ?? null : null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${dialogLabel} · ${rangeLabel}`}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border font-bold transition backdrop-blur focus-visible:outline-none focus-visible:ring-2",
          size === "sm" ? "h-7 px-3 text-[11px]" : "h-8 gap-2 px-3.5 text-[11px]",
          t.trigger
        )}
      >
        {pending ? (
          <Loader2 className={cn("h-3.5 w-3.5 animate-spin", t.triggerIcon)} aria-hidden />
        ) : (
          <SlidersHorizontal className={cn("h-3.5 w-3.5", t.triggerIcon)} aria-hidden />
        )}
        <span className={cn("hidden sm:inline", t.triggerMuted)}>{labelPrefix} ·</span>
        {rangeLabel}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            t.triggerMuted,
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={dialogLabel}
          className={cn(
            "absolute right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border p-3",
            size === "sm" ? "w-[280px]" : "w-[320px]",
            t.panel
          )}
        >
          <p className={cn("px-1 text-[10px] font-bold uppercase tracking-[0.16em]", t.heading)}>
            Period
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {presets.map((p) => {
              const active = draftPreset === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => pickPreset(p.key)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border text-[12px] font-bold transition focus-visible:outline-none focus-visible:ring-2",
                    tone === "dark" ? "focus-visible:ring-yellow-300/70" : "focus-visible:ring-primary-400",
                    active ? t.presetActive : t.presetIdle
                  )}
                >
                  {active && <Check className="h-3 w-3" aria-hidden />}
                  {p.label}
                </button>
              );
            })}
          </div>

          {customOpen && (
            <div className={cn("mt-2 rounded-xl border p-2.5", t.customPanel)}>
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em]",
                    t.customLabel
                  )}
                >
                  <CalendarRange className="h-3.5 w-3.5" aria-hidden />
                  Custom range
                </span>
                <span className={cn("text-[10px] font-semibold", t.customValue)}>
                  {draftFrom || "Pick a start"}
                  <span aria-hidden className={cn("px-1", t.customSeparator)}>
                    –
                  </span>
                  {draftTo || "pick an end"}
                </span>
              </div>

              <div className={cn("mt-2 rounded-lg border p-2", t.calendarWrap)}>
                <DateRangeCalendar
                  from={draftFrom}
                  to={draftTo}
                  tone={tone}
                  disableFuture={disableFuture}
                  onChange={(nextFrom, nextTo) => {
                    setDraftFrom(nextFrom);
                    setDraftTo(nextTo);
                  }}
                />
              </div>

              {customError && (
                <p className={cn("mt-1.5 text-center text-[11px] font-semibold", t.error)}>
                  {customError}
                </p>
              )}

              <div className="mt-2 flex items-center justify-between gap-2">
                {onClear ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClear();
                      setOpen(false);
                    }}
                    className={cn(
                      "inline-flex h-8 items-center rounded px-2 text-[12px] font-bold transition focus-visible:outline-none focus-visible:ring-2",
                      tone === "dark" ? "focus-visible:ring-yellow-300/70" : "focus-visible:ring-primary-400",
                      t.clear
                    )}
                  >
                    Clear
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={applyCustom}
                  disabled={!draftFrom || !draftTo || !!customError}
                  className={cn(
                    "inline-flex h-8 items-center justify-center rounded-lg px-4 text-[12px] font-bold transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2",
                    t.apply
                  )}
                >
                  Apply range
                </button>
              </div>
            </div>
          )}

          {footer && (
            <p className={cn("mt-3 px-1 text-[10px] leading-relaxed", t.footer)}>{footer}</p>
          )}
        </div>
      )}
    </div>
  );
}
