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
  | "assigned"
  | "acknowledged"
  | "in_progress"
  | "confirmed"
  | "resolved"
  | "escalated"
  | "rejected";

export type ReferralPriority = "low" | "medium" | "high" | "urgent";

/**
 * Official sheet Case Classification set (FM-DOrSU-GCTC-02, migration
 * 00040) — the canonical referral categorization, multi-select.
 */
export const REFERRAL_CLASSIFICATIONS = [
  "Behavioral",
  "Relational",
  "Financial",
  "Absenteeism",
  "Social Adjustment",
  "Academic-related",
  "Health",
  "Others",
] as const;

export type ReferralClassification = (typeof REFERRAL_CLASSIFICATIONS)[number];

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
  // Added by hand (00066) — student opt-in for counselor-visible photos.
  share_avatar_with_counselor: boolean;
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
  /** Null for walk-in sessions confirmed from typed-identity referrals (00042). */
  student_id: string | null;
  counselor_id: string | null;
  scheduled_at: string;
  /** Session end picked by the counselor inside an availability slot (00051, nullable for older rows). */
  ends_at: string | null;
  mode: AppointmentMode;
  status: AppointmentStatus;
  concern: string;
  /** Google Meet link for online sessions (set on counselor confirm). */
  meeting_url: string | null;
  is_anonymous: boolean;
  pss10_id: string | null;
  /** Session needs a linked PSS-10 within 7 days before start (00068). */
  pss10_required: boolean;
  /** Counselor explicitly waived the pre-session check-in (00068). */
  pss10_waived_at: string | null;
  /** Operational waiver reason (10–500 chars, never clinical detail) (00068). */
  pss10_waiver_reason: string | null;
  /** Draft appointments created from a referral link back here (00020). */
  source_referral_id: string | null;
  /** True for sessions minted as follow-ups from a session note (00054). */
  is_follow_up: boolean;
  /** The ended session the follow-up was documented from; null for regular bookings. */
  follow_up_of: string | null;
  created_at: string;
  updated_at: string;
  /** Actor who last changed the row (00064); null for service-role writes. */
  updated_by: string | null;
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
  /** Legacy column (00009 NOT NULL, relaxed by 00020) — kept in sync with `notes`. */
  content: string | null;
  /** Canonical note text since 00020. */
  notes: string | null;
  is_private: boolean;
  follow_up_required: boolean;
  follow_up_date: string | null;
  /** Follow-up moment (date + time) since 00053; follow_up_date stays as date twin. */
  follow_up_at: string | null;
  /** 00070: freeform or S.O.A.P. structured note. */
  note_format: "freeform" | "soap";
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  created_at: string;
  updated_at: string;
};

/** Persisted head report digest (00071) - aggregates only. */
export type ReportDigestRow = {
  id: string;
  period_start: string;
  period_end: string;
  payload: Record<string, unknown>;
  created_at: string;
  delivered_to: string | null;
};

