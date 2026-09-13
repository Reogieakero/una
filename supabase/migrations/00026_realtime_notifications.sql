-- 00026_realtime_notifications: stream inbox inserts to the navbar bell
-- and the notifications page (same pattern as 00024). Guarded for re-runs.

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;
