import { colors } from "@dorsu/ui-tokens";

/**
 * Chart palette for the dark dashboard canvas.
 *
 * The reports palette (`lib/report-palette.ts`) uses deep primary/accent steps
 * that disappear on `#050C16`. This mirrors its semantic keys with the LIGHT
 * end of the same two brand hues, so the strict blue/yellow rule survives:
 * blues carry flow and progression, yellows carry attention and terminal
 * states.
 */

export const DARK_STATUS_COLORS: Record<string, string> = {
  pending: colors.yellow[300],
  assigned: colors.blue[200],
  acknowledged: colors.blue[300],
  in_progress: colors.blue[400],
  confirmed: colors.blue[500],
  escalated: colors.yellow[500],
  resolved: colors.blue[100],
  rejected: colors.yellow[700],
};

export const DARK_PRIORITY_COLORS: Record<string, string> = {
  urgent: colors.yellow[500],
  high: colors.yellow[300],
  medium: colors.blue[400],
  low: colors.blue[200],
};

/** Appointment lifecycle colours for the counselor session-status donut. */
export const DARK_APPOINTMENT_COLORS: Record<string, string> = {
  pending: colors.yellow[300],
  assigned: colors.yellow[200],
  confirmed: colors.blue[300],
  completed: colors.blue[500],
  no_show: colors.yellow[500],
  cancelled: colors.blue[100],
  rejected: colors.yellow[700],
};

/** Session mode split (single-select per appointment). */
export const DARK_MODE_COLORS: Record<string, string> = {
  online: colors.blue[400],
  in_person: colors.blue[200],
};

export const DARK_CLASSIFICATION_COLORS: Record<string, string> = {
  Behavioral: colors.yellow[300],
  Relational: colors.blue[400],
  Financial: colors.blue[200],
  Absenteeism: colors.yellow[400],
  "Social Adjustment": colors.blue[300],
  "Academic-related": colors.blue[500],
  Health: colors.yellow[500],
  Others: colors.blue[100],
};

const FALLBACK = colors.blue[200];

/** Deeper steps for the light dashboard canvas (same semantics). */
export const LIGHT_STATUS_COLORS: Record<string, string> = {
  pending: colors.yellow[500],
  assigned: colors.blue[400],
  acknowledged: colors.blue[500],
  in_progress: colors.blue[600],
  confirmed: colors.blue[700],
  escalated: colors.yellow[600],
  resolved: colors.blue[800],
  rejected: colors.yellow[700],
};

export const LIGHT_PRIORITY_COLORS: Record<string, string> = {
  urgent: colors.yellow[600],
  high: colors.yellow[500],
  medium: colors.blue[600],
  low: colors.blue[400],
};

export const LIGHT_APPOINTMENT_COLORS: Record<string, string> = {
  pending: colors.yellow[500],
  assigned: colors.yellow[600],
  confirmed: colors.blue[400],
  completed: colors.blue[700],
  no_show: colors.yellow[700],
  cancelled: colors.blue[200],
  rejected: colors.yellow[700],
};

export const LIGHT_MODE_COLORS: Record<string, string> = {
  online: colors.blue[600],
  in_person: colors.blue[400],
};

/** Deeper steps for the light dashboard canvas (same semantics). */
export const LIGHT_CLASSIFICATION_COLORS: Record<string, string> = {
  Behavioral: colors.yellow[500],
  Relational: colors.blue[500],
  Financial: colors.blue[400],
  Absenteeism: colors.yellow[600],
  "Social Adjustment": colors.blue[400],
  "Academic-related": colors.blue[700],
  Health: colors.yellow[600],
  Others: colors.blue[300],
};

const LIGHT_FALLBACK = colors.blue[500];

export function statusColor(key: string): string {
  return DARK_STATUS_COLORS[key] ?? FALLBACK;
}

export function priorityColor(key: string): string {
  return DARK_PRIORITY_COLORS[key] ?? FALLBACK;
}

export function classificationColor(key: string): string {
  return DARK_CLASSIFICATION_COLORS[key] ?? FALLBACK;
}

export function lightStatusColor(key: string): string {
  return LIGHT_STATUS_COLORS[key] ?? LIGHT_FALLBACK;
}

export function lightPriorityColor(key: string): string {
  return LIGHT_PRIORITY_COLORS[key] ?? LIGHT_FALLBACK;
}

export function lightClassificationColor(key: string): string {
  return LIGHT_CLASSIFICATION_COLORS[key] ?? LIGHT_FALLBACK;
}

export function appointmentStatusColor(key: string): string {
  return DARK_APPOINTMENT_COLORS[key] ?? FALLBACK;
}

export function lightAppointmentStatusColor(key: string): string {
  return LIGHT_APPOINTMENT_COLORS[key] ?? LIGHT_FALLBACK;
}

export function modeColor(key: string): string {
  return DARK_MODE_COLORS[key] ?? FALLBACK;
}

export function lightModeColor(key: string): string {
  return LIGHT_MODE_COLORS[key] ?? LIGHT_FALLBACK;
}
