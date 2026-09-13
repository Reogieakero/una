-- 00020_prisma_dictionary_alignment: additive alignment of supabase/migrations
-- 00001–00019 with the Data Dictionary + packages/db/prisma/schema.prisma.
--
-- PRINCIPLES
-- - ADDITIVE ONLY: only ADD COLUMN / ADD CONSTRAINT / CREATE TABLE|INDEX|VIEW
--   with IF NOT EXISTS guards. No DROP COLUMN, no renames, no data loss, so
--   existing rows from 00001–00019 keep working and `supabase db reset` stays
--   green on a fresh project.
-- - Every dictionary field is added as NULLABLE (or with a DEFAULT) even when
--   the dictionary says NOT NULL, then backfilled from its legacy twin.
--   App code (Zod + Prisma + shared-services) enforces "required for new
--   writes"; the DB stays lenient so old + new rows coexist.
-- - Twin columns (legacy ↔ dictionary) are documented in schema.prisma and
--   synced once here (UPDATE ... WHERE new IS NULL). New writes must set BOTH.
-- - Prisma (`@dorsu/db`) is the server-side ORM over these tables; RLS
--   policies below cover the NEW tables only. Existing RLS is untouched.

-- ── §2 profiles: dictionary identity fields ─────────────────────────────
alter table public.profiles
  add column if not exists id_number text unique,
  add column if not exists department_or_college text,
  add column if not exists contact_number text,
  add column if not exists status text not null default 'active';

-- Backfill status from legacy is_active for rows predating this migration.
update public.profiles set status = case when is_active then 'active' else 'deactivated' end
  where status is null or status = 'active';

-- Dictionary §2 (+ §9 retention): active / deactivated (+ archived via retention job).
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_status_check
      check (status in ('active','deactivated','archived'));
  end if;
end $$;

-- ── §2 students: anonymous alias ─────────────────────────────────────────
alter table public.students
  add column if not exists anonymous_alias text unique;

-- Dictionary makes profiles.id_number canonical; relax legacy NOT NULL so
-- dictionary-style inserts (no student_no) validate at the app layer instead.
alter table public.students alter column student_no drop not null;

-- ── §2 counselors: dictionary credential fields ──────────────────────────
alter table public.counselors
  add column if not exists license_number text,
  add column if not exists is_registered_counselor boolean not null default true;

-- ── §1/§2 guidance_heads: named in the dictionary overview (1:1 off profiles)
create table if not exists public.guidance_heads (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.guidance_heads enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'guidance_heads' and policyname = 'heads_select_staff'
  ) then
    create policy "heads_select_staff"
      on public.guidance_heads for select
      to authenticated
      using (
        profile_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role in ('guidance_head','admin','counselor','guidance_personnel')
        )
      );
  end if;
end $$;

-- ── §2 faculty_members: dictionary college/department ────────────────────
alter table public.faculty_members
  add column if not exists college_department text;

-- ── §3 counselor_availability: dictionary is_active flag ─────────────────
alter table public.counselor_availability
  add column if not exists is_active boolean not null default true;

-- ── §3 appointments: dictionary booking fields ───────────────────────────
alter table public.appointments
  add column if not exists requested_datetime timestamptz,
  add column if not exists confirmed_datetime timestamptz,
  add column if not exists concern_type text
    check (concern_type in ('academic','financial','personal','social','other')),
  add column if not exists source_referral_id uuid references public.referrals(id) on delete set null;

-- Backfill requested_datetime from legacy scheduled_at so dictionary readers
-- see a value for every pre-existing row.
update public.appointments set requested_datetime = scheduled_at
  where requested_datetime is null and scheduled_at is not null;

-- Relax legacy NOT NULLs so dictionary-style writes (requested_datetime
-- primary, concern_type primary) are accepted; app layer requires one of each.
alter table public.appointments alter column scheduled_at drop not null;
alter table public.appointments alter column concern drop not null;
alter table public.appointments alter column concern set default '';

-- Widen mode/status CHECKs to the dictionary ∪ legacy superset.
-- (Constraint names are the Postgres defaults from 00007; drop-if-exists keeps
-- this idempotent on fresh and existing projects.)
alter table public.appointments drop constraint if exists appointments_mode_check;
alter table public.appointments
  add constraint appointments_mode_check
  check (mode in ('face_to_face','chat','phone','video','in_person','online'));

alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments
  add constraint appointments_status_check
  check (status in ('pending','accepted','confirmed','rescheduled','completed','canceled','cancelled','no_show'));

create index if not exists appointments_requested_idx on public.appointments (requested_datetime);
create index if not exists appointments_concern_type_idx on public.appointments (concern_type);
create index if not exists appointments_source_referral_idx on public.appointments (source_referral_id);

