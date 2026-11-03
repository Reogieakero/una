# API Reference

This document is the contract reference for DCAS server code: the privileged Next.js route handlers under `apps/web/app/api/**`, the Postgres RPCs they call, and the shared-service entry points used by both clients. It describes what exists in the repository, not an aspirational API.

**Audience:** web and mobile developers, integration reviewers, QA, and thesis panel members.

**Source of truth:** `apps/web/app/api/**/route.ts`, `packages/shared-services/src/**`, `packages/shared-schemas/src/**`, and `supabase/migrations/*.sql`. There is **no generated OpenAPI document** in this repository. If this document disagrees with the code, the code wins.

**Version:** repository state at the time of writing (November 2026). The API is not versioned in the URL; breaking changes are coordinated by migration and client release.

---

## 1. Scope and conventions

### 1.1 Two write paths

DCAS deliberately has two ways to change data:

| Path | Used for | Authentication |
|---|---|---|
| **Browser Supabase client + shared services** | Ordinary business writes: booking, assignment, confirmation, referral triage, availability, announcements, feedback, chat. | Supabase session cookie (SSR) or mobile session; RLS enforces every row. |
| **Privileged route handler** | Writes the browser cannot perform directly: registration, notifications fan-out, backups, break-glass logging/review/reveal, session-note file access, account status. | Supabase session plus an in-code role re-check; uses the service-role client only after that check. |

The route handlers are **not** a general REST API for the domain. They exist because a table is closed to client writes. Prefer the shared services for anything already supported there.

### 1.2 Request and response format

- Bodies are JSON (`Content-Type: application/json`) unless the route accepts uploads; no route currently accepts `multipart/form-data` at the HTTP layer (attachments are uploaded by the browser client to Storage, then registered by metadata).
- Success bodies are objects. List endpoints wrap arrays in a named key (`{ runs }`, `{ contacts }`).
- Errors use `{ "error": "<human sentence>" }`. Some add detail (`noteId` on a duplicate-note conflict; `unlinked` on a report payload).
- Timestamps are ISO-8601 UTC strings. Dates in report filters are `YYYY-MM-DD`.
- IDs are UUIDs; a malformed UUID is a `400`.

### 1.3 Authentication and authorization

Every handler except the two cron endpoints requires a Supabase session. Authorization is enforced three times:

1. the route reads the caller's `profiles.role` and `is_active`;
2. the documented role allowlist is applied in code;
3. the database query runs under RLS, or under the service-role client after the code check.

A deactivated account receives `403 { "error": "Account deactivated." }` from every guarded route.

### 1.4 Status codes used

| Code | Meaning in this API |
|---:|---|
| `200` | Success. |
| `201` | Created (registration, manual backup). |
| `400` | Validation failed, malformed body, or missing query parameter. |
| `401` | No session. |
| `403` | Wrong role, deactivated account, no active grant, or failed ownership/caseload check. |
| `404` | Referenced row not found or not visible. |
| `409` | Duplicate (email, student number, second session note, already-reviewed grant). |
| `422` | Business rule rejected the request (note before completion, Meet event not reschedulable, attachment cap). |
| `429` | Rate limit. Includes `Retry-After` where implemented. |
| `500` | Unexpected database or provider failure. |
| `503` | Integration not configured (Google Meet, `CRON_SECRET`). |

### 1.5 Route inventory

There are **20 route files** and **27 exported handlers**.

