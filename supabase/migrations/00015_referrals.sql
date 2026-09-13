-- 00015_referrals: faculty/personnel flag a student for counseling follow-up.

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referring_faculty_id uuid references public.faculty_members(id) on delete set null,
  referring_personnel_id uuid references public.guidance_personnel(id) on delete set null,
  student_id uuid not null references public.students(id) on delete cascade,
  reason text not null,
  priority text not null default 'medium'
    check (priority in ('low','medium','high','urgent')),
  status text not null default 'pending'
    check (status in ('pending','acknowledged','in_progress','resolved','escalated')),
  assigned_counselor_id uuid references public.counselors(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    referring_faculty_id is not null or referring_personnel_id is not null
  )
);

create index if not exists referrals_student_idx on public.referrals (student_id);
create index if not exists referrals_status_idx on public.referrals (status);
create index if not exists referrals_priority_idx on public.referrals (priority);
create index if not exists referrals_counselor_idx on public.referrals (assigned_counselor_id);

alter table public.referrals enable row level security;

-- Referrer sees own; assigned counselor + head/personnel/admin see scoped set.
create policy "referrals_select_scoped"
  on public.referrals for select
  to authenticated
  using (
    exists (select 1 from public.faculty_members f where f.id = referrals.referring_faculty_id and f.profile_id = auth.uid())
    or exists (select 1 from public.guidance_personnel g where g.id = referrals.referring_personnel_id and g.profile_id = auth.uid())
    or exists (select 1 from public.counselors c where c.id = referrals.assigned_counselor_id and c.profile_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('guidance_head','guidance_personnel','admin','counselor'))
  );

create policy "referrals_insert_faculty_personnel"
  on public.referrals for insert
  to authenticated
  with check (
    exists (select 1 from public.faculty_members f where f.id = referrals.referring_faculty_id and f.profile_id = auth.uid())
    or exists (select 1 from public.guidance_personnel g where g.id = referrals.referring_personnel_id and g.profile_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('guidance_head','admin'))
  );

create policy "referrals_update_counseling_staff"
  on public.referrals for update
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('counselor','guidance_head','guidance_personnel','admin'))
  );
