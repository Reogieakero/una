import { describe, expect, it } from "vitest";
import {
  PSS10_PRE_SESSION_DAYS,
  PSS10_RESCHEDULE_CUTOFF_HOURS,
  isPreSessionPss10Valid,
  isWithinPreSessionSubmitWindow,
  isWithinStudentRescheduleWindow,
  preSessionPss10State,
} from "./pre-session-pss10";

const START = new Date("2026-11-10T09:00:00.000Z");
const before = (ms: number) => new Date(START.getTime() - ms);
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

describe("isPreSessionPss10Valid", () => {
  it("accepts exactly 7 days before the start", () => {
    expect(isPreSessionPss10Valid(before(PSS10_PRE_SESSION_DAYS * DAY), START)).toBe(true);
  });

  it("rejects 7 days + 1 second before the start", () => {
    expect(isPreSessionPss10Valid(before(PSS10_PRE_SESSION_DAYS * DAY + 1000), START)).toBe(false);
  });

  it("accepts a check-in moments after the start within clock skew", () => {
    expect(isPreSessionPss10Valid(new Date(START.getTime() + 4 * 60 * 1000), START)).toBe(true);
  });

  it("rejects a check-in well after the start", () => {
    expect(isPreSessionPss10Valid(new Date(START.getTime() + 10 * 60 * 1000), START)).toBe(false);
  });

  it("rejects malformed timestamps", () => {
    expect(isPreSessionPss10Valid("not-a-date", START)).toBe(false);
  });
});

describe("isWithinPreSessionSubmitWindow", () => {
  it("opens exactly 7 days before the start", () => {
    expect(isWithinPreSessionSubmitWindow(before(PSS10_PRE_SESSION_DAYS * DAY), START)).toBe(true);
  });

  it("is closed before the 7-day window", () => {
    expect(isWithinPreSessionSubmitWindow(before(PSS10_PRE_SESSION_DAYS * DAY + 1000), START)).toBe(false);
  });

  it("is closed after the start plus skew", () => {
    expect(isWithinPreSessionSubmitWindow(new Date(START.getTime() + 6 * 60 * 1000), START)).toBe(false);
  });
});

describe("isWithinStudentRescheduleWindow", () => {
  it("allows a confirmed session more than 24 hours out", () => {
    const now = new Date(START.getTime() - (PSS10_RESCHEDULE_CUTOFF_HOURS * HOUR + 1000));
    expect(isWithinStudentRescheduleWindow(START, now)).toBe(true);
  });

  it("rejects a session inside the 24-hour cut-off", () => {
    const now = new Date(START.getTime() - (PSS10_RESCHEDULE_CUTOFF_HOURS * HOUR - 1000));
    expect(isWithinStudentRescheduleWindow(START, now)).toBe(false);
  });
});

describe("preSessionPss10State", () => {
  const base = { scheduledAt: START, clock: { now: () => before(DAY) } };

  it("does not require a check-in for legacy rows", () => {
    expect(preSessionPss10State({ ...base, required: false, submittedAt: null })).toBe("not_required");
  });

  it("reports a waiver before looking at submissions", () => {
    expect(
      preSessionPss10State({
        ...base,
        required: true,
        waivedAt: new Date().toISOString(),
        submittedAt: null,
      }),
    ).toBe("waived");
  });

  it("is not_due before the 7-day window opens", () => {
    expect(
      preSessionPss10State({
        ...base,
        clock: { now: () => before(PSS10_PRE_SESSION_DAYS * DAY + HOUR) },
        required: true,
        submittedAt: null,
      }),
    ).toBe("not_due");
  });

  it("is missing when the window is open and nothing is linked", () => {
    expect(preSessionPss10State({ ...base, required: true, submittedAt: null })).toBe("missing");
  });

  it("is complete for a fresh linked check-in", () => {
    expect(
      preSessionPss10State({ ...base, required: true, submittedAt: before(DAY) }),
    ).toBe("complete");
  });

  it("is expired for an old linked check-in", () => {
    expect(
      preSessionPss10State({
        ...base,
        required: true,
        submittedAt: before(PSS10_PRE_SESSION_DAYS * DAY + HOUR),
      }),
    ).toBe("expired");
  });
});
