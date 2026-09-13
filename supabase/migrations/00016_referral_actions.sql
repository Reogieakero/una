-- 00016_referral_actions: audit trail of every triage step.

create table if not exists public.referral_actions (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.referrals(id) on delete cascade,
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  action text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists referral_actions_referral_idx on public.referral_actions (referral_id);
create index if not exists referral_actions_actor_idx on public.referral_actions (actor_profile_id);

alter table public.referral_actions enable row level security;

-- Visibility follows parent referral; writes restricted to counseling staff.
create policy "referral_actions_select_staff"
  on public.referral_actions for select
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('counselor','guidance_head','guidance_personnel','admin','faculty'))
  );

create policy "referral_actions_insert_staff"
  on public.referral_actions for insert
  to authenticated
  with check (
    actor_profile_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('counselor','guidance_head','guidance_personnel','admin'))
  );
