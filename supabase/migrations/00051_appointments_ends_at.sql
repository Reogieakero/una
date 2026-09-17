-- 00051_appointments_ends_at: counselor-picked session end time.
--
-- Confirm/reschedule dialogs now collect a start AND end inside the
-- counselor's availability slot; the start keeps living in scheduled_at
-- (every reader already uses it) and the end lands here. Nullable so all
-- rows scheduled before this migration stay valid (readers treat a missing
-- end as start + 60 minutes). RLS policies are row-level and
-- column-agnostic, so no policy change is needed.

alter table public.appointments
  add column if not exists ends_at timestamptz;

alter table public.appointments
  drop constraint if exists appointments_ends_after_start;

alter table public.appointments
  add constraint appointments_ends_after_start
  check (ends_at is null or ends_at > scheduled_at);
