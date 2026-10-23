import { describe, expect, it } from "vitest";
import type { DbClient } from "../platform";
import { confirmAppointment, isMeetUrl } from "./mutations";

function fakeConfirmDb(current: unknown, updateError: unknown): DbClient {
  let table = "";
  let op = "select";
  const builder: any = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.update = () => {
    op = "update";
    return builder;
  };
  builder.single = async () => {
    if (table === "appointments" && op === "select") {
      return { data: current, error: null };
    }
    if (table === "appointments" && op === "update") {
      return { data: null, error: updateError };
    }
    return { data: null, error: null };
  };
  return {
    from(name: string) {
      table = name;
      op = "select";
      return builder;
    },
  } as DbClient;
}

describe("isMeetUrl", () => {
  it("accepts Google Meet links with optional paths and query strings", () => {
    expect(isMeetUrl("https://meet.google.com/abc-defg-hij")).toBe(true);
    expect(isMeetUrl("https://meet.google.com/abc-defg-hij/")).toBe(true);
    expect(isMeetUrl("https://meet.google.com/abc-defg-hij?authuser=0")).toBe(true);
    expect(isMeetUrl("  https://meet.google.com/abc-defg-hij  ")).toBe(true);
  });

  it("rejects non-HTTPS, wrong hosts, and malformed links", () => {
    expect(isMeetUrl("http://meet.google.com/abc-defg-hij")).toBe(false);
    expect(isMeetUrl("https://meet.google.com.evil.test/abc-defg-hij")).toBe(false);
    expect(isMeetUrl("https://zoom.us/j/123456789")).toBe(false);
    expect(isMeetUrl("https://meet.google.com/")).toBe(false);
    expect(isMeetUrl("not a url")).toBe(false);
    expect(isMeetUrl("")).toBe(false);
  });
});

describe("confirmAppointment", () => {
  const counselorId = "11111111-1111-4111-8111-111111111111";

  it("maps a 23P01 race to the friendly 'just taken' message", async () => {
    const db = fakeConfirmDb(
      { mode: "in_person", status: "assigned", counselor_id: counselorId },
      { code: "23P01", message: "conflicting key value violates exclusion constraint" },
    );
    await expect(confirmAppointment(db, "appointment-1")).rejects.toThrow(/just taken/);
  });

  it("requires a Meet link before confirming an online session", async () => {
    const db = fakeConfirmDb(
      { mode: "online", status: "assigned", counselor_id: counselorId },
      null,
    );
    await expect(confirmAppointment(db, "appointment-1")).rejects.toThrow(/Meet link/);
  });

  it("refuses to confirm a session that is not assigned", async () => {
    const db = fakeConfirmDb(
      { mode: "in_person", status: "confirmed", counselor_id: counselorId },
      null,
    );
    await expect(confirmAppointment(db, "appointment-1")).rejects.toThrow(/Only assigned/);
  });
});