| Area | Method and path | Roles | Purpose |
|---|---|---|---|
| Auth | `POST /api/auth/register` | Public (student); guidance head (staff) | Create an auth user plus profile/role row. |
| Dashboards | `GET /api/dashboard/head` | Guidance head | One-round-trip head dashboard payload. |
| Dashboards | `GET /api/dashboard/counselor` | Counselor | Counselor queue and counts. |
| Dashboards | `GET /api/dashboard/faculty` | Faculty | Own referral summary. |
| Reports | `GET /api/reports/head` | Guidance head | Office-wide aggregates. |
| Reports | `GET /api/reports/counselor` | Counselor | Own-scope aggregates. |
| Reports | `GET /api/reports/faculty` | Faculty | Own-referral list. |
| Reports | `GET /api/reports/digest/cron` | `CRON_SECRET` bearer | Store the scheduled head digest. |
| Appointments | `POST /api/appointments/meet` | Counselor, guidance head | Create a Google Meet event. |
| Appointments | `PATCH /api/appointments/meet` | Counselor, guidance head | Move/update the Meet event. |
| Appointments | `DELETE /api/appointments/meet` | Counselor, guidance head | Remove the Meet link. |
| Notes | `GET /api/session-notes` | Counselor (owner), guidance head | Read a note for one appointment. |
| Notes | `POST /api/session-notes` | Assigned counselor | Create the one note for a completed session. |
| Notes | `PATCH /api/session-notes` | Assigned counselor | Edit a note or its follow-up. |
| Notes | `GET /api/session-notes/attachments` | Counselor (owner), guidance head | List attachment metadata. |
| Notes | `POST /api/session-notes/attachments` | Assigned counselor | Register an uploaded image. |
| Notes | `DELETE /api/session-notes/attachments` | Assigned counselor | Remove an attachment and its object. |
| Chat | `GET /api/chat/contacts` | Faculty, counselor | Narrow office contact directory. |
| Notifications | `POST /api/staff/notify` | Counselor, guidance head, faculty | Insert staff/student notifications. |
| Security | `POST /api/staff/security/log-break-glass` | Counselor, guidance head | Step 1: log emergency access. |
| Security | `POST /api/staff/security/review-break-glass` | Guidance head | Mark a grant reviewed. |
| Security | `POST /api/staff/security/reveal` | Counselor, guidance head | Resolve real identity under a grant. |
| Users | `POST /api/staff/users/status` | Guidance head | Activate or deactivate an account. |
| Backups | `GET /api/admin/backups` | Guidance head | Backup run history. |
| Backups | `POST /api/admin/backups` | Guidance head | Run a backup now. |
| Backups | `GET /api/admin/backups/download?id=` | Guidance head | Signed download URL. |
| Backups | `GET /api/admin/backups/cron` | `CRON_SECRET` bearer | Scheduled backup. |

---

## 2. Auth and account routes

### 2.1 `POST /api/auth/register`

Creates an `auth.users` row and the matching `profiles` row, then the role row (`students`, `counselors`, `faculty_members`, or `guidance_heads`). Any failure rolls the auth user back so no orphan accounts remain.

**Rate limit:** 10 attempts per IP per 10 minutes, in-process memory. Flood responses are `429` with `Retry-After`.

**Two modes:**

| Mode | Caller | Body schema |
|---|---|---|
| Student self-registration | Anonymous | `registerStudentSchema` |
| Staff provisioning | Signed-in `guidance_head` | `registerStaffSchema` |

Student body:

```json
{
  "fullName": "Maria Santos",
  "email": "maria.santos@example.edu",
  "password": "Example123",
  "studentNo": "2026-00123",
  "program": "BS Psychology",
  "yearLevel": "2"
}
```

Staff body adds `role` (`counselor`, `faculty`, or `guidance_head`) and optional `employeeNo`, `department`, `specialization`.

**Responses**

| Status | Body | Meaning |
|---:|---|---|
| `201` | `{ "userId": "<uuid>", "role": "student" }` | Created. |
| `400` | `{ "error": "..." }` | Schema failure or unknown role. |
| `401` / `403` | `{ "error": "..." }` | Staff mode without a head session, or deactivated caller. |
| `409` | `{ "error": "An account with this email already exists." }` or student-number duplicate | Conflict. |
| `429` | `{ "error": "..." }` + `Retry-After` | Rate limited. |
| `500` | `{ "error": "..." }` | Alias generation or unexpected failure. |

**Notes**

- Student emails are created pre-confirmed so students can sign in immediately. This is a deliberate registrar-trust decision, not an email-verification flow.
- The alias (`Client-NNNN`) is generated server-side with a uniqueness retry. See [security-privacy.md](../security/security-privacy.md).
- Mobile registration does not use this route; it signs up directly and inserts its own student row under RLS `00030`, finishing at first login.

---

## 3. Dashboard routes

All three return `Cache-Control: private, max-age=30, stale-while-revalidate=60` and a `fetchedAt` timestamp. They exist to collapse a page's query waterfall into one request; the client still caches with TanStack Query.

### 3.1 `GET /api/dashboard/head`

Guidance head only. Returns:

- KPI counts (students, counselors, open referrals, unread direct messages, and similar);
- `weekChart` from `head_appointment_daily_counts`;
- `statusChart` from `head_referral_status_counts`;
- recent referrals, unassigned appointments, announcements;
- student aliases resolved through `get_student_aliases`, never names.

```json
{
  "weekChart": [{ "day": "2026-10-01", "sessions": 12 }],
  "statusChart": [{ "status": "pending", "count": 4 }],
  "unassignedAppointments": [
    { "id": "<uuid>", "scheduledAt": "...", "status": "pending", "concern": "Academic stress", "studentAlias": "Client-4821" }
  ],
  "fetchedAt": "2026-11-03T10:00:00.000Z"
}
```

