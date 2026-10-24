-- 00069_identity_rls_hardening: make routine staff workflows alias-only.
--
-- THREAT: before this migration every counselor, head, personnel, admin and
-- faculty session could `select * from students` and (for all but faculty)
-- `select * from profiles`. That ambient access correlates an anonymous alias
-- to a real name/email/student number through
--   appointments.student_id -> students.profile_id -> profiles.full_name.
-- The break-glass grant, review, caseload and audit path was therefore
-- bypassable with a normal browser query.
--
-- FIX (non-destructive, RLS + SECURITY DEFINER RPCs):
--   * students rows are readable only by their owner and by head/admin
--     oversight. Counselors/personnel/faculty get alias-level data through
--     scoped RPCs instead of the table.
--   * profiles readable by staff are limited to non-student profiles.
--     Head/admin retain full oversight; everyone else can still resolve
--     staff names (counselors, faculty, personnel) for boards.
--   * list_student_directory() is the /students feed: alias-level columns
--     only, caseload-scoped for counselors, directory-wide for head/admin
--     and guidance_personnel, empty for faculty.
--   * list_emergency_students() powers the break-glass picker: aliases only,
--     never student numbers. Access is limited to break-glass-capable roles.
--   * get_student_aliases(ids) resolves aliases for records the caller can
--     already reach (appointments, referrals, chat, reports, dashboards).
--     profile_id is returned only as an opaque notification routing key; the
--     profiles RLS above keeps it from resolving to a real identity.
--   * lookup_student_for_referral(student_no) is exact-match only for the
--     referral creators (faculty/personnel/head/admin). It cannot enumerate.
--
-- The existing reveal API (/api/staff/security/reveal) remains the only path
-- to full identity for counselors: active grant + head review + caseload +
-- expiry + audit_logs, all unchanged.
--
-- Helpers are SECURITY DEFINER so policies never re-enter RLS on profiles or
-- students (00022 recurrence). All statements are idempotent.

-- ── helpers ────────────────────────────────────────────────────────────────

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = (select auth.uid());
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

-- Is the target profile a student? Used by profiles RLS to keep routine
-- staff out of student identity rows without blocking staff/staff reads.
create or replace function public.profile_is_student(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = pid and p.role = 'student'
  );
$$;

revoke all on function public.profile_is_student(uuid) from public;
grant execute on function public.profile_is_student(uuid) to authenticated;

-- Can the caller reach this student through a real case relationship?
-- Head/admin oversight: any. Counselor: assigned session/referral/thread.
-- Personnel: alias-level directory (operational intake). Faculty: only
-- students on referrals they filed. Student: own row.
create or replace function public.can_access_student(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select (select auth.uid()) as uid, public.current_user_role() as role
  )
  select exists (
    select 1
    from public.students s
    join me on true
    where s.id = sid
      and (
        -- own row
        s.profile_id = me.uid
        -- oversight
        or me.role in ('guidance_head', 'admin')
        -- office personnel operate the alias-level directory
        or me.role = 'guidance_personnel'
        -- counselor caseload: session, referral, or chat thread
        or (
          me.role = 'counselor'
          and (
            exists (
              select 1 from public.appointments a
              join public.counselors c on c.id = a.counselor_id
              where a.student_id = s.id and c.profile_id = me.uid
            )
            or exists (
              select 1 from public.referrals r
              join public.counselors c on c.id = r.assigned_counselor_id
              where r.student_id = s.id and c.profile_id = me.uid
            )
            or exists (
              select 1 from public.chat_threads t
              join public.counselors c on c.id = t.counselor_id
              where t.student_id = s.id and c.profile_id = me.uid
            )
          )
        )
        -- faculty: students on referrals they filed
        or (
          me.role = 'faculty'
          and exists (
            select 1
            from public.referrals r
            join public.faculty_members f on f.id = r.referring_faculty_id
            where r.student_id = s.id and f.profile_id = me.uid
          )
        )
      )
  );
$$;

revoke all on function public.can_access_student(uuid) from public;
grant execute on function public.can_access_student(uuid) to authenticated;

-- ── profiles: routine staff cannot read student identity rows ─────────────

drop policy if exists "profiles_select_staff" on public.profiles;
create policy "profiles_select_staff"
  on public.profiles for select to authenticated
  using (
    public.current_user_role() in ('guidance_head', 'admin')
    or (
      public.current_user_role() in ('counselor', 'guidance_personnel')
      and not public.profile_is_student(profiles.id)
    )
  );

-- ── students: owner + oversight only ──────────────────────────────────────

