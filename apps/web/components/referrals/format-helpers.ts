import { REFERRAL_SCHEDULE_NOTE_PREFIX } from "@dorsu/shared-services";

/** Re-exported from shared lib — do not redefine locally. */
export {
  ageShort,
  defaultScheduleInput,
  formatWhen,
  statusLabel,
  timeAgo,
  toLocalInputValue,
} from "@/lib/format";

/**
 * Schedule display — the counselor-set session time is stored as a
 * structured trail note (REFERRAL_SCHEDULE_NOTE_PREFIX + ISO) on the
 * confirm action, and parsed back here. Confirming also mints the real
 * session row (see confirmReferralWithSession), so the note and the
 * calendar always agree.
 */
export function parseScheduleNote(note: string | null): string | null {
  if (!note || !note.startsWith(REFERRAL_SCHEDULE_NOTE_PREFIX)) return null;
  const candidate = note.slice(REFERRAL_SCHEDULE_NOTE_PREFIX.length).trim().split(" ")[0];
  const d = new Date(candidate);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Session mode from the same confirm note ("... (<mode>)" suffix, added
 * later — older notes without it read as null, i.e. unknown). Parsed from
 * the trail because faculty cannot read the appointments table (RLS), so
 * the note is their only channel for session details.
 */
export function parseSessionMode(note: string | null): "in_person" | "online" | null {
  if (!note || !note.startsWith(REFERRAL_SCHEDULE_NOTE_PREFIX)) return null;
  const m = note.match(/\((in_person|online)\)\s*$/);
  return m ? (m[1] as "in_person" | "online") : null;
}

export function formatSessionMode(mode: "in_person" | "online" | null): string {
  if (mode === "online") return "Online";
  if (mode === "in_person") return "In person";
  return "—";
}

/** Session time still in the future — Resolve unlocks once it passes (mirrors /appointments). */
export function isSessionUpcoming(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t > Date.now();
}
