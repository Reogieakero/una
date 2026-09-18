"use client";

import { Clock, MapPin, Video } from "lucide-react";
import type { CalendarSession } from "@/lib/hooks/use-sessions-calendar";
import { formatLong, sessionPhase, statusLabel } from "@/lib/calendar";
import { Badge, Button } from "@/components/ui/primitives";

/** Selected-session detail card — time, mode, status, Meet link, concern. */
export function SessionDetail({
  session,
  alias,
  counselorName,
  showCounselor,
  onClear,
  now,
  canManage,
  busy,
  onComplete,
  onNoShow,
}: {
  session: CalendarSession;
  alias: string;
  counselorName: string | null;
  showCounselor: boolean;
  onClear: () => void;
  /** Current epoch ms (page ticks) — drives live state + action unlock. */
  now: number;
  /** Counselor acting on their own session — heads stay read-only. */
  canManage: boolean;
  /** A mutation is in flight — buttons disable. */
  busy: boolean;
  onComplete: () => void;
  onNoShow: () => void;
}) {
  const phase = sessionPhase(session.scheduled_at, session.ends_at, now);
  return (
    <div className="mt-3 rounded-lg border border-primary-200 bg-primary-50/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="flex min-w-0 flex-wrap items-center gap-2 font-display text-sm font-bold text-ink">
          <span className="truncate">{alias}</span>
          {phase === "live" && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              Live now
            </span>
          )}
        </p>
        <button
          type="button"
          aria-label="Clear selection"
          onClick={onClear}
          className="text-xs font-bold text-ink-faint hover:text-ink"
        >
          ✕
        </button>
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
        <Clock className="h-3.5 w-3.5 text-ink-muted" aria-hidden /> {formatLong(session.scheduled_at)}
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-muted">
        {session.mode === "online"
          ? <Video className="h-3.5 w-3.5" aria-hidden />
          : <MapPin className="h-3.5 w-3.5" aria-hidden />}
        {session.mode === "online" ? "Online" : "In person"}
        <span aria-hidden>·</span>
        <Badge tone={
          session.status === "completed" ? "success"
            : session.status === "rejected" || session.status === "no_show" ? "danger"
              : session.status === "cancelled" ? "muted"
              : session.status === "assigned" || session.status === "confirmed" ? "info" : "warning"
        }>
          {statusLabel(session.status)}
        </Badge>
      </p>
      {session.mode === "online" && session.meeting_url && (
        <a
          href={session.meeting_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex h-8 items-center gap-1.5 rounded bg-primary-600 px-4 text-[13px] font-bold text-white shadow-soft transition-colors hover:bg-primary-700"
          aria-label={`Join the Google Meet scheduled for ${formatLong(session.scheduled_at)}`}
        >
          Join Google Meet
        </a>
      )}
      {showCounselor && (
        <p className="mt-1 text-[13px] text-ink-muted">
          Counselor: <span className="font-semibold text-ink">{counselorName ?? "Unassigned"}</span>
        </p>
      )}
      {canManage && session.status === "confirmed" && (
        <div className="mt-3 border-t border-ink/10 pt-3">
          {phase === "upcoming" ? (
            <p className="text-xs font-semibold text-ink-faint">
              Complete / no-show unlock when the session starts.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="accent" disabled={busy} onClick={onComplete}>
                {busy ? "Saving…" : "Complete"}
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={onNoShow}>
                {busy ? "Saving…" : "No-show"}
              </Button>
            </div>
          )}
        </div>
      )}
      <p className="mt-2 border-t border-ink/10 pt-2 text-[13px] leading-relaxed text-ink-soft">{session.concern}</p>
    </div>
  );
}
