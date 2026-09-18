"use client";

import type { CalendarSession } from "@/lib/hooks/use-sessions-calendar";
import { STATUS_PILL, formatTime, isSessionLive, statusLabel } from "@/lib/calendar";
import { cn } from "@/lib/utils";

/** Day schedule list — the selected day's sessions as selectable rows. */
export function DaySchedule({
  sessions,
  selectedId,
  aliases,
  role,
  counselorNames,
  onSelect,
  now,
}: {
  sessions: CalendarSession[];
  selectedId: string | null;
  aliases: Map<string, string>;
  role: string | null;
  counselorNames: Map<string, string>;
  onSelect: (id: string | null) => void;
  /** Current epoch ms (page ticks) — drives the live badge. */
  now: number;
}) {
  return (
    <>
      <ul className="mt-3 space-y-2">
        {sessions.map((s) => {
          const live = isSessionLive(s.scheduled_at, s.ends_at, now);
          return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelect(s.id === selectedId ? null : s.id)}
              aria-current={s.id === selectedId}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                s.id === selectedId
                  ? "border-primary-500 bg-primary-50/60"
                  : "border-ink/10 bg-white hover:border-primary-300 hover:bg-cream/60"
              )}
            >
              <span className="w-20 shrink-0 text-[13px] font-bold text-ink">{formatTime(s.scheduled_at)}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 truncate text-sm font-bold text-ink">
                  <span className="truncate">{s.student_id ? (aliases.get(s.student_id) ?? "Student") : "Walk-in"}</span>
                  {live && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-600 px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-white">
                      <span aria-hidden className="h-1 w-1 animate-pulse rounded-full bg-white" />
                      Live
                    </span>
                  )}
                </span>
                <span className="block truncate text-xs text-ink-muted">
                  {s.mode === "online" ? "Online" : "In person"}
                  {role === "guidance_head" && s.counselor_id ? ` · ${counselorNames.get(s.counselor_id) ?? "Counselor"}` : ""}
                </span>
              </span>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", STATUS_PILL[s.status] ?? "bg-ink/10 text-ink-muted")}>
                {statusLabel(s.status)}
              </span>
            </button>
          </li>
          );
        })}
      </ul>
      {!sessions.length && (
        <p className="mt-3 rounded-lg bg-cream px-4 py-3 text-center text-[13px] text-ink-muted">
          Pick another day — confirmed and upcoming sessions land here.
        </p>
      )}
    </>
  );
}
