"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, ClipboardCheck, FileText, MapPin, UserRound, Video, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  clearAppointmentMeetingLink,
  meetingRemoveAllowed,
  PSS10_BANDS,
  preSessionPss10State,
} from "@dorsu/shared-services";
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
  canSeeNotes,
  onNotes,
  canManageMeet,
  onRemoved,
}: {
  detail: Appt | null;
  aliases: Map<string, string>;
  counselorName: (id: string | null) => string;
  onClose: () => void;
  /** Counselor (own ended sessions) or head (oversight) — shows the notes entry. */
  canSeeNotes?: boolean;
  onNotes?: (appt: Appt) => void;
  /** Staff who may detach a managed or pasted Meet link. */
  canManageMeet?: boolean;
  /** Parent refreshes its board after a link is removed. */
  onRemoved?: () => void;
}) {
  const [removing, setRemoving] = useState(false);
  if (!detail) return null;
  const checkin = preSessionPss10State({
    required: detail.pss10_required,
    waivedAt: detail.pss10_waived_at,
    scheduledAt: detail.scheduled_at,
    submittedAt: detail.pss10_checkin_at ?? null,
  });
  const checkinCopy =
    checkin === "complete"
      ? `Check-in complete${detail.pss10_checkin_at ? ` · ${formatWhen(detail.pss10_checkin_at)}` : ""}`
      : checkin === "waived"
        ? "Check-in waived by counselor"
        : checkin === "expired"
          ? "Check-in expired — needs a fresh PSS-10"
          : checkin === "missing"
            ? "No pre-session check-in yet"
            : checkin === "not_due"
               ? "Check-in opens 7 days before the session"
               : null;

  const handleRemoveLink = async () => {
    if (!canManageMeet || removing || !detail.meeting_url) return;
    setRemoving(true);
    try {
      await clearAppointmentMeetingLink(createClient(), detail.id);
      toast.success("Meet link removed", { position: "top-right" });
      onRemoved?.();
      onClose();
    } catch (e) {
      toast.error((e as Error)?.message ?? "Couldn't remove the Meet link — please try again.", {
        position: "top-right",
      });
    } finally {
      setRemoving(false);
    }
  };

  const bandLabel = (band: string | null | undefined) =>
    band ? (PSS10_BANDS[band as keyof typeof PSS10_BANDS]?.label ?? band) : "—";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="appt-detail-title"
    >
      <div aria-hidden className="absolute inset-0 bg-ink/40 dark:bg-black/70" onClick={onClose} />
      <div className="no-scrollbar relative max-h-[90vh] w-full overflow-y-auto rounded-xl border border-ink/10 bg-white shadow-card sm:max-w-lg">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-ink/10 bg-white px-6 pb-4 pt-5">
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
              className="inline-flex h-8 w-8 items-center justify-center rounded text-ink-muted transition-colors hover:bg-cream hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="px-6 py-5">
          {/* Schedule hero */}
          <div className="flex items-start gap-3 rounded-lg border border-primary-200 bg-primary-50 p-4 dark:border-primary-400/30">
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
              <p className="mt-0.5 font-display text-[15px] font-bold leading-snug text-ink">
                {formatScheduleRange(detail.scheduled_at, detail.ends_at ?? null)}
              </p>
              <p className="mt-0.5 text-xs font-medium leading-relaxed text-ink-muted">
                {hasSetSchedule(detail.status)
                  ? "Final time set by the counselor — the student was notified."
                  : "Student's requested slot — the final time appears here after the counselor confirms."}
              </p>
            </div>
          </div>

          {/* People */}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-ink/10 bg-white p-3">
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
            <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-ink/10 bg-white p-3">
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

          {detail.student_id && (
            <Link
              href={`/students/${detail.student_id}`}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink/10 bg-white px-3 text-xs font-bold text-ink-soft shadow-card transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <UserRound className="h-3.5 w-3.5" aria-hidden />
              Open student record
            </Link>
          )}

          {/* Mode */}
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-ink/10 bg-cream px-4 py-3 text-sm">
            {detail.mode === "online" ? (
              <Video className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
            ) : (
              <MapPin className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
            )}
            <span className="font-bold text-ink">{detail.mode === "online" ? "Online" : "In person"}</span>
            {detail.mode === "online" && detail.meeting_url && (
              <span className="ml-2 whitespace-nowrap">
                <Badge tone="info">Meet link</Badge>
              </span>
            )}
            {detail.mode === "online" && detail.meeting_url && (
              <a
                href={detail.meeting_url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex h-8 shrink-0 items-center rounded bg-blue-100 px-3 text-[11px] font-bold text-blue-800 transition-colors hover:bg-blue-200"
                aria-label={`Join the Google Meet scheduled for ${formatWhen(detail.scheduled_at)}`}
              >
                Join Meet
              </a>
            )}
          </div>

          {/* Pre-session check-in status — status/timestamp only, never answers. */}
          {checkinCopy && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-ink/10 bg-cream px-4 py-3 text-sm">
              <ClipboardCheck className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
              <span className="font-bold text-ink">{checkinCopy}</span>
            </div>
          )}

          {/* PSS-10 context for the assigned counselor — score + band only. */}
          {(detail.pss10_booking_score != null || detail.pss10_checkin_score != null) && (
            <div className="mt-3 rounded-lg border border-ink/10 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">PSS-10 screening</p>
              <div className="mt-1.5 space-y-1.5 text-sm">
                {detail.pss10_booking_score != null && (
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="text-ink-muted">
                      At booking
                      {detail.pss10_booking_at ? ` · ${formatWhen(detail.pss10_booking_at)}` : ""}
                    </span>
                    <span className="font-bold text-ink">
                      {detail.pss10_booking_score}/40 · {bandLabel(detail.pss10_booking_band)}
                    </span>
                  </div>
                )}
                {detail.pss10_checkin_score != null && (
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="text-ink-muted">
                      Pre-session check-in
                      {detail.pss10_checkin_at ? ` · ${formatWhen(detail.pss10_checkin_at)}` : ""}
                    </span>
                    <span className="font-bold text-ink">
                      {detail.pss10_checkin_score}/40 · {bandLabel(detail.pss10_checkin_band)}
                    </span>
                  </div>
                )}
              </div>
              <p className="mt-2 text-[11px] font-medium leading-relaxed text-ink-faint">
                Score and band only — item answers stay private. Visible to the assigned counselor and the guidance head.
              </p>
            </div>
          )}

          {/* Concern */}
          <div className="mt-3 rounded-lg border border-ink/10 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Concern</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{detail.concern}</p>
          </div>

          {detail.is_follow_up && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-accent-50 px-4 py-3 text-[13px] leading-relaxed text-accent-700 ring-1 ring-accent-100">
              <FileText className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Follow-up session — scheduled from a previous session&apos;s notes. It runs the normal
              confirm → complete lifecycle like any other session.
            </p>
          )}

          {detail.status === "completed" && canSeeNotes && onNotes && (
            <button
              type="button"
              onClick={() => onNotes(detail)}
              className="mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded border-2 border-ink/15 bg-white px-4 text-sm font-bold text-ink transition-colors hover:border-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              Session notes (private)
            </button>
          )}

          {detail.mode === "online" && detail.meeting_url && (
            <a
              href={detail.meeting_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded bg-primary-600 px-4 text-sm font-bold text-white shadow-soft transition-colors hover:bg-primary-700"
              aria-label={`Join the Google Meet scheduled for ${formatLong(detail.scheduled_at)}`}
            >
              Join Google Meet
            </a>
          )}

          {canManageMeet && detail.meeting_url && meetingRemoveAllowed(detail.status) && (
            <button
              type="button"
              onClick={handleRemoveLink}
              disabled={removing}
              className="mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded border-2 border-ink/15 bg-white px-4 text-sm font-bold text-ink transition-colors hover:border-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              {removing ? "Removing…" : "Remove link"}
            </button>
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
