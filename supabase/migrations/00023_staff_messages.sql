-- 00023_staff_messages: direct staff-to-staff messages (head/admin <-> counselor).
-- Chat threads are student-bound and only participants may send, so office
-- coordination gets its own table. Students never touch these rows.

create table if not exists public.staff_messages (
  id uuid primary key default gen_random_uuid(),
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  check (sender_profile_id <> recipient_profile_id)
);

create index if not exists staff_messages_sender_idx on public.staff_messages (sender_profile_id);
create index if not exists staff_messages_recipient_idx on public.staff_messages (recipient_profile_id);
create index if not exists staff_messages_pair_idx on public.staff_messages (sender_profile_id, recipient_profile_id);

alter table public.staff_messages enable row level security;

-- Parties read their own conversation; head/admin supervise all staff DMs.
create policy "staff_messages_select_scoped"
  on public.staff_messages for select
  to authenticated
  using (
    sender_profile_id = auth.uid()
    or recipient_profile_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('guidance_head','admin')
    )
  );

-- Sender writes own rows, staff recipients only (no student DMs here).
create policy "staff_messages_insert_staff"
  on public.staff_messages for insert
  to authenticated
  with check (
    sender_profile_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = staff_messages.recipient_profile_id
        and p.role in ('counselor','guidance_head','guidance_personnel','admin')
    )
  );

-- Recipient marks own messages read.
create policy "staff_messages_update_recipient"
  on public.staff_messages for update
  to authenticated
  using (recipient_profile_id = auth.uid())
  with check (recipient_profile_id = auth.uid());

-- Realtime for the chat inbox (no-op if the project publishes all tables).
do $$
begin
  alter publication supabase_realtime add table public.staff_messages;
exception when duplicate_object then null;
end $$;
