-- 00060_phase2_rls_auth_uid_opt: wrap per-row auth.uid() in (select ...) (P4).
--
-- WHY: auth.uid() is volatile — Postgres re-evaluates it for EVERY row when
-- written bare inside RLS USING/WITH CHECK. Wrapping it as (select auth.uid())
-- turns it into an initPlan evaluated once per statement (standard Supabase
-- pattern). Semantics unchanged; only execution cost changes.
--
-- SCOPE: every policy that called auth.uid() directly. Policies already going
-- through SECURITY DEFINER helpers (profiles_select_staff via
-- current_user_role(), staff_messages_insert_staff via profile_role(),
-- audit_events via current_user_role()) are left alone except the helper
-- itself, which gets the same wrap. `using (true)` policies untouched.
-- All statements are DROP IF EXISTS + CREATE (safe re-run).

-- ── helpers ──
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

-- Participant check for chat_messages: one helper instead of a double
-- LEFT JOIN with two bare auth.uid() calls per row.
create or replace function public.is_thread_participant(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_threads t
    left join public.students s on s.id = t.student_id
    left join public.counselors c on c.id = t.counselor_id
    where t.id = tid
      and (s.profile_id = (select auth.uid()) or c.profile_id = (select auth.uid()))
  );
$$;

revoke all on function public.is_thread_participant(uuid) from public;
grant execute on function public.is_thread_participant(uuid) to authenticated;

-- ── profiles ──
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

-- profiles_select_staff already uses current_user_role() — no rewrite needed.
-- profiles_update_own (00001:33): wrap both sides.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ── students ──
drop policy if exists "students_select_own_or_staff" on public.students;
create policy "students_select_own_or_staff"
  on public.students for select to authenticated
  using (
    profile_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('counselor','guidance_head','guidance_personnel','admin','faculty')
    )
  );

drop policy if exists "students_insert_own" on public.students;
create policy "students_insert_own"
  on public.students for insert to authenticated
  with check (profile_id = (select auth.uid()));

drop policy if exists "students_update_own" on public.students;
create policy "students_update_own"
  on public.students for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- ── counselors ──
drop policy if exists "counselors_update_own" on public.counselors;
create policy "counselors_update_own"
  on public.counselors for update to authenticated
  using (
    profile_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('guidance_head','admin')
    )
  );

-- ── faculty_members ──
drop policy if exists "faculty_select_staff" on public.faculty_members;
create policy "faculty_select_staff"
  on public.faculty_members for select to authenticated
  using (
    profile_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('guidance_head','admin','counselor','guidance_personnel')
    )
  );

-- ── guidance_personnel ──
drop policy if exists "personnel_select_staff" on public.guidance_personnel;
create policy "personnel_select_staff"
  on public.guidance_personnel for select to authenticated
  using (
    profile_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('guidance_head','admin','counselor')
    )
  );

-- ── counselor_availability (manage-only; select is using(true)) ──
drop policy if exists "availability_manage_own_only" on public.counselor_availability;
create policy "availability_manage_own_only"
  on public.counselor_availability for all to authenticated
  using (
    exists (
      select 1 from public.counselors c
      where c.id = counselor_availability.counselor_id
        and c.profile_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.counselors c
      where c.id = counselor_availability.counselor_id
        and c.profile_id = (select auth.uid())
    )
  );

-- ── appointments ──
drop policy if exists "appointments_select_scoped" on public.appointments;
create policy "appointments_select_scoped"
  on public.appointments for select to authenticated
  using (
    exists (select 1 from public.students s where s.id = appointments.student_id and s.profile_id = (select auth.uid()))
    or exists (select 1 from public.counselors c where c.id = appointments.counselor_id and c.profile_id = (select auth.uid()))
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('guidance_head','guidance_personnel','admin')
    )
  );

drop policy if exists "appointments_insert_student" on public.appointments;
create policy "appointments_insert_student"
  on public.appointments for insert to authenticated
  with check (
    exists (select 1 from public.students s where s.id = appointments.student_id and s.profile_id = (select auth.uid()))
  );

drop policy if exists "appointments_update_scoped" on public.appointments;
create policy "appointments_update_scoped"
  on public.appointments for update to authenticated
  using (
    exists (select 1 from public.students s where s.id = appointments.student_id and s.profile_id = (select auth.uid()))
    or exists (select 1 from public.counselors c where c.id = appointments.counselor_id and c.profile_id = (select auth.uid()))
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('guidance_head','admin')
    )
  );