The exact key set is defined in the route's exported payload type; treat additional keys as additive.

### 3.2 `GET /api/dashboard/counselor`

Counselor only. Scoped to the caller's `counselors` row: today's sessions, requests awaiting confirmation, assigned referrals, unread messages, sessions missing notes. Counts marked "estimated" use Postgres estimated counts rather than exact scans.

### 3.3 `GET /api/dashboard/faculty`

Faculty only. Scoped to the caller's `faculty_members` row: only referrals that faculty member filed, with status counts and recent activity. Never includes counseling notes, check-in results, or another faculty member's referrals.

---

## 4. Reports routes

### 4.1 Shared query model

Defined in `apps/web/lib/reports-scope.ts`:

| Parameter | Values | Default |
|---|---|---|
| `section` | `all`, `sessions`, `referrals`, `satisfaction`, `wellbeing`, `operations`, `quality` | `sessions` |
| `range` | `7d`, `30d`, `90d`, `all` | `all` |
| `from`, `to` | `YYYY-MM-DD`, inclusive UTC, ordered, span <= 370 days | none |
| `group` | `program`, `year_level`, `college` (head only) | `program` |

Rules:

- A valid `from`/`to` pair wins over `range` and yields `preset: "custom"`.
- Invalid dates or a reversed/oversized window fall back to `range`.
- Appointments filter on `scheduled_at`; referrals, feedback, and screenings filter on `created_at`.
- Sections are loaded selectively. Requesting `section=sessions` does not query referrals or feedback.

### 4.2 `GET /api/reports/head`

Guidance head only. Returns the largest payload:

```json
{
  "section": "all",
  "range": { "preset": "30d", "from": "...", "to": "...", "label": "Last 30 days" },
  "appointments": [],
  "referrals": [],
  "feedback": [],
  "screenings": [],
  "trends": [],
  "cohort": [],
  "quality": {
    "completed_sessions": 120,
    "completed_without_note": 7,
    "screenings_unlinked": 3,
    "referrals_unassigned": 2,
    "feedback_responses": 44,
    "feedback_coverage": 0.37,
    "summary_last_day": "2026-11-02",
    "summary_age_days": 1
  },
  "digest": null,
  "pipeline": { "unassigned": 2, "escalated": 1, "oldestOpenAt": "..." },
  "workload": { "ranked": [], "unassignedSessions": 0 },
  "fetchedAt": "..."
}
```

Aggregates come from `head_appointment_daily_counts`, `head_referral_status_counts`, `head_wellbeing_trends`, `head_cohort_stress`, `head_data_quality`, and `head_report_digest`. Cells smaller than five are suppressed by `apps/web/lib/reports/suppression.ts` before display and export.

### 4.3 `GET /api/reports/counselor`

Counselor only. Scoped to the caller's counselor row:

- appointments where `counselor_id` is the caller;
- referrals where `assigned_counselor_id` is the caller;
- feedback joined through those appointments;
- screenings for students the counselor has seen (booking check-ins carry no appointment link, so the scope is the student id set, not a join).

If the account has no `counselors` row, the route returns a valid empty payload with `unlinked: true` rather than an error.

### 4.4 `GET /api/reports/faculty`

Faculty only. Returns referrals where `referring_faculty_id` is the caller's faculty row, including `classification`, `reason`, `status`, and `created_at`. If no faculty row exists, returns `unlinked: true` with an empty list.

### 4.5 `GET /api/reports/digest/cron`

Scheduled only. Requires `Authorization: Bearer <CRON_SECRET>`.

| Status | Meaning |
|---:|---|
| `200` | `{ "ok": true, ... }`; digest stored via `head_report_digest`. |
| `403` | Wrong or missing bearer token. |
| `503` | `CRON_SECRET` is not configured. |
| `500` | Digest build or insert failed. |

`maxDuration = 60`. There is no user-session path; the service-role client is used because no head is signed in at cron time. The payload is aggregate-only.

---

## 5. Appointment Meet routes

All three methods require counselor or guidance head. A counselor may only act on their own sessions (or referrals assigned to them); the head may act office-wide.

### 5.1 `POST /api/appointments/meet`

**Body** (`appointmentMeetSchema`): exactly one of `appointmentId` or `referralId`, plus optional `scheduledAt`, `endsAt` (ISO with offset).

**Behavior**

- `503` when `GOOGLE_MEET_ENABLED` / Google credentials are absent, with a message telling the caller to paste a link instead.
- Rate limited to 10 requests per IP per 60 seconds; `429` on excess.
- Creates a Calendar event with a **generic title**, no attendees, and no student identity, then stores `meeting_url`, `meeting_provider = "google_meet"`, `meeting_event_id`, and `meeting_created_at`.
- Writes an audit outcome (`created` or failure) without clinical content.

