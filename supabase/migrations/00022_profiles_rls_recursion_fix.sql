-- 00022_profiles_rls_recursion_fix: eliminate infinite recursion in the
-- profiles SELECT policy.
--
-- ROOT CAUSE: `profiles_select_own_or_staff` (00001) ran
-- `exists (select 1 from public.profiles ...)` INSIDE a policy on
-- public.profiles itself. Postgres re-enters RLS for the inner query,
-- which re-evaluates the same policy, forever. Every authenticated
-- `select` on profiles failed with:
--   "infinite recursion detected in policy for relation profiles"
-- That broke login role lookup, getCurrentProfile(), and every staff
-- policy on other tables that reads public.profiles.
--
-- FIX (standard Supabase pattern): staff check goes through a
-- SECURITY DEFINER helper that bypasses RLS, so no policy ever queries
-- its own table. Semantics are unchanged:
--   - users read their own profile row (auth.uid() = id)
--   - counselor / guidance_head / guidance_personnel / admin read all rows
-- (faculty intentionally excluded, matching 00001).

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

drop policy if exists "profiles_select_own_or_staff" on public.profiles;
-- Drops below make this file safely re-runnable (e.g. if it was first applied
-- via the SQL editor / API and `supabase db push` later replays it).
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_staff" on public.profiles;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_select_staff"
  on public.profiles for select
  to authenticated
  using (
    public.current_user_role() in ('counselor', 'guidance_head', 'guidance_personnel', 'admin')
  );
