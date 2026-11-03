# Anonymity Threat Model — Students, Aliases, and Break-Glass

**Scope:** the staff/admin portal, Supabase RLS, and the identity-reveal API.
**Status:** implemented by migration `00069_identity_rls_hardening.sql`
(applied to the linked Supabase project on 24 October 2026).
**Claim:** pseudonymity by default with audited re-identification — **not**
cryptographic anonymity. The achievement report treats this property as
satisfying Objective 3's anonymous-identity requirement; the residual risks
below are accepted design limits, not unimplemented controls.

## 1. Security property

> Students are pseudonymous by default. Routine clinical workflows expose only
> aliases. Real identity is available to the student, to oversight roles where
> operationally required, and otherwise only through an authorized,
> time-limited, audited reveal.

Any system that supports break-glass must keep a recoverable alias → identity
mapping. The goal is therefore to make ambient re-identification impossible
for routine staff, not to make re-identification mathematically impossible.

## 2. Identity versus alias-level fields

**Identity fields (never returned by routine staff reads):**

- `students.student_no`
- `students.contact_no`
- student `profiles.full_name`
- student `profiles.email`
- `students.profile_id` as an identity resolver (see §5)

**Alias-level fields (allowed through scoped RPCs):**

- `students.id`
- `students.anonymous_alias`
- `students.program`, `students.year_level`, `students.college`
- `students.created_at`
- Workload aggregates derived from appointments, referrals, screenings, and chat

## 3. Trust boundaries

| Boundary | Control |
|---|---|
| Student → own record | `students_select_own_or_oversight` and `profiles_select_own` allow the owner's row. |
| Routine staff → student rows | **Denied.** `students` is readable only by the owner and `guidance_head`/`admin` oversight. |
| Routine staff → student profiles | **Denied.** `profiles_select_staff` limits counselor/personnel reads to non-student profiles; faculty has no staff profile read. |
| Counselor → caseload aliases | `list_student_directory()` and `get_student_aliases()` scope to sessions, assigned referrals, and chat threads. |
| Faculty → referral creation | `lookup_student_for_referral(student_no)` is exact-match only; no browse, prefix, or wildcard lookup. |
| Head/admin oversight | Broad row access remains; routine boards still render aliases only. |
| Counselor → real identity | `POST /api/staff/security/reveal` only: active grant, head review, caseload check, expiry, and an `audit_logs` row. |
| Service role / DB admin | Out of scope for RLS. These principals can always correlate records. |

## 4. Attack paths closed by `00069`

1. **Ambient correlation.** A counselor could previously select all `students`
   rows (`student_no`, `profile_id`) and all student `profiles` rows
   (`full_name`, `email`), joining `appointments.student_id →
   students.profile_id → profiles`. Both table reads are now denied for routine
   staff.
2. **Emergency directory leak.** `/emergency` listed `alias · student_no`.
   It now uses the alias-only directory RPC.
3. **Faculty browse-all picker.** The referral form loaded up to 200 real
   student rows. It now performs one exact student-number lookup.
4. **Reports/dashboards/chat/realtime alias joins.** These now call
   `get_student_aliases(ids)`, which returns rows only for students the caller
   can already reach.

## 5. `profile_id` as a routing key

`get_student_aliases()` returns `students.profile_id` solely so notification
calls can address the student's inbox. It is an opaque UUID, and the profiles
RLS above prevents routine staff from resolving it to a name or email. It is
not treated as an alias-level display field.

## 6. Residual risks (accepted or out of scope)

- **Service role and database administrators** can correlate aliases. This is
  inherent to a recoverable break-glass design.
- **Referral documents are identifying by design.** Faculty type the student's
  name and number on the official form; `get_referral_student()` exposes the
  linked number/programme to the creator, assignee, and head so the document
  can be completed.
- **Head/admin oversight access is broader** than routine staff access.
- **Self-identification** in chat, notes, or free text cannot be prevented.
- **No alias rotation or retention policy** is implemented.
- **No penetration test** has been run.

## 7. Explicit non-claims

- This is not zero-knowledge or end-to-end encryption.
- Identity is not moved into a separate vault.
- The database still stores a recoverable mapping for break-glass.
- Audit metadata must never contain real names, student numbers, or clinical
  content.
