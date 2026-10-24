import { describe, expect, it } from "vitest";
import type { DbClient } from "../platform";
import { PreSessionPss10RequiredError } from "./pre-session-pss10";
import { completeAppointment, rescheduleAppointment } from "./mutations";

const STUDENT = "11111111-1111-4111-8111-111111111111";
const APPOINTMENT = "22222222-2222-4222-8222-222222222222";
const START = "2026-11-10T09:00:00.000Z";

type Audit = Record<string, unknown> | null;

/**
 * Minimal fake for the completion path: appointment read, latest linked
 * assessment read, guarded update, and the waiver audit insert.
 */
function fakeDb(options: {
  appointment?: Record<string, unknown> | null;
  latest?: Record<string, unknown> | null;
  updateError?: unknown;
  auditError?: unknown;
}) {
  let table = "";
  let op = "select";
  let payload: Record<string, unknown> | null = null;
  let audit: Audit = null;

  const builder: any = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.in = () => builder;
  builder.order = () => builder;
  builder.limit = () => builder;
  builder.insert = (value: Record<string, unknown>) => {
    op = "insert";
    payload = value;
    return builder;
  };
  builder.update = (value: Record<string, unknown>) => {
    op = "update";
    payload = value;
    return builder;
  };
  builder.maybeSingle = async () => {
    if (table === "pss10_assessments") {
      return { data: options.latest ?? null, error: null };
    }
    return { data: null, error: null };
  };
  builder.single = async () => {
    if (table === "appointments" && op === "select") {
      return options.appointment === null
        ? { data: null, error: new Error("not found") }
        : { data: options.appointment, error: null };
    }
    if (table === "appointments" && op === "update") {
      if (options.updateError) return { data: null, error: options.updateError };
      return {
        data: { ...(options.appointment ?? {}), ...(payload ?? {}) },
        error: null,
      };
    }
    return { data: null, error: null };
  };
  // The audit insert resolves when awaited directly (no .select()).
  builder.then = (resolve: (value: unknown) => unknown) => {
    if (table === "audit_logs" && op === "insert") {
      audit = payload;
      return Promise.resolve(
        options.auditError ? { data: null, error: options.auditError } : { data: null, error: null },
      ).then(resolve);
    }
    return Promise.resolve({ data: null, error: null }).then(resolve);
  };

  const db = {
    from(name: string) {
      table = name;
      op = "select";
      payload = null;
      return builder;
    },
    auth: {
      getUser: async () => ({ data: { user: { id: "profile-1" } }, error: null }),
    },
  } as unknown as DbClient;

  return { db, audit: () => audit };
}

const CONFIRMED = {
  id: APPOINTMENT,
  status: "confirmed",
  student_id: STUDENT,
  scheduled_at: START,
  pss10_required: true,
  pss10_waived_at: null,
};

describe("completeAppointment pre-session gate", () => {
  it("blocks completion when no check-in is linked", async () => {
    const { db } = fakeDb({ appointment: CONFIRMED, latest: null });
    await expect(completeAppointment(db, APPOINTMENT)).rejects.toBeInstanceOf(
      PreSessionPss10RequiredError,
    );
  });

  it("blocks completion when the linked check-in is older than 7 days", async () => {
    const { db } = fakeDb({
      appointment: CONFIRMED,
      latest: { id: "p1", student_id: STUDENT, created_at: "2026-10-01T09:00:00.000Z" },
    });
    await expect(completeAppointment(db, APPOINTMENT)).rejects.toBeInstanceOf(
      PreSessionPss10RequiredError,
    );
  });

  it("completes with a fresh linked check-in", async () => {
    const { db } = fakeDb({
      appointment: CONFIRMED,
      latest: { id: "p1", student_id: STUDENT, created_at: "2026-11-09T09:00:00.000Z" },
    });
    const row = await completeAppointment(db, APPOINTMENT);
    expect(row.status).toBe("completed");
  });

  it("does not require a check-in for grandfathered rows", async () => {
    const { db } = fakeDb({
      appointment: { ...CONFIRMED, pss10_required: false },
      latest: null,
    });
    const row = await completeAppointment(db, APPOINTMENT);
    expect(row.status).toBe("completed");
  });

  it("rejects a waiver reason shorter than 10 characters", async () => {
    const { db } = fakeDb({ appointment: CONFIRMED, latest: null });
    await expect(
      completeAppointment(db, APPOINTMENT, { waiverReason: "too short" }),
    ).rejects.toThrow(/10 and 500/);
  });

  it("completes with a valid waiver and writes the audit row", async () => {
    const { db, audit } = fakeDb({ appointment: CONFIRMED, latest: null });
    const row = await completeAppointment(db, APPOINTMENT, {
      waiverReason: "Walk-in session documented on paper.",
    });
    expect(row.status).toBe("completed");
    expect(row.pss10_waiver_reason).toBe("Walk-in session documented on paper.");
    expect(audit()).toMatchObject({
      actor_profile_id: "profile-1",
      action: "appointment.pss10_waived",
      entity: "appointments",
      entity_id: APPOINTMENT,
    });
    // No assessment content ever reaches the audit payload.
    expect(audit()).not.toHaveProperty("answers");
    expect(audit()).not.toHaveProperty("total_score");
  });
});

describe("rescheduleAppointment confirmed-session window", () => {
  const HOUR = 60 * 60 * 1000;

  function rescheduleDb(status: string, scheduledAt: string) {
    return fakeDb({
      appointment: {
        id: APPOINTMENT,
        status,
        counselor_id: null,
        scheduled_at: scheduledAt,
        ends_at: null,
      },
    }).db;
  }

  it("allows a confirmed session more than 24 hours before the start", async () => {
    const start = new Date(Date.now() + 30 * HOUR).toISOString();
    const db = rescheduleDb("confirmed", start);
    const row = await rescheduleAppointment(db, APPOINTMENT, new Date(Date.now() + 48 * HOUR));
    expect(row.scheduled_at).toBeTruthy();
  });

  it("rejects a confirmed session inside the 24-hour cut-off", async () => {
    const start = new Date(Date.now() + 20 * HOUR).toISOString();
    const db = rescheduleDb("confirmed", start);
    await expect(
      rescheduleAppointment(db, APPOINTMENT, new Date(Date.now() + 48 * HOUR)),
    ).rejects.toThrow(/24 hours/);
  });

  it("still allows pending requests to move", async () => {
    const start = new Date(Date.now() + 20 * HOUR).toISOString();
    const db = rescheduleDb("pending", start);
    const row = await rescheduleAppointment(db, APPOINTMENT, new Date(Date.now() + 48 * HOUR));
    expect(row.scheduled_at).toBeTruthy();
  });
});