**Success body**

```json
{
  "meetingUrl": "https://meet.google.com/abc-defg-hij",
  "provider": "google_meet",
  "created": true,
  "eventId": "<google-event-id>"
}
```

**Errors:** `400` schema, `401` no session, `403` wrong role/ownership, `404` session or referral not found, `422` state does not allow a Meet event, `429` rate limit, `503` integration disabled, `500` provider failure.

### 5.2 `PATCH /api/appointments/meet`

Moves an existing Google Meet event to a new `scheduledAt` / `endsAt`. Only allowed while the meeting patch policy permits it (`meetingPatchAllowed`). If the session has a manually pasted link, returns the link unchanged with `provider: "manual"`, `created: false`. Audits `patched` or `patch_failed`.

### 5.3 `DELETE /api/appointments/meet`

Deletes the Google Calendar event when the session has a managed event, then clears the local meeting fields. Audits the outcome. If Google is unreachable, the route still detaches locally so the join button disappears; the orphaned event is a documented manual cleanup item.

---

## 6. Session-note routes

Session notes are the most sensitive write surface. See [security-privacy.md](../security/security-privacy.md) and migration `00052`.

### 6.1 `GET /api/session-notes?appointmentId=<uuid>`

| Role | Allowed |
|---|---|
| Assigned counselor | Yes, for their own appointments. |
| **Other counselor** | `403`. |
| Guidance head | Yes, oversight read. |
| Admin | Not listed; `403`. |
| Student | `403`. |

Returns the note (including S.O.A.P. sections when `note_format = "soap"`) and its attachment count. `404` if the appointment is not visible; `400` for a missing or malformed id.

### 6.2 `POST /api/session-notes`

**Body:** `sessionNoteSchema` extended with `followUpRequired` and `followUpAt`.

```json
{
  "appointmentId": "<uuid>",
  "noteFormat": "soap",
  "subjective": "...",
  "objective": "...",
  "assessment": "...",
  "plan": "...",
  "content": "...",
  "followUpRequired": false,
  "followUpAt": null
}
```

**Rules enforced**

- Caller must be a counselor with a `counselors` row. Heads can read but not author.
- The appointment must be assigned to that counselor.
- The appointment must be `completed`; otherwise `422`.
- One note per appointment; a second create returns `409` with `noteId` so the client can switch to edit mode.
- A `soap` note needs at least one non-empty section.
- `content` is 10-10000 characters.
- `followUpAt`, when required, must be inside the counselor's availability. A follow-up conflict is returned as `followUpError` **without** discarding the saved note.
- The note is always private. No audit trigger, no notification, no log contains its text.

### 6.3 `PATCH /api/session-notes`

**Body:** `noteId` plus any of `content`, `noteFormat`, `subjective`, `objective`, `assessment`, `plan`, `followUpRequired`, `followUpAt`.

Ownership and counselor role are re-checked. An amended follow-up is validated like a new one. Removing the follow-up clears the persisted moment and calls off the linked follow-up session where possible. `409` is not used here; `404` means the note is not yours or does not exist.

---

## 7. Session-note attachment routes

Metadata only. Bytes live in the private `session-note-attachments` bucket under `{note_id}/{uuid}.{ext}`.

| Method | Path | Input | Notes |
|---|---|---|---|
| `GET` | `/api/session-notes/attachments?noteId=` | note id | Owner counselor or guidance head. |
| `POST` | `/api/session-notes/attachments` | `{ noteId, storagePath, fileName, mimeType, sizeBytes }` | Counselor owner only. |
| `DELETE` | `/api/session-notes/attachments?attachmentId=` | attachment id | Counselor owner only; deletes the storage object first. |

**Hard caps**

- Maximum **5 images** per note; the sixth returns `422`.
- MIME must start with `image/`; otherwise `400`.
- Maximum **5 MB** per file; otherwise `400`.
- Storage path must begin with the note's folder; otherwise `400`.

The note content itself is never logged or notified. Attachment metadata is private to the owner and the guidance head.

---

## 8. Chat contacts route

### `GET /api/chat/contacts`

Faculty or counselor only. Faculty cannot read other profiles under RLS, so the server resolves the narrow set each role may message.

| Caller | Returned contacts |
|---|---|
| Counselor | Active faculty members (`profileId`, name, role `faculty`). |
| Faculty | Active counselors (with specialization) plus active guidance heads. |

