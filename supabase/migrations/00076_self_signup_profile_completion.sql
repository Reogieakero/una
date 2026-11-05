-- 00076_self_signup_profile_completion: self-registered counselors and faculty
-- choose their role before any staff record exists, then fill in their real
-- name/employee details only after a guidance head approves the account.
--
-- `profile_completed` is service-role only (same guard as approval_status) so a
-- pending user cannot flip it to skip the completion screen.
--
-- Safe to re-run: every statement is guarded.

alter table public.profiles
  add column if not exists profile_completed boolean not null default true;

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
  if new.profile_completed is distinct from old.profile_completed then
    raise exception 'Only the guidance head can complete a staff profile.';
  end if;
  if new.id is distinct from old.id then
    raise exception 'Account id is immutable.';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_profile_privilege() from public;

-- Supabase's PostgREST caches the column list; refresh it so the new column is
-- visible immediately after this migration runs outside the dashboard editor.
notify pgrst, 'reload schema';
