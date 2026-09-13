-- 00001_profiles: one row per auth.users.id, role drives RBAC (see rbac.ts).
-- Depends on: auth.users (Supabase Auth).

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null check (role in ('student','counselor','guidance_head','faculty','guidance_personnel','admin')),
  full_name text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_email_idx on public.profiles (email);

alter table public.profiles enable row level security;

-- Users read/update their own profile; staff roles read all active profiles.
create policy "profiles_select_own_or_staff"
  on public.profiles for select
  to authenticated
  using (
    auth.uid() = id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('counselor','guidance_head','guidance_personnel','admin')
    )
  );

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Inserts happen via signup trigger/service-role only; no direct client insert.
-- Updates to role/is_active restricted to service-role (no client policy).
