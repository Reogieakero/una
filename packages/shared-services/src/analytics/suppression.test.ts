import { describe, expect, it } from "vitest";
import { MIN_CELL, isSuppressed, suppressCohorts, suppressCount } from "./suppression";

describe("report small-cell suppression", () => {
  it("suppresses counts from 1 to MIN_CELL - 1 and keeps 0 / MIN_CELL", () => {
    expect(MIN_CELL).toBe(5);
    for (const n of [1, 2, 3, 4]) expect(suppressCount(n)).toBeNull();
    expect(suppressCount(0)).toBe(0);
    expect(suppressCount(5)).toBe(5);
    expect(suppressCount(6)).toBe(6);
    expect(suppressCount(null)).toBeNull();
  });

  it("flags non-zero small cells only", () => {
    expect(isSuppressed(0)).toBe(false);
    expect(isSuppressed(4)).toBe(true);
    expect(isSuppressed(5)).toBe(false);
    expect(isSuppressed(null)).toBe(false);
  });

  it("drops cohorts below the denominator threshold", () => {
    const rows = [
      { cohort: "BSIT", screenings: 12 },
      { cohort: "BSED", screenings: 4 },
      { cohort: "BSN", screenings: 5 },
    ];
    expect(suppressCohorts(rows).map((r) => r.cohort)).toEqual(["BSIT", "BSN"]);
  });
});
