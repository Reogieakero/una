"use client";

import { useEffect } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Video,
  X,
} from "lucide-react";
import type { CalendarSession } from "@/lib/hooks/use-sessions-calendar";
import {
  STATUS_PILL,
  formatTime,
  isSessionLive,
  sessionEndMs,
  statusLabel,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";
import { SessionDetail } from "./session-detail";

/** "60 min" for the session chip, falling back to the default session length. */
function durationLabel(session: CalendarSession): string {
  const start = new Date(session.scheduled_at).getTime();
  const end = sessionEndMs(session.scheduled_at, session.ends_at);
  const minutes = Math.round((end - start) / 60_000);
  return Number.isFinite(minutes) && minutes > 0 ? `${minutes} min` : "Session";
}

/**
 * Day-details overlay for the full-width session calendar.
 *
 * Clicking any date opens this dialog with that day's confirmed sessions; a
 * session can then be expanded in place for the full record and the counselor
 * Complete / No-show actions. It works as a centred modal on desktop and a
 * bottom sheet on phones, closes on Escape / backdrop / the close button, and
 * keeps page scroll locked while open.
 */
export function DayOverlay({
  day,
  sessions,
  selected,
  aliases,
  counselorNames,
  role,
  now,
  busyId,
  canManage,
  onClose,
  onSelect,
  onComplete,
  onNoShow,
}: {
  day: Date;
  sessions: CalendarSession[];
  selected: CalendarSession | null;
  aliases: Map<string, string>;
  counselorNames: Map<string, string>;
  role: string | null;
  now: number;
  /** Session id with an in-flight outcome mutation. */
  busyId: string | null;
  canManage: (session: CalendarSession) => boolean;
  onClose: () => void;
  onSelect: (id: string | null) => void;
  onComplete: (session: CalendarSession) => void;
  onNoShow: (session: CalendarSession) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const liveCount = sessions.filter((s) => isSessionLive(s.scheduled_at, s.ends_at, now)).length;
  const fullDate = day.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sessions-day-title"
    >
      <button
        type="button"
        aria-label="Close day details"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
      />

      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-ink/10 bg-white shadow-2xl sm:max-h-[85vh] sm:max-w-2xl sm:rounded-2xl">
        <span aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-ink/15 sm:hidden" />

        <header className="flex items-start justify-between gap-3 border-b border-ink/10 px-5 pb-4 pt-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden
              className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary-600 text-white shadow-soft"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">
                {day.toLocaleDateString("en-US", { month: "short" })}
              </span>
              <span className="font-display text-lg font-bold leading-none">{day.getDate()}</span>
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                Day schedule
              </p>
              <h2
                id="sessions-day-title"
                className="truncate font-display text-lg font-bold leading-tight text-ink"
              >
                {fullDate}
              </h2>
              <p className="mt-0.5 text-[13px] text-ink-muted">
                {sessions.length
                  ? `${sessions.length} session${sessions.length > 1 ? "s" : ""} scheduled`
                  : "No sessions scheduled"}
                {liveCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center gap-1 font-bold text-accent-700">
                    <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-600" />
                    {liveCount} live now
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close day details"
            onClick={onClose}
            autoFocus
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-cream hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {selected ? (
            <>
              <button
                type="button"
                onClick={() => onSelect(null)}
                className="mb-3 inline-flex items-center gap-1 rounded text-[12px] font-bold text-primary-700 transition-colors hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                Back to {day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </button>
              <SessionDetail
                session={selected}
                alias={
                  selected.student_id ? (aliases.get(selected.student_id) ?? "Student") : "Walk-in"
                }
                counselorName={
                  selected.counselor_id
                    ? (counselorNames.get(selected.counselor_id) ?? "Counselor")
                    : "Unassigned"
                }
                showCounselor={role === "guidance_head"}
                onClear={() => onSelect(null)}
                now={now}
                canManage={canManage(selected)}
                busy={busyId === selected.id}
                onComplete={() => onComplete(selected)}
                onNoShow={() => onNoShow(selected)}
              />
            </>
          ) : sessions.length ? (
            <ul className="space-y-2.5">
              {sessions.map((s) => {
                const alias = s.student_id ? (aliases.get(s.student_id) ?? "Student") : "Walk-in";
                const live = isSessionLive(s.scheduled_at, s.ends_at, now);
                const counselor =
                  role === "guidance_head" && s.counselor_id
                    ? (counselorNames.get(s.counselor_id) ?? "Counselor")
                    : null;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(s.id)}
                      className="group flex w-full items-center gap-3 rounded-xl border border-ink/10 bg-white p-3 text-left shadow-card transition hover:border-primary-300 hover:bg-cream hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                    >
                      <span className="flex w-16 shrink-0 flex-col items-start gap-0.5 border-r border-ink/10 pr-3">
                        <span className="text-[13px] font-bold text-ink">
                          {formatTime(s.scheduled_at)}
                        </span>
                        <span className="text-[11px] font-medium text-ink-faint">
                          {durationLabel(s)}
                        </span>
                      </span>

                      <span
                        aria-hidden
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-600 font-display text-[13px] font-bold text-white"
                      >
                        {alias.trim().charAt(0).toUpperCase() || "S"}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-bold text-ink group-hover:text-primary-700">
                            {alias}
                          </span>
                          {live && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-600 px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-white">
                              <span aria-hidden className="h-1 w-1 animate-pulse rounded-full bg-white" />
                              Live
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-ink-muted">
                          {s.mode === "online" ? (
                            <Video className="h-3 w-3 shrink-0" aria-hidden />
                          ) : (
                            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                          )}
                          {s.mode === "online" ? "Online" : "In person"}
                          {counselor ? ` · ${counselor}` : ""}
                        </span>
                      </span>

                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
                          STATUS_PILL[s.status] ?? "bg-ink/10 text-ink-muted"
                        )}
                      >
                        {statusLabel(s.status)}
                      </span>
                      <ChevronRight
                        aria-hidden
                        className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-primary-600"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex min-h-[220px] flex-col items-center justify-center px-6 py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-primary-600 ring-1 ring-blue-100">
                <CalendarDays className="h-6 w-6" aria-hidden />
              </span>
              <p className="mt-3 text-sm font-bold text-ink">Nothing scheduled</p>
              <p className="mt-1 max-w-[280px] text-[13px] leading-relaxed text-ink-muted">
                There are no confirmed sessions on this day. Use the arrows in the calendar to
                browse another date.
              </p>
            </div>
          )}
        </div>

        <footer className="flex items-center gap-2 border-t border-ink/10 bg-cream px-5 py-3 text-[12px] font-medium text-ink-muted">
          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {selected
            ? "Complete or mark no-show once the session has started."
            : "Select a session to view its details and available actions."}
        </footer>
      </div>
    </div>
  );
}
