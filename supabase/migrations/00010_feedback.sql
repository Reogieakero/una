-- 00010_feedback: one rating per completed appointment.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists feedback_appointment_idx on public.feedback (appointment_id);
create index if not exists feedback_student_idx on public.feedback (student_id);
create index if not exists feedback_rating_idx on public.feedback (rating);

alter table public.feedback enable row level security;

create policy "feedback_select_scoped"
  on public.feedback for select
  to authenticated
  using (
    exists (select 1 from public.students s where s.id = feedback.student_id and s.profile_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('counselor','guidance_head','admin'))
  );

create policy "feedback_insert_own"
  on public.feedback for insert
  to authenticated
  with check (
    exists (select 1 from public.students s where s.id = feedback.student_id and s.profile_id = auth.uid())
  );
