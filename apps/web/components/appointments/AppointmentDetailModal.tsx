"use client";

import { CalendarDays, MapPin, Video, X } from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";
import { formatLong, formatScheduleRange, formatWhen, hasSetSchedule, statusLabel, statusTone } from "./status";
import type { Appt } from "./status";

/**
 * Row detail modal — any row opens it; interactive cells stop propagation.
 * Extracted verbatim from page.tsx.
 */
export function AppointmentDetailModal({
  detail,
  aliases,
  counselorName,
  onClose,
}: {
  detail: Appt | null;
  aliases: Map<string, string>;
  counselorName: (id: string | null) => string;
  onClose: () => void;
}) {
  if (!detail) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="appt-detail-title"
    >
      <div aria-hidden className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="no-scrollbar relative max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white shadow-card sm:max-w-lg">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-6 pb-4 pt-5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Appointment</p>
            <h2 id="appt-detail-title" className="mt-0.5 font-display text-lg font-bold text-ink">
              Session details
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge tone={statusTone(detail.status)}>{statusLabel(detail.status)}</Badge>
            <button
              type="button"
              aria-label="Close details"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-cream hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="px-6 py-5">
          {/* Schedule hero */}
          <div className="flex items-center gap-3 rounded-2xl border border-primary-200 bg-blue-50/60 p-4">
            <span
              aria-hidden
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white shadow-soft"
            >
              <CalendarDays className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                {hasSetSchedule(detail.status) ? "Session schedule" : "Requested schedule"}
              </p>
              <p className="mt-0.5 truncate font-display text-[15px] font-bold text-ink">
                {formatScheduleRange(detail.scheduled_at, detail.ends_at ?? null)}
              </p>
              <p className="mt-0.5 text-xs font-medium text-ink-faint">
                {hasSetSchedule(detail.status)
                  ? "Final time set by the counselor — the student was notified."
                  : "Student's requested slot — the final time appears here after the counselor confirms."}
              </p>
            </div>
          </div>

          {/* People */}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="flex min-w-0 items-center gap-2.5 rounded-2xl border border-ink/10 bg-white p-3">
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-600 font-display text-sm font-bold text-white"
              >
                {(detail.student_id ? (aliases.get(detail.student_id) ?? "S") : "W").trim().charAt(0).toUpperCase() || "S"}
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-ink-faint">Student</span>
                <span className="block truncate text-sm font-bold text-ink">
                  {detail.student_id ? (aliases.get(detail.student_id) ?? "Student") : "Walk-in"}
                </span>
              </span>
            </div>
            <div className="flex min-w-0 items-center gap-2.5 rounded-2xl border border-ink/10 bg-white p-3">
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-400 font-display text-sm font-bold text-ink"
              >
                {counselorName(detail.counselor_id).trim().charAt(0).toUpperCase() || "C"}
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-ink-faint">Counselor</span>
                <span className="block truncate text-sm font-bold text-ink">
                  {counselorName(detail.counselor_id)}
                </span>
              </span>
            </div>
          </div>

          {/* Mode */}
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-cream px-4 py-3 text-sm">
            {detail.mode === "online" ? (
              <Video className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
            ) : (
              <MapPin className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
            )}
            <span className="font-bold text-ink">{detail.mode === "online" ? "Online" : "In person"}</span>
            {detail.mode === "online" && detail.meeting_url && (
              <a
                href={detail.meeting_url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800 transition-colors hover:bg-blue-200"
                aria-label={`Join the Google Meet scheduled for ${formatWhen(detail.scheduled_at)}`}
              >
                <Video className="h-3 w-3" aria-hidden />
                Join Meet
              </a>
            )}
          </div>

          {/* Concern */}
          <div className="mt-3 rounded-2xl border border-ink/10 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Concern</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{detail.concern}</p>
          </div>

          {detail.mode === "online" && detail.meeting_url && (
            <a
              href={detail.meeting_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary-600 px-4 py-2.5 text-sm font-bold text-white shadow-soft transition-colors hover:bg-primary-700"
              aria-label={`Join the Google Meet scheduled for ${formatLong(detail.scheduled_at)}`}
            >
              <Video className="h-4 w-4" aria-hidden />
              Join Google Meet
            </a>
          )}

          <div className="mt-4 flex justify-end">
            <Button size="sm" variant="outline" onClick={onClose} autoFocus>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