drop policy if exists "appointments_insert_counselor" on public.appointments;
create policy "appointments_insert_counselor"
  on public.appointments for insert to authenticated
  with check (
    exists (
      select 1 from public.counselors c
      where c.id = appointments.counselor_id
        and c.profile_id = (select auth.uid())
    )
  );

-- ── pss10 ──
drop policy if exists "pss10_select_scoped" on public.pss10_assessments;
create policy "pss10_select_scoped"
  on public.pss10_assessments for select to authenticated
  using (
    exists (select 1 from public.students s where s.id = pss10_assessments.student_id and s.profile_id = (select auth.uid()))
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('counselor','guidance_head','guidance_personnel','admin')
    )
  );

drop policy if exists "pss10_insert_own" on public.pss10_assessments;
create policy "pss10_insert_own"
  on public.pss10_assessments for insert to authenticated
  with check (
    exists (select 1 from public.students s where s.id = pss10_assessments.student_id and s.profile_id = (select auth.uid()))
  );

-- ── session_notes ──
drop policy if exists "session_notes_select_owner_head" on public.session_notes;
create policy "session_notes_select_owner_head"
  on public.session_notes for select to authenticated
  using (
    exists (
      select 1 from public.counselors c
      where c.id = session_notes.counselor_id and c.profile_id = (select auth.uid())
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('guidance_head','admin')
    )
  );

drop policy if exists "session_notes_write_counselor" on public.session_notes;
create policy "session_notes_write_counselor"
  on public.session_notes for all to authenticated
  using (
    exists (select 1 from public.counselors c where c.id = session_notes.counselor_id and c.profile_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('guidance_head','admin'))
  )
  with check (
    exists (select 1 from public.counselors c where c.id = session_notes.counselor_id and c.profile_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('guidance_head','admin'))
  );

-- ── feedback ──
drop policy if exists "feedback_select_scoped" on public.feedback;
create policy "feedback_select_scoped"
  on public.feedback for select to authenticated
  using (
    exists (select 1 from public.students s where s.id = feedback.student_id and s.profile_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('counselor','guidance_head','admin'))
  );

drop policy if exists "feedback_insert_own" on public.feedback;
create policy "feedback_insert_own"
  on public.feedback for insert to authenticated
  with check (
    exists (select 1 from public.students s where s.id = feedback.student_id and s.profile_id = (select auth.uid()))
  );

-- ── chat_threads ──
drop policy if exists "threads_select_participant" on public.chat_threads;
create policy "threads_select_participant"
  on public.chat_threads for select to authenticated
  using (
    exists (select 1 from public.students s where s.id = chat_threads.student_id and s.profile_id = (select auth.uid()))
    or exists (select 1 from public.counselors c where c.id = chat_threads.counselor_id and c.profile_id = (select auth.uid()))
  );

drop policy if exists "threads_insert_student_or_counselor" on public.chat_threads;
create policy "threads_insert_student_or_counselor"
  on public.chat_threads for insert to authenticated
  with check (
    exists (select 1 from public.students s where s.id = chat_threads.student_id and s.profile_id = (select auth.uid()))
    or exists (select 1 from public.counselors c where c.id = chat_threads.counselor_id and c.profile_id = (select auth.uid()))
  );

-- ── chat_messages (helper for select; insert keeps sender check wrapped) ──
drop policy if exists "messages_select_participant_only" on public.chat_messages;
create policy "messages_select_participant_only"
  on public.chat_messages for select to authenticated
  using (public.is_thread_participant(chat_messages.thread_id));

drop policy if exists "messages_insert_participant" on public.chat_messages;
create policy "messages_insert_participant"
  on public.chat_messages for insert to authenticated
  with check (
    sender_profile_id = (select auth.uid())
    and public.is_thread_participant(chat_messages.thread_id)
  );

-- ── notifications ──
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select to authenticated
  using (profile_id = (select auth.uid()));

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- ── announcements (write only; select is published-based) ──
drop policy if exists "announcements_write_head_admin" on public.announcements;
create policy "announcements_write_head_admin"
  on public.announcements for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('guidance_head','admin'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('guidance_head','admin'))
  );

