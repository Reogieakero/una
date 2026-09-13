-- 00006_counselor_availability: recurring weekly slots per counselor.

create table if not exists public.counselor_availability (
  id uuid primary key default gen_random_uuid(),
  counselor_id uuid not null references public.counselors(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_recurring boolean not null default true,
  valid_from date,
  valid_to date,
  created_at timestamptz not null default now(),
  check (start_time < end_time)
);

create index if not exists availability_counselor_idx on public.counselor_availability (counselor_id);
create index if not exists availability_weekday_idx on public.counselor_availability (weekday);

alter table public.counselor_availability enable row level security;

-- Everyone books against availability, so all authenticated users can read.
create policy "availability_select_authenticated"
  on public.counselor_availability for select
  to authenticated
  using (true);

-- Counselor manages own slots; head/admin manage all.
create policy "availability_manage_own_or_head"
  on public.counselor_availability for all
  to authenticated
  using (
    exists (
      select 1 from public.counselors c
      where c.id = counselor_availability.counselor_id
        and c.profile_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('guidance_head','admin')
    )
  )
  with check (
    exists (
      select 1 from public.counselors c
      where c.id = counselor_availability.counselor_id
        and c.profile_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('guidance_head','admin')
    )
  );
