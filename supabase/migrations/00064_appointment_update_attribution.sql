-- 00064_appointment_update_attribution: let students see who last moved their
-- session, without exposing the staff-only audit trail.
--
-- WHAT: audit_events (00045) already records the actor for appointment moves,
-- but its RLS is guidance_head/admin-only. Students need a tiny projection:
-- "was this session updated, by whom, and when". Add the actor column to the
-- row (always stamped server-side from auth.uid()) and expose one
-- SECURITY DEFINER reader that is scoped to the caller's own appointment.
--
-- updated_at itself is maintained by 00062 (`appointments_touch_updated_at`);
-- this migration only adds attribution. Service-role writes have no auth.uid(),
-- so `updated_by` stays null and the reader reports "Guidance Office".
--
-- Idempotent: add-column-if-not-exists / drop-trigger-if-exists /
-- create-or-replace.

alter table public.appointments
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

-- Never trust a client-supplied updated_by: every write overwrites it with the
-- JWT subject (null for service_role / cron).
create or replace function public.appointments_stamp_updated_by()
returns trigger
language plpgsql
as $$
begin
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists appointments_stamp_updated_by on public.appointments;

create trigger appointments_stamp_updated_by
  before update on public.appointments
  for each row execute function public.appointments_stamp_updated_by();

-- Student-facing attribution for one appointment. Only the owner may call it;
-- returns at most one row. `updated_by_name` falls back to the Guidance Office
-- for system writes (or an actor with no profile row).
create or replace function public.appointment_update_info(p_appointment_id uuid)
returns table (
  updated_at timestamptz,
  updated_by_name text,
  updated_by_role text,
  is_self boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  -- appointments.student_id references students.id, while auth.uid() is the
  -- profile id — compare through the student row, not directly.
  owner_profile uuid;
begin
  select s.profile_id into owner_profile
  from public.appointments a
  join public.students s on s.id = a.student_id
  where a.id = p_appointment_id;

  if caller is null or owner_profile is null or owner_profile <> caller then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return query
    select
      a.updated_at,
      case
        when a.updated_by = caller then 'you'
        else coalesce(nullif(p.full_name, ''), 'Guidance Office')
      end,
      coalesce(p.role, 'system'),
      (a.updated_by = caller)
    from public.appointments a
    left join public.profiles p on p.id = a.updated_by
    where a.id = p_appointment_id;
end;
$$;

revoke all on function public.appointment_update_info(uuid) from public;
grant execute on function public.appointment_update_info(uuid) to authenticated;
