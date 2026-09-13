-- 00017_break_glass_logs: emergency access to restricted records.
-- Every access MUST carry a justification (enforced in break-glass-service.ts
-- AND by the check constraint below) and fires an audit trigger (00018).

create table if not exists public.break_glass_logs (
  id uuid primary key default gen_random_uuid(),
  accessor_profile_id uuid not null references public.profiles(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete cascade,
  justification text not null check (char_length(trim(justification)) >= 20),
  accessed_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz
);

create index if not exists break_glass_accessor_idx on public.break_glass_logs (accessor_profile_id);
create index if not exists break_glass_student_idx on public.break_glass_logs (student_id);

alter table public.break_glass_logs enable row level security;

-- Only counseling leadership + admin can break glass; everyone sees nothing else.
create policy "break_glass_insert_counseling_staff"
  on public.break_glass_logs for insert
  to authenticated
  with check (
    accessor_profile_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('counselor','guidance_head','admin'))
  );

create policy "break_glass_select_head_admin"
  on public.break_glass_logs for select
  to authenticated
  using (
    accessor_profile_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('guidance_head','admin'))
  );
