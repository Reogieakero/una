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
 * range selection in the app's ui-tokens palette. Date-only (YYYY-MM-DD),
 * all dates selectable (report history needs the past).
 *
 * Controlled by `from`/`to` day strings. Tapping a day starts a new range,
 * or completes it when it lands on/after the start; tapping before the
 * start restarts the range there.
 */
export function DateRangeCalendar({
  from,
  to,
  onChange,
  ariaLabel = "Choose a custom date range",
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  ariaLabel?: string;
}) {
  const seed = from || to;
  const seedParts = seed ? seed.split("-").map(Number) : null;
  const now = new Date();
  const [viewY, setViewY] = useState(seedParts ? seedParts[0] : now.getFullYear());
  const [viewM, setViewM] = useState(seedParts ? seedParts[1] - 1 : now.getMonth());

  const first = new Date(viewY, viewM, 1).getDay();
  const days = new Date(viewY, viewM + 1, 0).getDate();
  const cells: ({ day: number } | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push({ day: d });

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
        <p className="font-display text-sm font-bold text-ink">
          {MONTHS[viewM]} {viewY}
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => stepMonth(-1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-ink/15 bg-white text-ink transition-colors hover:border-primary-400 hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => stepMonth(1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-ink/15 bg-white text-ink transition-colors hover:border-primary-400 hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* Range grid */}
      <div className="mt-2 grid grid-cols-7 gap-1" role="grid" aria-label="Choose start and end dates">
        {WEEKDAYS.map((w) => (
          <span key={w} className="pb-1 text-center text-[11px] font-bold uppercase text-ink-faint">
            {w}
          </span>
        ))}
        {cells.map((c, i) => {
          if (!c) return <span key={`gap-${i}`} />;
          const day = toDayStr(viewY, viewM, c.day);
          const isStart = from !== "" && day === from;
          const isEnd = to !== "" && day === to;
          const inBetween = from !== "" && to !== "" && day > from && day < to;
          return (
            <button
              key={c.day}
              type="button"
              role="gridcell"
              aria-selected={isStart || isEnd}
              aria-label={`${MONTHS[viewM]} ${c.day}${isStart ? ", range start" : ""}${isEnd ? ", range end" : ""}`}
              onClick={() => pickDay(c.day)}
              className={cn(
                "inline-flex h-8 w-full items-center justify-center rounded text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                isStart || isEnd
                  ? "bg-primary-600 text-white shadow-soft"
                  : inBetween
                    ? "bg-primary-50 text-primary-700"
                    : "text-ink hover:bg-cream"
              )}
            >
              {c.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
