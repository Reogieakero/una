"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toDayStr(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

/**
 * shadcn-style date-range calendar — month grid with tap-start/tap-end
 * range selection in the app's ui-tokens palette. Date-only (YYYY-MM-DD).
 *
 * Controlled by `from`/`to` day strings. Tapping a day starts a new range,
 * or completes it when it lands on/after the start; tapping before the
 * start restarts the range there.
 *
 * `tone="dark"` matches the dashboard hero; `disableFuture` hides days after
 * today where future dates carry no data (dashboard).
 */
export function DateRangeCalendar({
  from,
  to,
  onChange,
  ariaLabel = "Choose a custom date range",
  tone = "light",
  disableFuture = false,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  ariaLabel?: string;
  tone?: "light" | "dark";
  disableFuture?: boolean;
}) {
  const seed = from || to;
  const seedParts = seed ? seed.split("-").map(Number) : null;
  const now = new Date();
  const [viewY, setViewY] = useState(seedParts ? seedParts[0] : now.getFullYear());
  const [viewM, setViewM] = useState(seedParts ? seedParts[1] - 1 : now.getMonth());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const first = new Date(viewY, viewM, 1).getDay();
  const days = new Date(viewY, viewM + 1, 0).getDate();
  const cells: ({ day: number } | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push({ day: d });

  const atCurrentMonth = viewY === today.getFullYear() && viewM === today.getMonth();
  const dark = tone === "dark";

  const pickDay = (day: number) => {
    const picked = toDayStr(viewY, viewM, day);
    if (!from || (from && to)) {
      onChange(picked, "");
    } else if (picked >= from) {
      onChange(from, picked);
    } else {
      onChange(picked, "");
    }
  };

  const stepMonth = (dir: 1 | -1) => {
    const d = new Date(viewY, viewM + dir, 1);
    setViewY(d.getFullYear());
    setViewM(d.getMonth());
  };

  return (
    <div role="group" aria-label={ariaLabel}>
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <p className={cn("font-display font-bold", dark ? "text-[12px] text-white" : "text-sm text-ink")}>
          {MONTHS[viewM]} {viewY}
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => stepMonth(-1)}
            className={cn(
              "inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2",
              dark
                ? "h-7 w-7 rounded-lg border border-white/10 bg-white/[0.04] text-blue-100/70 hover:border-white/25 hover:bg-white/[0.08] hover:text-white focus-visible:ring-yellow-300/60"
                : "h-8 w-8 rounded-full border border-ink/15 bg-white text-ink hover:border-primary-400 hover:bg-cream focus-visible:ring-primary-400"
            )}
          >
            <ChevronLeft className={dark ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => stepMonth(1)}
            disabled={disableFuture && atCurrentMonth}
            className={cn(
              "inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-30",
              dark
                ? "h-7 w-7 rounded-lg border border-white/10 bg-white/[0.04] text-blue-100/70 hover:border-white/25 hover:bg-white/[0.08] hover:text-white focus-visible:ring-yellow-300/60 disabled:hover:border-white/10 disabled:hover:bg-white/[0.04]"
                : "h-8 w-8 rounded-full border border-ink/15 bg-white text-ink hover:border-primary-400 hover:bg-cream focus-visible:ring-primary-400"
            )}
          >
            <ChevronRight className={dark ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
          </button>
        </div>
      </div>

      {/* Range grid */}
      <div
        className={cn("mt-2 grid grid-cols-7", dark ? "gap-0.5" : "gap-1")}
        role="grid"
        aria-label="Choose start and end dates"
      >
        {WEEKDAYS.map((w) => (
          <span
            key={w}
            className={cn(
              "pb-1 text-center font-bold uppercase",
              dark ? "text-[9px] tracking-wide text-blue-100/35" : "text-[11px] text-ink-faint"
            )}
          >
            {w}
          </span>
        ))}
        {cells.map((c, i) => {
          if (!c) return <span key={`gap-${i}`} />;
          const day = toDayStr(viewY, viewM, c.day);
          const isStart = from !== "" && day === from;
          const isEnd = to !== "" && day === to;
          const inBetween = from !== "" && to !== "" && day > from && day < to;
          const isToday =
            viewY === today.getFullYear() && viewM === today.getMonth() && c.day === today.getDate();
          const isFuture = disableFuture && new Date(viewY, viewM, c.day) > today;
          return (
            <button
              key={c.day}
              type="button"
              role="gridcell"
              aria-selected={isStart || isEnd}
              aria-label={`${MONTHS[viewM]} ${c.day}${isStart ? ", range start" : ""}${isEnd ? ", range end" : ""}`}
              disabled={isFuture}
              onClick={() => pickDay(c.day)}
              className={cn(
                "inline-flex w-full items-center justify-center font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2",
                dark
                  ? "h-7 rounded-md text-[11px] focus-visible:ring-yellow-300/60"
                  : "h-8 rounded text-sm focus-visible:ring-primary-400",
                isStart || isEnd
                  ? dark
                    ? "bg-yellow-400 text-ink shadow-soft"
                    : "bg-primary-600 text-white shadow-soft"
                  : inBetween
                    ? dark
                      ? "bg-blue-500/20 text-blue-100"
                      : "bg-primary-50 text-primary-700"
                    : dark
                      ? "text-blue-100/70 hover:bg-white/[0.08] hover:text-white"
                      : "text-ink hover:bg-cream",
                isToday && !isStart && !isEnd && (dark ? "ring-1 ring-inset ring-yellow-300/40" : ""),
                isFuture &&
                  (dark
                    ? "cursor-not-allowed text-blue-100/20 hover:bg-transparent hover:text-blue-100/20"
                    : "cursor-not-allowed text-ink/20 hover:bg-transparent")
              )}
            >
              {c.day}
            </button>
          );
        })}
      </div>

      {dark && (
        <p className="mt-2 text-[10px] leading-relaxed text-blue-100/35">
          {from && !to ? "Now pick the end date." : "Pick a start date, then an end date."}
        </p>
      )}
    </div>
  );
}
