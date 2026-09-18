"use client";

import { Button, Input } from "@/components/ui/primitives";
import { CONFIRM_COPY, formatWhen } from "./status";
import type { ActionKind, Appt } from "./status";
import { SlotSchedulePicker, type ScheduleSelection } from "./SlotSchedulePicker";
import type { BoardSlot } from "@/lib/hooks/use-appointments-board";

/** Minimal record the dialogs read — full board rows satisfy this. */
export type ConfirmAppt = Pick<Appt, "id" | "student_id" | "scheduled_at" | "mode" | "meeting_url">;

/**
 * Confirm / reschedule / complete / no-show / reject dialogs.
 * Confirm and reschedule collect the schedule through the
 * availability-scoped dropdowns (date + start + end inside the
 * counselor's own slots) — never a free datetime input.
 */
export function AppointmentConfirmDialogs({
  confirming,
  aliases,
  slots,
  sched,
  onSchedChange,
  scheduleError,
  meetingInput,
  onMeetingChange,
  meetingError,
  confirmBusy,
  onClose,
  onSubmit,
}: {
  confirming: { appt: ConfirmAppt; kind: ActionKind } | null;
  aliases: Map<string, string>;
  slots: BoardSlot[];
  sched: ScheduleSelection | null;
  onSchedChange: (v: ScheduleSelection) => void;
  scheduleError: string | null;
  meetingInput: string;
  onMeetingChange: (v: string) => void;
  meetingError: string | null;
  confirmBusy: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!confirming) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="appt-confirm-title"
      aria-describedby="appt-confirm-desc"
    >
      <div aria-hidden className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="no-scrollbar relative max-h-[90vh] w-full overflow-y-auto rounded-lg bg-white p-6 shadow-card sm:max-w-md">
        <h2 id="appt-confirm-title" className="font-display text-lg font-bold text-ink">
          {CONFIRM_COPY[confirming.kind].title}
        </h2>
        <p id="appt-confirm-desc" className="mt-1 text-sm leading-relaxed text-ink-muted">
          {CONFIRM_COPY[confirming.kind].body}
        </p>
        <p className="mt-3 truncate rounded-lg bg-cream px-3 py-2 text-[13px] font-semibold text-ink-soft">
          {confirming.appt.student_id ? (aliases.get(confirming.appt.student_id) ?? "Student") : "Walk-in"} · requested {formatWhen(confirming.appt.scheduled_at)}
        </p>
        {(confirming.kind === "confirm" || confirming.kind === "reschedule") && (
          <div className="mt-3">
            <SlotSchedulePicker slots={slots} value={sched} onChange={onSchedChange} />
            {scheduleError ? (
              <p className="mt-1.5 text-xs font-semibold text-red-600">{scheduleError}</p>
            ) : (
              <p className="mt-1.5 text-[11px] font-medium text-ink-faint">
                {confirming.kind === "confirm"
                  ? "This becomes the final schedule — the student is notified with this time."
                  : "This becomes the new schedule — the student is notified with this time."}
              </p>
            )}
          </div>
        )}
        {(confirming.kind === "confirm" || confirming.kind === "reschedule") && confirming.appt.mode === "online" && (
          <div className="mt-3">
            <label className="mb-1.5 block text-xs font-bold text-ink-muted" htmlFor="confirm-meet-link">
              Google Meet link
            </label>
            <Input
              id="confirm-meet-link"
              type="url"
              inputMode="url"
              placeholder="https://meet.google.com/abc-defg-hij"
              value={meetingInput}
              onChange={(e) => onMeetingChange(e.target.value)}
            />
            {meetingError ? (
              <p className="mt-1.5 text-xs font-semibold text-red-600">{meetingError}</p>
            ) : (
              <p className="mt-1.5 text-[11px] font-medium text-ink-faint">
                Paste the Google Meet for this session — the student joins with this link.
              </p>
            )}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" variant="outline" disabled={confirmBusy} onClick={onClose} autoFocus>
            Back
          </Button>
          <Button
            size="sm"
            variant={confirming.kind === "reject" ? "danger" : "primary"}
            disabled={confirmBusy || ((confirming.kind === "confirm" || confirming.kind === "reschedule") && !sched)}
            onClick={onSubmit}
          >
            {confirmBusy ? "Processing…" : CONFIRM_COPY[confirming.kind].ok}
          </Button>
        </div>
      </div>
    </div>
  );
}
