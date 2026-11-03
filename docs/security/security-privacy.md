# Security and Privacy

This document describes how DCAS protects student identity, clinical records, chat, referrals, and audit evidence, and it names the limits honestly. Every control points to the file, migration, or route that enforces it.

**Audience:** thesis panel, security reviewer, guidance head, developers, and data-protection officers.

**Core claim:** students are **pseudonymous by default** with **audited, time-limited re-identification**. This is not mathematical anonymity, zero-knowledge storage, or end-to-end encryption. The alias-to-identity mapping exists in the same database so break-glass can work.

---

## 1. Security properties at a glance

| Property | Status | Evidence |
|---|---|---|
| Alias-first staff workflows | Implemented | `00069_identity_rls_hardening.sql`; `list_student_directory`, `get_student_aliases` |
| Routine staff cannot read student identity rows | Implemented | `students_select_own_or_oversight`; `profiles_select_staff` |
| Faculty exact-number lookup only | Implemented | `lookup_student_for_referral(text)` |
| Time-limited break-glass grant | Implemented | `break_glass_logs.expires_at`, default `now() + 30 minutes` (`00027`) |
| Justification required | Implemented | `break_glass_logs` check `>= 20` characters; Zod `breakGlassSchema` |
| Head review before counselor reveal | Implemented | `/api/staff/security/reveal`; `reviewed_at` gate |
| Caseload scope for counselor | Implemented | `isStudentOnCounselorCaseload`; reveal route re-check |
| Every break-glass step audited | Implemented | `trg_break_glass_audit`; reveal route inserts `audit_logs` |
| Append-only audit trail | Implemented with limits | `00018`, `00045`; no update/delete policies |
| Session-note privacy | Implemented | `00052`; private attachment bucket; API ownership checks |
| Chat participant-only access | Implemented | `is_thread_participant`; `00037`; `00074` |
| Small-cell suppression | Implemented | `MIN_CELL = 5`; `suppression.ts` |
| Field-level encryption of notes/PSS-10 | **Not implemented** | Plain text columns at rest; platform disk encryption only |
| Alias rotation / alias history | **Not implemented** | One alias per student; no rotation table or job |
| Automated retention/deletion | **Not implemented** | No retention job or purge policy in migrations |
| External penetration test | **Not run** | No report in the repository |
| Automatic alert to the head on break-glass | **Not implemented** | The head sees unreviewed entries in `/security` |

---

## 2. Identity and anonymity model

### 2.1 The alias

- Each student gets one alias in the form `Client-NNNN` (for example, `Client-4821`).
- Web registration generates it in `apps/web/app/api/auth/register/route.ts`; the mobile bootstrap generates it in `apps/mobile/lib/supabase/ensureStudent.ts`.
- The alias is stored in `students.anonymous_alias` with a uniqueness constraint (`00020`, `00002`).
- The alias is the routine display name in appointment boards, session lists, the student directory, chat, feedback, reports, dashboards, emergency pickers, and notification titles.
- There is no alias rotation, alias history, or per-counselor alias. The same alias follows the student across sessions and referrals.

### 2.2 Identity fields

These fields are identity, not alias-level data:

- `students.student_no`
- `students.contact_no`
- student `profiles.full_name`
- student `profiles.email`
- `students.profile_id` as a resolver (returned only as an opaque notification routing key)

Routine staff must not receive these through ordinary reads. After `00069`:

- `students` is selectable only by the owning student and by `guidance_head`/`admin` oversight.
- `profiles` selectable by staff is limited to non-student profiles; counselors and guidance personnel can resolve staff names, not student names.
- Counselors get alias-level data through scoped, `SECURITY DEFINER` RPCs.
- Faculty get one exact student-number match through `lookup_student_for_referral`, with no browse, prefix, or wildcard mode.

### 2.3 Which code may join back to identity

Only these paths may resolve a real identity:

