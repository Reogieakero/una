import { describe, expect, it } from "vitest";
import { calculatePss10 } from "./pss10-scoring";

const answers = (value: number) => Array.from({ length: 10 }, () => value);

describe("calculatePss10", () => {
  it("applies reverse scoring to all-zero answers", () => {
    const input = answers(0);
    // Q4, Q5, Q7, Q8 are reverse-scored, so all-zero answers = 4 each.
    expect(calculatePss10(input)).toEqual({ totalScore: 16, band: "moderate" });
  });

  it("scores a mix consistently with reverse scoring", () => {
    // Six non-reverse items at 4 = 24; four reverse items at 4 = 0.
    expect(calculatePss10(answers(4))).toEqual({
      totalScore: 24,
      band: "moderate",
    });
  });

  it("reaches the maximum score of 40 (high band)", () => {
    const input = answers(4);
    // Set reverse items to 0 => 4 each (16), non-reverse stay 4 (24).
    input[3] = 0;
    input[4] = 0;
    input[6] = 0;
    input[7] = 0;
    expect(calculatePss10(input)).toEqual({ totalScore: 40, band: "high" });
  });

  it("reaches the minimum score of 0 (low band)", () => {
    const input = answers(0);
    // Set reverse items to 4 => 0 each, non-reverse stay 0.
    input[3] = 4;
    input[4] = 4;
    input[6] = 4;
    input[7] = 4;
    expect(calculatePss10(input)).toEqual({ totalScore: 0, band: "low" });
  });

  it("uses the documented band boundaries", () => {
    const low13 = answers(0);
    low13[3] = 1;
    low13[4] = 1;
    low13[6] = 1;
    // 3 + 3 + 3 + 4 = 13.
    expect(calculatePss10(low13)).toEqual({ totalScore: 13, band: "low" });

    const moderate14 = answers(0);
    moderate14[3] = 1;
    moderate14[4] = 1;
    // 3 + 3 + 4 + 4 = 14.
    expect(calculatePss10(moderate14)).toEqual({
      totalScore: 14,
      band: "moderate",
    });

    const moderate26 = answers(4);
    moderate26[3] = 3;
    moderate26[4] = 3;
    // 24 non-reverse + 1 + 1 = 26.
    expect(calculatePss10(moderate26)).toEqual({
      totalScore: 26,
      band: "moderate",
    });

    const high27 = answers(4);
    high27[3] = 3;
    high27[4] = 3;
    high27[6] = 3;
    // 24 non-reverse + 1 + 1 + 1 = 27.
    expect(calculatePss10(high27)).toEqual({ totalScore: 27, band: "high" });
  });

  it("rejects wrong answer counts", () => {
    expect(() => calculatePss10([])).toThrow(/exactly 10/);
    expect(() => calculatePss10(answers(0).slice(0, 9))).toThrow(/exactly 10/);
    expect(() => calculatePss10([...answers(0), 0])).toThrow(/exactly 10/);
  });

  it("rejects out-of-range and non-integer answers", () => {
    const negative = answers(0);
    negative[0] = -1;
    expect(() => calculatePss10(negative)).toThrow(/out of range/);

    const tooHigh = answers(0);
    tooHigh[0] = 5;
    expect(() => calculatePss10(tooHigh)).toThrow(/out of range/);

    const fractional = answers(0);
    fractional[0] = 1.5;
    expect(() => calculatePss10(fractional)).toThrow(/out of range/);
  });
});