/** Private image attached to a session note (bytes in the private bucket). */
export type SessionNoteAttachmentRow = {
  id: string;
  note_id: string;
  counselor_id: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

/** Head-managed logical backup run (00056) — artifacts in the private bucket. */
export type BackupRunRow = {
  id: string;
  status: string;
  source: string;
  tables: Record<string, number>;
  row_counts: Record<string, number>;
  total_rows: number;
  bytes: number;
  checksum: string | null;
  storage_path: string | null;
  warnings: string[];
  error: string | null;
  initiated_by: string | null;
  started_at: string;
  finished_at: string | null;
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
  // Added by hand (00021 dedupe_key, 00044 tone) — db:types regen will keep
  // these once run against the migrated project.
  dedupe_key: string | null;
  tone: string | null;
  // Added by hand (00063) — action items survive "mark all"; read_at is the
  // audit timestamp (is_read stays for backwards compatibility).
  is_action_required: boolean;
  read_at: string | null;
  ref_type: string | null;
  ref_id: string | null;
  resolved_at: string | null;
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
  /** Null for walk-ins: referred student has no account yet (00041). */
  student_id: string | null;
  /** Free-text identity typed off the paper form for walk-ins (00041). */
  student_name_text: string | null;
  student_no_text: string | null;
  reason: string;
  priority: ReferralPriority;
  status: ReferralStatus;
  assigned_counselor_id: string | null;
  created_at: string;
  updated_at: string;
  /** Point-in-time snapshot from the official referral sheet (00040). */
  student_gender: string | null;
  student_age: string | null;
  relation_to_client: string | null;
  /** Paper Case Classification checkboxes (multi-select). */
  case_classification: string[];
  /** Free text for the "Others, please specify" classification. */
  classification_other: string | null;
};

export type ReferralActionRow = {
  id: string;
  referral_id: string;
  actor_profile_id: string;
  // Added by hand (00048 actor_name, 00049 actor_role) — db:types regen will
  // keep them once run against the migrated project.
  actor_name: string | null;
  actor_role: string | null;
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
      session_note_attachments: { Row: SessionNoteAttachmentRow; Insert: Partial<SessionNoteAttachmentRow>; Update: Partial<SessionNoteAttachmentRow>; Relationships: [] };
      backup_runs: { Row: BackupRunRow; Insert: Partial<BackupRunRow>; Update: Partial<BackupRunRow>; Relationships: [] };
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
      report_digests: { Row: ReportDigestRow; Insert: Partial<ReportDigestRow>; Update: Partial<ReportDigestRow>; Relationships: [] };
    };
    Views: {
      analytics_daily_summary: { Row: AnalyticsDailySummaryRow; Relationships: [] };
    };
    Functions: {
      // Added by hand (00049) — db:types regen will keep it.
      counselor_directory: {
        Args: Record<string, never>;
        Returns: { counselor_id: string; display_name: string }[];
      };
      // Added by hand (00061) — db:types regen will keep it.
      head_appointment_daily_counts: {
        Args: { from_ts: string; to_ts: string };
        Returns: { day: string; sessions: number }[];
      };
      head_referral_status_counts: {
        Args: { from_ts?: string | null; to_ts?: string | null };
        Returns: { status: string; count: number }[];
      };
      // Added by hand (00064) — student-facing "who last updated this session".
      appointment_update_info: {
        Args: { p_appointment_id: string };
        Returns: {
          updated_at: string;
          updated_by_name: string | null;
          updated_by_role: string | null;
          is_self: boolean;
        }[];
      };
      // Added by hand (00063) — per-user sidebar counters, RLS-scoped.
      sidebar_counts: {
        Args: Record<string, never>;
        Returns: {
          appointment_requests: number;
          unassigned_requests: number;
          referrals_to_triage: number;
          chat_unread: number;
          announcements_unread: number;
          feedback_unread: number;
          security_unread: number;
          informational_unread: number;
        };
      };
      mark_informational_read: {
        Args: Record<string, never>;
        Returns: number;
      };
      // Added by hand (00065) — cron fan-out for 10-minute session reminders.
      send_session_reminders: {
        Args: Record<string, never>;
        Returns: number;
      };
      // Added by hand (00069) — identity hardening: alias-only RPCs.
      list_student_directory: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          anonymous_alias: string | null;
          program: string | null;
          year_level: string | null;
          college: string | null;
          created_at: string;
        }[];
      };
      list_emergency_students: {
        Args: Record<string, never>;
        Returns: { id: string; anonymous_alias: string | null }[];
      };
      get_student_aliases: {
        Args: { ids: string[] };
        Returns: { id: string; anonymous_alias: string | null; profile_id: string }[];
      };
      lookup_student_for_referral: {
        Args: { p_student_no: string };
        Returns: {
          id: string;
          anonymous_alias: string | null;
          student_no: string;
          program: string | null;
          year_level: string | null;
        }[];
      };
      get_referral_student: {
        Args: { p_referral_id: string };
        Returns: {
          student_id: string;
          student_no: string;
          anonymous_alias: string | null;
          program: string | null;
          year_level: string | null;
        }[];
      };
      // Added by hand (00070) — alias-only student record + timeline.
      get_student_record: {
        Args: { p_student_id: string };
        Returns: {
          id: string;
          anonymous_alias: string | null;
          program: string | null;
          year_level: string | null;
          college: string | null;
          created_at: string;
        }[];
      };
      get_student_record_counts: {
        Args: { p_student_id: string };
        Returns: {
          total_sessions: number;
          completed_sessions: number;
          open_referrals: number;
          latest_band: string | null;
          follow_ups_due: number;
        }[];
      };
      get_student_timeline: {
        Args: { p_student_id: string; p_limit?: number };
        Returns: {
          event_type: string;
          event_id: string;
          occurred_at: string | null;
          status: string | null;
          label: string | null;
          band: string | null;
          score: number | null;
          rating: number | null;
          note_id: string | null;
          follow_up_at: string | null;
          appointment_id: string | null;
        }[];
      };
      // Added by hand (00071) — head-only aggregate analytics + quality.
      head_wellbeing_trends: {
        Args: { from_ts: string | null; to_ts: string | null };
        Returns: {
          day: string;
          screenings: number;
          low: number;
          moderate: number;
          high: number;
          avg_score: number | null;
        }[];
      };
      head_cohort_stress: {
        Args: { from_ts: string | null; to_ts: string | null; group_by?: string };
        Returns: {
          cohort: string;
          screenings: number;
          high: number;
          avg_score: number | null;
        }[];
      };
      head_data_quality: {
        Args: Record<string, never>;
        Returns: {
          completed_sessions: number;
          completed_without_note: number;
          screenings_unlinked: number;
          referrals_unassigned: number;
          feedback_responses: number;
          feedback_coverage: number | null;
          summary_last_day: string | null;
          summary_age_days: number | null;
        }[];
      };
      head_report_digest: {
        Args: { from_ts: string | null; to_ts: string | null };
        Returns: Record<string, unknown>;
      };
    };
    Enums: Record<string, never>;
  };
}
