-- 00074_counselor_directory_role: expose each counselor's profile role so the
-- student chat inbox can hide contacts who cannot receive student threads.
--
-- ROOT CAUSE: guidance_head profiles are not chat participants (00037/00060
-- participant-only RLS), and the staff chat board never lists student threads
-- for heads. When a head also owns a `counselors` row, they still appeared in
-- the student's "Your counselors" list and messages went nowhere.
--
-- 00049 returned only (counselor_id, display_name). The return type changes
-- here, so the function must be dropped and recreated (CREATE OR REPLACE
-- cannot add an output column).
--
-- Still a narrow SECURITY DEFINER exception: id, display name, and role only.

drop function if exists public.counselor_directory();

create function public.counselor_directory()
returns table (counselor_id uuid, display_name text, profile_role text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, coalesce(p.full_name, 'Counselor'), p.role
  from public.counselors c
  join public.profiles p on p.id = c.profile_id and p.is_active = true;
$$;

revoke all on function public.counselor_directory() from public;
grant execute on function public.counselor_directory() to authenticated;
