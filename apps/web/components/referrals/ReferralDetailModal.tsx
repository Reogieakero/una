"use client";

import { useEffect } from "react";
import { CalendarClock, Eye, Loader2, X } from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";
import { Dropdown } from "@/components/shared/dropdown";
import {
  ACTION_ICON,
  TRIAGE_COPY,
  classificationSummary,
  nextMoves,
  priorityTone,
  referralStudentName,
  statusLabel,
  statusTone,
  type RefAction,
  type Referral,
  type TriageKind,
} from "./status";
import { formatWhen, isSessionUpcoming, timeAgo } from "./format-helpers";

/**
 * Full referral record overlay — everything the compact grid card leaves
 * out: referrer, dates, session, handling, the complete reason, and the
 * triage actions. The card only carries the overview; this is the pro-level
 * detail view. Escape closes and the page behind stays put.
 */
export function ReferralDetailModal({
  referral,
  aliases,
  trail,
  sessionSchedule,
  counselorName,
  referrerLabel,
  canAssign,
  canReject,
  isCounselor,
  busyId,
  counselors,
  openMenuKey,
  setOpenMenuKey,
  onAssign,
  onAskConfirm,
  onReschedule,
  canResolve,
  onViewForm,
  onRecord,
  onClose,
}: {
  referral: Referral | null;
  aliases: Map<string, string>;
  trail: Map<string, RefAction[]>;
  sessionSchedule: Map<string, string>;
  counselorName: (id: string | null) => string;
  referrerLabel: (r: Referral) => string;
  canAssign: boolean;
  canReject: boolean;
  isCounselor: boolean;
  busyId: string | null;
  counselors: { id: string; name: string }[];
  openMenuKey: string | null;
  setOpenMenuKey: (k: string | null) => void;
  onAssign: (ref: Referral, counselorId: string) => void;
  onAskConfirm: (ref: Referral, to: TriageKind) => void;
  onReschedule: (ref: Referral) => void;
  canResolve: (ref: Referral) => boolean;
  onViewForm?: (r: Referral) => void;
  onRecord?: (r: Referral) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!referral) return;
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
  }, [referral, onClose]);

  if (!referral) return null;

  const student = referralStudentName(referral, aliases);
  const sessionIso = sessionSchedule.get(referral.id) ?? null;
  const upcoming = isSessionUpcoming(sessionIso);
  const actions = nextMoves(referral.status, isCounselor);
  const history = trail.get(referral.id) ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ref-detail-title"
    >
      <button
        type="button"
        aria-label="Close referral details"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 dark:bg-black/70"
      />
      <div className="no-scrollbar relative max-h-[90vh] w-full overflow-y-auto rounded-lg bg-white p-6 shadow-card sm:max-w-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Referral details</p>
            <h2 id="ref-detail-title" className="mt-0.5 truncate font-display text-xl font-bold text-ink">
              {student}
            </h2>
            <p className="mt-0.5 text-xs font-medium text-ink-faint">
              Filed {timeAgo(referral.created_at)}
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

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={priorityTone(referral.priority)}>{statusLabel(referral.priority)} priority</Badge>
          <Badge tone="info">{classificationSummary(referral.case_classification)}</Badge>
          <Badge tone={statusTone(referral.status)}>{statusLabel(referral.status)}</Badge>
        </div>

        <dl className="mt-4 grid gap-x-6 gap-y-3 rounded-lg border border-ink/10 px-4 py-4 text-[13px] sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Referred by</dt>
            <dd className="mt-0.5 font-bold text-ink">{referrerLabel(referral)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Referred</dt>
            <dd className="mt-0.5 font-bold text-ink">{formatWhen(referral.created_at)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Session</dt>
            <dd className="mt-0.5 font-bold text-ink">
              {sessionIso ? formatWhen(sessionIso) : "Not scheduled yet"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Classification</dt>
            <dd className="mt-0.5 font-bold text-ink">{classificationSummary(referral.case_classification)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Handling</dt>
            <dd className="mt-1">
              {canAssign ? (
                <span className="inline-flex items-center gap-1.5">
                  <Dropdown
                    menuKey={`ref-detail-assign-${referral.id}`}
                    openMenuKey={openMenuKey}
                    onOpenChange={setOpenMenuKey}
                    value={referral.assigned_counselor_id ?? ""}
                    onChange={(v) => void onAssign(referral, v)}
                    ariaLabel={`Assign counselor for referral from ${student}`}
                    buttonClassName="rounded px-2.5 text-[13px]"
                    disabled={busyId === referral.id}
                    options={[
                      { value: "", label: "Unassigned" },
                      ...counselors.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                  />
                  {busyId === referral.id && (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-faint" aria-label="Assigning counselor" />
                  )}
                </span>
              ) : (
                <span className="font-bold text-ink">{counselorName(referral.assigned_counselor_id)}</span>
              )}
            </dd>
          </div>
        </dl>

        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Reason</p>
          <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-cream px-4 py-3 text-sm leading-relaxed text-ink">
            {referral.reason}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {canReject && referral.status === "pending" && (
            <Button size="sm" variant="outline" disabled={busyId === referral.id} onClick={() => onAskConfirm(referral, "rejected")}>
              {TRIAGE_COPY.rejected.ok}
            </Button>
          )}
          {isCounselor && referral.status === "confirmed" && upcoming && (
            <Button size="sm" variant="outline" disabled={busyId === referral.id} onClick={() => onReschedule(referral)}>
              <CalendarClock className="h-4 w-4" aria-hidden />
              Reschedule session
            </Button>
          )}
          {isCounselor &&
            !(referral.status === "confirmed" && upcoming) &&
            actions.map((s) => {
              if (s === "resolved" && upcoming) return null;
              const Icon = ACTION_ICON[s];
              const blocked = s === "resolved" && !canResolve(referral);
              return (
                <Button
                  key={s}
                  size="sm"
                  variant={s === "escalated" || s === "rejected" ? "outline" : "accent"}
                  title={blocked ? "Resolve (needs a confirmed session first)" : TRIAGE_COPY[s].ok}
                  disabled={busyId === referral.id}
                  onClick={() => onAskConfirm(referral, s)}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {TRIAGE_COPY[s].ok}
                </Button>
              );
            })}
          {referral.status === "pending" && isCounselor && (
            <span className="text-[13px] font-medium text-ink-faint">Waiting for assignment — the head assigns a counselor first.</span>
          )}
          {referral.status === "assigned" && canReject && (
            <span className="text-[13px] font-medium text-ink-faint">Assigned — unassign to reject.</span>
          )}
          {(referral.status === "assigned" || referral.status === "confirmed" || referral.status === "escalated") && !isCounselor && !canReject && (
            <span className="text-[13px] font-medium text-ink-faint">Waiting for counselor confirmation.</span>
          )}
          {(referral.status === "resolved" || referral.status === "rejected") && (
            <span className="text-[13px] font-medium text-ink-faint">Terminal — no further moves.</span>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {onRecord && (
              <Button size="sm" variant="outline" onClick={() => onRecord(referral)}>
                <Eye className="h-4 w-4" aria-hidden />
                Referral record
                {history.length > 0 && <span className="text-ink-faint">({history.length})</span>}
              </Button>
            )}
            {onViewForm && (
              <Button size="sm" variant="outline" onClick={() => onViewForm(referral)}>
                Official form
              </Button>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={onClose} autoFocus>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
