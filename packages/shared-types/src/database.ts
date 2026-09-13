/**
 * Supabase `public` schema types.
 *
 * Source of truth is the SQL in /supabase/migrations. This file is a
 * hand-maintained scaffold matching those migrations — regenerate with
 * `pnpm db:types` (supabase gen types) once the migrations are applied and
 * replace this file wholesale. Never hand-duplicate these types in apps/*.
 *
 * NOTE: Row shapes are `type` aliases (not `interface`) because supabase-js
 * v2.1xx postgrest generics require `Row extends Record<string, unknown>` —
 * named interfaces lack implicit index signatures and collapse inserts to
 * `never[]`. Keep them as `type`.
 */

export type UserRole =
  | "student"
  | "counselor"
  | "guidance_head"
  | "faculty"
  | "guidance_personnel"
  | "admin";

export type AppointmentStatus =
  | "pending"
  | "assigned"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "rejected"
  | "no_show";

export type AppointmentMode = "in_person" | "online";

export type ReferralStatus =
  | "pending"
  | "acknowledged"
  | "in_progress"
  | "resolved"
  | "escalated";

export type ReferralPriority = "low" | "medium" | "high" | "urgent";

export type ChatThreadStatus = "open" | "closed";

export type NotificationType =
  | "appointment"
  | "referral"
  | "announcement"
  | "chat"
  | "assessment"
  | "system";

