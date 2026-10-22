-- 00062_appointments_updated_at: keep appointments.updated_at current.
--
-- The counselor board sorts by "latest activity" (updated_at desc) so a
-- request the head just assigned, or a session the counselor just
-- confirmed/rescheduled/completed, surfaces at the top of their queue.
-- Until now nothing maintained updated_at on writes: it kept its insert-time
-- default, so the column could not be used for ordering.
--
-- The trigger is table-wide on purpose — every appointment writer (shared
-- mutations, referral confirmation, follow-up sync, future RPCs) gets the
-- timestamp without having to remember to set it.
--
-- All statements are idempotent (drop-if-exists / if-not-exists).

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists appointments_touch_updated_at on public.appointments;

create trigger appointments_touch_updated_at
  before update on public.appointments
  for each row execute function public.touch_updated_at();

-- Keyset support for listAppointmentPage({ orderBy: "updated_at" }).
create index if not exists appointments_counselor_updated_idx
  on public.appointments (counselor_id, updated_at desc, id);
