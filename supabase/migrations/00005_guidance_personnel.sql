-- 00005_guidance_personnel

create table if not exists public.guidance_personnel (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  employee_no text unique,
  position text,
  created_at timestamptz not null default now()
);

create index if not exists guidance_personnel_profile_idx on public.guidance_personnel (profile_id);

alter table public.guidance_personnel enable row level security;

create policy "personnel_select_staff"
  on public.guidance_personnel for select
  to authenticated
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('guidance_head','admin','counselor')
    )
  );
