"use client";

import type { CalendarSession } from "@/lib/hooks/use-sessions-calendar";
import { STATUS_PILL, formatTime, statusLabel } from "@/lib/calendar";
import { cn } from "@/lib/utils";

/** Day schedule list — the selected day's sessions as selectable rows. */
export function DaySchedule({
  sessions,
  selectedId,
  aliases,
  role,
  counselorNames,
  onSelect,
}: {
  sessions: CalendarSession[];
  selectedId: string | null;
  aliases: Map<string, string>;
  role: string | null;
  counselorNames: Map<string, string>;
  onSelect: (id: string | null) => void;
}) {
  return (
    <>
      <ul className="mt-3 space-y-2">
        {sessions.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelect(s.id === selectedId ? null : s.id)}
              aria-current={s.id === selectedId}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors",
                s.id === selectedId
                  ? "border-primary-500 bg-blue-50/60"
                  : "border-ink/10 bg-white hover:border-primary-300 hover:bg-cream/60"
              )}
            >
              <span className="w-20 shrink-0 text-[13px] font-bold text-ink">{formatTime(s.scheduled_at)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-ink">{s.student_id ? (aliases.get(s.student_id) ?? "Student") : "Walk-in"}</span>
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
        ))}
      </ul>
      {!sessions.length && (
        <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-center text-[13px] text-ink-muted">
          Pick another day — confirmed and upcoming sessions land here.
        </p>
      )}
    </>
  );
}
