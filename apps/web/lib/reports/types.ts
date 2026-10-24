export type ReportScope = {
  counselorId?: string | null;
  from?: string | null;
  to?: string | null;
};

export type OfficeInfo = {
  name?: string;
  location?: string;
  contact?: string;
};

export type ReportBundle = {
  appointments: any[];
  referrals: any[];
  feedback: any[];
  pss: any[];
  counselors: any[];
  announcements: any[];
  /** Head-only aggregate trend/quality (00071); empty for counselor exports. */
  trends?: {
    day: string;
    screenings: number;
    low: number;
    moderate: number;
    high: number;
    avg_score: number | null;
  }[];
  quality?: {
    completed_sessions: number;
    completed_without_note: number;
    screenings_unlinked: number;
    referrals_unassigned: number;
    feedback_responses: number;
    feedback_coverage: number | null;
    summary_last_day: string | null;
    summary_age_days: number | null;
  } | null;
  counselorName: Map<string, string>;
  counselorSpec: Map<string, string | null>;
  counselorAvail: Map<string, boolean>;
  aliasByStudent: Map<string, string>;
  office: OfficeInfo | undefined;
};

export type WorkbookOptions = {
  personal?: boolean;
  rangeLabel?: string;
};

/** Precomputed figures shared by every sheet builder. */
export type SheetContext = {
  meta: string;
  officeLine: string;
  personal: boolean;
  totalAppts: number;
  completed: number;
  missed: number;
  avgRating: number;
  openRefs: number;
  resolvedRefs: number;
  highStress: number;
};
