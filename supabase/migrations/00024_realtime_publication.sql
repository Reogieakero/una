-- 00024_realtime_publication: stream chat changes to the inbox UI.
-- The hosted project published no chat tables, so thread/message inserts
-- never reached realtime subscribers (staff_messages self-registers in
-- 00023). Guarded so re-runs are safe.

do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.chat_threads;
exception when duplicate_object then null;
end $$;