```json
{
  "contacts": [
    { "profileId": "<uuid>", "name": "C. Reyes", "role": "counselor", "detail": "Adolescent counseling" }
  ]
}
```

Only id, name, role, and specialization leave the route. No emails, student rows, or full profiles. Cached privately for 60 seconds.

---

## 9. Notification route

### `POST /api/staff/notify`

Roles: counselor, guidance head, faculty.

**Body**

```json
{
  "to": ["<profile-uuid>"],
  "type": "appointment",
  "title": "Session confirmed",
  "body": "Your session is confirmed.",
  "link": "/sessions",
  "dedupeKey": "appt:<appointment-id>:confirmed:<profile-id>",
  "tone": "success"
}
```

- `to`: up to 500 UUIDs. Empty is allowed only for faculty, whose recipients resolve to active heads.
- `type`: `appointment`, `referral`, `announcement`, `chat`, `assessment`, `system`.
- `title`: 1-200 characters. It is **not trusted verbatim** for sensitive types. `appointment` and `referral` titles are stripped at ` - ` / ` - ` and allowlisted; `chat` is always `"New message"`; anything else becomes `"Appointment update"` / `"Referral update"`.
- `body`: up to 2000 characters. Callers must not put note text, scores, chat bodies, or identifiers in it.
- `link`: must start with `/`.
- `dedupeKey`: up to 200 characters; replays collide on the per-recipient unique key and return `{ "ok": true, "notified": 0, "duplicate": true }`.
- `tone`: `success`, `info`, or `error`.

**Authorization rules**

- Only the guidance head may send `type: "announcement"`.
- Faculty may notify heads, or message counselors/heads/personnel in a `chat` type.
- Counselors and heads may reach students they have a case with (appointment, referral, or thread); the head may reach all active profiles.
- Self-notifications are dropped except for the head.

**Responses:** `200 { ok: true, notified: <n> }`, `400` invalid/empty recipients, `401`, `403`, `500`. Failures are logged as `[dorsu:NOTIFICATION_FAILED]` and never throw back into the caller's business flow.

---

## 10. Security routes

### 10.1 `POST /api/staff/security/log-break-glass`

Step 1 of the break-glass protocol. Body (`breakGlassSchema`): `{ studentId, justification }`, justification >= 20 characters.

- Counselor or guidance head only.
- For a counselor, the student must be on their caseload: an appointment with that counselor or a referral assigned to them.
- Inserts `break_glass_logs` with a default 30-minute expiry. A trigger writes `audit_logs`.
- Returns `{ ok: true, log: {...} }`.

**Errors:** `400` validation, `401`, `403` wrong role or off-caseload, `500` insert failure.

### 10.2 `POST /api/staff/security/review-break-glass`

Guidance head only. Body `{ logId }`.

- `404` unknown event.
- `409` already reviewed.
- Sets `reviewed_by` and `reviewed_at` through the service-role client because the table has no client update policy.
- Returns `{ ok: true }`.

### 10.3 `POST /api/staff/security/reveal`

Counselor or guidance head. Body `{ studentId }`.

Checks, in order:

1. active session;
2. counselor or head role;
3. an unexpired `break_glass_logs` grant for this caller and student;
4. for a counselor only, `reviewed_at` is set (head review);
5. for a counselor only, the student is still on their caseload.

On success it reads identity with the service-role client, writes `audit_logs` with `action = 'break_glass.reveal'` and the grant id, and returns:

```json
{
  "ok": true,
  "identity": {
    "fullName": "...",
    "email": "...",
    "studentNo": "...",
    "program": "...",
    "yearLevel": "...",
    "college": "...",
    "contactNo": "...",
    "alias": "Client-4821"
  },
  "expiresAt": "..."
}
```

`403` messages are intentionally distinct ("No active emergency grant", "Waiting for head review", "Only students from your assigned appointments...") so the UI can guide the user without leaking whether a student exists. `404` means the grant pointed at a missing student.

---

## 11. User status route

### `POST /api/staff/users/status`

Guidance head only. Body `{ userId, isActive }`.

- `400` schema failure, or attempting to change your own status.
- `403` wrong role.
- Updates `profiles.is_active` with the service-role client.
- Writes its own `audit_events` row (`users.activate` / `users.deactivate`) with actor, before/after, and IP, because a service-role write has no `auth.uid()`.
- Best-effort audit: the account change commits even if the audit insert fails, and the failure is logged loudly as `AUDIT_FAILED`.
- Returns `{ ok: true }`.

Deactivation takes effect at the next guarded page load or login check, not mid-request.

---

## 12. Backup routes

### 12.1 `GET /api/admin/backups`

Guidance head only. Returns the newest 100 runs.

