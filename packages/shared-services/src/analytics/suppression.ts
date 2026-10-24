/**
 * Small-cell suppression for aggregate reports (Objective 5).
 *
 * A cohort or band cell below MIN_CELL is withheld rather than shown exactly:
 * with very small numbers a count can effectively identify one student.
 * Denominators used for percentages are left visible so trends stay readable.
 */
export const MIN_CELL = 5;

export function isSuppressed(count: number | null | undefined): boolean {
  return typeof count === "number" && count > 0 && count < MIN_CELL;
}

/** Returns the count only when it is safe to publish, otherwise null. */
export function suppressCount(count: number | null | undefined): number | null {
  if (count == null) return null;
  return count > 0 && count < MIN_CELL ? null : count;
}

/** Drops cohorts whose screening denominator is too small to report safely. */
export function suppressCohorts<T extends { screenings: number }>(rows: T[], min = MIN_CELL): T[] {
  return rows.filter((row) => row.screenings >= min);
}
