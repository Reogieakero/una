-- 00037_chat_participant_only: student–counselor threads are private to
-- participants. The guidance_head/admin read-all bypass on chat_threads +
-- chat_messages (supervision model) is revoked: the head's inbox is direct
-- staff messages (staff_messages) only — never student thread content.
--
-- Participant rule (unchanged): the student on the thread, or the assigned
-- counselor, may read. Everyone else — including head/admin — sees zero
-- rows. Insert policy is untouched (participants only, head never wrote).

drop policy if exists "threads_select_participant_or_staff"
  on public.chat_threads;

create policy "threads_select_participant"
  on public.chat_threads for select
  to authenticated
  using (
    exists (select 1 from public.students s where s.id = chat_threads.student_id and s.profile_id = auth.uid())
    or exists (select 1 from public.counselors c where c.id = chat_threads.counselor_id and c.profile_id = auth.uid())
  );

drop policy if exists "messages_select_participant"
  on public.chat_messages;

create policy "messages_select_participant_only"
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
  );
