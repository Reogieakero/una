import type { CounselorAvailabilityRow } from "@dorsu/shared-types";

/**
 * Student-facing booking windows derived from `counselor_availability`.
 *
 * Availability rows are recurring weekly slots in Philippine wall-clock time
 * (Asia/Manila has no DST, so a fixed UTC+8 shift is exact). This mirrors the
 * server-side gate in `appointments/mutations.ts` (`fitsAvailabilitySlot` /
 * `validateCounselorSchedule`): a session must sit entirely inside one slot on
 * the same day, and the default session length is 60 minutes.
 *
 * Pure and framework-free so the mobile app (and any future client) can share
 * one definition of "what times can a student request".
 */

export type AvailabilityWindow = Pick<
  CounselorAvailabilityRow,
  "weekday" | "start_time" | "end_time" | "is_recurring" | "valid_from" | "valid_to"
>;

export type BookableDay = {
  /** YYYY-MM-DD in Asia/Manila. */
  date: string;
  weekday: number;
  weekdayShort: string;
  dayOfMonth: string;
};

export type BookableSlot = {
  /** Exact UTC instant of the session start, suitable for `scheduled_at`. */
  startIso: string;
  /** Wall-clock label in Asia/Manila, e.g. "9:00 AM". */
  label: string;
};

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const SESSION_MINUTES = 60;
const SLOT_STEP_MINUTES = 30;
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function hhmmToMins(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** UTC-midnight number for a YYYY-MM-DD calendar date (Manila calendar). */
function ymdToDayNumber(ymd: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function dayNumberToYmd(dayNumber: number): string {
  const d = new Date(dayNumber);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Manila calendar day number (UTC-midnight representation) for an instant. */
function manilaDayNumber(ms: number): number {
  const d = new Date(ms + MANILA_OFFSET_MS);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function formatManilaTime(minutes: number): string {
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${pad2(mins)} ${suffix}`;
}

/**
 * Does a window cover this calendar day? Mirrors the server: `valid_from` /
 * `valid_to` only constrain non-recurring one-off slots.
 */
function windowCoversDay(window: AvailabilityWindow, dayNumber: number, weekday: number): boolean {
  if (window.weekday !== weekday) return false;
  if (window.is_recurring) return true;
  const from = window.valid_from ? ymdToDayNumber(window.valid_from) : null;
  const to = window.valid_to ? ymdToDayNumber(window.valid_to) : null;
  if (from !== null && dayNumber < from) return false;
  if (to !== null && dayNumber > to) return false;
  return true;
}

/**
 * Open start times for one Manila calendar date. Times already in the past are
 * dropped, duplicate starts across counselors are merged, and results are
 * sorted. Each start is 60 minutes, matching the default session length.
 */
export function bookableSlots(
  windows: AvailabilityWindow[],
  date: string,
  now: Date = new Date(),
): BookableSlot[] {
  const dayNumber = ymdToDayNumber(date);
  if (dayNumber === null) return [];
  const weekday = new Date(dayNumber).getUTCDay();
  const nowMs = now.getTime();
  const starts = new Map<number, BookableSlot>();

  for (const window of windows) {
    if (!windowCoversDay(window, dayNumber, weekday)) continue;
    const windowStart = hhmmToMins(window.start_time);
    const windowEnd = hhmmToMins(window.end_time);
    for (
      let minute = windowStart;
      minute + SESSION_MINUTES <= windowEnd;
      minute += SLOT_STEP_MINUTES
    ) {
      // Manila wall clock -> UTC instant.
      const startMs = dayNumber + minute * 60_000 - MANILA_OFFSET_MS;
      if (startMs <= nowMs) continue;
      if (!starts.has(startMs)) {
        starts.set(startMs, {
          startIso: new Date(startMs).toISOString(),
          label: formatManilaTime(minute),
        });
      }
    }
  }

  return [...starts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, slot]) => slot);
}

/**
 * The next `maxDays` days that actually have open slots, scanning at most
 * `horizonDays` calendar days from today (Manila).
 */
export function bookableDays(
  windows: AvailabilityWindow[],
  now: Date = new Date(),
  maxDays = 7,
  horizonDays = 21,
): BookableDay[] {
  const today = manilaDayNumber(now.getTime());
  const out: BookableDay[] = [];

  for (let offset = 0; offset < horizonDays && out.length < maxDays; offset++) {
    const dayNumber = today + offset * 86_400_000;
    const date = dayNumberToYmd(dayNumber);
    if (bookableSlots(windows, date, now).length === 0) continue;
    const weekday = new Date(dayNumber).getUTCDay();
    out.push({
      date,
      weekday,
      weekdayShort: WEEKDAY_SHORT[weekday] ?? "",
      dayOfMonth: String(new Date(dayNumber).getUTCDate()),
    });
  }

  return out;
}
