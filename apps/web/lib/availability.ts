import type { AvailabilitySlot } from "./hooks/use-availability-board";

/**
 * Availability display helpers — shared by the coverage board, the counselor
 * roster, and the slot manager. Pure formatting over slot rows; identical
 * output to the former page-local copies.
 */

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];

export function hhmm(t: string): string {
  return t.slice(0, 5);
}

export function slotMinutes(s: Pick<AvailabilitySlot, "start_time" | "end_time">): number {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  return Math.max(0, toMin(s.end_time) - toMin(s.start_time));
}

export function fmtHours(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
