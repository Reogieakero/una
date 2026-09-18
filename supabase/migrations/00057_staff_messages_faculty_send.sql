-- 00057_staff_messages_faculty_send: let faculty DM counselors / heads.
--
-- ROOT CAUSE: `staff_messages_insert_staff` (00023) checks the recipient's
-- role with `exists (select 1 from public.profiles ...)` INSIDE the policy.
-- That subquery runs under the CALLER's RLS, and faculty can only read their
-- OWN profile row (`profiles_select_own`, 00022 — faculty intentionally
-- excluded from staff-wide reads). So for a faculty sender the recipient row
-- is invisible, EXISTS is false, and EVERY faculty DM insert is denied with
-- a generic RLS error ("Couldn't deliver the message"). Counselors/heads
-- pass because `profiles_select_staff` lets them read all rows.
--
-- FIX (same pattern as 00022): resolve the recipient's role through a
-- SECURITY DEFINER helper that bypasses RLS. Insert semantics are unchanged:
-- sender must be the caller, recipient must be office staff (never students).

create or replace function public.profile_role(pid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = pid;
$$;

revoke all on function public.profile_role(uuid) from public;
grant execute on function public.profile_role(uuid) to authenticated;

drop policy if exists "staff_messages_insert_staff" on public.staff_messages;

create policy "staff_messages_insert_staff"
  on public.staff_messages for insert
  to authenticated
  with check (
    sender_profile_id = auth.uid()
    and public.profile_role(staff_messages.recipient_profile_id) in ('counselor','guidance_head','guidance_personnel','admin')
  );