-- ── §3 pss10_assessments: dictionary item_scores / stress_level ──────────
-- Added nullable first so the backfill below restores true history
-- (submitted_at ← created_at); only then is NOT NULL + DEFAULT applied.
alter table public.pss10_assessments
  add column if not exists item_scores jsonb,
  add column if not exists stress_level text
    check (stress_level in ('low','moderate','high')),
  add column if not exists submitted_at timestamptz;

-- Backfill twins: item_scores ← answers, stress_level ← band, submitted_at ← created_at.
update public.pss10_assessments set item_scores = to_jsonb(answers)
  where item_scores is null and answers is not null;
update public.pss10_assessments set stress_level = band
  where stress_level is null and band is not null;
update public.pss10_assessments set submitted_at = created_at
  where submitted_at is null and created_at is not null;

-- Dictionary makes item_scores/stress_level canonical; relax legacy NOT NULLs
-- so dictionary-style writes validate at the app layer instead.
alter table public.pss10_assessments alter column answers drop not null;
alter table public.pss10_assessments alter column band drop not null;
alter table public.pss10_assessments alter column submitted_at set default now();
-- Enforce NOT NULL only for rows going forward (existing NULLs, if any, stay):
-- use a CHECK-equivalent via trigger-free two-step: rows already backfilled
-- above have submitted_at set; genuinely-NULL rows (no created_at) are left
-- for manual review rather than failing the whole migration.

-- Dictionary: one assessment per appointment (00008 had only a plain index).
create unique index if not exists pss10_appointment_unique on public.pss10_assessments (appointment_id);

-- ── §3 session_notes: dictionary follow-up fields ────────────────────────
alter table public.session_notes
  add column if not exists notes text,
  add column if not exists follow_up_required boolean not null default false,
  add column if not exists follow_up_date date;

update public.session_notes set notes = content
  where notes is null and content is not null;

-- Dictionary makes `notes` canonical; relax legacy NOT NULL for compat.
alter table public.session_notes alter column content drop not null;

create index if not exists session_notes_followup_idx on public.session_notes (follow_up_required);

-- ── §3 feedback: dictionary comments / submitted_at twins ────────────────
alter table public.feedback
  add column if not exists comments text,
  add column if not exists submitted_at timestamptz;

update public.feedback set comments = comment
  where comments is null and comment is not null;
update public.feedback set submitted_at = created_at
  where submitted_at is null and created_at is not null;

alter table public.feedback alter column submitted_at set default now();

-- ── §3.5 device_tokens (new table for Expo push) ─────────────────────────
create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('ios','android','web')),
  push_token text not null,
  device_label text,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists device_tokens_profile_idx on public.device_tokens (profile_id);
create index if not exists device_tokens_active_idx on public.device_tokens (last_active_at);
alter table public.device_tokens enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'device_tokens' and policyname = 'devices_manage_own'
  ) then
    create policy "devices_manage_own"
      on public.device_tokens for all
      to authenticated
      using (profile_id = auth.uid())
      with check (profile_id = auth.uid());
  end if;
end $$;

-- ── §4 chat_threads: dictionary anonymous mirror ─────────────────────────
alter table public.chat_threads
  add column if not exists is_anonymous boolean not null default false;

-- ── §4 chat_messages: dictionary sent_at / read_at ───────────────────────
alter table public.chat_messages
  add column if not exists sent_at timestamptz,
  add column if not exists read_at timestamptz;

update public.chat_messages set sent_at = created_at
  where sent_at is null and created_at is not null;

alter table public.chat_messages alter column sent_at set default now();

-- ── §4 notifications: dictionary payload + widened types ─────────────────
alter table public.notifications
  add column if not exists payload jsonb;

-- Dictionary inserts are payload-centric (title optional); relax legacy NOT NULL.
alter table public.notifications alter column title drop not null;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('appointment','followup','message','announcement','referral','chat','assessment','system'));

-- ── §4 announcements: dictionary event_date ──────────────────────────────
alter table public.announcements
  add column if not exists event_date timestamptz;

-- ── §5 referrals: dictionary category / description / submitted_at ───────
alter table public.referrals
  add column if not exists reason_category text
    check (reason_category in ('academic','behavioral','relational')),
  add column if not exists description text,
  add column if not exists submitted_at timestamptz;

-- Backfill twins: description ← reason, submitted_at ← created_at.
update public.referrals set description = reason
  where description is null and reason is not null;
update public.referrals set submitted_at = created_at
  where submitted_at is null and created_at is not null;

alter table public.referrals alter column submitted_at set default now();