```json
{
  "runs": [
    {
      "id": "<uuid>",
      "status": "success",
      "source": "manual",
      "tables": ["profiles", "students"],
      "row_counts": { "profiles": 120 },
      "total_rows": 120,
      "bytes": 84512,
      "checksum": "sha256:...",
      "storage_path": "backups/....json.gz",
      "warnings": [],
      "error": null,
      "initiated_by": "<uuid>",
      "started_at": "...",
      "finished_at": "..."
    }
  ]
}
```

### 12.2 `POST /api/admin/backups`

Guidance head only. Runs a logical backup synchronously: export JSON -> gzip -> checksum -> private bucket -> `backup_runs` row. `maxDuration = 300`.

- `201 { run }` on success.
- `500 { error }` when the run fails; the run row records the failure where possible.

### 12.3 `GET /api/admin/backups/download?id=<uuid>`

Guidance head only. Validates the id, loads the finished artifact, creates a signed URL valid for **1800 seconds**, and writes an audit row (`backup.download`) with actor and IP.

- `400` invalid id, `401`, `403`, `404` artifact unavailable, `500` signing failure.
- `200 { url }`.

### 12.4 `GET /api/admin/backups/cron`

No session. Requires `Authorization: Bearer <CRON_SECRET>`.

- `503` when `CRON_SECRET` is missing.
- `403` when the bearer does not match.
- `200 { run }` on success.
- `500 { error }` on failure.

`maxDuration = 300`. The run is attributed to `system` with source `cron`.

---

## 13. Report and dashboard response stability

These routes return hand-authored payload types, not generated schema objects. Practical rules:

- Additive keys are allowed; removing or renaming a key is a breaking change for the page that consumes it.
- `fetchedAt` is always present on dashboard and report payloads.
- `unlinked: true` is a normal state for a staff account with no role row, not an error.
- Empty arrays are preferred over `null` for collections.
- Suppressed values are `null` or omitted, never `0`, so a consumer cannot mistake privacy suppression for a real zero.

---

## 14. Postgres RPC catalog

The migrations define **37** `public` functions. They fall into five groups.

### 14.1 Identity and access

| Function | Purpose | Migration |
|---|---|---|
| `current_user_role()` | Role lookup for RLS without recursion. | `00022`, `00060`, `00069` |
| `profile_role(pid)` | Role of a given profile. | `00057` |
| `profile_is_student(pid)` | Student check. | `00069` |
| `can_access_student(sid)` | Central identity-access predicate. | `00069` |
| `can_view_profile_avatar(target)` | Avatar visibility rule. | `00066` |
| `is_thread_participant(tid)` | Chat thread membership. | `00060` |
| `guard_profile_privilege()` | Blocks self-escalation on profile writes. | `00030` |

### 14.2 Alias-scoped reads

| Function | Purpose | Migration |
|---|---|---|
| `list_student_directory()` | `/students` feed, alias-level, caseload-scoped. | `00069` |
| `list_emergency_students()` | Emergency picker, alias-only. | `00069` |
| `get_student_aliases(ids)` | Batch alias resolution for boards. | `00069` |
| `get_referral_student(referral_id)` | Limited student facts for a referral. | `00069` |
| `lookup_student_for_referral(student_no)` | Exact faculty lookup, no browse. | `00069` |
| `counselor_directory()` | Counselor names/specializations for faculty chat. | `00049`, `00074` |

### 14.3 Clinical record

| Function | Purpose | Migration |
|---|---|---|
| `get_student_record(student_id)` | Case record header. | `00070` |
| `get_student_record_counts(student_id)` | Counts for the record. | `00070` |
| `get_student_timeline(student_id, ...)` | Month-grouped timeline. | `00070` |

### 14.4 Analytics

| Function | Purpose | Migration |
|---|---|---|
| `head_appointment_daily_counts(...)` | Daily appointment buckets. | `00061` |
| `head_referral_status_counts()` | Referral status buckets. | `00061` |
| `head_wellbeing_trends(...)` | PSS-10 trend aggregates. | `00071` |
| `head_cohort_stress(...)` | Cohort stress aggregates. | `00071` |
| `head_data_quality()` | Completeness metrics. | `00071` |
| `head_report_digest(...)` | Stored digest payload. | `00071` |

### 14.5 Workflow, audit, and scheduling