-- ── referrals ──
drop policy if exists "referrals_select_scoped" on public.referrals;
create policy "referrals_select_scoped"
  on public.referrals for select to authenticated
  using (
    exists (select 1 from public.faculty_members f where f.id = referrals.referring_faculty_id and f.profile_id = (select auth.uid()))
    or exists (select 1 from public.guidance_personnel g where g.id = referrals.referring_personnel_id and g.profile_id = (select auth.uid()))
    or exists (select 1 from public.counselors c where c.id = referrals.assigned_counselor_id and c.profile_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('guidance_head','guidance_personnel','admin'))
  );

drop policy if exists "referrals_insert_faculty_personnel" on public.referrals;
create policy "referrals_insert_faculty_personnel"
  on public.referrals for insert to authenticated
  with check (
    exists (select 1 from public.faculty_members f where f.id = referrals.referring_faculty_id and f.profile_id = (select auth.uid()))
    or exists (select 1 from public.guidance_personnel g where g.id = referrals.referring_personnel_id and g.profile_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('guidance_head','admin'))
  );

drop policy if exists "referrals_update_scoped" on public.referrals;
create policy "referrals_update_scoped"
  on public.referrals for update to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('guidance_head','guidance_personnel','admin'))
    or exists (select 1 from public.counselors c where c.id = referrals.assigned_counselor_id and c.profile_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('guidance_head','guidance_personnel','admin'))
    or exists (select 1 from public.counselors c where c.id = referrals.assigned_counselor_id and c.profile_id = (select auth.uid()))
  );

-- ── referral_actions ──
drop policy if exists "referral_actions_select_staff" on public.referral_actions;
create policy "referral_actions_select_staff"
  on public.referral_actions for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid())
      and p.role in ('counselor','guidance_head','guidance_personnel','admin','faculty'))
  );

drop policy if exists "referral_actions_insert_staff" on public.referral_actions;
create policy "referral_actions_insert_staff"
  on public.referral_actions for insert to authenticated
  with check (
    actor_profile_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid())
      and p.role in ('counselor','guidance_head','guidance_personnel','admin'))
  );

-- ── break_glass_logs ──
drop policy if exists "break_glass_insert_counseling_staff" on public.break_glass_logs;
create policy "break_glass_insert_counseling_staff"
  on public.break_glass_logs for insert to authenticated
  with check (
    accessor_profile_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid())
      and p.role in ('counselor','guidance_head','admin'))
  );

drop policy if exists "break_glass_select_head_admin" on public.break_glass_logs;
create policy "break_glass_select_head_admin"
  on public.break_glass_logs for select to authenticated
  using (
    accessor_profile_id = (select auth.uid())
    or exists (select 1 from public.profiles p where p.id = (select auth.uid())
      and p.role in ('guidance_head','admin'))
  );

-- ── audit_logs ──
drop policy if exists "audit_select_head_admin" on public.audit_logs;
create policy "audit_select_head_admin"
  on public.audit_logs for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid())
      and p.role in ('guidance_head','admin'))
  );

-- ── staff_messages ──
drop policy if exists "staff_messages_select_scoped" on public.staff_messages;
create policy "staff_messages_select_scoped"
  on public.staff_messages for select to authenticated
  using (
    sender_profile_id = (select auth.uid())
    or recipient_profile_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('guidance_head','admin')
    )
  );

-- insert policy uses profile_role() helper (00057/00058) — only the sender
-- side needs the wrap; helper itself bypasses RLS.
drop policy if exists "staff_messages_insert_staff" on public.staff_messages;
create policy "staff_messages_insert_staff"
  on public.staff_messages for insert to authenticated
  with check (
    sender_profile_id = (select auth.uid())
    and public.profile_role(staff_messages.recipient_profile_id) in ('counselor','guidance_head','guidance_personnel','admin','faculty')
  );

drop policy if exists "staff_messages_update_recipient" on public.staff_messages;
create policy "staff_messages_update_recipient"
  on public.staff_messages for update to authenticated
  using (recipient_profile_id = (select auth.uid()))
  with check (recipient_profile_id = (select auth.uid()));

-- ── workspace_settings (write only) ──
drop policy if exists "workspace_settings_write_head" on public.workspace_settings;
create policy "workspace_settings_write_head"
  on public.workspace_settings for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'guidance_head')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'guidance_head')
  );

