-- 00021_idempotency: retry-safe writes for every client-retryable path.
--
-- - appointments.idempotency_key: client-generated UUID per booking intent.
--   Plain UNIQUE (NULLs never conflict) so double-taps, timeouts and mobile
--   retries collapse to a single row; omitted keys keep legacy behavior.
-- - notifications.dedupe_key: per-event key (e.g. 'appt:<id>:<status>').
--   UNIQUE (profile_id, dedupe_key) so replayed events don't duplicate
--   in-app rows; NULL keys keep legacy behavior.
-- - notification_deliveries: one row per (notification, push_token), so the
--   push fan-out (Expo/FCM, at-least-once) records at most one send per
--   device per event. The worker MUST insert here before/with each send and
--   skip tokens that already have a row for the notification.
--
-- Deliberately NOT applied to break_glass_logs / audit_logs /
-- referral_actions: every attempt there is a security event and must append.

-- ── Booking intent key ───────────────────────────────────────────────────
alter table public.appointments
  add column if not exists idempotency_key text;

create unique index if not exists appointments_idempotency_key_unique
  on public.appointments (idempotency_key);

-- ── Notification event key ───────────────────────────────────────────────
alter table public.notifications
  add column if not exists dedupe_key text;

create unique index if not exists notifications_dedupe_unique
  on public.notifications (profile_id, dedupe_key);

-- ── Push send ledger (one send per device per event) ─────────────────────
create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  push_token text not null,
  status text not null default 'queued'
    check (status in ('queued','sent','failed','skipped')),
  provider_response jsonb,
  created_at timestamptz not null default now(),
  unique (notification_id, push_token)
);

create index if not exists notification_deliveries_notification_idx
  on public.notification_deliveries (notification_id);

alter table public.notification_deliveries enable row level security;
-- No client policies on purpose: the push worker uses service_role (bypasses
-- RLS). RLS with zero policies denies all direct client access.