| Function | Purpose | Migration |
|---|---|---|
| `audit_track()` | Generic audit trigger. | `00045` |
| `log_break_glass_access()` | Break-glass audit trigger. | `00018` |
| `appointment_update_info(id)` | Attribution for an update. | `00064` |
| `appointments_stamp_updated_by()` | Stamps the actor. | `00064` |
| `resolve_appointment_overlaps()` | Slot-overlap guard helper. | `00067` |
| `set_appointment_ends_at()` | Derives the end time. | `00067` |
| `touch_updated_at()` | Generic `updated_at` trigger. | `00062` |
| `bump_chat_thread_on_message()` | Thread ordering. | `00032` |
| `mark_informational_read()` | Bulk notification read. | `00063` |
| `sidebar_counts()` | Badge counts per role. | `00063` |
| `send_session_reminders()` | Reminder fan-out. | `00065` |
| `notify_heads_on_appointment()` | Head fan-out on booking. | `00035`, `00046`, `00063` |
| `notify_staff_on_appointment_update()` | Staff fan-out on status change. | `00043`, `00063` |
| `notify_staff_on_feedback()` | Feedback fan-out. | `00035`, `00063` |
| `notify_on_student_chat_message()` | Chat fan-out. | `00073` |

**Calling convention:** privileged functions are `SECURITY DEFINER` with `set search_path = public` and explicit `grant execute` to `authenticated` (or service role). Clients call them through `supabase.rpc(...)`; the browser never receives the function body. Do not add a `SECURITY DEFINER` function without the same search-path and grant discipline.

---

## 15. Shared-service entry points

These are framework-free functions imported by web and mobile. They accept a `DbClient`, never call `fetch`/`window`/`AsyncStorage`, and are the preferred write path.

### 15.1 Appointments

| Module | Exports |
|---|---|
| `appointments/booking-service.ts` | `isPss10Fresh`, `bookAppointment` |
| `appointments/mutations.ts` | `submitPss10`, `assignAppointment`, `rejectAppointment`, `confirmAppointment`, `completeAppointment`, `cancelAppointment`, `markAppointmentNoShow`, `rescheduleAppointment`, `rescheduleAppointmentByCounselor`, `validateCounselorSchedule`, `validateFollowUpMoment`, `syncFollowUpSession`, `fitsAvailabilitySlot`, `isMissingEndsAtColumn`, `submitFeedback` |
| `appointments/queries.ts` | `listAppointmentPage`, `listStudentAppointments`, `listCounselorAppointments`, `listOfficeAppointments`, `getAppointmentDetail`, `getLatestPss10` |
| `appointments/availability.ts` | `bookableSlots`, `bookableDays` |
| `appointments/pre-session-pss10.ts` | `preSessionPss10State`, `getPreSessionPss10`, `getValidPreSessionPss10`, `isPreSessionPss10Valid`, `isWithinPreSessionSubmitWindow`, `isWithinStudentRescheduleWindow` |
| `appointments/meeting.ts` | `isMeetUrl`, `extractMeetCode`, `buildCounselingMeetEvent`, `parseGoogleMeetLink`, `parseGoogleEventId`, `meetingCreateAllowed`, `meetingPatchAllowed`, `meetingRemoveAllowed`, `isMeetEventExpired`, `meetEventLeaksStudentIdentity` |

### 15.2 Assessments, referrals, chat, notifications, security, analytics, profile

| Module | Exports |
|---|---|
| `assessments/pss10-instrument.ts` | `isPss10Answer` |
| `assessments/pss10-scoring.ts` | `calculatePss10` |
| `referrals/mutations.ts` | `createReferral`, `triageReferral`, `assignReferral`, `rejectReferral`, `confirmReferral`, `confirmReferralWithSession` |
| `referrals/queries.ts` | `listReferralPage`, `getReferralDetail` |
| `referrals/referral-service.ts` | `isReferralOverdue`, `escalateStaleUrgent` |
| `chat/chat-service.ts` | `messageableCounselors`, `listThreads`, `getThreadWithMessages`, `openThread`, `sendMessage` |
| `chat/staff-messages.ts` | `listStaffMessages`, `sendStaffMessage`, `markStaffMessagesRead` |
| `notifications/notification-service.ts` | `createNotification`, `notifyAppointmentChange`, `markNotificationRead`, `markNotificationsRead`, `markAllInformationalRead`, `listNotifications`, `recordDelivery` |
| `security/break-glass-service.ts` | `breakGlassAccess`, `isStudentOnCounselorCaseload`, `reviewBreakGlass` |
| `analytics/analytics-queries.ts` | `getDailySummary`, `getStressOverview` |
| `analytics/suppression.ts` | `isSuppressed`, `suppressCount`, `suppressCohorts` |
| `profile/avatar.ts` | `isExternalAvatar`, `avatarStoragePath`, `signAvatarUrl`, `uploadAvatar`, `removeAvatar`, `setAvatarSharing` |
| `rbac.ts` | `canVisitRoute`, `canPerform`, `homeRouteFor` |
| `platform.ts` | `isUniqueViolation`, `DbClient`, `Clock`, `systemClock` |

