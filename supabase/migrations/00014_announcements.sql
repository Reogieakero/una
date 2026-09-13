-- 00014_announcements

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  author_profile_id uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  body text not null,
  audience text[] null,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists announcements_author_idx on public.announcements (author_profile_id);
create index if not exists announcements_published_idx on public.announcements (published_at);

alter table public.announcements enable row level security;

-- Published announcements readable by all authenticated users.
create policy "announcements_select_published"
  on public.announcements for select
  to authenticated
  using (published_at is not null and published_at <= now());

-- Only head/admin create/publish (enforced again in services).
create policy "announcements_write_head_admin"
  on public.announcements for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('guidance_head','admin'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('guidance_head','admin'))
  );
