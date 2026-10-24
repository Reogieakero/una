# Objective 3 — Identity RLS and Routine-UI Hardening Plan

**Status:** Proposed  
**Scope:** Targeted RLS/RPC hardening plus routine-UI cleanup  
**Objective 3 verdict after completion:** Substantially achieved  
**Faculty referrals:** Exact student-number lookup only; no browse-all directory

## 1. Objective

Strengthen the "secure anonymous identity" implementation so routine staff workflows are alias-only. Real student identity must require student self-access, privileged oversight access, or an authorized, time-limited, audited break-glass reveal.

This plan does **not** attempt cryptographic anonymity or a zero-knowledge identity vault. Any system that supports break-glass must retain a recoverable identity mapping. The defensible security property is:

> Students are pseudonymous by default. Routine clinical workflows expose only aliases. Real identity is available to the student, to oversight roles where operationally required, and otherwise only through an authorized, time-limited, audited reveal.

### Residual risk

- Service-role and database administrators can still correlate aliases to real identities.
- Referral documents created by faculty are identifying by design.
- Head/admin oversight access remains broader than routine staff access.
- Break-glass grants necessarily preserve a recoverable mapping.

## 2. Current Gap

A normal staff browser session can currently correlate an alias to a real student without break-glass:

1. **`students` RLS** allows every counselor, head, personnel, admin, and faculty member to select all student rows, including `student_no`, `program`, `college`, `contact_no`, and `profile_id`.
2. **`profiles` RLS** allows counselor/head/personnel/admin to read all profiles, including student `full_name` and `email`. The correlation chain is:
   `appointments.student_id -> students.profile_id -> profiles.full_name/email`.
3. **Routine UIs expose identity fields**:
   - `/students` renders `student_no` and program/year despite claiming alias-only behavior.
   - `/emergency` lists `alias · student_no`.
   - The faculty referral picker loads up to 200 real student rows.

The problem is ambient re-identification, not missing cryptography.

## 3. Field Policy

### Identity fields

These must not be available through routine staff queries:

- `students.student_no`
- `students.contact_no`
- `students.profile_id`
- student `profiles.full_name`
- student `profiles.email`

### Alias-level fields

These may be exposed through authorized directory/RPC paths:

- `students.id`
- `students.anonymous_alias`
- `students.program`
- `students.year_level`
- `students.college`
- `students.created_at`
- Workload aggregates derived from appointments, referrals, screenings, and chat

### Legitimate exceptions

- **Student self-access:** a student may read their own `students` and `profiles` rows.
- **Oversight access:** `guidance_head` and `admin` may retain broader row access for oversight. Identity should still be surfaced only in dedicated oversight/security screens, not routine boards.
- **Faculty referral creation:** faculty may resolve an exact `student_no` match for referral creation. Referral documents remain identifying by design.
- **Break-glass reveal:** the existing reveal API remains the only path to full identity for counselors, subject to grant, review, caseload, expiry, and audit requirements.

## 4. Implementation Phases

### Phase 0 — Threat model and field policy

Create `docs/anonymity-threat-model.md` documenting:

- identity fields versus alias-only fields;
- student self-access, oversight access, faculty referral creation, and break-glass exceptions;
- residual risks from service-role/database access and recoverable break-glass mappings;
- the explicit non-claim: this is pseudonymity with audited re-identification, not cryptographic anonymity.

**Estimated effort:** 0.25 day.

### Phase 1 — Migration `00069_identity_rls_hardening.sql`

Add a non-destructive RLS/RPC migration:

- Restrict `profiles_select_staff` so counselor/head/personnel cannot read student profiles.
- Keep `admin` access to all profiles.
- Restrict `students` select to:
  - the student's own row;
  - `guidance_head` and `admin` oversight access.
- Remove blanket counselor/faculty access to all student rows.
- Use SECURITY DEFINER authorization helpers where needed. Avoid policies that query `profiles` from `students` and vice versa without a helper, because that can reintroduce RLS recursion.
- Add an alias-level directory RPC:
  - `list_student_directory()`
  - `guidance_head`/`admin`: all students;
  - `counselor`: caseload only, derived from assigned appointments, referrals, and chat participation;
  - `guidance_personnel`: alias-level directory as operationally required;
  - `faculty`: no directory access;
  - returns `id, anonymous_alias, program, year_level, college, created_at`;
  - does not return `student_no`, `profile_id`, or `contact_no`.
- Add a faculty referral lookup RPC:
  - `lookup_student_for_referral(student_no)`;
  - faculty only;
  - exact match only;
  - minimal return fields;
  - no enumeration or browse-all behavior.