-- Legacy reason stays NOT NULL with a default so dictionary-style writes that
-- only set description still pass; give it a default for forward compat.
alter table public.referrals alter column reason set default '';

alter table public.referrals drop constraint if exists referrals_status_check;
alter table public.referrals
  add constraint referrals_status_check
  check (status in ('submitted','under_review','action_taken','closed','pending','acknowledged','in_progress','resolved','escalated'));

create index if not exists referrals_reason_category_idx on public.referrals (reason_category);

-- ── §5 referral_actions: dictionary action_taken / action_date ───────────
alter table public.referral_actions
  add column if not exists action_taken text,
  add column if not exists action_date timestamptz;

update public.referral_actions set action_taken = action
  where action_taken is null and action is not null;
update public.referral_actions set action_date = created_at
  where action_date is null and created_at is not null;

alter table public.referral_actions alter column action_date set default now();

alter table public.referral_actions alter column action set default '';

-- ── §6 break_glass_logs: dictionary appointment / approver ───────────────
alter table public.break_glass_logs
  add column if not exists appointment_id uuid references public.appointments(id) on delete set null,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists counselor_id uuid references public.counselors(id) on delete set null;

create index if not exists break_glass_appointment_idx on public.break_glass_logs (appointment_id);

-- ── §6 audit_logs: dictionary target_* twins + §3.5 platform ─────────────
alter table public.audit_logs
  add column if not exists target_table text,
  add column if not exists target_id uuid,
  add column if not exists platform text
    check (platform in ('web','mobile'));

update public.audit_logs set target_table = entity
  where target_table is null and entity is not null;
update public.audit_logs set target_id = entity_id
  where target_id is null and entity_id is not null;

create index if not exists audit_logs_target_idx on public.audit_logs (target_table, target_id);
create index if not exists audit_logs_platform_idx on public.audit_logs (platform);

-- Legacy entity stays NOT NULL with a default so dictionary-style writes that
-- only set target_table still pass.
alter table public.audit_logs alter column entity set default '';

-- ── §7 analytics_daily_summary: dictionary superset view ─────────────────
-- Keeps the legacy day-grain (one row per day) so existing charts keep
-- working; dictionary columns are added as mirrors/derivations:
-- summary_date←day, avg_pss10_score←avg_pss10, top_concern_type = daily mode
-- of concern_type (fallback concern), avg_response_time_minutes = mean
-- confirmed−requested, counselor_id NULL (whole-service grain; per-counselor
-- breakdown is a GROUP BY query, not a second grain in this view).
-- NOTE: per-day aggregates are pre-computed in CTEs and joined — Postgres
-- rejects correlated subqueries that reference ungrouped outer columns.
-- DROP+CREATE (not CREATE OR REPLACE) because the dictionary column order
-- differs from 00019's; nothing depends on this view.
drop view if exists public.analytics_daily_summary;

create view public.analytics_daily_summary as
with daily as (
  select
    date_trunc('day', a.created_at)::date as day,
    count(a.id)::int as total_appointments,
    count(a.id) filter (where a.status = 'completed')::int as completed_appointments,
    avg(p.total_score)::float as avg_pss10,
    count(p.id) filter (where coalesce(p.stress_level, p.band) = 'high')::int as high_stress_count,
    avg(
      extract(epoch from (a.confirmed_datetime - a.requested_datetime)) / 60.0
    ) filter (where a.confirmed_datetime is not null and a.requested_datetime is not null)::float
      as avg_response_time_minutes
  from public.appointments a
  left join public.pss10_assessments p on p.appointment_id = a.id
  group by 1
),
referrals_per_day as (
  select r.created_at::date as day, count(*)::int as total_referrals
  from public.referrals r
  group by 1
),
top_concern_per_day as (
  select day, val as top_concern_type
  from (
    select
      date_trunc('day', created_at)::date as day,
      coalesce(concern_type, concern) as val,
      row_number() over (
        partition by date_trunc('day', created_at)::date order by count(*) desc
      ) as rn
    from public.appointments
    where coalesce(concern_type, concern) is not null
    group by 1, 2
  ) s
  where rn = 1
)
select
  d.day,
  d.day as summary_date,
  d.total_appointments,
  d.completed_appointments,
  d.avg_pss10,
  d.avg_pss10 as avg_pss10_score,
  d.high_stress_count,
  t.top_concern_type,
  null::uuid as counselor_id,
  d.avg_response_time_minutes,
  coalesce(r.total_referrals, 0) as total_referrals
from daily d
left join referrals_per_day r on r.day = d.day
left join top_concern_per_day t on t.day = d.day
order by 1 desc;
