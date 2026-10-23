import {
  PSS10_ANSWER_MAX,
  PSS10_ANSWER_MIN,
  PSS10_ITEMS,
  PSS10_REVERSE_INDEXES,
} from "./pss10-instrument";

/** Reverse-scored item indexes (0-based): Q4, Q5, Q7, Q8 per PSS-10 manual. */
const REVERSE = new Set<number>(PSS10_REVERSE_INDEXES);

export type Pss10Band = "low" | "moderate" | "high";

/** Score one PSS-10 submission (pure, no I/O; bands 0-13 low, 14-26 moderate, 27-40 high). */
export function calculatePss10(answers: number[]): {
  totalScore: number;
  band: Pss10Band;
} {
  if (answers.length !== PSS10_ITEMS.length)
    throw new Error(`PSS-10 requires exactly ${PSS10_ITEMS.length} answers`);
  let total = 0;
  answers.forEach((a, i) => {
    if (!Number.isInteger(a) || a < PSS10_ANSWER_MIN || a > PSS10_ANSWER_MAX)
      throw new Error(
        `Answer ${i + 1} out of range ${PSS10_ANSWER_MIN}..${PSS10_ANSWER_MAX}`,
      );
    total += REVERSE.has(i) ? PSS10_ANSWER_MAX - a : a;
  });
  const band: Pss10Band = total <= 13 ? "low" : total <= 26 ? "moderate" : "high";
  return { totalScore: total, band };
}

/** Band thresholds shared by analytics + UI badges. */
export const PSS10_BANDS = {
  low: { min: 0, max: 13, label: "Low stress" },
  moderate: { min: 14, max: 26, label: "Moderate stress" },
  high: { min: 27, max: 40, label: "High perceived stress" },
} as const;
