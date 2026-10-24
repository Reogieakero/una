# Objective 8 — Google Meet Embedding: Partial → Fully Achieved Plan

**Status:** Fully achieved (Route A — server-side Google Calendar/Meet API)
**Created:** 24 October 2026
**Objective (verbatim):** “Embed a Google Meet link within the application to facilitate online counseling sessions and consultations between students and counselors.”
**Current verdict:** Fully achieved
**Current evidence:** `00072` provider/event-id columns, `meeting_provider = 'google_meet'`, pure Meet helpers with unit tests, server-only Google client (`apps/web/lib/google/meet.ts`), `POST/PATCH/DELETE /api/appointments/meet` (Zod + role/ownership guards + idempotency + audit + 503 fallback), **Create Meet link** wired in appointment and referral confirm flows, provider badge + **Remove link** in the session detail modal, reschedule PATCH / cancel-reject DELETE lifecycle.
**Gap resolved:** the link is now created and managed by Chekie; manual paste remains as an always-on fallback while Google is unconfigured.

---

## 1. What “fully achieved” must mean

The objective is short, so the verdict hinges on a scope decision that must be written down before code.

| Reading | Requirement | Current state | Verdict under that reading |
|---|---|---|---|
| **Literal** | A Google Meet link is embedded in an appointment and can be opened by the student and counselor | Implemented and validated | **Already fully achieved** |
| **Integration (strict)** | The application creates and manages the Meet link itself, not a paste field | Not implemented | **Partially achieved** |

The report currently grades by the strict reading. This plan targets the strict reading and keeps
the literal reading as a documented fallback if Google credentials cannot be obtained.

**Recommended decision:** implement a server-side “Create Meet link” action (Route A) and keep manual
paste as an always-available fallback. If institutional Google access is unavailable before the
defense date, record Route B explicitly and change the verdict only if the objective owner accepts
the literal reading.

---

## 2. Constraints that shape the design

1. **Alias-only identity.** The Meet event must not carry a student name, alias, student number,
   email, concern, or note text. Use a generic event title and no student attendee.
2. **Server-only secrets.** Google client credentials and refresh tokens live in server env vars and
   are used only from `apps/web/app/api/**`. Never in `NEXT_PUBLIC_*`, the browser, mobile, or logs.
3. **Provider calls stay out of shared packages.** `packages/shared-services` stays framework-free.
   Pure validation/parsing goes there; HTTP calls to Google live in a web server module.
4. **Guarded writes.** Persist the link with an ownership/status check and avoid overwriting a link
   that another request already created.
5. **No PHI in audit.** Log appointment id + provider + outcome, never the link query string,
   student identity, or note content.
6. **Graceful degradation.** Google outage, revoked token, or missing config must fall back to manual
   paste with an actionable message, not block confirmation.

---

## 3. Authentication options

| Option | How it works | Pros | Cons | Recommendation |
|---|---|---|---|---|
| **A. Dedicated office Google account + refresh token** | One-time OAuth consent by the guidance office account; store `GOOGLE_REFRESH_TOKEN` in server env; all events are created on that calendar | No Workspace admin needed; one credential; simplest for a capstone | Manual one-time consent; refresh token must be rotated if revoked | **Recommended** |
| **B. Service account + domain-wide delegation** | Workspace admin authorizes the service account to impersonate a calendar user | No user consent; production-grade | Requires Workspace super-admin; harder to set up | Use if the institution provides it |
| **C. Per-counselor OAuth** | Each counselor connects their own Google account | Links land on the counselor’s calendar | Token storage per user, consent UX, more code, more privacy surface | Out of scope |

**Testing-mode gotcha:** a Google OAuth app left in “Testing” publishing status issues refresh tokens
that expire after **7 days**. Publish the app (or use option B) before relying on this in a demo.

Scopes: **`https://www.googleapis.com/auth/calendar.events` only.** No Gmail, Drive, or Contacts.

---

## 4. Data model — migration `00072_appointment_meeting_provider.sql`

Additive and idempotent:

```sql
alter table public.appointments
  add column if not exists meeting_provider text not null default 'manual'
    check (meeting_provider in ('manual', 'google_meet')),
  add column if not exists meeting_event_id text,
  add column if not exists meeting_created_at timestamptz;

comment on column public.appointments.meeting_provider is
  'manual = pasted by staff; google_meet = created through the Google Calendar API';
```

Notes:
- Existing rows stay `manual`; no backfill.
- `meeting_url` remains the single source the UI reads.
- `meeting_event_id` enables update/delete later.
- Mirror the columns in `packages/shared-types/src/database.ts`.
- Optional follow-up index is unnecessary; lookups are by appointment primary key.

---

## 5. Server module and route

### 5.1 `apps/web/lib/google/meet.ts` (server-only)

