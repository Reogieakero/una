-- 00013_notifications

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('appointment','referral','announcement','chat','assessment','system')),
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_profile_idx on public.notifications (profile_id);
create index if not exists notifications_read_idx on public.notifications (profile_id, is_read);

alter table public.notifications enable row level security;

create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (profile_id = auth.uid());

create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Inserts are service-side (notification-service with service_role); no client insert policy.