| Path | Who | Control |
|---|---|---|
| Student's own session | The student | `students_select_own_or_oversight` |
| Head/admin oversight reads | Guidance head, admin | RLS role check; boards still render aliases |
| Break-glass reveal | Counselor or head with an active grant | Grant, review, caseload, expiry, audit |
| Referral document | Creator, assignee, head | `get_referral_student` returns number/program, not full name/email |
| Service-role route | Server code | Must re-check caller role and ownership in code |

### 2.4 Why this is pseudonymity, not anonymity

The mapping `students.id -> students.profile_id -> profiles.id` exists in the same database. A database administrator, a service-role key holder, or a successful break-glass action can correlate an alias to a person. The guarantee is narrower and testable: a normal staff browser session cannot see identity without an authorized, logged action.

Residual correlation risks:

- program, year level, college, schedule, and counselor assignment can narrow a small cohort;
- free text in chat, notes, or referrals can self-identify the student;
- referral documents are identifying by design;
- the head/admin oversight role is broader than a counselor's caseload.

---

## 3. Break-glass protocol

### 3.1 The sequence

1. **Log access.** A counselor or the guidance head inserts a `break_glass_logs` row with `student_id` and a justification of at least 20 characters. `expires_at` defaults to 30 minutes after `accessed_at` (`00017`, `00027`).
2. **Caseload check.** For a counselor, the student must be on their caseload: an assigned appointment, an assigned referral, or a chat thread. The check runs in the API route and again at reveal.
3. **Audit.** An `AFTER INSERT` trigger appends an `audit_logs` row with `action = 'break_glass.access'`, the student id, and a truncated justification (`00018`).
4. **Review.** The guidance head reviews the event in `/security`. Review writes `reviewed_by` and `reviewed_at` through a head-only route, because the table has no client update policy.
5. **Reveal.** `POST /api/staff/security/reveal` checks: active account; counselor or head role; an unexpired grant for that student; for a counselor, a completed review; for a counselor, caseload. It then reads the student's identity with the service-role client and writes its own `audit_logs` row.
6. **Expiry.** After 30 minutes the grant no longer authorizes a reveal. A new emergency requires a new log and a new review.

### 3.2 What the head sees

`/security` lists break-glass logs with the accessor, alias, justification, time, expiry, and review state. `/security/events` shows the broader `audit_events` trail.

There is **no automatic push alert** to the head when a grant is logged. The head must open the console. This is a documented limitation, not a hidden control.

### 3.3 What each audit row contains

| Field | Break-glass `audit_logs` | General `audit_events` |
|---|---|---|
| Actor | `actor_profile_id` | `actor_profile_id`, `actor_role` |
| Action | `break_glass.access` or reveal | `<entity>.<operation>[:<status>]` |
| Entity | `students` plus student id | Entity name and id |
| Reason | Justification, truncated to 200 characters | Optional `reason` |
| Before/after | Not applicable | Watched columns only |
| Clinical content | Never | Never; message bodies and note text are excluded |
| IP / request id | Not in the log path | Available columns, used by some admin routes |
| Update/delete | No policy | No policy |

### 3.4 What break-glass does not protect

- It does not stop a database administrator or a service-role key from reading identity directly.
- It does not prevent an authorized counselor from misusing a legitimate reveal.
- It does not encrypt the revealed identity in transit beyond TLS.
- It does not alert the head in real time.

---

## 4. Role-based access control

### 4.1 Enforcement layers

DCAS checks access at four layers, and a request must pass all that apply:

1. **Layout guard** - `apps/web/app/(staff)/layout.tsx` calls `requireRole([...])`; `(admin)` requires `guidance_head`.
2. **Page checks** - pages redirect or hide actions for the wrong role.
3. **RBAC policy** - `packages/shared-services/src/rbac.ts` defines `routePolicy`, `actionPolicy`, `canVisitRoute`, `canPerform`, and `homeRouteFor`.
4. **Row Level Security** - the database policies are the final boundary; the browser's role checks are UX, not security.
5. **Privileged route re-check** - every `app/api/**` handler that uses the service-role client re-checks the caller's role and ownership in code.

