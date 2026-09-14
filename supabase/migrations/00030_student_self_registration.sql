-- 00030_student_self_registration: enforce "only admin provisions staff".
--
-- RULE: users can NEVER create counselor/faculty/head accounts themselves.
-- Staff rows are written by the guidance head via POST /api/auth/register
-- (service-role, caller must be guidance_head). Public signup is students
-- only (web /register form + mobile register screen, both student-shaped).
--
-- This migration closes the two remaining enforcement gaps at the DB layer:
--
-- 1. profiles had NO client INSERT policy ("service-role only"), which both
--    blocked legitimate mobile student signup AND left the guarantee to app
--    code alone. New narrow policy: an authenticated user may insert exactly
--    ONE profile row — their own (id = auth.uid()) — with role forced to
--    'student'. Even a hand-crafted API call cannot mint counselor/faculty.
--
-- 2. profiles_update_own allowed changing ANY column on your own row,
--    including role/is_active — a self-promotion hole (student -> counselor
--    with one update call). New trigger freezes privilege columns for all
--    non-service-role writers. Service-role (admin API routes) is exempt,
--    so head-driven activation/deactivation keeps working.

-- ── 1. Student-only self insert ──
drop policy if exists "profiles_insert_own_student" on public.profiles;

create policy "profiles_insert_own_student"
  on public.profiles for insert
  to authenticated
  with check (
    id = auth.uid()
    and role = 'student'
  );

-- ── 2. Freeze privilege columns against client writes ──
create or replace function public.guard_profile_privilege()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_service boolean := false;
begin
  begin
    is_service :=
      coalesce((auth.jwt() ->> 'role') = 'service_role', false)
      or current_user = 'service_role';
  exception when others then
    is_service := (current_user = 'service_role');
  end;
  if is_service then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Only the guidance head can change account roles.';
  end if;
  if new.is_active is distinct from old.is_active then
    raise exception 'Only the guidance head can activate or deactivate accounts.';
  end if;
  if new.status is distinct from old.status then
    raise exception 'Only the guidance head can change account status.';
  end if;
  if new.id is distinct from old.id then
    raise exception 'Account id is immutable.';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_profile_privilege() from public;

drop trigger if exists trg_profiles_guard_privilege on public.profiles;

create trigger trg_profiles_guard_privilege
  before update on public.profiles
  for each row execute function public.guard_profile_privilege();
