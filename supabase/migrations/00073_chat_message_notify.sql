-- 00073_chat_message_notify: tell the counselor when their student writes.
--
-- Students now start conversations from the Messages inbox by picking the
-- counselor who confirmed their session (one thread per counselor). Until
-- this migration only the staff side notified: the web chat page calls
-- notifyStaff after a counselor reply, so a student's first message sat
-- silently in a thread the counselor only saw after a manual refresh.
--
-- Payload is deliberately content-free (00013 / AGENTS.md §9): generic title,
-- no body, no alias, no message text, no thread id in the clickable link.
-- dedupe_key is per message id so a retried INSERT cannot duplicate the inbox
-- row (00021 unique (profile_id, dedupe_key)).
--
-- Only student-sender rows notify. Counselor -> student replies already fan
-- out from the web client (dedupe key chat:<message>:thread), and notifying
-- both sides here would double-send. A thread whose counselor is still null
-- (legacy "Guidance Office" conversation) has no reachable inbox, so it is
-- skipped rather than fanned out to every counselor.

create or replace function public.notify_on_student_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  counselor_profile uuid;
begin
  select c.profile_id
    into counselor_profile
    from public.chat_threads t
    join public.students s on s.id = t.student_id
    join public.counselors c on c.id = t.counselor_id
   where t.id = NEW.thread_id
     and s.profile_id = NEW.sender_profile_id;

  if counselor_profile is null or counselor_profile = NEW.sender_profile_id then
    return NEW;
  end if;

  insert into public.notifications (profile_id, type, title, link, dedupe_key)
  values (counselor_profile, 'chat', 'New message', '/chat', 'chat:' || NEW.id::text)
  on conflict (profile_id, dedupe_key) do nothing;

  return NEW;
end;
$$;

drop trigger if exists trg_notify_on_student_chat_message on public.chat_messages;
create trigger trg_notify_on_student_chat_message
  after insert on public.chat_messages
  for each row execute function public.notify_on_student_chat_message();
