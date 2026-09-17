-- 00040_referral_paper_form: digitize the official Counseling Referral Form
-- (FM-DOrSU-GCTC-02) — student snapshot fields, relation to the client, the
-- paper's Case Classification set, and free-text REMARKS support.
--
-- case_classification mirrors the paper checkboxes (multi-select); the
-- pre-existing concern_type column (00039) is left untouched for history.
-- All columns nullable (or defaulted) so rows filed before this migration
-- stay valid. Select/insert/update RLS policies are column-agnostic.

alter table public.referrals
  add column if not exists student_gender text,
  add column if not exists student_age text,
  add column if not exists relation_to_client text,
  add column if not exists case_classification text[] not null default '{}',
  add column if not exists classification_other text;

alter table public.referrals
  drop constraint if exists referrals_case_classification_check;

alter table public.referrals
  add constraint referrals_case_classification_check
  check (
    case_classification <@ array[
      'Behavioral',
      'Relational',
      'Financial',
      'Absenteeism',
      'Social Adjustment',
      'Academic-related',
      'Health',
      'Others'
    ]
  );

create index if not exists referrals_case_classification_idx on public.referrals using gin (case_classification);
