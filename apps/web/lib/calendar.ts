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

/** Status → pill colors (same language as dashboard + appointments). */
export const STATUS_PILL: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  assigned: "bg-indigo-100 text-indigo-800",
  confirmed: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-ink/10 text-ink-muted",
  rejected: "bg-red-100 text-red-700",
  no_show: "bg-red-100 text-red-700",
};

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
