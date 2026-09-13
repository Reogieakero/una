-- 00008_pss10_assessments: PSS-10 gate for booking (see booking-service.ts).
-- Also adds appointments.pss10_id FK (kept here to avoid a create-order cycle).

create table if not exists public.pss10_assessments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  answers int[] not null check (array_length(answers, 1) = 10),
  total_score int not null check (total_score between 0 and 40),
  band text not null check (band in ('low','moderate','high')),
  created_at timestamptz not null default now()
);

create index if not exists pss10_student_idx on public.pss10_assessments (student_id);
create index if not exists pss10_appointment_idx on public.pss10_assessments (appointment_id);
create index if not exists pss10_band_idx on public.pss10_assessments (band);

-- Back-reference from appointment -> the PSS-10 that gated it.
alter table public.appointments
  add column if not exists pss10_id uuid references public.pss10_assessments(id) on delete set null;
create index if not exists appointments_pss10_idx on public.appointments (pss10_id);

alter table public.pss10_assessments enable row level security;

create policy "pss10_select_scoped"
  on public.pss10_assessments for select
  to authenticated
  using (
    exists (select 1 from public.students s where s.id = pss10_assessments.student_id and s.profile_id = auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('counselor','guidance_head','guidance_personnel','admin')
    )
  );

create policy "pss10_insert_own"
  on public.pss10_assessments for insert
  to authenticated
  with check (
    exists (select 1 from public.students s where s.id = pss10_assessments.student_id and s.profile_id = auth.uid())
  );