export type ProfileRow = {
  id: string; // auth.users.id
  email: string;
  role: UserRole;
  full_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type StudentRow = {
  id: string;
  profile_id: string;
  student_no: string;
  program: string | null;
  year_level: string | null;
  college: string | null;
  contact_no: string | null;
  anonymous_alias: string | null;
  created_at: string;
};

export type CounselorRow = {
  id: string;
  profile_id: string;
  employee_no: string | null;
  specialization: string | null;
  is_available: boolean;
  created_at: string;
};

export type FacultyMemberRow = {
  id: string;
  profile_id: string;
  employee_no: string | null;
  department: string | null;
  created_at: string;
};

export type GuidancePersonnelRow = {
  id: string;
  profile_id: string;
  employee_no: string | null;
  position: string | null;
  created_at: string;
};

export type CounselorAvailabilityRow = {
  id: string;
  counselor_id: string;
  weekday: number; // 0=Sun..6=Sat
  start_time: string; // time
  end_time: string; // time
  is_recurring: boolean;
  valid_from: string | null;
  valid_to: string | null;
  created_at: string;
};

export type AppointmentRow = {
  id: string;
  student_id: string;
  counselor_id: string | null;
  scheduled_at: string;
  mode: AppointmentMode;
  status: AppointmentStatus;
  concern: string;
  is_anonymous: boolean;
  pss10_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Pss10AssessmentRow = {
  id: string;
  student_id: string;
  appointment_id: string | null;
  /** 10 answers, each 0..4 in PSS-10 order (4,5,7,8 reverse-scored at scoring time). */
  answers: number[];
  total_score: number;
  band: "low" | "moderate" | "high";
  created_at: string;
};

export type SessionNoteRow = {
  id: string;
  appointment_id: string;
  counselor_id: string;
  content: string;
  is_private: boolean;
  created_at: string;
  updated_at: string;
};

export type FeedbackRow = {
  id: string;
  appointment_id: string;
  student_id: string;
  rating: number; // 1..5
  comment: string | null;
  created_at: string;
};

export type ChatThreadRow = {
  id: string;
  student_id: string;
  counselor_id: string | null;
  appointment_id: string | null;
  status: ChatThreadStatus;
  created_at: string;
  updated_at: string;
};

export type ChatMessageRow = {
  id: string;
  thread_id: string;
  sender_profile_id: string;
  body: string;
  created_at: string;
};

export type StaffMessageRow = {
  id: string;
  sender_profile_id: string;
  recipient_profile_id: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

export type WorkspaceSettingsRow = {
  key: string;
  value: Record<string, unknown>;
  updated_by: string | null;
  updated_at: string;
};

export type NotificationRow = {
  id: string;
  profile_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

export type AnnouncementRow = {
  id: string;
  author_profile_id: string;
  title: string;
  body: string;
  audience: UserRole[] | null; // null = everyone
  image_url: string | null;
  published_at: string | null;
  created_at: string;
};

export type ReferralRow = {
  id: string;
  referring_faculty_id: string | null;
  referring_personnel_id: string | null;
  student_id: string;
  reason: string;
  priority: ReferralPriority;
  status: ReferralStatus;
  assigned_counselor_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ReferralActionRow = {
  id: string;
  referral_id: string;
  actor_profile_id: string;
  action: string;
  note: string | null;
  created_at: string;
};

export type BreakGlassLogRow = {
  id: string;
  accessor_profile_id: string;
  student_id: string;
  justification: string;
  accessed_at: string;
  expires_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

export type AuditLogRow = {
  id: string;
  actor_profile_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type AnalyticsDailySummaryRow = {
  day: string;
  total_appointments: number;
  completed_appointments: number;
  avg_pss10: number | null;
  high_stress_count: number;
  total_referrals: number;
};

/** Minimal Database shape for `createClient<Database>()` typing. */
export interface Database {
  public: {
    Tables: {
      profiles: { Row: ProfileRow; Insert: Partial<ProfileRow>; Update: Partial<ProfileRow>; Relationships: [] };
      students: { Row: StudentRow; Insert: Partial<StudentRow>; Update: Partial<StudentRow>; Relationships: [] };
      counselors: { Row: CounselorRow; Insert: Partial<CounselorRow>; Update: Partial<CounselorRow>; Relationships: [] };
      faculty_members: { Row: FacultyMemberRow; Insert: Partial<FacultyMemberRow>; Update: Partial<FacultyMemberRow>; Relationships: [] };
      guidance_personnel: { Row: GuidancePersonnelRow; Insert: Partial<GuidancePersonnelRow>; Update: Partial<GuidancePersonnelRow>; Relationships: [] };
      counselor_availability: { Row: CounselorAvailabilityRow; Insert: Partial<CounselorAvailabilityRow>; Update: Partial<CounselorAvailabilityRow>; Relationships: [] };
      appointments: { Row: AppointmentRow; Insert: Partial<AppointmentRow>; Update: Partial<AppointmentRow>; Relationships: [] };
      pss10_assessments: { Row: Pss10AssessmentRow; Insert: Partial<Pss10AssessmentRow>; Update: Partial<Pss10AssessmentRow>; Relationships: [] };
      session_notes: { Row: SessionNoteRow; Insert: Partial<SessionNoteRow>; Update: Partial<SessionNoteRow>; Relationships: [] };
      feedback: { Row: FeedbackRow; Insert: Partial<FeedbackRow>; Update: Partial<FeedbackRow>; Relationships: [] };
      chat_threads: { Row: ChatThreadRow; Insert: Partial<ChatThreadRow>; Update: Partial<ChatThreadRow>; Relationships: [] };
      chat_messages: { Row: ChatMessageRow; Insert: Partial<ChatMessageRow>; Update: Partial<ChatMessageRow>; Relationships: [] };
      staff_messages: { Row: StaffMessageRow; Insert: Partial<StaffMessageRow>; Update: Partial<StaffMessageRow>; Relationships: [] };
      workspace_settings: { Row: WorkspaceSettingsRow; Insert: Partial<WorkspaceSettingsRow>; Update: Partial<WorkspaceSettingsRow>; Relationships: [] };
      notifications: { Row: NotificationRow; Insert: Partial<NotificationRow>; Update: Partial<NotificationRow>; Relationships: [] };
      announcements: { Row: AnnouncementRow; Insert: Partial<AnnouncementRow>; Update: Partial<AnnouncementRow>; Relationships: [] };
      referrals: { Row: ReferralRow; Insert: Partial<ReferralRow>; Update: Partial<ReferralRow>; Relationships: [] };
      referral_actions: { Row: ReferralActionRow; Insert: Partial<ReferralActionRow>; Update: Partial<ReferralActionRow>; Relationships: [] };
      break_glass_logs: { Row: BreakGlassLogRow; Insert: Partial<BreakGlassLogRow>; Update: Partial<BreakGlassLogRow>; Relationships: [] };
      audit_logs: { Row: AuditLogRow; Insert: Partial<AuditLogRow>; Update: Partial<AuditLogRow>; Relationships: [] };
    };
    Views: {
      analytics_daily_summary: { Row: AnalyticsDailySummaryRow; Relationships: [] };
    };
    Functions: { [_ in never]: never };
    Enums: Record<string, never>;
  };
}
