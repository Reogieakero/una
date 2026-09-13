-- 00004_faculty_members

create table if not exists public.faculty_members (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  employee_no text unique,
  department text,
  created_at timestamptz not null default now()
);

create index if not exists faculty_members_profile_idx on public.faculty_members (profile_id);

alter table public.faculty_members enable row level security;

create policy "faculty_select_staff"
  on public.faculty_members for select
  to authenticated
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('guidance_head','admin','counselor','guidance_personnel')
    )
  );
