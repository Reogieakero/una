/**
 * Pure Google Meet helpers — no network. HTTP to Google lives in
 * `apps/web/lib/google/meet.ts`.
 */

/** Google Meet links live at meet.google.com/<code>. */
const MEET_URL_RE = /^https:\/\/meet\.google\.com\/([A-Za-z0-9-]+)(?:\?.*)?\/?$/;

const MEET_EVENT_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
const DEFAULT_DURATION_MS = 60 * 60 * 1000;
export const MEET_TIME_ZONE = "Asia/Manila";

/** Loose check shared by callers that collect the link client-side. */
export function isMeetUrl(url: string): boolean {
  return MEET_URL_RE.test(url.trim());
}

/** Meeting code (`abc-defg-hij`) or null when the URL is not a Meet link. */
export function extractMeetCode(url: string): string | null {
  const match = MEET_URL_RE.exec(url.trim());
  return match?.[1] ?? null;
}

/** True when a Chekie-created event is older than 180 days (stale calendar row). */
export function isMeetEventExpired(
  createdAt: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!createdAt) return false;
  const t = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
  if (Number.isNaN(t)) return false;
  return now.getTime() - t > MEET_EVENT_MAX_AGE_MS;
}

export function meetingCreateAllowed(
  status: string,
  mode: string,
  scheduledAt: string | Date,
  now: Date = new Date(),
): boolean {
  if (mode !== "online") return false;
  if (status !== "assigned" && status !== "confirmed") return false;
  const t = scheduledAt instanceof Date ? scheduledAt.getTime() : new Date(scheduledAt).getTime();
  if (Number.isNaN(t)) return false;
  return t > now.getTime();
}

/** Staff may detach a link on an active or just-closed (cancel/reject) row. */
export function meetingRemoveAllowed(status: string): boolean {
  return status === "assigned" || status === "confirmed" || status === "cancelled" || status === "rejected";
}

export function meetingPatchAllowed(status: string, mode: string): boolean {
  return mode === "online" && (status === "assigned" || status === "confirmed");
}

export type CounselingMeetEventInput = {
  appointmentId: string;
  scheduledAt: string;
  endsAt: string | null;
};

/** Privacy-minimized Calendar event: generic title, no attendees, no student fields. */
export function buildCounselingMeetEvent(input: CounselingMeetEventInput): {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  conferenceData: {
    createRequest: {
      requestId: string;
      conferenceSolutionKey: { type: "hangoutsMeet" };
    };
  };
} {
  const start = new Date(input.scheduledAt);
  const end = input.endsAt ? new Date(input.endsAt) : new Date(start.getTime() + DEFAULT_DURATION_MS);
  return {
    summary: "Counseling session",
    description: "Join from the Chekie portal.",
    start: { dateTime: start.toISOString(), timeZone: MEET_TIME_ZONE },
    end: { dateTime: end.toISOString(), timeZone: MEET_TIME_ZONE },
    conferenceData: {
      createRequest: {
        requestId: input.appointmentId,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };
}

function stripMeetUrl(url: string): string {
  return url.trim().split("?")[0]?.replace(/\/$/, "") ?? url.trim();
}

/** Pull a joinable Meet URL from a Calendar API event payload. */
export function parseGoogleMeetLink(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const rec = payload as Record<string, unknown>;
  if (typeof rec.hangoutLink === "string" && isMeetUrl(rec.hangoutLink)) {
    return stripMeetUrl(rec.hangoutLink);
  }
  const conference = rec.conferenceData;
  if (!conference || typeof conference !== "object") return null;
  const entries = (conference as { entryPoints?: unknown }).entryPoints;
  if (!Array.isArray(entries)) return null;
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const point = entry as { entryPointType?: unknown; uri?: unknown };
    if (point.entryPointType === "video" && typeof point.uri === "string" && isMeetUrl(point.uri)) {
      return stripMeetUrl(point.uri);
    }
  }
  return null;
}

export function parseGoogleEventId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const id = (payload as { id?: unknown }).id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

/** Test helper: the Calendar payload must never carry student identity. */
export function meetEventLeaksStudentIdentity(event: Record<string, unknown>): boolean {
  if ("attendees" in event && event.attendees != null) return true;
  const blob = JSON.stringify(event).toLowerCase();
  const forbidden = ["student_no", "anonymous_alias", "full_name", "@", "concern"];
  // The description is a fixed portal sentence — "@" would only appear if
  // someone stuffed an email. The generic title is allowed.
  return forbidden.some((token) => {
    if (token === "concern") return blob.includes("concern");
    if (token === "@") return blob.includes("@") && blob.includes(".");
    return blob.includes(token);
  });
}
