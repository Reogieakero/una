/**
 * Server-only Google Calendar/Meet client (option A: office refresh token).
 * Never import from client components. Tokens are never logged.
 */

import {
  buildCounselingMeetEvent,
  parseGoogleEventId,
  parseGoogleMeetLink,
} from "@dorsu/shared-services";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const TIMEOUT_MS = 10_000;

export class GoogleMeetError extends Error {
  constructor(
    message: string,
    readonly code: "unconfigured" | "unauthorized" | "unavailable" | "invalid_response" | "not_found",
    readonly httpStatus: number,
  ) {
    super(message);
    this.name = "GoogleMeetError";
  }
}

type TokenCache = { accessToken: string; expiresAtMs: number };
let tokenCache: TokenCache | null = null;
let configUnhealthy = false;

export function isGoogleMeetEnabled(): boolean {
  const flag = process.env["GOOGLE_MEET_ENABLED"]?.trim();
  return flag === "1" || flag === "true";
}

export function isGoogleMeetConfigured(): boolean {
  return Boolean(
    isGoogleMeetEnabled() &&
      process.env["GOOGLE_CLIENT_ID"]?.trim() &&
      process.env["GOOGLE_CLIENT_SECRET"]?.trim() &&
      process.env["GOOGLE_REFRESH_TOKEN"]?.trim(),
  );
}

function calendarId(): string {
  return process.env["GOOGLE_CALENDAR_ID"]?.trim() || "primary";
}

function eventsUrl(eventId?: string): string {
  const cal = encodeURIComponent(calendarId());
  const base = `${CALENDAR_API}/calendars/${cal}/events`;
  return eventId ? `${base}/${encodeURIComponent(eventId)}` : `${base}?conferenceDataVersion=1`;
}

async function googleFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    throw new GoogleMeetError(
      aborted ? "Google Meet timed out." : "Couldn't reach Google Meet.",
      "unavailable",
      502,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function googleFetchOnceOrRetry(url: string, init: RequestInit): Promise<Response> {
  const first = await googleFetch(url, init);
  if (first.status >= 500 && first.status <= 599) {
    return googleFetch(url, init);
  }
  return first;
}

async function refreshAccessToken(): Promise<string> {
  if (configUnhealthy) {
    throw new GoogleMeetError(
      "Couldn't create a Meet link — paste one instead or try again.",
      "unauthorized",
      502,
    );
  }
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAtMs - 30_000 > now) {
    return tokenCache.accessToken;
  }
  const body = new URLSearchParams({
    client_id: process.env["GOOGLE_CLIENT_ID"] ?? "",
    client_secret: process.env["GOOGLE_CLIENT_SECRET"] ?? "",
    refresh_token: process.env["GOOGLE_REFRESH_TOKEN"] ?? "",
    grant_type: "refresh_token",
  });
  const res = await googleFetchOnceOrRetry(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (res.status === 401 || res.status === 400) {
    configUnhealthy = true;
    throw new GoogleMeetError(
      "Couldn't create a Meet link — paste one instead or try again.",
      "unauthorized",
      502,
    );
  }
  if (!res.ok) {
    throw new GoogleMeetError(
      "Couldn't create a Meet link — paste one instead or try again.",
      "unavailable",
      502,
    );
  }
  const json = (await res.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
  } | null;
  if (!json?.access_token) {
    throw new GoogleMeetError(
      "Couldn't create a Meet link — paste one instead or try again.",
      "invalid_response",
      502,
    );
  }
  tokenCache = {
    accessToken: json.access_token,
    expiresAtMs: now + Math.max(60, json.expires_in ?? 3600) * 1000,
  };
  return tokenCache.accessToken;
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export type CreatedMeet = { meetingUrl: string; eventId: string };

export async function createCounselingMeetEvent(input: {
  requestId: string;
  scheduledAt: string;
  endsAt: string | null;
}): Promise<CreatedMeet> {
  if (!isGoogleMeetConfigured()) {
    throw new GoogleMeetError(
      "Chekie isn't set up to create Meet links yet — paste one instead.",
      "unconfigured",
      503,
    );
  }
  const token = await refreshAccessToken();
  const event = buildCounselingMeetEvent({
    appointmentId: input.requestId,
    scheduledAt: input.scheduledAt,
    endsAt: input.endsAt,
  });
  const res = await googleFetchOnceOrRetry(eventsUrl(), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(event),
  });
  if (res.status === 401) {
    configUnhealthy = true;
    tokenCache = null;
    throw new GoogleMeetError(
      "Couldn't create a Meet link — paste one instead or try again.",
      "unauthorized",
      502,
    );
  }
  if (!res.ok) {
    throw new GoogleMeetError(
      "Couldn't create a Meet link — paste one instead or try again.",
      "unavailable",
      502,
    );
  }
  const payload: unknown = await res.json().catch(() => null);
  const meetingUrl = parseGoogleMeetLink(payload);
  const eventId = parseGoogleEventId(payload);
  if (!meetingUrl || !eventId) {
    throw new GoogleMeetError(
      "Couldn't create a Meet link — paste one instead or try again.",
      "invalid_response",
      502,
    );
  }
  return { meetingUrl, eventId };
}

export async function patchCounselingMeetEvent(input: {
  eventId: string;
  scheduledAt: string;
  endsAt: string | null;
}): Promise<void> {
  if (!isGoogleMeetConfigured()) {
    throw new GoogleMeetError(
      "Chekie isn't set up to update Meet links yet.",
      "unconfigured",
      503,
    );
  }
  const token = await refreshAccessToken();
  const start = new Date(input.scheduledAt);
  const end = input.endsAt ? new Date(input.endsAt) : new Date(start.getTime() + 60 * 60 * 1000);
  const res = await googleFetchOnceOrRetry(eventsUrl(input.eventId), {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({
      start: { dateTime: start.toISOString(), timeZone: "Asia/Manila" },
      end: { dateTime: end.toISOString(), timeZone: "Asia/Manila" },
    }),
  });
  if (res.status === 404) {
    throw new GoogleMeetError("That calendar event is already gone.", "not_found", 404);
  }
  if (res.status === 401) {
    configUnhealthy = true;
    tokenCache = null;
    throw new GoogleMeetError("Couldn't update the Meet event.", "unauthorized", 502);
  }
  if (!res.ok) {
    throw new GoogleMeetError("Couldn't update the Meet event.", "unavailable", 502);
  }
}

export async function deleteCounselingMeetEvent(eventId: string): Promise<void> {
  if (!isGoogleMeetConfigured()) {
    throw new GoogleMeetError(
      "Chekie isn't set up to remove Meet links yet.",
      "unconfigured",
      503,
    );
  }
  const token = await refreshAccessToken();
  const res = await googleFetchOnceOrRetry(eventsUrl(eventId), {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (res.status === 404 || res.status === 410) return;
  if (res.status === 401) {
    configUnhealthy = true;
    tokenCache = null;
    throw new GoogleMeetError("Couldn't remove the calendar event.", "unauthorized", 502);
  }
  if (!res.ok) {
    throw new GoogleMeetError("Couldn't remove the calendar event.", "unavailable", 502);
  }
}

/** Exported for tests — do not call from product code. */
export function _resetGoogleMeetStateForTests(): void {
  tokenCache = null;
  configUnhealthy = false;
}

export const GOOGLE_CALENDAR_EVENTS_SCOPE = SCOPE;
