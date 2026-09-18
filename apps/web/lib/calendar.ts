import { statusLabel } from "./format";

/**
 * Session-calendar date helpers — extracted from
 * app/(staff)/sessions/page.tsx so the month grid, week strip, day schedule,
 * and detail card share one implementation. `statusLabel` is re-exported
 * from the shared format module (single source, no duplicate copy).
 */

export { statusLabel };

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Status → pill colors (primary blue + secondary accent only). */
export const STATUS_PILL: Record<string, string> = {
  pending: "bg-accent-100 text-accent-700",
  assigned: "bg-accent-100 text-accent-700",
  confirmed: "bg-primary-100 text-primary-800",
  completed: "bg-primary-700 text-white",
  cancelled: "bg-ink/10 text-ink-muted",
  rejected: "bg-accent-700 text-white",
  no_show: "bg-accent-700 text-white",
};

/** Assumed length when a session has no counselor-picked end time. */
export const DEFAULT_SESSION_MINUTES = 60;

/** End-of-session epoch ms — counselor-picked end, else start + default length. */
export function sessionEndMs(scheduledAt: string, endsAt: string | null): number {
  const start = new Date(scheduledAt).getTime();
  if (Number.isNaN(start)) return Number.NaN;
  const end = endsAt ? new Date(endsAt).getTime() : Number.NaN;
  if (!Number.isNaN(end) && end > start) return end;
  return start + DEFAULT_SESSION_MINUTES * 60_000;
}

/** Live window: start time reached, end not yet passed. */
export function isSessionLive(scheduledAt: string, endsAt: string | null, now: number = Date.now()): boolean {
  const start = new Date(scheduledAt).getTime();
  if (Number.isNaN(start) || start > now) return false;
  return now < sessionEndMs(scheduledAt, endsAt);
}

/** Session phase relative to now — drives live badges, banners, and action unlocks. */
export function sessionPhase(
  scheduledAt: string,
  endsAt: string | null,
  now: number = Date.now()
): "upcoming" | "live" | "past" {
  const start = new Date(scheduledAt).getTime();
  if (Number.isNaN(start) || start > now) return "upcoming";
  return now < sessionEndMs(scheduledAt, endsAt) ? "live" : "past";
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 42 cells (6 weeks) starting Sunday, covering the cursor month. */
export function monthCells(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/** 7 days (Sun–Sat) of the cursor week. */
export function weekDays(cursor: Date): Date[] {
  const start = new Date(cursor);
  start.setDate(cursor.getDate() - cursor.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function formatLong(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · ${formatTime(iso)}`;
}
