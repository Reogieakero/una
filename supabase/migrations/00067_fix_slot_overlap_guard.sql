-- 00067_fix_slot_overlap_guard: repair and re-arm the P12 slot guard.
--
-- WHY: 00059 created `no_counselor_overlap` inside a DO block that caught ALL
-- exceptions and only raised a notice. On a database with pre-existing
-- overlapping `assigned`/`confirmed` rows the constraint was silently skipped,
-- so deployments could run without the race backstop. This migration:
--
--   1. resolves existing overlap groups deterministically,
--   2. writes one audit_logs row per cancelled appointment,
--   3. adds the exclusion constraint WITHOUT swallowing errors,
--   4. verifies that the constraint exists and is validated.
--
-- KEEP RULE: within a connected overlap group for one counselor, keep the
-- earliest confirmed appointment; if none is confirmed, keep the earliest
-- assigned appointment. Cancel the rest. `pending` and terminal rows are
-- untouched. The policy is applied by `resolve_appointment_overlaps()` and is
-- safe to re-run (a clean database cancels nothing).

create extension if not exists "btree_gist";

-- The exclusion constraint below needs an IMMUTABLE index expression.
-- `timestamptz + interval` is only STABLE (it depends on the session TimeZone),
-- so `coalesce(ends_at, scheduled_at + interval '1 hour')` cannot be indexed.
-- Instead, keep `ends_at` filled at the table level and index the plain
-- `tstzrange(scheduled_at, ends_at)` (both are immutable).
update public.appointments
   set ends_at = scheduled_at + interval '1 hour'
 where ends_at is null;

create or replace function public.set_appointment_ends_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.ends_at is null then
    new.ends_at := new.scheduled_at + interval '1 hour';
  elsif new.scheduled_at is distinct from old.scheduled_at
        and new.ends_at is not distinct from old.ends_at then
    -- Reschedule that moves only the start: preserve the original duration
    -- instead of leaving ends_at behind (which could invert the range).
    new.ends_at := new.scheduled_at + (old.ends_at - old.scheduled_at);
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_set_ends_at on public.appointments;
create trigger appointments_set_ends_at
  before insert or update of scheduled_at, ends_at on public.appointments
  for each row execute function public.set_appointment_ends_at();

create or replace function public.resolve_appointment_overlaps()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  cancelled_count integer := 0;
begin
  -- Connected overlap groups per counselor, ordered by start time.
  create temp table _p0_overlap_cancellations on commit drop as
  with recursive base as (
    select
      a.id,
      a.counselor_id,
      a.status,
      a.scheduled_at,
      tstzrange(a.scheduled_at, a.ends_at) as slot_range,
      row_number() over (
        partition by a.counselor_id
        order by a.scheduled_at, a.id
      ) as rn
    from public.appointments a
    where a.counselor_id is not null
      and a.status in ('assigned', 'confirmed')
  ),
  walk as (
    select
      b.id, b.counselor_id, b.status, b.scheduled_at, b.rn,
      1 as grp_id,
      b.slot_range as grp_range
    from base b
    where b.rn = 1

    union all

    select
      b.id, b.counselor_id, b.status, b.scheduled_at, b.rn,
      case when b.slot_range && w.grp_range then w.grp_id else w.grp_id + 1 end,
      case when b.slot_range && w.grp_range
           then range_merge(w.grp_range, b.slot_range)
           else b.slot_range
      end
    from base b
    join walk w
      on b.counselor_id = w.counselor_id
     and b.rn = w.rn + 1
  ),
  ranked as (
    select
      w.id,
      w.counselor_id,
      w.grp_id,
      row_number() over (
        partition by w.counselor_id, w.grp_id
        order by (w.status = 'confirmed') desc, w.scheduled_at, w.id
      ) as rn,
      first_value(w.id) over (
        partition by w.counselor_id, w.grp_id
        order by (w.status = 'confirmed') desc, w.scheduled_at, w.id
      ) as keep_id
    from walk w
  )
  select id, counselor_id, grp_id, keep_id
  from ranked
  where rn > 1;

  -- Audit before the update so the cancelled rows have a durable reason.
  insert into public.audit_logs (action, entity, entity_id, metadata)
  select
    'appointments.bulk_cancel_overlap',
    'appointments',
    c.id,
    jsonb_build_object(
      'reason', 'P0 slot overlap cleanup',
      'kept_appointment_id', c.keep_id,
      'counselor_id', c.counselor_id,
      'overlap_group', c.grp_id
    )
  from _p0_overlap_cancellations c;

  update public.appointments a
     set status = 'cancelled'
    from _p0_overlap_cancellations c
   where a.id = c.id
     and a.status in ('assigned', 'confirmed');

  get diagnostics cancelled_count = row_count;
  return cancelled_count;
end;
$$;

revoke all on function public.resolve_appointment_overlaps() from public;
revoke all on function public.resolve_appointment_overlaps() from authenticated;

-- Resolve existing overlaps (no-op when the database is already clean).
select public.resolve_appointment_overlaps();

-- Fail loudly if even one overlap remains. Do not repeat 00059's silent skip.
do $$
begin
  if exists (
    select 1
    from public.appointments a
    join public.appointments b
      on a.counselor_id = b.counselor_id
     and a.id < b.id
     and a.status in ('assigned', 'confirmed')
     and b.status in ('assigned', 'confirmed')
     and tstzrange(a.scheduled_at, a.ends_at)
         && tstzrange(b.scheduled_at, b.ends_at)
  ) then
    raise exception '00067: overlapping active appointments remain after cleanup';
  end if;
end
$$;

-- Add the constraint without hiding failures.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'no_counselor_overlap'
  ) then
    alter table public.appointments
      add constraint no_counselor_overlap
      exclude using gist (
        counselor_id with =,
        tstzrange(scheduled_at, ends_at) with &&
      )
      where (status in ('assigned', 'confirmed'));
  end if;
end
$$;

-- Verify it is present and validated.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'no_counselor_overlap'
      and convalidated
  ) then
    raise exception '00067: no_counselor_overlap is missing or not validated';
  end if;
end
$$;

comment on constraint no_counselor_overlap on public.appointments is
  'P12 race backstop: one active (assigned/confirmed) window per counselor.';
