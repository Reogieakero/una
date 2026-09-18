"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";
import { classificationSummary, referralStudentName, statusLabel, statusTone } from "./status";
import { formatSessionMode, formatWhen, latestSessionSchedule, sessionScheduleLog, timeAgo } from "./format-helpers";
import type { Referral } from "./status";
import type { RefAction } from "./status";

const ROLE_LABEL: Record<string, string> = {
  guidance_head: "Guidance Head",
  counselor: "Counselor",
  faculty: "Faculty",
  guidance_personnel: "Guidance Personnel",
  admin: "Admin",
  student: "Student",
  system: "System",
};

function actorLine(a: RefAction, actorNames: Map<string, string>): string {
  const name = a.actor_name ?? actorNames.get(a.actor_profile_id) ?? null;
  const role = a.actor_role ? (ROLE_LABEL[a.actor_role] ?? a.actor_role) : null;
  if (role && name) return `by ${role}: ${name}`;
  if (name) return `by ${name}`;
  return "by Guidance office";
}

function timeRemaining(iso: string, now: number): string {  const diff = new Date(iso).getTime() - now;
  if (Number.isNaN(diff)) return "—";
  if (diff <= 0) return "Session time has passed";
  const secs = Math.floor(diff / 1000);
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `Starts in ${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s`;
  if (h > 0) return `Starts in ${h}h ${pad(m)}m ${pad(s)}s`;
  if (m > 0) return `Starts in ${m}m ${pad(s)}s`;
  return `Starts in ${s}s`;
}

/**
 * Referral tracking overlay for the faculty Sent history — status trail
 * (timeline), handling counselor, current status, scheduled session with
 * mode, and a live countdown to the session. Panel is rounded-lg (8px)
 * per design.
 */
export function ReferralTrackingModal({
  referral,
  alias,
  counselorName,
  sessionIso,
  sessionMode,
  trail,
  actorNames,
  onClose,
}: {
  referral: Referral | null;
  alias: string;
  counselorName: string;
  sessionIso: string | null;
  sessionMode: "in_person" | "online" | null;
  trail: RefAction[];
  actorNames: Map<string, string>;
  onClose: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!referral) return;
    setNow(Date.now());
    // Real-time countdown — ticks every second while the modal is open.
    const t = setInterval(() => setNow(Date.now()), 1_000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearInterval(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [referral, onClose]);

  if (!referral) return null;

  const ordered = [...trail].sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at)
  );

  // Effective schedule: the confirm ISO overridden by every later reschedule
  // in the trail — stays correct after session moves (faculty cannot read
  // appointments via RLS, so the trail is the channel).
  const effectiveIso = latestSessionSchedule(trail, sessionIso);
  const scheduleLog = sessionScheduleLog(trail);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Tracking referral for ${alias}`}
    >
      <button
        type="button"
        aria-label="Close tracking"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
      />
      <div className="no-scrollbar relative max-h-[90vh] w-full overflow-y-auto rounded-lg bg-white p-6 shadow-card sm:max-w-lg">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-ink">Track referral</h2>
            <p className="mt-0.5 truncate text-sm text-ink-muted">
              {alias} · {classificationSummary(referral.case_classification)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-ink-soft transition hover:bg-cream-dark hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="mt-4 grid gap-2 rounded-lg bg-cream px-4 py-3 text-sm">
          <p className="flex items-center justify-between gap-2">
            <span className="font-medium text-ink-muted">Status</span>
            <Badge tone={statusTone(referral.status)}>{statusLabel(referral.status)}</Badge>
          </p>
          <p className="flex items-center justify-between gap-2">
            <span className="font-medium text-ink-muted">Counselor</span>
            <span className="font-bold text-ink">{counselorName}</span>
          </p>
          <p className="flex items-center justify-between gap-2">
            <span className="font-medium text-ink-muted">Session</span>
            <span className="font-bold text-ink">
              {effectiveIso ? formatWhen(effectiveIso) : "Not scheduled yet"}
            </span>
          </p>
          <p className="flex items-center justify-between gap-2">
            <span className="font-medium text-ink-muted">Mode</span>
            <span className="font-bold text-ink">
              {effectiveIso ? formatSessionMode(sessionMode) : "—"}
            </span>
          </p>
          <p className="flex items-center justify-between gap-2">
            <span className="font-medium text-ink-muted">Countdown</span>
            <span className="font-bold text-primary-700">
              {effectiveIso ? timeRemaining(effectiveIso, now) : "Waiting for schedule"}
            </span>
          </p>
        </div>

        {scheduleLog.length > 0 && (
          <>
            <h3 className="mt-5 font-display text-sm font-bold text-ink">Session schedule log</h3>
            <ol className="mt-2 space-y-0">
              {scheduleLog.map((e, i) => (
                <li key={`${e.kind}-${e.at}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < scheduleLog.length - 1 && (
                    <span aria-hidden className="absolute left-[5px] top-4 h-full w-px bg-ink/15" />
                  )}
                  <span
                    aria-hidden
                    className={`mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ring-2 ring-white ${
                      e.kind === "rescheduled" ? "bg-accent-500" : "bg-primary-600"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-ink">
                      {e.kind === "rescheduled" ? "Rescheduled" : "Scheduled"}
                      <span className="ml-2 font-medium text-ink-faint">{timeAgo(e.at)}</span>
                    </p>
                    <p className="mt-0.5 text-[13px] font-semibold text-ink-soft">
                      {e.kind === "rescheduled" && e.from
                        ? `${formatWhen(e.from)} → ${formatWhen(e.iso)}`
                        : formatWhen(e.iso)}
                    </p>
                    <p className="text-xs font-medium text-ink-muted">
                      {(() => {
                        const name = e.actorName ?? actorNames.get(e.actorId) ?? null;
                        const role = e.actorRole ? (ROLE_LABEL[e.actorRole] ?? e.actorRole) : null;
                        if (role && name) return `by ${role}: ${name}`;
                        if (name) return `by ${name}`;
                        return "by Guidance office";
                      })()}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}

        <h3 className="mt-5 font-display text-sm font-bold text-ink">Progress trail</h3>
        {ordered.length ? (
          <ol className="mt-2 space-y-0">
            {ordered.map((a, i) => (
              <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
                {i < ordered.length - 1 && (
                  <span aria-hidden className="absolute left-[5px] top-4 h-full w-px bg-ink/15" />
                )}
                <span
                  aria-hidden
                  className={`mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ring-2 ring-white ${
                    i === 0 ? "bg-primary-600" : "bg-ink/25"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-ink">
                    {statusLabel(a.action)}
                    <span className="ml-2 font-medium text-ink-faint">{timeAgo(a.created_at)}</span>
                  </p>
                  <p className="text-xs font-medium text-ink-muted">
                    {actorLine(a, actorNames)}
                  </p>
                  {a.action === "escalated" && a.note && (
                    <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-ink-soft">{a.note}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">
            Filed and waiting — the head assigns a counselor next.
          </p>
        )}

        <div className="mt-5 flex justify-end">
          <Button size="sm" variant="outline" onClick={onClose} autoFocus>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
