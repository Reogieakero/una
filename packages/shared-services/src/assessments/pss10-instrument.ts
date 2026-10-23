/**
 * PSS-10 instrument content — the single source of item wording, response
 * labels, and reverse-scored indexes.
 *
 * PROVENANCE
 *   Cohen, S., Kamarck, T., & Mermelstein, R. (1983). A global measure of
 *   perceived stress. Journal of Health and Social Behavior, 24(4), 385–396.
 *   The 10-item response format follows Cohen & Williamson (1988).
 *
 * LICENSING: the project must confirm its permission to reproduce the exact
 * instrument wording before external distribution. Until that is recorded in
 * `docs/pss10-license-note.md`, treat this as a pending compliance item — do
 * not paraphrase, reorder, translate, or relabel the items.
 *
 * The mobile UI renders `PSS10_INSTRUCTIONS` once and then one item per
 * screen; items are clauses, not full sentences.
 */

export const PSS10_INSTRUCTIONS = "In the last month, how often have you…";

export const PSS10_LABELS = [
  "Never",
  "Almost never",
  "Sometimes",
  "Fairly often",
  "Very often",
] as const;

export type Pss10Label = (typeof PSS10_LABELS)[number];

export const PSS10_ITEMS = [
  "been upset because of something that happened unexpectedly?",
  "felt that you were unable to control the important things in your life?",
  "felt nervous and stressed?",
  "felt confident about your ability to handle your personal problems?",
  "felt that things were going your way?",
  "found that you could not cope with all the things that you had to do?",
  "been able to control irritations in your life?",
  "felt that you were on top of things?",
  "been angered because of things that happened that were outside of your control?",
  "felt difficulties were piling up so high that you could not overcome them?",
] as const;

export type Pss10Item = (typeof PSS10_ITEMS)[number];

/** 0-based indexes of the positively worded items (Q4, Q5, Q7, Q8). */
export const PSS10_REVERSE_INDEXES = [3, 4, 6, 7] as const;

export const PSS10_ANSWER_MIN = 0;
export const PSS10_ANSWER_MAX = 4;

/** True for a valid 0..4 response value. Used by screens before submission. */
export function isPss10Answer(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= PSS10_ANSWER_MIN &&
    value <= PSS10_ANSWER_MAX
  );
}
