"use client";

import type { CalendarSession } from "@/lib/hooks/use-sessions-calendar";
import { STATUS_PILL, WEEKDAYS, dayKey, formatTime, sameDay, statusLabel, weekDays } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import type { CalendarGridHandlers } from "./month-grid";

const WEEK_CHIP_LIMIT = 6;

/**
 * Full-width week view — seven tall day columns. The day cell opens the
 * overlay (when `daysClickable`), and each session chip opens the overlay with
 * that session expanded.
 */
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
  /** Week cells open the day overlay; kept explicit for reuse in day views. */
  daysClickable: boolean;
} & CalendarGridHandlers) {
  const cells = weekDays(cursor);
  return (
    <div className="overflow-x-auto pb-1">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((w) => (
            <span
              key={w}
              className="pb-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-ink-faint"
            >
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((d, i) => {
            const k = dayKey(d);
            const daySessions = byDay.get(k) ?? [];
            const isToday = sameDay(d, today);
            const isSelected = sameDay(d, selectedDay);
            const shown = daySessions.slice(0, WEEK_CHIP_LIMIT);
            const overflow = daySessions.length - shown.length;
            return (
              <div
                key={`${k}-${i}`}
                role={daysClickable ? "button" : undefined}
                tabIndex={daysClickable ? 0 : undefined}
                onClick={() => {
                  if (daysClickable) onPickDay(d);
                }}
                onKeyDown={(e) => {
                  if (!daysClickable) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onPickDay(d);
                  }
                }}
                aria-label={
                  daysClickable
                    ? `${d.toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}, ${daySessions.length} session${daySessions.length === 1 ? "" : "s"} — open day schedule`
                    : undefined
                }
                className={cn(
                  "flex min-h-[220px] flex-col rounded-lg border p-2 text-left transition",
                  daysClickable && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                  isSelected
                    ? "border-primary-400 bg-primary-50 ring-1 ring-primary-300"
                    : "border-ink/10 bg-white",
                  daysClickable && !isSelected && "hover:border-primary-300 hover:bg-primary-50 hover:shadow-soft"
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={cn(
                      "inline-flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold",
                      isToday ? "bg-primary-600 text-white shadow-soft" : "text-ink"
                    )}
                  >
                    {d.getDate()}
                  </span>
                  <span className="text-[10px] font-semibold text-ink-faint">
                    {d.toLocaleDateString("en-US", { month: "short" })}
                  </span>
                </div>

                <div className="mt-2 space-y-1">
                  {shown.map((s) => {
                    const alias = s.student_id ? (aliases.get(s.student_id) ?? "Student") : "Walk-in";
                    return (
                      <button
                        key={s.id}
                        type="button"
                        aria-label={`${alias} at ${formatTime(s.scheduled_at)}, ${statusLabel(s.status)} — open session details`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPickSession(s);
                        }}
                        onKeyDown={(e) => e.stopPropagation()}
                        className={cn(
                          "block w-full cursor-pointer truncate rounded-md px-1.5 py-1 text-left text-[11px] font-bold transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                          STATUS_PILL[s.status] ?? "bg-ink/10 text-ink-muted",
                          selectedId === s.id && "ring-2 ring-ink/30"
                        )}
                      >
                        {formatTime(s.scheduled_at)} · {alias}
                      </button>
                    );
                  })}
                  {overflow > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onExpandDay(d);
                      }}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="block w-full cursor-pointer rounded px-1.5 text-left text-[11px] font-bold text-primary-700 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                    >
                      +{overflow} more
                    </button>
                  )}
                </div>

                {daysClickable && daySessions.length === 0 && (
                  <span className="mt-auto rounded-md border border-dashed border-ink/10 px-2 py-1 text-center text-[10px] font-medium text-ink-faint">
                    Open day
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
