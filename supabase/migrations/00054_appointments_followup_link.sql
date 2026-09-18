-- 00054_appointments_followup_link: mark sessions minted as follow-ups.
--
-- WHAT / WHY: documenting a follow-up on a session note now mints a real
-- follow-up session (status confirmed, counselor + slot already chosen), so
-- it shows on the sessions page like any other session instead of living
-- only as a date on the note. These two columns carry that lineage:
-- - is_follow_up: badge/display flag (no new status value — every status
--   gate, filter, and report keeps working unchanged).
-- - follow_up_of: the ended session the follow-up was documented from
--   (NULL for regular bookings). One live follow-up per origin: the API
--   reschedules/cancels it instead of minting duplicates.
-- RLS policies are row-level and column-agnostic (see 00051), so no policy
-- change is needed. All idempotent for re-runs.

alter table public.appointments
  add column if not exists is_follow_up boolean not null default false;

alter table public.appointments
  add column if not exists follow_up_of uuid references public.appointments(id) on delete set null;

create index if not exists appointments_follow_up_of_idx on public.appointments (follow_up_of);
