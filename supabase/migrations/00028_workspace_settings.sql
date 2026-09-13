-- 00028_workspace_settings: head-managed office identity (name, location,
-- contact) rendered in the staff sidebar. Single 'office' key; extend with
-- more keys (never columns) as new preferences arrive.

create table if not exists public.workspace_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.workspace_settings enable row level security;

-- Every signed-in user reads (sidebar renders for all staff roles).
create policy "workspace_settings_select_authenticated"
  on public.workspace_settings for select
  to authenticated
  using (true);

-- Only the guidance head writes.
create policy "workspace_settings_write_head"
  on public.workspace_settings for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'guidance_head')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'guidance_head')
  );

insert into public.workspace_settings (key, value)
values ('office', '{"name": "DOrSU Guidance", "location": "Mati City", "contact": ""}'::jsonb)
on conflict (key) do nothing;
