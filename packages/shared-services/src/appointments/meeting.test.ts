import { describe, expect, it } from "vitest";
import {
  buildCounselingMeetEvent,
  extractMeetCode,
  isMeetEventExpired,
  isMeetUrl,
  meetEventLeaksStudentIdentity,
  meetingCreateAllowed,
  meetingPatchAllowed,
  meetingRemoveAllowed,
  parseGoogleEventId,
  parseGoogleMeetLink,
} from "./meeting";

describe("extractMeetCode", () => {
  it("returns the meeting code from a valid Meet URL", () => {
    expect(extractMeetCode("https://meet.google.com/abc-defg-hij")).toBe("abc-defg-hij");
    expect(extractMeetCode("  https://meet.google.com/abc-defg-hij?authuser=0  ")).toBe("abc-defg-hij");
  });

  it("returns null for non-Meet URLs", () => {
    expect(extractMeetCode("https://zoom.us/j/123")).toBeNull();
    expect(extractMeetCode("https://meet.google.com/")).toBeNull();
    expect(extractMeetCode("")).toBeNull();
  });
});

describe("isMeetEventExpired", () => {
  const now = new Date("2026-10-24T00:00:00.000Z");

  it("is false when there is no created-at", () => {
    expect(isMeetEventExpired(null, now)).toBe(false);
    expect(isMeetEventExpired(undefined, now)).toBe(false);
  });

  it("is false inside 180 days and true after", () => {
    expect(isMeetEventExpired("2026-09-01T00:00:00.000Z", now)).toBe(false);
    expect(isMeetEventExpired("2026-01-01T00:00:00.000Z", now)).toBe(true);
  });
});

describe("meetingCreateAllowed", () => {
  const future = "2026-10-25T02:00:00.000Z";
  const past = "2026-10-23T02:00:00.000Z";
  const now = new Date("2026-10-24T00:00:00.000Z");

  it("allows assigned/confirmed online sessions still in the future", () => {
    expect(meetingCreateAllowed("assigned", "online", future, now)).toBe(true);
    expect(meetingCreateAllowed("confirmed", "online", future, now)).toBe(true);
  });

  it("rejects in-person, terminal, and past sessions", () => {
    expect(meetingCreateAllowed("assigned", "in_person", future, now)).toBe(false);
    expect(meetingCreateAllowed("pending", "online", future, now)).toBe(false);
    expect(meetingCreateAllowed("cancelled", "online", future, now)).toBe(false);
    expect(meetingCreateAllowed("assigned", "online", past, now)).toBe(false);
  });
});

describe("meetingRemoveAllowed / meetingPatchAllowed", () => {
  it("allows detach on active and cancel/reject rows, not completed history", () => {
    expect(meetingRemoveAllowed("assigned")).toBe(true);
    expect(meetingRemoveAllowed("confirmed")).toBe(true);
    expect(meetingRemoveAllowed("cancelled")).toBe(true);
    expect(meetingRemoveAllowed("rejected")).toBe(true);
    expect(meetingRemoveAllowed("completed")).toBe(false);
    expect(meetingRemoveAllowed("no_show")).toBe(false);
  });

  it("allows time patches only on active online rows", () => {
    expect(meetingPatchAllowed("confirmed", "online")).toBe(true);
    expect(meetingPatchAllowed("assigned", "online")).toBe(true);
    expect(meetingPatchAllowed("confirmed", "in_person")).toBe(false);
    expect(meetingPatchAllowed("cancelled", "online")).toBe(false);
  });
});

describe("parseGoogleMeetLink", () => {
  it("prefers hangoutLink", () => {
    expect(
      parseGoogleMeetLink({ hangoutLink: "https://meet.google.com/abc-defg-hij?hs=122" }),
    ).toBe("https://meet.google.com/abc-defg-hij");
  });

  it("falls back to the video entry point", () => {
    expect(
      parseGoogleMeetLink({
        conferenceData: {
          entryPoints: [
            { entryPointType: "phone", uri: "tel:+1" },
            { entryPointType: "video", uri: "https://meet.google.com/xyz-abcd-efg" },
          ],
        },
      }),
    ).toBe("https://meet.google.com/xyz-abcd-efg");
  });

  it("rejects missing or non-Meet payloads", () => {
    expect(parseGoogleMeetLink(null)).toBeNull();
    expect(parseGoogleMeetLink({ hangoutLink: "https://zoom.us/j/1" })).toBeNull();
    expect(parseGoogleMeetLink({ conferenceData: { entryPoints: [] } })).toBeNull();
  });
});

describe("parseGoogleEventId", () => {
  it("reads the Calendar event id", () => {
    expect(parseGoogleEventId({ id: "evt_123" })).toBe("evt_123");
    expect(parseGoogleEventId({ id: "  " })).toBeNull();
    expect(parseGoogleEventId({})).toBeNull();
  });
});

describe("buildCounselingMeetEvent", () => {
  const appointmentId = "11111111-1111-4111-8111-111111111111";

  it("uses a generic title, no attendees, and the appointment id as requestId", () => {
    const event = buildCounselingMeetEvent({
      appointmentId,
      scheduledAt: "2026-10-25T02:00:00.000Z",
      endsAt: "2026-10-25T03:00:00.000Z",
    });
    expect(event.summary).toBe("Counseling session");
    expect(event.description).toBe("Join from the Chekie portal.");
    expect(event.conferenceData.createRequest.requestId).toBe(appointmentId);
    expect(event.conferenceData.createRequest.conferenceSolutionKey.type).toBe("hangoutsMeet");
    expect(meetEventLeaksStudentIdentity(event as unknown as Record<string, unknown>)).toBe(false);
    expect("attendees" in event).toBe(false);
  });

  it("defaults the end to one hour after start", () => {
    const event = buildCounselingMeetEvent({
      appointmentId,
      scheduledAt: "2026-10-25T02:00:00.000Z",
      endsAt: null,
    });
    expect(event.end.dateTime).toBe("2026-10-25T03:00:00.000Z");
  });
});

describe("isMeetUrl (re-exported contract)", () => {
  it("still accepts the same Meet URLs as confirmAppointment", () => {
    expect(isMeetUrl("https://meet.google.com/abc-defg-hij")).toBe(true);
    expect(isMeetUrl("https://meet.google.com.evil.test/abc-defg-hij")).toBe(false);
  });
});

describe("meetEventLeaksStudentIdentity (leak vectors)", () => {
  it("flags attendees, embedded emails, and identity tokens", () => {
    expect(meetEventLeaksStudentIdentity({ attendees: [{ email: "student@chekie.test" }] })).toBe(true);
    expect(meetEventLeaksStudentIdentity({ description: "Email the student at s@x.io" })).toBe(true);
    expect(meetEventLeaksStudentIdentity({ description: "student_no 12345" })).toBe(true);
    expect(meetEventLeaksStudentIdentity({ description: "full_name Jane Doe" })).toBe(true);
    expect(meetEventLeaksStudentIdentity({ description: "an anonymous_alias leak" })).toBe(true);
    expect(meetEventLeaksStudentIdentity({ description: "this concern is sensitive" })).toBe(true);
  });

  it("does not flag an ordinary managed Meet event", () => {
    expect(
      meetEventLeaksStudentIdentity({
        summary: "Counseling session",
        hangoutLink: "https://meet.google.com/abc-defg-hij",
        conferenceData: {
          createRequest: { requestId: "abc", conferenceSolutionKey: { type: "hangoutsMeet" } },
        },
      }),
    ).toBe(false);
  });
});
