-- 00053_session_note_followup_attachments: follow-up datetime + private image attachments.
--
-- WHAT / WHY: counselors schedule a follow-up moment (date AND time, not just
-- a date) and attach up to 5 supporting images to a session note. Both stay
-- inside the note's confidentiality boundary:
-- - follow_up_at is a column on session_notes (same RLS as the note itself);
--   follow_up_date stays as the compat date twin.
-- - Attachments are rows in session_note_attachments (owner + head/admin
--   only, note-ownership verified) with bytes in the PRIVATE
--   session-note-attachments bucket — never the public announcement bucket.
--   Storage paths are note-scoped (`{note_id}/{uuid}.{ext}`) and every
--   storage policy re-verifies note ownership (or head/admin), so a caller
--   can only touch files of notes they may read.
-- - Count (max 5), image-only, and size caps are enforced at the API
--   (/api/session-notes/attachments); RLS is the ownership backstop.

-- ── Follow-up datetime ──────────────────────────────────────────────────────
alter table public.session_notes
  add column if not exists follow_up_at timestamptz;

update public.session_notes
  set follow_up_at = follow_up_date::timestamptz
  where follow_up_at is null and follow_up_date is not null;

-- ── Attachment metadata ─────────────────────────────────────────────────────
create table if not exists public.session_note_attachments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.session_notes(id) on delete cascade,
  counselor_id uuid not null references public.counselors(id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  created_at timestamptz not null default now()
);

create index if not exists sn_attachments_note_idx on public.session_note_attachments (note_id);
create index if not exists sn_attachments_counselor_idx on public.session_note_attachments (counselor_id);

alter table public.session_note_attachments enable row level security;

drop policy if exists "sn_attachments_select_owner_head" on public.session_note_attachments;
create policy "sn_attachments_select_owner_head"
  on public.session_note_attachments for select
  to authenticated
  using (
    exists (
      select 1 from public.session_notes n
      join public.counselors c on c.id = n.counselor_id
      where n.id = session_note_attachments.note_id
        and c.profile_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('guidance_head','admin')
    )
  );

drop policy if exists "sn_attachments_write_owner" on public.session_note_attachments;
create policy "sn_attachments_write_owner"
  on public.session_note_attachments for all
  to authenticated
  using (
    exists (
      select 1 from public.session_notes n
      join public.counselors c on c.id = n.counselor_id
      where n.id = session_note_attachments.note_id
        and c.profile_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('guidance_head','admin')
    )
  )
  with check (
    exists (
      select 1 from public.session_notes n
      join public.counselors c on c.id = n.counselor_id
      where n.id = session_note_attachments.note_id
        and c.profile_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('guidance_head','admin')
    )
  );

-- ── Private storage bucket ──────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('session-note-attachments', 'session-note-attachments', false)
on conflict (id) do update set public = false;

-- Reads (powers short-lived signed URLs): owning counselor or head/admin.
drop policy if exists "sn_attachments_storage_read" on storage.objects;
create policy "sn_attachments_storage_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'session-note-attachments'
    and (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('guidance_head','admin')
      )
      or exists (
        select 1 from public.session_notes n
        join public.counselors c on c.id = n.counselor_id
        where n.id::text = split_part(storage.objects.name, '/', 1)
          and c.profile_id = auth.uid()
      )
    )
  );

-- Uploads: same ownership gate.
drop policy if exists "sn_attachments_storage_insert" on storage.objects;
create policy "sn_attachments_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'session-note-attachments'
    and (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('guidance_head','admin')
      )
      or exists (
        select 1 from public.session_notes n
        join public.counselors c on c.id = n.counselor_id
        where n.id::text = split_part(storage.objects.name, '/', 1)
          and c.profile_id = auth.uid()
      )
    )
  );

-- Deletes (counselor removing their own image): same ownership gate.
drop policy if exists "sn_attachments_storage_delete" on storage.objects;
create policy "sn_attachments_storage_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'session-note-attachments'
    and (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('guidance_head','admin')
      )
      or exists (
        select 1 from public.session_notes n
        join public.counselors c on c.id = n.counselor_id
        where n.id::text = split_part(storage.objects.name, '/', 1)
          and c.profile_id = auth.uid()
      )
    )
  );