### 4.2 Capability matrix

| Capability | Student | Counselor | Guidance head | Faculty | Admin |
|---|---|---|---|---|---|
| Student mobile app | Yes | No | No | No | No |
| Web portal | No | Yes | Yes | Yes | Limited (`/settings`) |
| Book / cancel own session | Yes | No | No | No | No |
| Submit check-in / feedback | Yes | No | No | No | No |
| Assign or reject appointment | No | No | Yes | No | No |
| Confirm / complete / no-show | No | Yes | No (oversight) | No | No |
| Reschedule | Own | Own caseload | No | No | No |
| Manage availability | No | Yes | Read | No | No |
| View alias directory | No | Caseload | Office-wide | No | No |
| Write session notes | No | Assigned only | No authoring | No | No |
| Read session notes | No | Own notes | Oversight | No | No |
| Create referral | No | No | Yes | Yes | No |
| Assign / reject referral | No | No | Yes | No | No |
| Confirm / resolve / escalate referral | No | Yes | No | No | No |
| Publish announcement | No | No | Yes | No | No |
| View analytics | Own sessions (mobile) | Own scope | Office-wide | Own referrals | No |
| Break-glass log / reveal | No | Yes, caseload | Yes | No | No |
| Review break-glass | No | No | Yes | No | No |
| Manage users / backups | No | No | Yes | No | No |

Notes:

- `guidance_personnel` exists in the role type but has no route or action policy entry in this revision.
- The `admin` role is narrow: it enters the staff shell and `/settings`; it cannot run the office.
- Route access and action access differ. The head can open `/availability` but cannot manage slots through the counselor action.
- The sidebar hides links, but hidden links are not the boundary; `rbac.ts`, the layout guard, and RLS are.

### 4.3 Known RBAC inconsistencies

These are documented, not fixed, because this task is documentation-only:

- `rbac.ts` lists `/analytics`, `/resources`, and `/appointments/new`; no pages exist.
- `/emergency`, `/students/[id]`, and `/update-password` are real routes but absent from the `AppRoute` union.
- The `canVisitRoute` implementation is an exact lookup, while a comment describes prefix matching.
- `routePolicy` excludes `admin` from `/notifications`, but the page has no explicit redirect; the bell can open it.

See [ui-sitemap.md](../ux/ui-sitemap.md) for the full list.

---

## 5. Data protection

### 5.1 In transit

- Web traffic is served by Vercel over HTTPS.
- Mobile and web talk to Supabase over HTTPS/TLS.
- Google Calendar API calls are server-to-server with OAuth tokens; the refresh token never reaches the browser or the app.
- Realtime uses Supabase's secure WebSocket connection.

### 5.2 At rest

| Data | Storage | Protection |
|---|---|---|
| Profiles, students, appointments, PSS-10, notes, referrals, chat | Supabase Postgres | Platform disk encryption; RLS; no application-level field encryption |
| Session-note images | Private `session-note-attachments` bucket | Private bucket + storage policies; signed URLs |
| Announcement images | Public `announcement-images` bucket | Intentionally public for display; head-only writes |
| Backups | Private `system-backups` bucket | Gzipped JSON, sha256 checksum, head-only signed download, audit-logged |
| Meet links | `appointments.meeting_url` | Plain text column; bearer-style link |
| Google credentials | Server environment variables | Server-only; never in `NEXT_PUBLIC_*` or the client bundle |
| Supabase service key | Server environment | Server-only; only `app/api/**` may import the admin client |

### 5.3 What is not encrypted at the application layer

- Session-note bodies (`session_notes.content`, S.O.A.P. sections).
- PSS-10 answers and scores.
- Chat message bodies.
- Student identity fields and the alias mapping.
- Meet URLs.

The Prisma dictionary comment may imply note encryption; no encryption code exists. Treat notes as plain text protected by RLS, private storage, and platform disk encryption only.

