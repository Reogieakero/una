import { colors } from "@dorsu/ui-tokens";

/**
 * Shared reports chart palette — the ONLY place report colors live.
 *
 * Strict two-hue rule: every value is a PRIMARY blue or SECONDARY accent
 * (warm yellow) step from the system brand tokens (`@dorsu/ui-tokens`) — no
 * green/red/gray anywhere. Blues carry flow and progression (lighter =
 * earlier/lower, darker = further/higher); ambers carry attention and
 * terminal/negative states (darker = more severe). A brand change in
 * `packages/ui-tokens/src/colors.ts` re-skins every chart (faculty,
 * counselor, and head views share these maps verbatim).
 */
export type ChartMeta = { label: string; color: string };

export const CHART_PRIMARY = colors.primary[600];
export const FALLBACK_SLICE = colors.primary[200];

export const APPT_STATUS_META: Record<string, ChartMeta> = {
  pending: { label: "Pending", color: colors.accent[400] },
  assigned: { label: "Assigned", color: colors.primary[300] },
  confirmed: { label: "Confirmed", color: colors.primary[600] },
  completed: { label: "Completed", color: colors.primary[800] },
  cancelled: { label: "Cancelled", color: colors.primary[100] },
  rejected: { label: "Rejected", color: colors.accent[600] },
  no_show: { label: "No-show", color: colors.accent[700] },
};

export const REFERRAL_STATUS_META: Record<string, ChartMeta> = {
  pending: { label: "Pending", color: colors.accent[400] },
  assigned: { label: "Assigned", color: colors.primary[300] },
  acknowledged: { label: "Acknowledged", color: colors.primary[400] },
  in_progress: { label: "In progress", color: colors.primary[500] },
  confirmed: { label: "Confirmed", color: colors.primary[700] },
  resolved: { label: "Resolved", color: colors.primary[800] },
  escalated: { label: "Escalated", color: colors.accent[700] },
  rejected: { label: "Rejected", color: colors.accent[600] },
};

export const PRIORITY_META: Record<string, ChartMeta> = {
  low: { label: "Low", color: colors.primary[200] },
  medium: { label: "Medium", color: colors.primary[500] },
  high: { label: "High", color: colors.accent[500] },
  urgent: { label: "Urgent", color: colors.accent[700] },
};

export const STRESS_META: Record<string, ChartMeta> = {
  low: { label: "Low", color: colors.primary[300] },
  moderate: { label: "Moderate", color: colors.accent[500] },
  high: { label: "High", color: colors.accent[700] },
};

/** Official-form case classifications (faculty concern breakdown). */
export const CONCERN_META: Record<string, ChartMeta> = {
  Behavioral: { label: "Behavioral", color: colors.accent[500] },
  Relational: { label: "Relational", color: colors.primary[500] },
  Financial: { label: "Financial", color: colors.primary[200] },
  Absenteeism: { label: "Absenteeism", color: colors.accent[600] },
  "Social Adjustment": { label: "Social Adjustment", color: colors.primary[400] },
  "Academic-related": { label: "Academic-related", color: colors.primary[700] },
  Health: { label: "Health", color: colors.accent[700] },
  Others: { label: "Others", color: colors.primary[100] },
};

/** Session format split — primary for in-person, secondary for online. */
export const MODE_COLORS = {
  in_person: colors.primary[600],
  online: colors.accent[500],
} as const;

/** 1–5 star rating bars — amber for low, primary for high. */
export function ratingColor(rating: number): string {
  if (rating >= 5) return colors.primary[700];
  if (rating === 4) return colors.primary[500];
  if (rating === 3) return colors.accent[500];
  if (rating === 2) return colors.accent[600];
  return colors.accent[700];
}
