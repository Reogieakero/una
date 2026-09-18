"use client";

import type { CalendarSession } from "@/lib/hooks/use-sessions-calendar";
import { STATUS_PILL, WEEKDAYS, dayKey, formatTime, sameDay, statusLabel, weekDays } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import type { CalendarGridHandlers } from "./month-grid";

/** Week/day view — 7 taller cells, up to 4 pills per day. */
export function WeekStrip({
  cursor,
  byDay,
  aliases,
  today,
  selectedDay,
  selectedId,
  daysClickable,
  onPickDay,
  onPickSession,
  onExpandDay,
}: {
  cursor: Date;
  byDay: Map<string, CalendarSession[]>;
  aliases: Map<string, string>;
  today: Date;
  selectedDay: Date;
  selectedId: string | null;
  /** Day view cells are not day-pickable (only their pills are). */
  daysClickable: boolean;
} & CalendarGridHandlers) {
  const cells = weekDays(cursor);
  return (
    <div className="mt-4">
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <span key={w} className="pb-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-ink-faint">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          const k = dayKey(d);
          const daySessions = byDay.get(k) ?? [];
          const isToday = sameDay(d, today);
          const isSelected = sameDay(d, selectedDay);
          const shown = daySessions.slice(0, 4);
          return (
            <button
              key={`${k}-${i}`}
              type="button"
              onClick={() => {
                if (!daysClickable) return;
                onPickDay(d);
              }}
              aria-label={`${d.toLocaleDateString("en-US", { month: "long", day: "numeric" })}, ${daySessions.length} sessions`}
              className={cn(
                "min-h-[120px] rounded-lg border p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                isSelected
                  ? "border-primary-500 bg-blue-50/60 ring-1 ring-primary-400"
                  : "border-ink/10 bg-white hover:border-primary-300 hover:bg-cream/60"
              )}
            >
              <span
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold",
                  isToday ? "bg-primary-600 text-white shadow-soft" : "text-ink"
                )}
              >
                {d.getDate()}
              </span>
              <span className="mt-1 space-y-1">
                {shown.map((s) => (
                  <span
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${s.student_id ? (aliases.get(s.student_id) ?? "Student") : "Walk-in"} at ${formatTime(s.scheduled_at)}, ${statusLabel(s.status)}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPickSession(s);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        onPickSession(s);
                      }
                    }}
                    className={cn(
                      "block w-full cursor-pointer truncate rounded-lg px-1.5 py-0.5 text-[11px] font-bold",
                      STATUS_PILL[s.status] ?? "bg-ink/10 text-ink-muted",
                      selectedId === s.id && "ring-2 ring-ink/40"
                    )}
                  >
                    {formatTime(s.scheduled_at)} · {s.student_id ? (aliases.get(s.student_id) ?? "Student") : "Walk-in"}
                  </span>
                ))}
                {daySessions.length > shown.length && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onExpandDay(d);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.stopPropagation();
                        onExpandDay(d);
                      }
                    }}
                    className="block cursor-pointer px-1.5 text-[11px] font-bold text-primary-700 hover:underline"
                  >
                    +{daySessions.length - shown.length} more
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