### 5.4 Key handling

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are client-visible by design.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only; any handler using it must re-check the caller.
- `CRON_SECRET` protects `/api/admin/backups/cron` and `/api/reports/digest/cron`.
- Google `GOOGLE_CLIENT_SECRET` and `GOOGLE_REFRESH_TOKEN` are server-only; `GOOGLE_MEET_ENABLED` gates the route.
- There is no documented key-rotation schedule or secrets manager integration; rotation is manual.

### 5.5 Retention and deletion

| Item | Current behavior | Gap |
|---|---|---|
| Student account | Can be deactivated by the head | No self-service deletion; no automated purge |
| Session notes | Kept indefinitely | No retention job or legal-hold policy |
| PSS-10 rows | Kept indefinitely | No retention policy |
| Chat messages | Kept indefinitely | No retention or expiry |
| Break-glass logs | Append-only | No purge; no archival job |
| Backups | Runs accumulate; head prunes deliberately | No automatic retention tier |
| Audit events | Append-only | No purge; no WORM storage |

There is **no documented retention schedule** in the repository. The institution must define one before production use. Any future purge must preserve audit/legal-hold requirements and must not silently delete referenced records.

### 5.6 Backups and recovery

The backup runbook is in [backup-restore.md](../operations/backup-restore.md). Security-relevant points:

- Backups are head-triggered or nightly cron; both require the correct role or `CRON_SECRET`.
- Downloads are head-only, short-lived, and audit-logged.
- Artifacts exclude `auth.users` and storage bytes; restore recreates auth users first, then upserts in FK order.
- Restore is deliberately not a button.
- An untested backup is not a recovery plan; the runbook requires quarterly staging drills.

---

## 6. Threat model

The table lists the threat, the control, the residual risk, and the evidence.

### 6.1 Insider snooping

- **Threat:** a counselor, faculty member, or personnel account browses student identity or notes outside a case.
- **Control:** alias-only RPCs; RLS denies routine `students`/student `profiles` reads; notes are owner + head/admin; faculty see only their own referrals.
- **Residual:** head/admin oversight is broad; a curious head can read notes. Service-role compromise bypasses RLS.
- **Evidence:** `00069`, `00052`, `00037`, `00060`.

### 6.2 Alias correlation

- **Threat:** staff correlate an alias with a person using program, year, schedule, chat, or referral context.
- **Control:** only alias-level fields in routine views; emergency picker returns aliases only; no student numbers in routine lists.
- **Residual:** small cohorts and free text can identify; no alias rotation; the mapping is in one database.
- **Evidence:** `00069`, anonymity threat model.

### 6.3 Referral leakage

- **Threat:** a faculty member reads another faculty member's referral, or a counselor reads an unassigned referral.
- **Control:** RLS scopes referrals to the creator, assignee, and head; `get_referral_student` is limited to those parties; faculty reports are own-referral only.
- **Residual:** referral documents are identifying by design and may contain typed names, numbers, and sensitive context; export files can leave the system.
- **Evidence:** `00015`, `00033`, `00038`, `00039`, `00040`, `00069`.

### 6.4 Chat interception

- **Threat:** a non-participant reads a thread, a realtime payload leaks message text, or a service-role bug exposes all messages.
- **Control:** participant-only RLS (`is_thread_participant`); realtime payloads carry IDs/status, not bodies; notifications carry generic titles; service-role route access is limited.
- **Residual:** no end-to-end encryption; a service-role key or database administrator can read messages; self-identification in messages is possible.
- **Evidence:** `00011`, `00012`, `00037`, `00073`, `00074`, `chat-service.ts`.

### 6.5 Meet link guessing or leakage

- **Threat:** an unauthorized person obtains a Meet URL and joins a counseling session.
- **Control:** Google Meet codes are high-entropy; the link is only shown on the appointment to participants; the calendar event has a generic title, no attendees, and no student identity; there is a unit test that fails if identity fields enter the event.
- **Residual:** a Meet link is a bearer credential; anyone with the URL can attempt to join; the link is stored in plain text; there is no per-session waiting room or PIN in the application.
- **Evidence:** `/api/appointments/meet`, `meeting.ts`, `meeting.test.ts`, `00072`, `docs/operations/google-meet-integration.md`.

