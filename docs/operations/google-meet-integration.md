# Google Meet integration

Chekie can create and manage Google Meet links for online counseling sessions
through the Google Calendar API, with manual paste as an always-on fallback.
This is **Objective 8 — Route A** (server-side Google Calendar/Meet API).

## How it works

- A counselor confirms (or reschedules) an online session and clicks **Create
  Meet link** in the confirm dialog — on the Appointments page and in the
  Referrals triage dialog.
- The client calls `POST /api/appointments/meet` with the appointment or
  referral id and the scheduled window.
- The route calls the Google Calendar API as the office account, creates a
  calendar event with `conferenceData.conferenceSolutionKey.type = "hangoutsMeet"`,
  and persists the resulting join URL on the appointment row with
  `meeting_provider = 'google_meet'` and the Google `meeting_event_id`.
- The counselor can still paste a link instead; pasted links are stored as
  `meeting_provider = 'manual'`.
- Rescheduling an online session with a managed link **PATCH**es the calendar
  event time. Cancelling/rejecting (or staff removing the link from the session
  detail modal) **DELETE**s the calendar event and clears the link, except on
  `completed`/`no_show` rows where the link is kept for history.

## Scope (least privilege)

```
https://www.googleapis.com/auth/calendar.events
```

Only the Sessions scope is requested; events are created on the office calendar
(`GOOGLE_CALENDAR_ID`, default `primary`). No refresh token is ever exposed to
the browser, mobile, or logs.

## Environment (server-only)

In `.env` / Vercel Environment Variables (Project Settings → Environment Variables).
See `.env.example`:

```
GOOGLE_MEET_ENABLED=1
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
GOOGLE_CALENDAR_ID=primary
```

`GOOGLE_MEET_ENABLED` gates the route: with it unset/off the route returns
**503** and counselors fall back to pasting. This lets you deploy a build with
the UI wired without credentials present.

## Provisioning the credentials

1. Create a Google Cloud OAuth app for the office account (testing-mode apps are
   fine for pilots).
2. In **APIs & Services → OAuth consent screen**, add the single scope above and
   the office account as a test user.
3. Generate (or refresh) a **refresh token** for the office account with that
   scope; store it as `GOOGLE_REFRESH_TOKEN`.
4. Enter `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from the same OAuth
   client.

> Testing-mode refresh tokens **expire after 7 days**. For anything beyond a
> short demo, publish the OAuth app or use domain-wide service-account
> delegation so tokens don't silently stop working.

## Rotation

- Rotate `GOOGLE_CLIENT_SECRET` in the Google Cloud console, then update
  `GOOGLE_REFRESH_TOKEN` by re-authorizing the office account.
- Rotating `GOOGLE_REFRESH_TOKEN` invalidates the previous token; the new one
  takes effect on the next create/patch/delete call (no deploy needed).
- `GOOGLE_CLIENT_ID` is only used to mint the access token, so it does not need
  to change on every refresh-token rotation.

## Failure modes and behavior

| Trigger | Behavior |
| --- | --- |
| `GOOGLE_MEET_ENABLED` unset | `POST` returns 503; the confirm dialog shows "Couldn't create a Meet link — paste one instead or try again." Counselors paste a link. |
| Bad/expired refresh token | Token refresh fails; `POST` returns 503 with the same fallback. Create a new refresh token. |
| Google 5xx | Single automatic retry once; then 503 fallback. |
| Google 4xx (invalid request, ACL) | No retry; the route returns 400/403 with the detail. |
| Idempotent re-create | `conferenceData.createRequest.requestId` is set to the appointment id and the DB update is guarded
  (`.is("meeting_url", null)`), so concurrent creates produce one event and one link. Re-calling create on a managed session returns the existing link (200, `created: false`). |
| Reschedule of a managed link | `PATCH /api/appointments/meet` updates the event end time; failure is non-fatal — the link stays on the session and the time edit is a documented residual. |
| Cancel / reject / Remove link | `DELETE /api/appointments/meet` deletes the calendar event and clears `meeting_url`/`meeting_provider`/`meeting_event_id` on the row. For `completed`/`no_show` rows it returns 409 and keeps the link. |

## Privacy

Calendar events are created with a generic title ("Counseling session"), no
attendees, no reminders, and **no student name, alias, number, email, or
concern**. `meetEventLeaksStudentIdentity()` in
`packages/shared-services/src/appointments/meeting.ts` asserts this in the unit
test suite — a CI regression here prevents student identity from landing in the
office Google calendar.

## Verifying locally

- `pnpm --filter @dorsu/shared-services test` — pure-helper unit tests
  (URL/code parsing, create/patch/remove gating, link parsing, privacy leak
  assertion).
- `pnpm --filter @dorsu/web typecheck` — route + client type-checks.
- End-to-end (real Google) is **not** run in CI — it needs real credentials. Set
  `GOOGLE_MEET_E2E=1` locally and hit `POST /api/appointments/meet` with a real
  `appointmentId`; the response returns the join URL that appears in Chekie.

## Limitations

- Single office account (Option A). Per-counselor OAuth (Option C) is out of
  scope; all events are created on the office calendar.
- No two-way calendar sync, attendee management, or invitation emails — create /
  patch / delete of the session event only.
- Student-initiated cancellation happens on the mobile app and flips the session
  to `cancelled` via `cancelAppointment`; it does not (yet) call the Google
  cleanup route because the mobile client has no absolute API base URL. Staff
  detach the orphaned calendar event from the session detail modal ("Remove
  link"), which is available for `assigned`/`confirmed`/`cancelled`/`rejected`
  sessions; completed/no-show rows keep their link for history.