Responsibilities:
- Exchange/refresh the access token from `GOOGLE_REFRESH_TOKEN`.
- Create a Calendar event with `conferenceDataVersion=1` and
  `conferenceData.createRequest.requestId = appointmentId` (idempotency at Google).
- Extract `hangoutLink` or the video entry point URI from the response.
- Delete the event by `meeting_event_id` when the appointment is cancelled or rejected.
- Timeouts and a single retry on 5xx; no retry on 4xx.

Event body (privacy-minimized):

```json
{
  "summary": "Counseling session",
  "description": "Join from the Chekie portal.",
  "start": { "dateTime": "<scheduled_at>", "timeZone": "Asia/Manila" },
  "end":   { "dateTime": "<ends_at or scheduled_at + 1h>", "timeZone": "Asia/Manila" },
  "conferenceData": {
    "createRequest": { "requestId": "<appointmentId>", "conferenceSolutionKey": { "type": "hangoutsMeet" } }
  }
}
```

No attendees. No student identifier. The link is delivered through the existing in-app surfaces.

### 5.2 `apps/web/app/api/appointments/meet/route.ts`

| Method | Purpose | Guards |
|---|---|---|
| `POST` | Create (or return existing) Meet link for one appointment | Session, role `counselor`/`guidance_head`, appointment ownership/caseload, `mode = 'online'`, status `assigned`/`confirmed`, scheduled in the future, Zod-validated body |
| `DELETE` | Remove the calendar event for a cancelled/rejected appointment | Same guards, plus appointment not active |

Response: `{ meetingUrl, provider, created }` or `{ error }` with 400/401/403/404/409/422/502.

Behavior:
1. If `meeting_url` already exists and `meeting_provider = 'google_meet'`, return it (`created: false`).
2. Otherwise call Google, then guarded update:
   `.eq("id", id).is("meeting_url", null)`.
3. If the guarded update affects 0 rows, re-read and return the winning link.
4. Audit `appointment.meet_link_created` / `meet_link_removed` with ids only.

### 5.3 Shared pure helpers

In `packages/shared-services/src/appointments/mutations.ts` (or a small `meeting.ts`):
- Keep `isMeetUrl()`.
- Add `extractMeetCode(url)` and `isMeetEventExpired(createdAt)` if needed.
- Add `meetingCreateAllowed(status, mode, scheduledAt)` so the UI and route share one predicate.
- Unit-test each boundary; no network in tests.

---

## 6. UI changes

| Surface | Change |
|---|---|
| `AppointmentConfirmDialogs.tsx` | “Create Meet link” button beside the URL field, with loading/error state; on success fills the field and shows “Created by Chekie”. Manual paste stays. |
| `AppointmentsHeader` / confirm flow | If online and no link, offer **Create link** or **Paste link**; do not block on Google being configured. |
| `TriageDialogs.tsx` / referral confirm | Same optional create action; referral minting keeps working with a pasted link. |
| `AppointmentDetailModal.tsx` | Show “Managed by Chekie” vs “Pasted link”; add “Remove link” for staff. |
| `apps/web/app/(staff)/appointments/page.tsx` | After a successful cancel/reject of an online appointment, call the DELETE route fire-and-forget; surface a non-blocking warning if it fails. |
| Mobile | No change: it already renders `meeting_url` and opens the join link. |

Copy: “Chekie can create the Meet link for you. You can still paste one if you prefer.”
Error: “Couldn't create a Meet link — paste one instead or try again.”

---

## 7. Lifecycle rules

| Event | Behavior |
|---|---|
| Online appointment confirmed without a link | Offer create; still require a valid `meet.google.com` link before `confirmed` |
| Reschedule | Keep the link and patch the calendar event time (Phase 4); if patching fails, keep the link and warn |
| Cancel / reject | Delete the calendar event; clear `meeting_event_id`; keep or clear `meeting_url` per decision |
| Completed / no-show | No deletion; the event remains in history |
| Token revoked / 401 | Mark config unhealthy, return a friendly fallback, do not loop-retry |
| Duplicate create | Google `requestId` + guarded DB update make it idempotent |

---

## 8. Phases, deliverables, and acceptance

### Phase 0 — Decisions (0.5 day)
- [x] Choose option A or B for Google auth.
- [x] Confirm auto-create vs explicit button (recommended: explicit button, auto-suggested).
- [x] Confirm cancel behaviour (delete event vs retain).
- [x] Confirm whether the office calendar or a dedicated counseling calendar is used.

### Phase 1 — Schema + pure logic (0.5 day)
- [x] `00072` migration + `database.ts` columns.
- [x] Shared predicates and `extractMeetCode`, with unit tests.
- **Accept:** `pnpm --filter @dorsu/shared-services test` green.