-- ── session_note_attachments (+ storage) ──
drop policy if exists "sn_attachments_select_owner_head" on public.session_note_attachments;
create policy "sn_attachments_select_owner_head"
  on public.session_note_attachments for select to authenticated
  using (
    exists (
      select 1 from public.session_notes n
      join public.counselors c on c.id = n.counselor_id
      where n.id = session_note_attachments.note_id
        and c.profile_id = (select auth.uid())
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('guidance_head','admin')
    )
  );

drop policy if exists "sn_attachments_write_owner" on public.session_note_attachments;
create policy "sn_attachments_write_owner"
  on public.session_note_attachments for all to authenticated
  using (
    exists (
      select 1 from public.session_notes n
      join public.counselors c on c.id = n.counselor_id
      where n.id = session_note_attachments.note_id
        and c.profile_id = (select auth.uid())
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('guidance_head','admin')
    )
  )
  with check (
    exists (
      select 1 from public.session_notes n
      join public.counselors c on c.id = n.counselor_id
      where n.id = session_note_attachments.note_id
        and c.profile_id = (select auth.uid())
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('guidance_head','admin')
    )
  );

drop policy if exists "sn_attachments_storage_read" on storage.objects;
create policy "sn_attachments_storage_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'session-note-attachments'
    and (
      exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.role in ('guidance_head','admin')
      )
      or exists (
        select 1 from public.session_notes n
        join public.counselors c on c.id = n.counselor_id
        where n.id::text = split_part(storage.objects.name, '/', 1)
          and c.profile_id = (select auth.uid())
      )
    )
  );

drop policy if exists "sn_attachments_storage_insert" on storage.objects;
create policy "sn_attachments_storage_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'session-note-attachments'
    and (
      exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.role in ('guidance_head','admin')
      )
      or exists (
        select 1 from public.session_notes n
        join public.counselors c on c.id = n.counselor_id
        where n.id::text = split_part(storage.objects.name, '/', 1)
          and c.profile_id = (select auth.uid())
      )
    )
  );

drop policy if exists "sn_attachments_storage_delete" on storage.objects;
create policy "sn_attachments_storage_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'session-note-attachments'
    and (
      exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.role in ('guidance_head','admin')
      )
      or exists (
        select 1 from public.session_notes n
        join public.counselors c on c.id = n.counselor_id
        where n.id::text = split_part(storage.objects.name, '/', 1)
          and c.profile_id = (select auth.uid())
      )
    )
  );

-- ── backup_runs (head/admin only) ──
drop policy if exists "backup_runs_head_only" on public.backup_runs;
create policy "backup_runs_head_only"
  on public.backup_runs for all to authenticated
  using (public.current_user_role() in ('guidance_head','admin'))
  with check (public.current_user_role() in ('guidance_head','admin'));

drop policy if exists "system_backups_head_read" on storage.objects;
create policy "system_backups_head_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'system-backups'
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('guidance_head','admin')
    )
  );

drop policy if exists "system_backups_head_delete" on storage.objects;
create policy "system_backups_head_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'system-backups'
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('guidance_head','admin')
    )
  );

-- ── profiles self-registration (student-only insert) ──
drop policy if exists "profiles_insert_own_student" on public.profiles;
create policy "profiles_insert_own_student"
  on public.profiles for insert to authenticated
  with check (
    id = (select auth.uid())
    and role = 'student'
  );

-- ── guidance_heads directory ──
drop policy if exists "heads_select_staff" on public.guidance_heads;
create policy "heads_select_staff"
  on public.guidance_heads for select to authenticated
  using (
    profile_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('guidance_head','admin','counselor','guidance_personnel')
    )
  );

-- ── device_tokens (own rows only) ──
drop policy if exists "devices_manage_own" on public.device_tokens;
create policy "devices_manage_own"
  on public.device_tokens for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- ── announcement cover images (head writes) ──
drop policy if exists "announcement_images_head_insert" on storage.objects;
create policy "announcement_images_head_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'announcement-images'
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'guidance_head'
    )
  );

drop policy if exists "announcement_images_head_delete" on storage.objects;
create policy "announcement_images_head_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'announcement-images'
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'guidance_head'
    )
  );
