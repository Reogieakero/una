"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dropdown } from "../shared/dropdown";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "YYYY-MM-DDTHH:mm" (local) → parts. Falls back to now on bad input. */
function parseValue(value: string): { y: number; m: number; d: number; h: number; min: number } {
  const now = new Date();
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) {
    return { y: now.getFullYear(), m: now.getMonth(), d: now.getDate(), h: now.getHours(), min: now.getMinutes() };
  }
  return {
    y: Number(m[1]),
    m: Number(m[2]) - 1,
    d: Number(m[3]),
    h: Number(m[4]),
    min: Number(m[5]),
  };
}

function compose(y: number, m: number, d: number, h: number, min: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}T${pad(h)}:${pad(min)}`;
}

function to12h(h24: number): { h12: string; period: "AM" | "PM" } {
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { h12: pad(h12), period };
}

function from12h(h12: string, period: "AM" | "PM"): number {
  const n = Number(h12) % 12;
  return period === "PM" ? n + 12 : n;
}

const MINUTES = ["00", "15", "30", "45"];
const HOURS_12 = Array.from({ length: 12 }, (_, i) => pad(i + 1));

/**
 * shadcn-style date + time picker — calendar grid + time selects in the
 * app's ui-tokens palette. Replaces the native `datetime-local` input so
 * the counselor schedule step matches the rest of the design system.
 *
 * Controlled via a local `YYYY-MM-DDTHH:mm` string (same shape as the
 * datetime-local value it replaces).
 *
 * Optional availability gates (omit for the unconstrained behavior):
 * `isDayEnabled` disables calendar days outside coverage (e.g. counselor
 * availability), `isTimeEnabled` filters the hour/minute options to moments
 * inside coverage — picking a day snaps the time to its first valid moment.
 */
export function DateTimePicker({
  id,
  value,
  onChange,
  ariaLabel = "Session date and time",
  isDayEnabled,
  isTimeEnabled,
  scopeHint,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
  /** Local YYYY-MM-DD → false disables that calendar day. */
  isDayEnabled?: (dateISO: string) => boolean;
  /** Local YYYY-MM-DD + 24h hour/minute → false hides that time option. */
  isTimeEnabled?: (dateISO: string, hour24: number, minute: number) => boolean;
  /** Hint shown under the time selects (e.g. the covering slot window). */
  scopeHint?: string | null;
}) {
  const parts = parseValue(value);
  const [viewY, setViewY] = useState(parts.y);
  const [viewM, setViewM] = useState(parts.m);
  // One open menu at a time across the hour / minute / period dropdowns.
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);

  const today = useMemo(() => {
    const n = new Date();
    n.setHours(0, 0, 0, 0);
    return n;
  }, []);

  const cells = useMemo(() => {
    const first = new Date(viewY, viewM, 1).getDay();
    const days = new Date(viewY, viewM + 1, 0).getDate();
    const list: ({ day: number } | null)[] = [];
    for (let i = 0; i < first; i++) list.push(null);
    for (let d = 1; d <= days; d++) list.push({ day: d });
    return list;
  }, [viewY, viewM]);

  const { h12, period } = to12h(parts.h);
  const minute = MINUTES.includes(pad(parts.min)) ? pad(parts.min) : "00";
  const selectedISO = `${parts.y}-${pad(parts.m + 1)}-${pad(parts.d)}`;

  const hourOptions = HOURS_12.filter(
    (h) => !isTimeEnabled || MINUTES.some((mm) => isTimeEnabled(selectedISO, from12h(h, period), Number(mm)))
  );
  const minuteOptions = MINUTES.filter(
    (mm) => !isTimeEnabled || isTimeEnabled(selectedISO, from12h(h12, period), Number(mm))
  );

  const firstValidMoment = (dayISO: string): { h: number; min: number } | null => {
    if (!isTimeEnabled) return null;
    for (let h = 0; h < 24; h++) {
      for (const mm of MINUTES) {
        if (isTimeEnabled(dayISO, h, Number(mm))) return { h, min: Number(mm) };
      }
    }
    return null;
  };

  const pickDay = (day: number) => {
    const dayISO = `${viewY}-${pad(viewM + 1)}-${pad(day)}`;
    if (isTimeEnabled && !isTimeEnabled(dayISO, parts.h, parts.min)) {
      // Snap to the new day's first valid moment instead of stranding the
      // time selects on an out-of-scope value.
      const snap = firstValidMoment(dayISO);
      if (snap) onChange(compose(viewY, viewM, day, snap.h, snap.min));
      return;
    }
    onChange(compose(viewY, viewM, day, parts.h, parts.min));
  };

  const pickTime = (next: { h12?: string; min?: string; period?: "AM" | "PM" }) => {
    const h = from12h(next.h12 ?? h12, next.period ?? period);
    const m = Number(next.min ?? minute);
    if (isTimeEnabled && !isTimeEnabled(selectedISO, h, m)) {
      // Period/hour switches can strand the moment outside coverage — snap
      // to the day's first valid moment so the value stays bookable.
      const snap = firstValidMoment(selectedISO);
      if (snap) {
        onChange(compose(parts.y, parts.m, parts.d, snap.h, snap.min));
        return;
      }
    }
    onChange(compose(parts.y, parts.m, parts.d, h, m));
  };

  const stepMonth = (dir: 1 | -1) => {
    const d = new Date(viewY, viewM + dir, 1);
    setViewY(d.getFullYear());
    setViewM(d.getMonth());
  };

  const selectedLabel = new Date(parts.y, parts.m, parts.d, parts.h, parts.min).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div id={id} role="group" aria-label={ariaLabel} className="rounded-lg border border-ink/15 bg-white p-4 shadow-card">
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
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-ink/15 bg-white text-ink transition-colors hover:border-primary-400 hover:bg-cream"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => stepMonth(1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-ink/15 bg-white text-ink transition-colors hover:border-primary-400 hover:bg-cream"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="mt-3 grid grid-cols-7 gap-1" role="grid" aria-label="Choose a day">
        {WEEKDAYS.map((w) => (
          <span key={w} className="pb-1 text-center text-[11px] font-bold uppercase text-ink-faint">
            {w}
          </span>
        ))}
        {cells.map((c, i) => {
          if (!c) return <span key={`gap-${i}`} />;
          const date = new Date(viewY, viewM, c.day);
          const cellISO = `${viewY}-${pad(viewM + 1)}-${pad(c.day)}`;
          const disabled = date < today || (isDayEnabled ? !isDayEnabled(cellISO) : false);
          const selected = parts.y === viewY && parts.m === viewM && parts.d === c.day;
          return (
            <button
              key={c.day}
              type="button"
              role="gridcell"
              aria-selected={selected}
              aria-label={`${MONTHS[viewM]} ${c.day}`}
              disabled={disabled}
              onClick={() => pickDay(c.day)}
              className={cn(
                "inline-flex h-8 w-full items-center justify-center rounded text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                selected
                  ? "bg-primary-600 text-white shadow-soft"
                  : "text-ink hover:bg-cream",
                disabled && "cursor-not-allowed text-ink-faint/50 hover:bg-transparent"
              )}
            >
              {c.day}
            </button>
          );
        })}
      </div>

      {/* Time selects */}
      <div className="mt-3 border-t border-ink/10 pt-3">
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink-muted">
          <Clock className="h-3.5 w-3.5" aria-hidden /> Time · {selectedLabel}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Dropdown
            menuKey="dtp-hour"
            openMenuKey={openMenuKey}
            onOpenChange={setOpenMenuKey}
            value={h12}
            onChange={(v) => pickTime({ h12: v })}
            ariaLabel="Hour"
            options={hourOptions.map((h) => ({ value: h, label: h }))}
          />
          <Dropdown
            menuKey="dtp-minute"
            openMenuKey={openMenuKey}
            onOpenChange={setOpenMenuKey}
            value={minute}
            onChange={(v) => pickTime({ min: v })}
            ariaLabel="Minute"
            options={minuteOptions.map((m) => ({ value: m, label: m }))}
          />
          <Dropdown
            menuKey="dtp-period"
            openMenuKey={openMenuKey}
            onOpenChange={setOpenMenuKey}
            value={period}
            onChange={(v) => pickTime({ period: v as "AM" | "PM" })}
            ariaLabel="AM or PM"
            options={[
              { value: "AM", label: "AM" },
              { value: "PM", label: "PM" },
            ]}
          />
        </div>
        {scopeHint && (
          <p className="mt-1.5 text-[11px] font-medium text-ink-faint" aria-live="polite">
            {scopeHint}
          </p>
        )}
      </div>
    </div>
  );
}
