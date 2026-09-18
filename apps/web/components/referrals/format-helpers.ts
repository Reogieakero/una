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

/** Minimal trail shape the schedule helpers read (RefAction satisfies this). */
export type TrailActionLike = {
  action: string;
  note: string | null;
  created_at: string;
  actor_profile_id: string;
  actor_name: string | null;
  actor_role: string | null;
};

/**
 * Reschedule note written by rescheduleAppointmentByCounselor
 * ("Session rescheduled from <oldIso> to <newIso>") → normalized ISOs.
 */
export function parseRescheduleNote(note: string | null): { from: string; to: string } | null {
  if (!note) return null;
  const m = note.match(/rescheduled from (\S+) to (\S+)/);
  if (!m) return null;
  const from = new Date(m[1]);
  const to = new Date(m[2]);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * Current session schedule from the trail: the confirm ISO, overridden by
 * each later reschedule in chronological order. Falls back when the trail
 * has no schedule events (unconfirmed referrals).
 */
export function latestSessionSchedule(actions: TrailActionLike[], fallback: string | null): string | null {
  let iso = fallback;
  const ordered = [...actions].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  for (const a of ordered) {
    if (a.action === "confirmed") {
      const c = parseScheduleNote(a.note);
      if (c) iso = c;
    } else if (a.action === "rescheduled") {
      const r = parseRescheduleNote(a.note);
      if (r) iso = r.to;
    }
  }
  return iso;
}

/** True when the trail holds at least one reschedule entry. */
export function hasReschedule(actions: TrailActionLike[]): boolean {
  return actions.some((a) => a.action === "rescheduled" && parseRescheduleNote(a.note) !== null);
}

export type ScheduleLogEntry = {
  kind: "confirmed" | "rescheduled";
  /** Effective ISO for confirmed; the new ISO for rescheduled. */
  iso: string;
  /** Previous ISO — rescheduled entries only. */
  from: string | null;
  at: string;
  actorName: string | null;
  actorRole: string | null;
  actorId: string;
};

/** Schedule history, oldest first: confirm entry + every reschedule. */
export function sessionScheduleLog(actions: TrailActionLike[]): ScheduleLogEntry[] {
  const ordered = [...actions].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  const out: ScheduleLogEntry[] = [];
  for (const a of ordered) {
    if (a.action === "confirmed") {
      const c = parseScheduleNote(a.note);
      if (c) out.push({ kind: "confirmed", iso: c, from: null, at: a.created_at, actorName: a.actor_name, actorRole: a.actor_role, actorId: a.actor_profile_id });
    } else if (a.action === "rescheduled") {
      const r = parseRescheduleNote(a.note);
      if (r) out.push({ kind: "rescheduled", iso: r.to, from: r.from, at: a.created_at, actorName: a.actor_name, actorRole: a.actor_role, actorId: a.actor_profile_id });
    }
  }
  return out;
}

/** Session time still in the future — Resolve unlocks once it passes (mirrors /appointments). */
export function isSessionUpcoming(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t > Date.now();
}