### 6.6 Analytics re-identification

- **Threat:** a report reveals an individual from a small cohort or from differencing two queries.
- **Control:** aggregate RPCs return counts and bands, not student ids; `MIN_CELL = 5` suppresses small cells before display and export; counselor and faculty reports are scoped.
- **Residual:** repeated queries with different filters can sometimes narrow a group; suppression is a threshold, not differential privacy; free-text feedback comments can identify.
- **Evidence:** `00061`, `00071`, `suppression.ts`, `/api/reports/head`.

### 6.7 Audit tampering

- **Threat:** an actor changes or deletes the record of their action.
- **Control:** `audit_logs` and `audit_events` have no client update/delete policies; triggers write in the same transaction as the business write; the security console is head-only; backups include audit tables.
- **Residual:** a database administrator or service-role caller can alter rows; there is no WORM storage or external log sink; the backup itself is not immutable.
- **Evidence:** `00018`, `00045`, `00052`, `00056`, `/api/staff/users/status`.

### 6.8 Clinical-content leakage through notifications

- **Threat:** a notification carries a student alias, concern, note text, score, or chat body to the wrong person.
- **Control:** `/api/staff/notify` normalizes appointment, referral, and chat titles, drops free text for sensitive types, limits recipients to reachable people, and deduplicates. Note content is never notified.
- **Residual:** a generic title still reveals that an event happened; the recipient list may be broader than necessary for non-sensitive announcement types.
- **Evidence:** `apps/web/app/api/staff/notify/route.ts`, `notification-service.ts`, `00063`.

### 6.9 Credential and session threats

- **Threat:** stolen service key, leaked Google refresh token, or a shared staff browser session.
- **Control:** service key server-only; Google token server-only; Supabase SSR cookies; deactivation checked at guard time; admin status route cannot change your own account.
- **Residual:** no MFA requirement is enforced by the application; no device management; a signed-in shared browser stays signed in until logout or expiry.
- **Evidence:** `apps/web/lib/supabase/*`, `apps/web/lib/auth/guard.ts`, `/api/staff/users/status`.

### 6.10 Availability and abuse

- **Threat:** registration flooding, brute-force sign-in, or a booking race.
- **Control:** per-IP registration rate limit (10 attempts / 10 minutes, per instance); Supabase auth rate limits; slot exclusion constraint; idempotency keys.
- **Residual:** in-memory rate limits reset per instance and are not a distributed bucket; no CAPTCHA; no WAF rule documented.
- **Evidence:** `apps/web/app/api/auth/register/route.ts`, `lib/rate-limit.ts`, `00059`, `00021`.

---

## 7. Audit requirements

### 7.1 What is audited

| Event | Table | Trigger/source |
|---|---|---|
| Break-glass access | `audit_logs` | `trg_break_glass_audit` |
| Break-glass reveal | `audit_logs` | Reveal route |
| Appointment insert/status/assignment/reschedule/Meet change | `audit_events` | `audit_appointments` |
| Referral status/assignment/priority | `audit_events` | `audit_referrals` |
| Chat message send (metadata only) | `audit_events` | `audit_chat_messages` |
| Staff DM send (metadata only) | `audit_events` | `audit_staff_messages` |
| Announcement create/update/delete | `audit_events` | `audit_announcements` |
| Availability add/remove | `audit_events` | `audit_availability` |
| Account status change | `audit_events` | `/api/staff/users/status` |
| Backup download | `audit_events` | Download route |
| PSS-10 waiver | `audit_logs` | `completeAppointment` |

### 7.2 What is deliberately not audited

- Session-note content or note saves (no trigger; content is private clinical record).
- PSS-10 answers or scores.
- Chat message bodies.
- Notification inserts.
- Read receipts.
- Feedback content.

