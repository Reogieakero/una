import { describe, expect, it } from "vitest";
import {
  PSS10_ANSWER_MAX,
  PSS10_ANSWER_MIN,
  PSS10_INSTRUCTIONS,
  PSS10_ITEMS,
  PSS10_LABELS,
  PSS10_REVERSE_INDEXES,
  isPss10Answer,
} from "./pss10-instrument";

describe("PSS-10 instrument", () => {
  it("has exactly 10 items and 5 response labels", () => {
    expect(PSS10_ITEMS).toHaveLength(10);
    expect(PSS10_LABELS).toHaveLength(5);
  });

  it("keeps the published reverse-scored items (Q4, Q5, Q7, Q8)", () => {
    expect([...PSS10_REVERSE_INDEXES]).toEqual([3, 4, 6, 7]);
  });

  it("has non-empty item text and a last-month instruction", () => {
    for (const item of PSS10_ITEMS) {
      expect(item.trim().length).toBeGreaterThan(0);
    }
    expect(PSS10_INSTRUCTIONS.toLowerCase()).toContain("last month");
  });

  it("accepts only integer answers 0..4", () => {
    expect(isPss10Answer(PSS10_ANSWER_MIN)).toBe(true);
    expect(isPss10Answer(PSS10_ANSWER_MAX)).toBe(true);
    expect(isPss10Answer(2)).toBe(true);
    expect(isPss10Answer(-1)).toBe(false);
    expect(isPss10Answer(5)).toBe(false);
    expect(isPss10Answer(1.5)).toBe(false);
    expect(isPss10Answer(Number.NaN)).toBe(false);
  });
});
