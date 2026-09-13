-- 00007_appointments: core booking entity.
-- NOTE: pss10_id FK is added in 00008 (pss10 table must exist first to avoid a
-- forward-reference cycle). This file intentionally omits that column.

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  counselor_id uuid references public.counselors(id) on delete set null,
  scheduled_at timestamptz not null,
  mode text not null check (mode in ('in_person','online')),
  status text not null default 'pending'
    check (status in ('pending','confirmed','completed','cancelled','no_show')),
  concern text not null,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointments_student_idx on public.appointments (student_id);
create index if not exists appointments_counselor_idx on public.appointments (counselor_id);
create index if not exists appointments_status_idx on public.appointments (status);
create index if not exists appointments_scheduled_idx on public.appointments (scheduled_at);

alter table public.appointments enable row level security;

-- Students see own; assigned counselor sees theirs; head/personnel/admin see all.
create policy "appointments_select_scoped"
  on public.appointments for select
  to authenticated
  using (
    exists (select 1 from public.students s where s.id = appointments.student_id and s.profile_id = auth.uid())
    or exists (select 1 from public.counselors c where c.id = appointments.counselor_id and c.profile_id = auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('guidance_head','guidance_personnel','admin')
    )
  );

create policy "appointments_insert_student"
  on public.appointments for insert
  to authenticated
  with check (
    exists (select 1 from public.students s where s.id = appointments.student_id and s.profile_id = auth.uid())
  );

-- Status transitions go through booking-service; RLS allows owner/counselor/head.
create policy "appointments_update_scoped"
  on public.appointments for update
  to authenticated
  using (
    exists (select 1 from public.students s where s.id = appointments.student_id and s.profile_id = auth.uid())
    or exists (select 1 from public.counselors c where c.id = appointments.counselor_id and c.profile_id = auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('guidance_head','admin')
    )
  );
