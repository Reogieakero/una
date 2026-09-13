-- 00012_chat_messages

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_thread_idx on public.chat_messages (thread_id);
create index if not exists chat_messages_sender_idx on public.chat_messages (sender_profile_id);

alter table public.chat_messages enable row level security;

-- Participant check goes through parent thread (avoids duplicating membership logic).
create policy "messages_select_participant"
  on public.chat_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.chat_threads t
      left join public.students s on s.id = t.student_id
      left join public.counselors c on c.id = t.counselor_id
      where t.id = chat_messages.thread_id
        and (s.profile_id = auth.uid() or c.profile_id = auth.uid())
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('guidance_head','admin'))
  );

create policy "messages_insert_participant"
  on public.chat_messages for insert
  to authenticated
  with check (
    sender_profile_id = auth.uid()
    and exists (
      select 1 from public.chat_threads t
      left join public.students s on s.id = t.student_id
      left join public.counselors c on c.id = t.counselor_id
      where t.id = chat_messages.thread_id
        and (s.profile_id = auth.uid() or c.profile_id = auth.uid())
    )
  );