All of these are re-exported from `@dorsu/shared-services` (`packages/shared-services/src/index.ts`). Import from the package root, not a deep path, so the export surface stays intentional.

### 15.3 Error behavior

Shared services throw `Error` with user-facing sentences ("That time was just taken - pick another slot."). They do not return `{ error }` objects. The UI catches and renders the message; route handlers translate to HTTP status. Duplicate-key detection uses `isUniqueViolation`, so a Postgres `23505` becomes a friendly conflict rather than a stack trace.

---

## 16. Input contract index

Zod schemas live in `packages/shared-schemas/src` and are the only place a shape should be defined.

| File | Schemas |
|---|---|
| `appointment.schema.ts` | `appointmentModeSchema`, `appointmentStatusSchema`, `createAppointmentSchema`, `appointmentMeetSchema` |
| `auth.schema.ts` | `loginSchema`, `registerStudentSchema`, `registerStaffSchema`, `resetPasswordSchema`, `updatePasswordSchema` |
| `chat.schema.ts` | Chat thread/message input contracts |
| `pss10.schema.ts` | `pss10SubmitSchema` and answer validation |
| `referral.schema.ts` | Referral create/triage/reject contracts |
| `extra.schema.ts` | Break-glass, session-note, feedback, and supporting schemas |

If you add an endpoint, add or reuse a schema here first. A route that parses with an inline object literal has no shared contract and will drift from mobile.

---

## 17. Rate limits and operational limits

| Surface | Limit | Scope | Implementation |
|---|---|---|---|
| `POST /api/auth/register` | 10 requests / 10 minutes | Per IP | In-memory (`lib/rate-limit.ts`), resets per instance |
| `POST /api/appointments/meet` | 10 requests / 60 seconds | Per IP | In-memory |
| Backups (manual, cron) | `maxDuration = 300` | Per invocation | Vercel plan cap |
| Digest cron | `maxDuration = 60` | Per invocation | Vercel plan cap |
| Session-note attachments | 5 images/note, 5 MB each, image MIME | Per note | Route + storage policy |
| Notifications | 500 recipients/request | Per request | Zod |
| Reports | 370-day custom window | Per request | `reports-scope.ts` |
| Booking | One row per idempotency key | Per intent | `UNIQUE(appointments.idempotency_key)` |
| Confirmed slots | No overlap per counselor | Per counselor/time | Exclusion constraint (`00059`, `00067`) |

In-memory limits are a per-instance mitigation, not a distributed quota. A multi-instance deployment needs a shared bucket (for example Upstash Redis); this is a documented follow-up, not an implemented control.

---

## 18. Security boundaries a caller must respect

1. **Never call `createAdminClient()` outside `app/api/**` or server-only code.** It is a service-role key and bypasses RLS.
2. **Re-check role and ownership in code even when using the service client.** RLS does not protect a service-role query.
3. **Do not put clinical content in a notification.** The notification route filters titles, but callers must not put note text or scores in `body`.
4. **Do not log request bodies for note, PSS-10, chat, or reveal routes.** The routes avoid this; middleware and error reporting must too.
5. **Treat a Meet URL as a bearer credential.** It is high-entropy but grants join access to anyone who has it.
6. **Break-glass is not a read shortcut.** A reveal requires a grant, and a counselor also requires head review.
7. **Cron routes are not user endpoints.** They accept only the bearer secret and must stay out of navigation.

See [security-privacy.md](../security/security-privacy.md) for the full control matrix and residual risks.

---

## 19. What this reference does not cover

- **Supabase Auth endpoints** (`/auth/v1/*`) and Storage endpoints. These are platform APIs, configured by Supabase, not defined in this repository.
- **Realtime channels.** The table/channel design and payload rules are documented in `docs/architecture/realtime-audit.md`; this file only notes that payloads carry IDs/status, not content.
- **Google Calendar API.** The server calls it through `apps/web/lib/google/meet.ts`; the provider contract is Google's, and the integration notes are in `docs/operations/google-meet-integration.md`.
- **Database columns and policies.** See [database-diagram.md](./database-diagram.md) and the migrations; this file names only the functions and tables a caller touches.
- **Generated types.** `packages/shared-types/src/database.ts` is hand-maintained; it is not a generated OpenAPI or GraphQL schema.

If a route is added, update this file in the same change: add the row to the inventory, the method section, and any new schema or RPC. A route that exists only in code is invisible to the next reviewer.