drop policy if exists "students_select_own_or_staff" on public.students;
drop policy if exists "students_select_own_or_oversight" on public.students;
create policy "students_select_own_or_oversight"
  on public.students for select to authenticated
  using (
    profile_id = (select auth.uid())
    or public.current_user_role() in ('guidance_head', 'admin')
  );

-- ── alias-level directory (/students) ─────────────────────────────────────

create or replace function public.list_student_directory()
returns table (
  id uuid,
  anonymous_alias text,
  program text,
  year_level text,
  college text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select (select auth.uid()) as uid, public.current_user_role() as role
  )
  select s.id, s.anonymous_alias, s.program, s.year_level, s.college, s.created_at
  from public.students s
  join me on true
  where
    me.role in ('guidance_head', 'admin')
    or me.role = 'guidance_personnel'
    or (
      me.role = 'counselor'
      and (
        exists (
          select 1 from public.appointments a
          join public.counselors c on c.id = a.counselor_id
          where a.student_id = s.id and c.profile_id = me.uid
        )
        or exists (
          select 1 from public.referrals r
          join public.counselors c on c.id = r.assigned_counselor_id
          where r.student_id = s.id and c.profile_id = me.uid
        )
        or exists (
          select 1 from public.chat_threads t
          join public.counselors c on c.id = t.counselor_id
          where t.student_id = s.id and c.profile_id = me.uid
        )
      )
    )
    or s.profile_id = me.uid
  order by s.created_at desc;
$$;

revoke all on function public.list_student_directory() from public;
grant execute on function public.list_student_directory() to authenticated;

-- Break-glass picker: aliases only, all students, break-glass roles only.
-- Emergency response must not be limited to the caller's caseload.
create or replace function public.list_emergency_students()
returns table (id uuid, anonymous_alias text)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.anonymous_alias
  from public.students s
  where public.current_user_role() in ('counselor', 'guidance_head', 'admin')
  order by s.anonymous_alias nulls last, s.created_at desc;
$$;

revoke all on function public.list_emergency_students() from public;
grant execute on function public.list_emergency_students() to authenticated;

-- Alias resolution for ids the caller can already reach. profile_id is an
-- opaque notification routing key, not identity: profiles RLS blocks the
-- matching name/email for routine staff.
create or replace function public.get_student_aliases(ids uuid[])
returns table (id uuid, anonymous_alias text, profile_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.anonymous_alias, s.profile_id
  from public.students s
  where s.id = any(ids)
    and public.can_access_student(s.id);
$$;

revoke all on function public.get_student_aliases(uuid[]) from public;
grant execute on function public.get_student_aliases(uuid[]) to authenticated;

-- Exact student-number lookup for referral creation. No wildcard, no limit
-- browsing: one case-insensitive exact match. Returns alias-level fields plus
-- the number the caller already typed so the UI can echo it back.
create or replace function public.lookup_student_for_referral(p_student_no text)
returns table (
  id uuid,
  anonymous_alias text,
  student_no text,
  program text,
  year_level text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.anonymous_alias, s.student_no, s.program, s.year_level
  from public.students s
  where public.current_user_role() in ('faculty', 'guidance_personnel', 'guidance_head', 'admin')
    and btrim(coalesce(p_student_no, '')) <> ''
    and lower(s.student_no) = lower(btrim(p_student_no))
  limit 1;
$$;

revoke all on function public.lookup_student_for_referral(text) from public;
grant execute on function public.lookup_student_for_referral(text) to authenticated;

-- Official referral document identity. Referral forms are identifying by
-- design, so the creator/assignee/head may resolve the linked student's
-- number and programme snapshot. Full name/email stay out; the paper form
-- carries typed text for walk-ins.
create or replace function public.get_referral_student(p_referral_id uuid)
returns table (
  student_id uuid,
  student_no text,
  anonymous_alias text,
  program text,
  year_level text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.student_no, s.anonymous_alias, s.program, s.year_level
  from public.referrals r
  join public.students s on s.id = r.student_id
  where r.id = p_referral_id
    and (
      public.current_user_role() in ('guidance_head', 'admin')
      or exists (
        select 1 from public.faculty_members f
        where f.id = r.referring_faculty_id and f.profile_id = (select auth.uid())
      )
      or exists (
        select 1 from public.guidance_personnel g
        where g.id = r.referring_personnel_id and g.profile_id = (select auth.uid())
      )
      or exists (
        select 1 from public.counselors c
        where c.id = r.assigned_counselor_id and c.profile_id = (select auth.uid())
      )
    );
$$;

revoke all on function public.get_referral_student(uuid) from public;
grant execute on function public.get_referral_student(uuid) to authenticated;
