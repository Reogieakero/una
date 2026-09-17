-- 00050_availability_realtime: stream slot changes to the availability UI.
-- The /availability page subscribes to counselor_availability (same
-- postgres_changes pipe as chat) so an add/remove in one session patches
-- every other open board live. Guarded so re-runs are safe.

do $$
begin
  alter publication supabase_realtime add table public.counselor_availability;
exception when duplicate_object then null;
end $$;