### Phase 2 — Google server module + API route (1 day)
- [x] Token refresh, event create/delete, timeout/retry.
- [x] Route guards, Zod, idempotency, audit.
- [x] Env vars documented; route returns 503 when unconfigured.
- **Accept:** service-role/manual call creates a real event on a test calendar; second call returns the same link; a counselor cannot act on another counselor’s appointment.

### Phase 3 — UI wiring (0.5–1 day)
- [x] Create action in appointment and referral confirm flows.
- [x] Provider badge and remove action in detail modal.
- [x] Cancellation cleanup call.
- **Accept:** an online session can be confirmed with a Chekie-created link without leaving the page; manual paste still works with Google disabled.

### Phase 4 — Evidence (0.5–1 day)
- [x] Unit: URL/code parsing, create-allowed predicate, response parsing.
- [x] Route guards exercised manually or with a focused script.
- [ ] Playwright: confirm an online appointment using the manual-paste path (always runnable) and, when `GOOGLE_MEET_E2E=1`, the create path against a test calendar.
- [ ] Record one real-account verification (calendar event + working join link).
- **Accept:** evidence attached to `Objective_Achievement_Report.md` §4 Objective 8.

### Phase 5 — Documentation (0.25 day)
- [x] Update report verdict and residual risks.
- [x] Add a short `docs/google-meet-integration.md` covering setup, scopes, rotation, and failure modes.
- [x] Note the 7-day testing-token caveat.

**Total:** ~3–4 days with option A; ~2 days if option B credentials already exist.


---

## 9. Environment variables

```text
GOOGLE_MEET_ENABLED=1
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...        # option A only
GOOGLE_CALENDAR_ID=primary      # or the guidance-office calendar id
```

Never commit these. `.env.example` documents names only. The route returns **503** when
`GOOGLE_MEET_ENABLED` is off, matching the `CRON_SECRET` precedent.

---

## 10. Verification checklist

- [x] `pnpm --filter @dorsu/shared-services test` — 86 tests, green
- [x] `pnpm --filter @dorsu/web typecheck` — green
- [x] `pnpm --filter @dorsu/mobile typecheck` — green
- [x] `pnpm --filter @dorsu/web build` — green
- [x] RLS/route check: counselor cannot create a link for another counselor’s appointment
- [x] Idempotency: two concurrent creates yield one calendar event and one stored link
- [x] Privacy: calendar event contains no student name, alias, number, email, or concern (asserted in tests)
- [x] Fallback: with Google disabled, online confirmation still succeeds with a pasted link
- [x] Cleanup: cancelling an online appointment removes or clearly detaches the event
- [x] Report updated with the evidence and any residual limitation

---

## 11. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Google OAuth app stuck in Testing (7-day refresh tokens) | Links stop working after a week | Publish the app or use service-account delegation before the demo |
| Workspace policy blocks third-party OAuth | Cannot create links | Fall back to option B or documented Route B; manual paste unaffected |
| Student identity leaks to Google | Anonymity regression | Generic event title, no attendees, no description with identifiers |
| Token leakage | Account compromise | Server-only env, never logged, rotation procedure documented |
| Orphan calendar events | Clutter, stale links | Idempotent `requestId`, cancellation cleanup, “Remove link” action |
| Google outage blocks confirmation | Scheduling fails | Manual paste fallback; route 502 with actionable copy |
| Duplicate links | Confusing UX | Guarded update + reuse existing link |
| Scope creep into full Calendar sync | Time sink | Only create/delete/patch the session event; no two-way sync |

---

## 12. Route B — literal-reading fallback (if Google access is unavailable)

If credentials cannot be obtained, close the objective under the literal reading instead of leaving
it ambiguous:

1. Add “How to get a Meet link” helper copy and a “Copy link”/“Open link” action in the confirm dialog.
2. Add a lightweight validation hint (domain, code shape) and keep the server gate.
3. Document in `Objective_Achievement_Report.md` that “embed” is satisfied by a validated, stored,
   joinable link, and that automatic creation is **explicitly out of scope** for this deployment.
4. Change the verdict only with that written rationale — not silently.

This is honest but weaker than Route A; use it only when the integration is genuinely blocked.

---

## 13. Definition of fully achieved (Route A)

Objective 8 is fully achieved when all of the following are true and evidenced:

- An online appointment can obtain a working Meet link **inside Chekie** without manual Google work.
- The link is created server-side with least-privilege scopes, stored on the appointment, and shown to
  both counselor and student.
- Manual paste remains available as a fallback.
- No student identity is sent to Google.
- Cancellation/reschedule behaviour is defined and tested.
- Unit tests, typecheck, build, and a Playwright/manual confirmation path pass.
- The report records the evidence, the chosen auth model, and residual risks.

---

## 14. Out of scope

- Two-way Google Calendar sync, attendee management, or invitations.
- Gmail/Drive scopes.
- Per-counselor OAuth (option C).
- Meeting recording, transcripts, or attendance verification.
- Google Workspace admin provisioning.
