-- 00044_notification_tone: per-event toast tone for the global Sonner layer.
--
-- success (default) = completed moves (confirmed, resolved, completed,
-- published); info = FYI that names no failure (assignments, announcements,
-- DMs); error = bad or urgent news (rejected, cancelled, no-show, escalated).
-- NULL reads as success so every pre-existing row keeps today's styling.

alter table public.notifications
  add column if not exists tone text
  check (tone in ('success', 'info', 'error'));
