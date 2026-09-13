-- 00009_session_notes: counselor-private notes per appointment.

create table if not exists public.session_notes (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  counselor_id uuid not null references public.counselors(id) on delete cascade,
  content text not null,
  is_private boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists session_notes_appointment_idx on public.session_notes (appointment_id);
create index if not exists session_notes_counselor_idx on public.session_notes (counselor_id);

alter table public.session_notes enable row level security;

-- Only counseling staff; students never read session notes (break-glass excepted).
create policy "session_notes_select_staff"
  on public.session_notes for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('counselor','guidance_head','admin')
    )
    or exists (
      select 1 from public.counselors c where c.id = session_notes.counselor_id and c.profile_id = auth.uid()
    )
  );

create policy "session_notes_write_counselor"
  on public.session_notes for all
  to authenticated
  using (
    exists (select 1 from public.counselors c where c.id = session_notes.counselor_id and c.profile_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('guidance_head','admin'))
  )
  with check (
    exists (select 1 from public.counselors c where c.id = session_notes.counselor_id and c.profile_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('guidance_head','admin'))
  );
