-- 00011_chat_threads

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  counselor_id uuid references public.counselors(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_threads_student_idx on public.chat_threads (student_id);
create index if not exists chat_threads_counselor_idx on public.chat_threads (counselor_id);
create index if not exists chat_threads_status_idx on public.chat_threads (status);

alter table public.chat_threads enable row level security;

create policy "threads_select_participant_or_staff"
  on public.chat_threads for select
  to authenticated
  using (
    exists (select 1 from public.students s where s.id = chat_threads.student_id and s.profile_id = auth.uid())
    or exists (select 1 from public.counselors c where c.id = chat_threads.counselor_id and c.profile_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('guidance_head','admin'))
  );

create policy "threads_insert_student_or_counselor"
  on public.chat_threads for insert
  to authenticated
  with check (
    exists (select 1 from public.students s where s.id = chat_threads.student_id and s.profile_id = auth.uid())
    or exists (select 1 from public.counselors c where c.id = chat_threads.counselor_id and c.profile_id = auth.uid())
  );
