-- 00039_referrals_concern_type: categorize faculty referrals by observed
-- concern kind (academic / behavioral / relational) so the Guidance Office
-- can triage by kind, not just urgency.
--
-- Nullable so rows filed before this migration stay valid; new submissions
-- require it at the app layer (shared-schemas validation + referral form).
-- Select/insert/update RLS policies are column-agnostic, so no policy
-- changes are needed.

alter table public.referrals
  add column if not exists concern_type text
    check (concern_type in ('academic','behavioral','relational'));

create index if not exists referrals_concern_type_idx on public.referrals (concern_type);
