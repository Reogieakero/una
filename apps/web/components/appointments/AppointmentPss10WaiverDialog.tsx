"use client";

import { Button, Input } from "@/components/ui/primitives";
import { formatWhen } from "./status";
import type { Appt } from "./status";

/**
 * Shown when a counselor tries to complete a session whose student has no
 * valid pre-session PSS-10. The waiver is explicit: a 10–500 character
 * operational reason, stored on the appointment and audited separately.
 * No PSS answers/scores are displayed or transmitted.
 */
export function AppointmentPss10WaiverDialog({
  appointment,
  reason,
  error,
  busy,
  onReasonChange,
  onClose,
  onSubmit,
}: {
  appointment: Appt | null;
  reason: string;
  error: string | null;
  busy: boolean;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!appointment) return null;
  const chars = reason.trim().length;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="pss10-waiver-title"
      aria-describedby="pss10-waiver-desc"
    >
      <div aria-hidden className="absolute inset-0 bg-ink/40" onClick={busy ? undefined : onClose} />
      <div className="relative w-full rounded-lg bg-white p-6 shadow-card sm:max-w-md">
        <h2 id="pss10-waiver-title" className="font-display text-lg font-bold text-ink">
          Pre-session check-in missing
        </h2>
        <p id="pss10-waiver-desc" className="mt-1 text-sm leading-relaxed text-ink-muted">
          This student has no fresh PSS-10 linked to the session. Ask them to
          complete the check-in, or record why this session is being completed
          without one.
        </p>
        <p className="mt-3 truncate rounded-lg bg-cream px-3 py-2 text-[13px] font-semibold text-ink-soft">
          {formatWhen(appointment.scheduled_at)}
        </p>

        <label className="mt-4 block text-xs font-bold text-ink-muted" htmlFor="pss10-waiver-reason">
          Waiver reason
        </label>
        <Input
          id="pss10-waiver-reason"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          maxLength={500}
          placeholder="e.g. Walk-in session; student completed the form on paper."
        />
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <p className="text-[11px] font-medium text-ink-faint">
            Operational reason only — never clinical detail. Audited.
          </p>
          <span className="text-[11px] font-semibold text-ink-faint">{chars}/500</span>
        </div>
        {error ? <p className="mt-2 text-xs font-semibold text-red-600">{error}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={onClose} autoFocus>
            Ask student to check in
          </Button>
          <Button size="sm" variant="primary" disabled={busy || chars < 10} onClick={onSubmit}>
            {busy ? "Completing…" : "Record waiver & complete"}
          </Button>
        </div>
      </div>
    </div>
  );
}
