-- 00032_chat_thread_bump: keep chat_threads.updated_at in sync with new messages.
--
-- Root cause: the sidebar sorts threads by updated_at, but nothing ever moved
-- it — sendMessage()'s follow-up UPDATE is rejected by RLS (chat_threads has
-- no UPDATE policy, and the error is ignored), and no trigger bumped it
-- instead. So the latest user who chatted never rose to the top of the list.
-- A trigger runs as the table owner (bypasses RLS), fixing this for every
-- client (web, mobile, service-role) at the source.

create or replace function public.bump_chat_thread_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_threads
  set updated_at = greatest(NEW.created_at, updated_at)
  where id = NEW.thread_id;
  return NEW;
end;
$$;

drop trigger if exists trg_chat_messages_bump_thread on public.chat_messages;
create trigger trg_chat_messages_bump_thread
  after insert on public.chat_messages
  for each row execute function public.bump_chat_thread_on_message();

-- Backfill: threads whose updated_at predates their latest message.
update public.chat_threads t
set updated_at = m.latest
from (select thread_id, max(created_at) as latest from public.chat_messages group by thread_id) m
where m.thread_id = t.id
  and m.latest > t.updated_at;
