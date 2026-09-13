-- 00003_counselors

create table if not exists public.counselors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  employee_no text unique,
  specialization text,
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists counselors_profile_idx on public.counselors (profile_id);
create index if not exists counselors_available_idx on public.counselors (is_available);

alter table public.counselors enable row level security;

-- Directory is visible to any authenticated user (booking needs counselor list).
create policy "counselors_select_authenticated"
  on public.counselors for select
  to authenticated
  using (true);

-- Counselor edits own row; head/admin manage all (via service role / extra policy).
create policy "counselors_update_own"
  on public.counselors for update
  to authenticated
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('guidance_head','admin')
    )
  );