- Add a scoped alias-resolution RPC if routine appointment/chat/report reads still need aliases after student RLS is tightened. Restrict it to records the caller can already access.
- Keep the existing reveal API as the only path to full identity for counselors.

**Estimated effort:** 0.5–1 day.

### Phase 2 — Client migration and UI cleanup

- Audit every routine `.from("students")` read and migrate it to the directory, alias-resolution, or referral-lookup RPC as appropriate.
- `/students`:
  - display alias, program/year/college, and workload aggregates;
  - remove `student_no` from the table and search;
  - do not expose `profile_id`;
  - keep identity access out of the routine board, including for head/admin.
- `/emergency`:
  - search by alias only;
  - show identity only after a successful break-glass reveal.
- `/referrals`:
  - counselor/head use alias-based views;
  - faculty use exact student-number lookup instead of the 200-row student picker;
  - referral documents remain identifying by design because faculty explicitly create them.
- Verify appointments, chat, reports, realtime, feedback, and notifications remain alias-only.
- Remove student numbers and names from routine page copy where they imply a directory.

**Estimated effort:** 1–1.5 days.

### Phase 3 — Break-glass verification

- Preserve grant, head review, caseload, expiry, and audit behavior.
- Add tests proving reveal is denied when:
  - there is no active grant;
  - counselor review is missing;
  - the student is off the counselor's caseload.
- Confirm every reveal writes `audit_logs`.
- Keep real names out of audit metadata.
- Head alerting remains Objective 9 scope.

**Estimated effort:** 0.5 day.

### Phase 4 — Verification and report updates

#### RLS tests

Add coverage in `tests/rls/rls.test.ts`:

- counselor/faculty cannot select another student's `students` or student `profiles` row;
- head/admin can;
- directory RPC returns aliases only and respects caseload;
- faculty referral lookup cannot enumerate;
- reveal without a valid grant or review is denied.

#### Playwright tests

Add coverage in `e2e/specs/counselor.spec.ts`:

- counselor boards and `/students` show no student numbers or names;
- emergency reveal still works after grant/review;
- routine pages contain no student name, email, or contact information.

#### Report

Update `Objective_Achievement_Report.md`:

- update §1.6 and the Objective 3 row;
- replace the vague caveat with the precise security property and residual-risk statement;
- keep the verdict at **Substantially achieved**.

**Estimated effort:** 0.5 day.

## 5. Acceptance Criteria

- Routine staff browsers cannot obtain `student_no`, student `contact_no`, or student `full_name/email` without break-glass or oversight access.
- Faculty can create referrals only by exact student-number lookup.
- Alias-based boards continue to work for appointments, chat, reports, and emergency workflows.
- Break-glass remains audited and time-limited.
- The report claims pseudonymity with audited re-identification, not cryptographic anonymity.
- RLS and Playwright tests cover identity isolation and the reveal flow.

## 6. Affected Files

### Migrations and security

- `supabase/migrations/00022_profiles_rls_recursion_fix.sql`
- `supabase/migrations/00060_phase2_rls_auth_uid_opt.sql`
- `supabase/migrations/00069_identity_rls_hardening.sql` (new)
- `apps/web/app/api/staff/security/reveal/route.ts`
- `packages/shared-services/src/security/break-glass-service.ts`

### Routine student reads and UI

- `apps/web/lib/hooks/use-students-board.ts`
- `apps/web/lib/hooks/use-emergency-board.ts`
- `apps/web/lib/hooks/use-referrals-board.ts`
- `apps/web/lib/hooks/use-appointments-board.ts`
- `apps/web/lib/hooks/use-chat-board.ts`
- `apps/web/components/students/StudentTable.tsx`
- `apps/web/components/referrals/ReferralFormModal.tsx`
- `apps/web/components/referrals/ReferralExcelModal.tsx`
- `apps/web/app/(staff)/students/page.tsx`
- `apps/web/app/(staff)/referrals/page.tsx`

### Tests and documentation

- `tests/rls/rls.test.ts`
- `e2e/specs/counselor.spec.ts`
- `docs/anonymity-threat-model.md` (new)
- `Objective_Achievement_Report.md`

## 7. Estimated Total

**3–4 engineering days**, mostly client migration and test coverage.

## 8. Out of Scope

- Cryptographic envelope encryption or a zero-knowledge identity vault.
- Moving identity data into a separate vault table.
- Head alerting for break-glass events (Objective 9).
- Destructive data migrations.
