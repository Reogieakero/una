import { describe, expect, it } from "vitest";
import type { Clock, DbClient } from "../platform";
import { bookAppointment, isPss10Fresh } from "./booking-service";

const STUDENT = "11111111-1111-4111-8111-111111111111";
const OTHER_STUDENT = "22222222-2222-4222-8222-222222222222";
const PSS_ID = "33333333-3333-4333-8333-333333333333";
const IDEMPOTENCY = "44444444-4444-4444-8444-444444444444";

const clockAt = (iso: string): Clock => ({ now: () => new Date(iso) });

type Result = { data: any; error: any };

function fakeDb(options: {
  latest?: Result;
  byId?: Result;
  inserted?: Result;
  existing?: Result;
}): { db: DbClient; lastInsert: () => Record<string, unknown> | null } {
  let table = "";
  let op = "select";
  let insertPayload: Record<string, unknown> | null = null;
  const filters: Record<string, unknown> = {};

  const builder: any = {};
  builder.select = () => builder;
  builder.eq = (column: string, value: unknown) => {
    filters[column] = value;
    return builder;
  };
  builder.order = () => builder;
  builder.limit = () => builder;
  builder.insert = (payload: Record<string, unknown>) => {
    op = "insert";
    insertPayload = payload;
    return builder;
  };
  builder.update = () => {
    op = "update";
    return builder;
  };
  builder.maybeSingle = async () => {
    if (table === "pss10_assessments" && op === "select") {
      return options.latest ?? { data: null, error: null };
    }
    return { data: null, error: null };
  };
  builder.single = async () => {
    if (table === "pss10_assessments" && op === "select") {
      return options.byId ?? { data: null, error: null };
    }
    if (table === "appointments" && op === "insert") {
      return options.inserted ?? { data: { id: "appointment-1" }, error: null };
    }
    if (table === "appointments" && op === "select") {
      return options.existing ?? { data: null, error: null };
    }
    return { data: null, error: null };
  };

  const db = {
    from(name: string) {
      table = name;
      op = "select";
      insertPayload = null;
      for (const key of Object.keys(filters)) delete filters[key];
      return builder;
    },
  } as DbClient;

  return { db, lastInsert: () => insertPayload };
}

const future = new Date("2026-10-25T02:00:00.000Z");
const now = "2026-10-24T00:00:00.000Z";

function bookingInput(overrides: Partial<Parameters<typeof bookAppointment>[1]> = {}) {
  return {
    studentId: STUDENT,
    scheduledAt: future,
    mode: "in_person" as const,
    concern: "Academic support session",
    ...overrides,
  };
}

describe("isPss10Fresh", () => {
  const clock = clockAt(now);

  it("accepts an assessment inside the 30-day window", () => {
    expect(isPss10Fresh("2026-09-24T00:00:00.000Z", clock)).toBe(true);
    expect(isPss10Fresh("2026-09-25T00:00:00.000Z", clock)).toBe(true);
  });

  it("rejects an assessment older than 30 days", () => {
    expect(isPss10Fresh("2026-09-23T23:59:59.999Z", clock)).toBe(false);
  });

  it("tolerates small client/server clock skew into the future", () => {
    expect(isPss10Fresh("2026-10-24T00:04:00.000Z", clock)).toBe(true);
    expect(isPss10Fresh("2026-10-24T00:06:00.000Z", clock)).toBe(false);
  });

  it("rejects unparseable timestamps", () => {
    expect(isPss10Fresh("not-a-date", clock)).toBe(false);
  });

  it("handles PostgREST microsecond timestamps", () => {
    expect(isPss10Fresh("2026-10-20T10:00:00.123456+00:00", clock)).toBe(true);
  });
});

describe("bookAppointment", () => {
  it("rejects a start time in the past before touching the DB", async () => {
    const { db } = fakeDb({});
    await expect(
      bookAppointment(
        db,
        bookingInput({ scheduledAt: new Date("2026-10-23T00:00:00.000Z") }),
        clockAt(now),
      ),
    ).rejects.toThrow(/future/);
  });

  it("requires a check-in when no PSS-10 exists", async () => {
    const { db } = fakeDb({ latest: { data: null, error: null } });
    await expect(bookAppointment(db, bookingInput(), clockAt(now))).rejects.toThrow(
      /Complete a PSS-10 check-in/,
    );
  });

  it("rejects an explicit PSS-10 that belongs to another student", async () => {
    const { db } = fakeDb({
      byId: {
        data: {
          id: PSS_ID,
          student_id: OTHER_STUDENT,
          created_at: "2026-10-20T00:00:00.000Z",
        },
        error: null,
      },
    });
    await expect(
      bookAppointment(db, bookingInput({ pss10Id: PSS_ID }), clockAt(now)),
    ).rejects.toThrow(/Invalid PSS-10 reference/);
  });

  it("rejects an expired latest PSS-10", async () => {
    const { db } = fakeDb({
      latest: {
        data: {
          id: PSS_ID,
          student_id: STUDENT,
          created_at: "2026-08-01T00:00:00.000Z",
        },
        error: null,
      },
    });
    await expect(bookAppointment(db, bookingInput(), clockAt(now))).rejects.toThrow(
      /expired/,
    );
  });

  it("inserts a pending appointment with the gate PSS-10 id", async () => {
    const { db, lastInsert } = fakeDb({
      latest: {
        data: {
          id: PSS_ID,
          student_id: STUDENT,
          created_at: "2026-10-20T00:00:00.000Z",
        },
        error: null,
      },
      inserted: { data: { id: "appointment-1" }, error: null },
    });
    const result = await bookAppointment(db, bookingInput(), clockAt(now));
    expect(result).toEqual({ id: "appointment-1" });
    expect(lastInsert()).toMatchObject({
      student_id: STUDENT,
      status: "pending",
      pss10_id: PSS_ID,
    });
  });

  it("maps a slot-race conflict (23P01) to a friendly retry message", async () => {
    const { db } = fakeDb({
      latest: {
        data: {
          id: PSS_ID,
          student_id: STUDENT,
          created_at: "2026-10-20T00:00:00.000Z",
        },
        error: null,
      },
      inserted: { data: null, error: { code: "23P01", message: "conflict" } },
    });
    await expect(bookAppointment(db, bookingInput(), clockAt(now))).rejects.toThrow(
      /just taken/,
    );
  });

  it("returns the existing row when the same idempotency key is retried", async () => {
    const { db } = fakeDb({
      latest: {
        data: {
          id: PSS_ID,
          student_id: STUDENT,
          created_at: "2026-10-20T00:00:00.000Z",
        },
        error: null,
      },
      inserted: { data: null, error: { code: "23505", message: "duplicate" } },
      existing: { data: { id: "appointment-existing" }, error: null },
    });
    const result = await bookAppointment(
      db,
      bookingInput({ idempotencyKey: IDEMPOTENCY }),
      clockAt(now),
    );
    expect(result).toEqual({ id: "appointment-existing" });
  });

  it("rethrows a unique violation when there is no idempotency key", async () => {
    const { db } = fakeDb({
      latest: {
        data: {
          id: PSS_ID,
          student_id: STUDENT,
          created_at: "2026-10-20T00:00:00.000Z",
        },
        error: null,
      },
      inserted: { data: null, error: { code: "23505", message: "duplicate" } },
    });
    await expect(bookAppointment(db, bookingInput(), clockAt(now))).rejects.toMatchObject({
      code: "23505",
    });
  });
});
