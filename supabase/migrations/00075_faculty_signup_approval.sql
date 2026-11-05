-- 00075_faculty_signup_approval: faculty may self-register on the web, but a
-- guidance head must approve the account before it can enter the staff shell.
--
-- `approval_status` is separate from `is_active` so the app can tell a brand-new
-- pending faculty account apart from one an admin later deactivated. Existing
-- rows default to 'approved'; only self-service faculty signups start 'pending'.
--
-- Safe to re-run: every statement is guarded.

alter table public.profiles
  add column if not exists approval_status text not null default 'approved',
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_approval_status_check;

alter table public.profiles
  add constraint profiles_approval_status_check
  check (approval_status in ('pending', 'approved', 'rejected'));

create index if not exists profiles_pending_approval_idx
  on public.profiles (created_at desc)
  where approval_status = 'pending';

-- ── freeze the new privilege columns ──────────────────────────────────────
-- 00030 froze role/status/is_active against client writes but predates these
-- columns. Without this, a signed-in user could PATCH their own profile to
-- approval_status = 'approved'. Only the service role (the approval route)
-- may write them.
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
  if new.approval_status is distinct from old.approval_status then
    raise exception 'Only the guidance head can approve accounts.';
  end if;
  if new.approved_by is distinct from old.approved_by then
    raise exception 'Only the guidance head can approve accounts.';
  end if;
  if new.approved_at is distinct from old.approved_at then
    raise exception 'Only the guidance head can approve accounts.';
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
