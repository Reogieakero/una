"use client";

import { Clock, MapPin, Video } from "lucide-react";
import type { CalendarSession } from "@/lib/hooks/use-sessions-calendar";
import { formatLong, statusLabel } from "@/lib/calendar";
import { Badge } from "@/components/ui/primitives";

/** Selected-session detail card — time, mode, status, Meet link, concern. */
export function SessionDetail({
  session,
  alias,
  counselorName,
  showCounselor,
  onClear,
}: {
  session: CalendarSession;
  alias: string;
  counselorName: string | null;
  showCounselor: boolean;
  onClear: () => void;
}) {
  return (
    <div className="mt-3 rounded-2xl border border-primary-200 bg-blue-50/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-sm font-bold text-ink">
          {alias}
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
          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-4 py-1.5 text-[13px] font-bold text-white shadow-soft transition-colors hover:bg-primary-700"
          aria-label={`Join the Google Meet scheduled for ${formatLong(session.scheduled_at)}`}
        >
          <Video className="h-3.5 w-3.5" aria-hidden />
          Join Google Meet
        </a>
      )}
      {showCounselor && (
        <p className="mt-1 text-[13px] text-ink-muted">
          Counselor: <span className="font-semibold text-ink">{counselorName ?? "Unassigned"}</span>
        </p>
      )}
      <p className="mt-2 border-t border-ink/10 pt-2 text-[13px] leading-relaxed text-ink-soft">{session.concern}</p>
    </div>
  );
}
