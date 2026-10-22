-- 00066_profile_avatars: every signed-in user can attach a profile photo.
--
-- VISIBILITY (chosen policy):
--   • your own photo — always
--   • staff photos — any signed-in staff member
--   • student photos — the student, plus a counselor who (a) has a real
--     appointment/referral/chat link to them AND (b) the student has opted in
--     with `share_avatar_with_counselor`. Off by default, so the anonymous
--     alias model is never silently broken.
--
-- The bucket is PRIVATE. `avatar_url` stores either an external OAuth URL
-- (staff; students are scrubbed below) or an object path that the app
-- exchanges for a short-lived signed URL. Storage RLS enforces the matrix
-- above, so even a leaked path cannot be signed by the wrong person.

alter table public.profiles
  add column if not exists share_avatar_with_counselor boolean not null default false;

-- Student OAuth pictures are absolute URLs: storage RLS cannot gate them, and
-- staff can read `profiles.avatar_url`. To keep the opt-in promise real, a
-- student's photo must always be an `avatars` object we can gate. Drop any
-- external (Google) URL previously copied onto a student profile.
update public.profiles
   set avatar_url = null
 where role = 'student'
   and avatar_url ~* '^https?://';

-- ── 1. visibility predicate ─────────────────────────────────────────────────
-- Takes text so storage policies can pass the first path segment without an
-- unsafe uuid cast on malformed object names.
create or replace function public.can_view_profile_avatar(target text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  if target is null
     or target !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  target_id := target::uuid;

  if target_id = auth.uid() then
    return true;
  end if;

  -- Staff photos are office-facing; staff roles may read each other.
  if exists (
    select 1
    from public.profiles t
    join public.profiles viewer on viewer.id = auth.uid()
    where t.id = target_id
      and t.role in ('counselor', 'guidance_head', 'guidance_personnel', 'faculty', 'admin')
      and viewer.role in ('counselor', 'guidance_head', 'guidance_personnel', 'faculty', 'admin')
  ) then
    return true;
  end if;

  -- Opted-in student photo, only for a counselor with a live case link.
  return exists (
    select 1
    from public.profiles t
    join public.profiles viewer on viewer.id = auth.uid() and viewer.role = 'counselor'
    join public.counselors c on c.profile_id = viewer.id
    join public.students s on s.profile_id = t.id
    where t.id = target_id
      and t.role = 'student'
      and t.share_avatar_with_counselor
      and (
        exists (
          select 1 from public.appointments a
          where a.student_id = s.id and a.counselor_id = c.id
        )
        or exists (
          select 1 from public.referrals r
          where r.student_id = s.id and r.assigned_counselor_id = c.id
        )
        or exists (
          select 1 from public.chat_threads th
          where th.student_id = s.id and th.counselor_id = c.id
        )
      )
  );
end;
$$;

revoke all on function public.can_view_profile_avatar(text) from public;
grant execute on function public.can_view_profile_avatar(text) to authenticated;

-- ── 2. private bucket ───────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── 3. storage policies (path = <profile_id>/<file>) ────────────────────────
drop policy if exists "avatars_read_visible" on storage.objects;
create policy "avatars_read_visible"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and public.can_view_profile_avatar((storage.foldername(name))[1])
  );

drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
