import type {
  AppointmentRow,
  AppointmentStatus,
  ChatMessageRow,
  ChatThreadRow,
  Pss10AssessmentRow,
  ReferralRow,
  UserRole,
} from "./database";

/**
 * App-level domain types — composed from DB rows so apps never redefine shapes.
 * Import from `@dorsu/shared-types`, never hand-duplicate in apps/*.
 */

export type { UserRole, AppointmentStatus };

export interface Student {
  id: string;
  profileId: string;
  studentNo: string;
  fullName: string | null;
  program: string | null;
  yearLevel: string | null;
}

export interface Appointment extends AppointmentRow {}

export interface AppointmentWithRefs extends AppointmentRow {
  student?: { id: string; full_name?: string | null } | null;
  counselor?: { id: string; full_name?: string | null } | null;
  pss10?: Pss10AssessmentRow | null;
}

export type Pss10Band = Pss10AssessmentRow["band"];

export interface Pss10Result {
  totalScore: number;
  band: Pss10Band;
  answers: number[];
}

export interface Referral extends ReferralRow {}

export interface ChatThread extends ChatThreadRow {
  messages?: ChatMessageRow[];
}

/** Storage-agnostic session shape returned by auth services. */
export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  fullName: string | null;
}