### 7.3 Append-only rules

- `audit_logs`: select for head/admin; insert allowed for authenticated services; **no update or delete policy**.
- `audit_events`: select for head/admin; rows arrive through `SECURITY DEFINER` triggers and the service role; **no insert/update/delete policy** for clients.
- `break_glass_logs`: insert for counseling staff; select for the accessor or head/admin; review is a service-role route; **no client update/delete**.
- Corrections are new rows, not edits.

### 7.4 Review cadence

There is no automated review SLA in the code. Recommended operating practice:

- review unreviewed break-glass grants at least daily;
- review the `audit_events` trail weekly for unusual status changes;
- verify backup downloads and failed download attempts monthly;
- run the restore drill quarterly;
- review account deactivations when staff leave.

These are recommendations, not enforced controls. The repository contains no scheduler for review.

---

## 8. Compliance notes

This section is not legal advice. It names the controls that a Philippine Data Privacy Act (RA 10173) review would likely ask about, and states what exists.

| Topic | Current state | Action needed before production |
|---|---|---|
| Lawful basis and notice | No in-app privacy notice or consent capture module | Add a privacy notice and record consent before collecting clinical data |
| Consent for sensitive data | No consent table; only the photo-sharing toggle | Add explicit consent capture with version and timestamp |
| Minor consent | No age gate or guardian-consent flow | Define policy and implement if minors are served |
| Data subject access | No self-service export | Add an access-request procedure or export |
| Erasure | No self-service deletion; head deactivation only | Define retention and erasure rules that preserve audit/legal holds |
| Retention schedule | Not implemented | Define per-table retention, archival, and purge |
| Breach notification | No incident runbook in the repo | Add an incident response and notification procedure |
| Processor agreements | Supabase, Vercel, Google are processors | Confirm institutional agreements and region/data-location choices |
| Audit retention | Kept indefinitely; no WORM | Define retention and tamper-evidence requirements |
| Access review | Head can deactivate accounts | Add periodic access review evidence |

**Do not claim full DPA compliance.** The system has strong access controls and an audit trail, but it lacks formal consent, retention, access-request, and breach-response processes.

---

## 9. Security verification checklist

Use this against a staging project, never production.

### Identity

- [ ] A counselor cannot select `students` rows directly.
- [ ] A counselor cannot select a student `profiles` row.
- [ ] The student directory returns aliases only.
- [ ] Faculty lookup returns one exact match and cannot enumerate.
- [ ] A faculty member cannot open another faculty member's referral.

### Break glass

- [ ] A justification under 20 characters is refused.
- [ ] A counselor cannot log access for an off-caseload student.
- [ ] A counselor reveal before head review is refused.
- [ ] A reveal after 30 minutes is refused.
- [ ] A head reveal still requires a grant.
- [ ] Every log, review, and reveal adds the expected audit row.
- [ ] Audit rows contain no student name, number, note text, or score.

### Notes and chat

- [ ] Another counselor cannot read a note.
- [ ] A student cannot read any note.
- [ ] A note cannot be created before completion.
- [ ] A second note is refused.
- [ ] Attachment count, MIME type, and size caps hold.
- [ ] A non-participant cannot read a chat thread or message.

### Analytics

- [ ] A cell with fewer than five students is suppressed in the page and export.
- [ ] A counselor report contains only that counselor's scope.
- [ ] A faculty report contains only that faculty member's referrals.
- [ ] Feedback comments do not appear in notification payloads.

### Audit and operations

- [ ] No client role can update or delete `audit_logs` or `audit_events`.
- [ ] A backup download requires the head and writes an audit row.
- [ ] The cron route returns 403 without the bearer secret.
- [ ] Deactivation blocks the next guarded page load.
- [ ] The admin account can reach `/settings` and not the office boards.

If a control fails, record it as a finding with the file, the test, and the date. Do not mark Objective 3 or 9 as fully achieved until the failing control is fixed or the limitation is accepted in writing.
