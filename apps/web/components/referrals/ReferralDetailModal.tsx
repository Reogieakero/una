"use client";

import { useEffect } from "react";
import { Badge, Button } from "@/components/ui/primitives";
import {
  classificationSummary,
  priorityTone,
  referralStudentName,
  statusLabel,
  statusTone,
  type RefAction,
  type Referral,
} from "./status";
import { formatWhen, timeAgo } from "./format-helpers";

/** Reason viewer modal — Escape closes, background stays put while open. */
export function ReferralDetailModal({
  referral,
  aliases,
  actorNames,
  trail,
  sessionSchedule,
  counselorName,
  referrerLabel,
  onViewForm,
  onClose,
}: {
  referral: Referral | null;
  aliases: Map<string, string>;
  actorNames: Map<string, string>;
  trail: Map<string, RefAction[]>;
  sessionSchedule: Map<string, string>;
  counselorName: (id: string | null) => string;
  referrerLabel: (r: Referral) => string;
  onViewForm?: (r: Referral) => void;
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ref-reason-title"
    >
      <div aria-hidden className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="no-scrollbar relative max-h-screen w-full overflow-y-auto rounded-bl-2xl bg-white p-6 shadow-card sm:max-w-md">
        <h2 id="ref-reason-title" className="font-display text-lg font-bold text-ink">
          Referral reason
        </h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone={priorityTone(referral.priority)}>{statusLabel(referral.priority)}</Badge>
          <Badge tone="info">{classificationSummary(referral.case_classification)}</Badge>
          <Badge tone={statusTone(referral.status)}>{statusLabel(referral.status)}</Badge>
        </div>
        <dl className="mt-3 space-y-1.5 text-[13px]">
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 font-medium text-ink-faint">Student</dt>
            <dd className="font-bold text-ink">{referralStudentName(referral, aliases)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 font-medium text-ink-faint">Referred by</dt>
            <dd className="font-bold text-ink">{referrerLabel(referral)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 font-medium text-ink-faint">Classification</dt>
            <dd className="font-bold text-ink">{classificationSummary(referral.case_classification)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 font-medium text-ink-faint">Referred</dt>
            <dd className="font-bold text-ink">{formatWhen(referral.created_at)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 font-medium text-ink-faint">Counselor</dt>
            <dd className="font-bold text-ink">{counselorName(referral.assigned_counselor_id)}</dd>
          </div>
          {sessionSchedule.get(referral.id) && (
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 font-medium text-ink-faint">Session</dt>
              <dd className="font-bold text-ink">{formatWhen(sessionSchedule.get(referral.id)!)}</dd>
            </div>
          )}
        </dl>
        <p className="mt-3 whitespace-pre-wrap rounded-xl bg-cream px-4 py-3 text-sm leading-relaxed text-ink">
          {referral.reason}
        </p>
        {(trail.get(referral.id) ?? []).length > 0 && (
          <div className="mt-3 rounded-xl border border-ink/10 px-4 py-3">
            <p className="text-xs font-bold text-ink-muted">
              Trail · {(trail.get(referral.id) ?? []).length} entr{(trail.get(referral.id) ?? []).length === 1 ? "y" : "ies"}
            </p>
            <ul className="mt-2 space-y-1.5 text-[13px]">
              {(trail.get(referral.id) ?? []).map((h) => (
                <li key={h.id} className="text-ink-muted">
                  <span className="font-bold text-ink">{actorNames.get(h.actor_profile_id) ?? "Staff"}</span>
                  {" → "}
                  <span className="font-semibold">{statusLabel(h.action)}</span>
                  {h.note && <span className="italic"> — {h.note}</span>}
                  <span className="block text-[11px] font-medium text-ink-faint">{timeAgo(h.created_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          {onViewForm && (
            <Button size="sm" variant="outline" onClick={() => onViewForm(referral)}>
              Official form
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onClose} autoFocus>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
