import { CalendarClock, Check, CheckCheck, UserX, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  completeAppointment,
  confirmAppointment,
  markAppointmentNoShow,
  rejectAppointment,
  rescheduleAppointmentByCounselor,
} from "@dorsu/shared-services";
import type { BoardAppointment, BoardCounselor } from "@/lib/hooks/use-appointments-board";

/** Row shape — identical to the board hook's BoardAppointment. */
export type Appt = BoardAppointment;
export type CounselorOpt = BoardCounselor;

/** Reuse shared formatters where identical — no local copies. */
export { formatWhen, statusLabel, toLocalInputValue } from "@/lib/format";

export const STATUSES = ["pending", "assigned", "confirmed", "completed", "cancelled", "rejected", "no_show"] as const;

export function statusTone(s: string): "info" | "success" | "warning" | "danger" | "muted" {
  if (s === "completed") return "success";
  if (s === "cancelled") return "muted";
  if (s === "rejected" || s === "no_show") return "danger";
  if (s === "assigned" || s === "confirmed") return "info";
  return "warning";
}

/** Full schedule line for the detail modal — "Friday, March 6 · 2:00 PM". */
export function formatLong(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

/** Terminal-ish states whose schedule is the counselor-set final time. */
export function hasSetSchedule(status: string): boolean {
  return ["confirmed", "completed", "no_show"].includes(status);
}

/** Session time still in the future — Complete / No-show unlock once it passes. */
export function isUpcomingSession(iso: string): boolean {
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t > Date.now();
}

/** "Friday, March 6 · 2:00 – 3:00 PM" — falls back to the start when no end is set. */
export function formatScheduleRange(startIso: string, endIso: string | null): string {
  const s = new Date(startIso);
  if (Number.isNaN(s.getTime())) return startIso;
  const day = s.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const start = s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (!endIso) return `${day} · ${start}`;
  const e = new Date(endIso);
  if (Number.isNaN(e.getTime())) return `${day} · ${start}`;
  const sameDay =
    s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth() && s.getDate() === e.getDate();
  const end = e.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return sameDay ? `${day} · ${start.replace(/\s?[AP]M/i, "")} – ${end}` : `${day} · ${start} → ${formatLong(endIso)}`;
}

export const HEAD_LEGEND: { icon: typeof Check; label: string; desc: string; variant: "accent" | "outline" }[] = [
  { icon: Check, label: "Assign", desc: "Pending → assigned", variant: "accent" },
  { icon: X, label: "Reject", desc: "Pending → rejected", variant: "outline" },
];

export const COUNSELOR_LEGEND: { icon: typeof Check; label: string; desc: string; variant: "accent" | "outline" }[] = [
  { icon: Check, label: "Confirm", desc: "Assigned → confirmed + set schedule inside your slots (+ Meet link when online)", variant: "accent" },
  { icon: CalendarClock, label: "Reschedule", desc: "Move an assigned/confirmed session inside your slots (student notified)", variant: "outline" },
  { icon: CheckCheck, label: "Complete", desc: "Confirmed → completed (once session time passes)", variant: "accent" },
  { icon: UserX, label: "No-show", desc: "Confirmed, student didn't arrive (once session time passes)", variant: "outline" },
];

export type ActionKind = "confirm" | "complete" | "no-show" | "reject" | "reschedule";

export const ACTION_DEFS: Record<
  ActionKind,
  {
    fn: (db: ReturnType<typeof createClient>, apptId: string, scheduledAt?: Date, meetingUrl?: string | null, endsAt?: Date | null) => Promise<unknown>;
    fail: string;
    doneTitle: string;
    doneBody: (when: string) => string;
    /** Staff-facing success toast line shown to the actor on success. */
    okBody: (when: string) => string;
  }
> = {
  confirm: {
    fn: confirmAppointment,
    fail: "confirm this session",
    doneTitle: "Session confirmed",
    doneBody: (when) => `Your session is scheduled on ${when}. See you then!`,
    okBody: (when) => `Scheduled on ${when} — student notified.`,
  },
  reschedule: {
    fn: (db, apptId, scheduledAt, _meetingUrl, endsAt) => {
      if (!scheduledAt) throw new Error("Choose a valid session date and time");
      return rescheduleAppointmentByCounselor(db, apptId, scheduledAt, endsAt);
    },
    fail: "reschedule this session",
    doneTitle: "Session rescheduled",
    doneBody: (when) => `Your session is moved to ${when}. See you then!`,
    okBody: (when) => `Moved to ${when} — student notified.`,
  },
  complete: {
    fn: completeAppointment,
    fail: "complete this session",
    doneTitle: "Session completed",
    doneBody: (when) => `Your session on ${when} is marked complete. Feedback helps us improve.`,
    okBody: (when) => `Session on ${when} marked complete.`,
  },
  reject: {
    fn: rejectAppointment,
    fail: "reject this session",
    doneTitle: "Session rejected",
    doneBody: (when) => `Your session request for ${when} was declined by the office. Contact guidance for alternatives.`,
    okBody: (when) => `Request for ${when} declined — student notified.`,
  },
  "no-show": {
    fn: (db, apptId) => markAppointmentNoShow(db, apptId),
    fail: "mark no-show",
    doneTitle: "Marked as no-show",
    doneBody: (when) => `You were marked as no-show for ${when}. Contact the office to rebook.`,
    okBody: (when) => `Marked no-show for ${when}.`,
  },
};

export const CONFIRM_COPY: Record<ActionKind, { title: string; body: string; ok: string }> = {
  confirm: { title: "Confirm and schedule this session?", body: "Set the final session date and time inside your availability slots. The student will be notified with this schedule.", ok: "Confirm session" },
  reschedule: { title: "Reschedule this session?", body: "Pick a new date and time inside your availability slots. The student will be notified with the new schedule.", ok: "Reschedule session" },
  complete: { title: "Mark this session complete?", body: "The session was held and is now done. This can't be undone.", ok: "Mark complete" },
  reject: { title: "Reject this session?", body: "The request ends as Rejected and leaves the counselor queue. This can't be undone.", ok: "Reject session" },
  "no-show": { title: "Mark as no-show?", body: "The session was confirmed but the student didn't arrive.", ok: "Mark no-show" },
};
