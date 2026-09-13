-- 00002_students: student extension of profiles.

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  student_no text not null unique,
  program text,
  year_level text,
  college text,
  contact_no text,
  created_at timestamptz not null default now()
);

create index if not exists students_profile_idx on public.students (profile_id);
create index if not exists students_student_no_idx on public.students (student_no);

alter table public.students enable row level security;

create policy "students_select_own_or_staff"
  on public.students for select
  to authenticated
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('counselor','guidance_head','guidance_personnel','admin','faculty')
    )
  );

create policy "students_insert_own"
  on public.students for insert
  to authenticated
  with check (profile_id = auth.uid());

create policy "students_update_own"
  on public.students for update
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
