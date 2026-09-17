-- 00049_trail_role_and_counselor_names: show WHO did WHAT by role + name.
--
-- PART 1 — actor_role stamp: faculty cannot read profiles via RLS (00022),
-- so role (like the display name in 00048) is stamped at write time by the
-- actor's own session and backfilled here (migration runs as owner).
--
-- PART 2 — counselor_directory(): faculty need the handling counselor's NAME
-- for tracking, but profiles are unreadable to them. This narrow
-- SECURITY DEFINER exception exposes ONLY active counselors' display names
-- (id + full_name, no emails, no other roles, no other columns) — staff
-- directory info, not private data. All other profile reads stay closed.

alter table public.referral_actions
  add column if not exists actor_role text;

update public.referral_actions ra
set actor_role = p.role
from public.profiles p
where ra.actor_role is null
  and p.id = ra.actor_profile_id;

create or replace function public.counselor_directory()
returns table (counselor_id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, coalesce(p.full_name, 'Counselor')
  from public.counselors c
  join public.profiles p on p.id = c.profile_id and p.is_active = true;
$$;

revoke all on function public.counselor_directory() from public;
grant execute on function public.counselor_directory() to authenticated;
