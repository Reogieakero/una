# Web Real-Time / Mutation / Notification Audit Report

> Scope: existing `apps/web` pages only. Mobile (`apps/mobile`) out of scope.
> Status: audit + plan only — no code changes made.
> Date: 2026-09-17

## 0. Architecture truth (web)

- **Mutations:** no Server Actions, no `useMutation`. All writes go through the
  browser `createClient()` (`apps/web/lib/supabase/client.ts`) plus
  `@dorsu/shared-services`, except privileged writes via `createAdminClient()`
  inside `app/api/**` route handlers.
- **Reads:** per-page React Query board hooks (`useAppointmentsBoard`,
  `useReferralsBoard`, `useNotificationsBoard`, `useChatBoard`,
  `useSessionsCalendar`, etc.) with `staleTime` 30–60s, `keepPreviousData`,
  and no `refetchOnWindowFocus`. The `QueryClient` lives in the root layout
  and survives in-app navigation.
- **Notify path:** `notifyStaff()` (`apps/web/lib/notify.ts`, fire-and-forget
  `void`, never throws) → `POST /api/staff/notify` → service-role insert into
  `notifications`. Student-originated bookings and feedback fan out via DB
  triggers (migration `00035_realtime_transaction_fanout.sql`). RLS: clients
  have **no INSERT policy** on `notifications` (service-role only) — correct,
  keep as-is.
- **Realtime today:** 4 overlapping `notifications` subscriptions per staff
  session (`realtime-toasts-{uid}` in `realtime-toasts.tsx`, `nav-counts-{uid}`
  + `nav-notif-{uid}` in `staff-nav.tsx`, `notif-{me}` on the inbox page) plus
  3 chat channels (`thread-{id}`, `chat-list`, `staff-dms`). Two of them
  (`useNavCounts`, `NotifBell`) **re-subscribe on every route change** via a
  `pathname` dependency. Two chat channels have **no filter** (`chat-list` on
  all `chat_messages` INSERTs, `staff-dms` on all `staff_messages` INSERTs),
  relying purely on RLS.
- **Terminology mapping** (brief names vs. repo reality): assignment =
  `appointments.counselor_id` / `referrals.assigned_counselor_id`; session =
  `appointments` row + `session_notes`; SF10 / Registrar / Principal do not
  exist (closest: PSS-10 `pss10_assessments`; roles are `student / counselor /
  guidance_head / faculty / guidance_personnel / admin`).

## 1. Page-by-page audit (existing web pages)

| Page | Mutations on page | Loading | Notify (non-blocking?) | Other users see it live? | Refetch behavior | Defects |
|---|---|---|---|---|---|---|
| `/appointments` (counselor/head) | assign, reject, confirm (+schedule/Meet link), complete, no-show via `act()` + `runConfirming` (`app/(staff)/appointments/page.tsx`) | ✅ `busyId` + `confirmBusyRef` (best pattern in repo — generalize it) | ✅ `void notifyStaff` after success (student + heads) | ❌ No page subscription; full `refetch()` only updates the actor | Full-board refetch on every action | No `dedupeKey` on notifies; redundant full refetch instead of `patchBoard` |
| `/referrals` (counselor/head/faculty) | `act()` (confirm/resolve/escalate/reject), `assign()`, faculty `createReferral` (`app/(staff)/referrals/page.tsx`, `components/referrals/TriageDialogs.tsx`) | ✅ `busyId` on triage/assign; ❌ **faculty submit has no busy/disable — double-click submits duplicate rows** | ✅ `void notifyStaff` (2–3 calls per action: student, referrer, heads) | ❌ Assignee counselor / referrer see nothing until reload | Full `refetch()` everywhere | Double-submit hole (no `dedupe` on `referrals` either); no `dedupeKey` on notifies; `referral_actions` audit write must stay in the critical path |
| `/notifications` (inbox) | `markRead`, `markAllRead` (`app/(staff)/notifications/page.tsx`) | ✅ `busyAll` on mark-all | n/a | ✅ INSERT patched live via `patchBoard` + toast — the only working board-level realtime | Incremental `patchBoard` ✅ (model pattern) | `markAllRead` fires **N round-trips** (`Promise.all(ids.map(markNotificationRead))`); optimistic patch **never rolls back** on failure; UPDATE (read receipts) not subscribed |
| `/chat` | `sendMessage`, `sendStaffMessage`, `markStaffMessagesRead` (`app/(staff)/chat/page.tsx`) | ✅ `msgBusy` / `sending` states | ✅ `chat` type in `SILENT_TYPES` (bell increments, no toast — intended, keep) | ✅ thread messages + DM list patch live | `chat-list` runs full `invalidateQueries` on **every** message (refetch storm in active conversations) | Unfiltered `chat-list` + `staff-dms` channels; 3 channels should multiplex into 1 + filtered thread channel |
| Shell: bell, nav badges, toasts (`components/shared/staff-nav.tsx`, `realtime-toasts.tsx`, `staff-shell.tsx`) | — | — | — | Bell / badge / toast work globally but via **3 duplicate channels + resubscribe on navigation** | Per-event full `refresh()` (count query runs twice — counts + bell) | Consolidate into a single provider channel + unread-count context |
| `/refer-student` (faculty) | `createReferral` (dedicated-page variant of the faculty form) | Same faculty-submit defect as `/referrals` | ✅ faculty callers forced to heads server-side in `/api/staff/notify` (good rail — keep) | Heads via bell ✅ | Refetch on submit | Same double-submit fix (`formState.isSubmitting` disable) |
| `/sessions` (calendar) | Read-only (no service write fn; `session_notes` writes go through direct RLS inserts elsewhere) | Skeleton ✅ | None | ❌ Newly minted sessions (from referral confirm) don't appear until reload | Hook refetch | Add provider-driven invalidation/patch on appointment events |
| `/announcements` | Direct `supabase.from("announcements").insert/update/delete` (`app/(staff)/announcements/page.tsx`) | ✅ per-page busy | `notifyStaff` after publish (audience to confirm — see open questions) | ❌ | Full refetch | Add `dedupeKey`, incremental `patchBoard` |
| `/availability` | Direct `supabase.from("counselor_availability").insert/delete` (`app/(staff)/availability/page.tsx`) | ✅ | None (fine — self-managed) | ❌ Other viewers don't update | Full refetch | Incremental patch; low priority |
| `/feedback` | Read-only (students submit via mobile) | ✅ | ✅ via DB trigger `feedback_notify_staff` (handling counselor + heads) | Bell ✅, board ❌ until reload | — | Provider-driven patch on notification event |
| `/students`, `/reports`, `/dashboard/*` | Profile update, `workspace_settings` upsert (settings page); reads elsewhere | ✅ | None needed | n/a | Targeted | No change except consuming the shared provider (no per-page channels) |
| `/emergency`, `/security`, `/users`, `/users/new`, `/settings`, `/about` | Break-glass log/reveal/review, `is_active` toggle, profile/workspace updates, staff registration | ✅ `busy` / `revealing` / `checking` | Via secure routes, audit-logged (`audit_logs`, `break_glass_logs`) | ❌ (acceptable for admin screens) | Targeted refetch | **Never put break-glass/audit content in realtime payloads** (ids only); no other change |

## 1B. Existing processing / status-update flows (as-built)

This section documents how each status-changing flow actually works today —
who validates what, where the guards live, who gets notified, and whether the
actor's UI waits on notification delivery. File references are under `apps/web`
unless noted.

### Appointments — `act()` + `runConfirming` (`app/(staff)/appointments/page.tsx:72-187`)

1. Row action click → `setBusyId(id)` disables that row's buttons.
2. Status moves go through `ACTION_DEFS` (`components/appointments/status.ts:58`):
   `confirm → confirmAppointment`, `complete → completeAppointment`,
   `reject → rejectAppointment`, `no-show → markAppointmentNoShow`
   (`packages/shared-services/src/appointments/mutations.ts`).
3. **Client validation first** (confirm only): schedule input present + future
   date; online mode requires a `meet.google.com` link (`isMeetUrl`); then a
   confirm dialog (`AppointmentConfirmDialogs`) with `confirmBusyRef` guard so
   Escape/backdrop can't dismiss mid-flight.
4. **Service guards** (bypass-proof): each mutation does a guarded
   `update … .eq("status", <expected-from>)` — e.g. confirm only from
   `assigned`, complete/no-show only from `confirmed`, reject only from
   `pending` (with a pre-read for a clear error message). `confirmAppointment`
   additionally re-reads `mode` to enforce the Meet-link rule server-side.
5. On success: `await refetch()` (full board), then **non-blocking** fan-out —
   `void notifyStudent(...)` + `void notifyHeadsAppt(...)` — then
   `toast.success(def.doneTitle)`. Errors map to friendly messages; anything
   unmatched becomes "may have changed status, reload and try again".
6. **Assign** (`handleAssign`, head only) skips the dialog: `assignAppointment`
   (pending/assigned → assigned, or null → unassign back to pending), then two
   `void notifyStaff` calls (student + heads), then `refetch()`. No actor toast
   on assign — the row change itself is the feedback.
7. ✅ Correct separation: spinner resolves on the DB write; notifies never
   block. ⚠️ Redundant full `refetch()`; notifies carry no `dedupeKey`.

### Referrals — `act()` + `assign()` + faculty submit (`app/(staff)/referrals/page.tsx:183-305`, `components/referrals/TriageDialogs.tsx:126-181`)

1. **Triage dialog** (`TriageConfirmDialog`) owns field state + validation:
   confirm requires future schedule (+ Meet link when online, mirroring
   appointments); escalate requires a ≥10-char note; resolve is gated twice —
   `canResolve` (a confirmed/completed session with a schedule must exist) and
   "session time must have passed". Dialog holds a local `busy` spinner and
   blocks Escape/backdrop close while processing.
2. Page `act()` sets `busyId`, then:
   - `to === "confirmed"` + schedule → `confirmReferralWithSession`
     (reads counselor-id + referral + existing session in one
     `Promise.allSettled` batch; upserts the `appointments` row linked via
     `source_referral_id` — re-confirm refreshes the active row instead of
     minting duplicates; terminal sessions get a fresh row; then
     `triageReferral` to `confirmed` with a `Session scheduled for <ISO>`
     trail note);
   - `to === "rejected"` → `rejectReferral` (pending-only, must unassign first);
   - else → `triageReferral` (role-gate via `REFERRAL_MOVE_ROLES` checked
     **before** the transition table; counselor-ownership check; resolve-gate
     session lookup; guarded update + `referral_actions` audit insert).
3. On success: 2–3 `void notifyStaff` calls (student on confirm-with-schedule,
   referrer, heads — escalate additionally pings the assigned counselor),
   then `await refetch()`, then `toast.success` ("Session confirmed",
   "Referral resolved/escalated/rejected").
4. **Assign** (`assign()`, head only): `assignReferral` → `triageReferral`, then
   `void notifyStaff` to the assignee counselor ("Referral assigned to you") +
   heads, then `refetch()`.
5. **Faculty submit** (`FacultyReferralSection`, `TriageDialogs.tsx:361-388`):
   react-hook-form + zod (`createReferralSchema`) → `createReferral` (status
   `pending`) → `toast.success` → `void notifyStaff(headIds)` → `onSubmitted`
   → `refetch()`. ❌ **No busy/disable state** — double-click files two rows.
6. **Excel/paper-form modal** (`ReferralExcelModal.tsx:244-286`): same shape
   (validate → student-No. match or walk-in name/number → `createReferral` →
   toast → notify → close) with a `busy` guard ✅, but ❌ it **`await`s
   `notifyStaff`** (line 273), so modal close waits on notification delivery.
7. ✅ Guards/audit exemplary (`REFERRAL_TRANSITIONS`, move-role errors,
   ownership, `referral_actions` trail). ⚠️ Full refetch per action; no
   `dedupeKey`; Excel modal blocks on notify.

### Chat — thread + staff DMs (`app/(staff)/chat/page.tsx:152-280`)

1. **Thread open:** `getThreadWithMessages` loads history; a filtered
   `thread-{activeId}` channel appends INSERTs (deduped by message id) and
   patches the thread-list preview via `patchBoard`. Closing/leaving removes
   the channel; switching threads re-subscribes.
2. **Send:** `sendMessage` (client UUID `messageId` as row PK → retried sends
   resolve to the existing row; thread `updated_at` bumped for ordering), then
   counterpart notified via `notifyStaff` with type `chat` → **silent toast**
   (`SILENT_TYPES` in `realtime-toasts.tsx`), bell still increments.
3. **Staff DMs:** `sendStaffMessage` / `markStaffMessagesRead`; unfiltered
   `staff-dms` channel patches the DM cache by id.
4. **Thread list:** unfiltered `chat-list` channel → full `invalidateQueries`
   on **every** message (correct but heavy — the one refetch storm in the app).
5. ✅ Only surface with working end-to-end realtime. ⚠️ 3 channels (2
   unfiltered) → multiplex + filter; replace invalidate-all with preview patch.

### Notifications inbox (`app/(staff)/notifications/page.tsx:91-163`)

1. Board loads via `useNotificationsBoard` (stale-while-revalidate, 60s).
2. `notif-{me}` INSERT channel → `patchBoard` prepend (dedupe by row id) +
   `toast.message(row.title)`.
3. `markRead`: optimistic patch → `markNotificationRead` → error toast on
   failure (⚠️ no rollback). `markAllRead`: optimistic patch-all → N parallel
   single-row updates (⚠️ N round-trips) → success/error toast.
4. Filters/search/stats are local derivations — correctly never refetched.

### Announcements (`app/(staff)/announcements/page.tsx:190-268`)

1. **Save:** `setSaving(true)` (form-level disable ✅) → optional image upload
   to `announcement-images` storage → `announcements.insert` (draft if
   `published_at` null) → `refetch()` → resolve audience to profile ids
   (role-filtered when audience set) → ❌ **`await notifyStaff(...)`** (line
   218) — publish confirmation waits on fan-out → `toast.success`.
2. **Publish/unpublish** (`setPublished`, `busyId` per row ✅) and **delete**
   (`removePost`, incl. storage cleanup, ✅) → `refetch()` + toast. No notify
   on these (acceptable; publish toggle is the gap only if toggles should ping).
3. ⚠️ Fix = `void` the publish fan-out + add `dedupeKey: announcement:<id>`.

### Availability (`app/(staff)/availability/page.tsx:144-176`)

1. Single `mutate(label, fn)` wrapper: global `setBusy(true)` → direct
   `counselor_availability` insert (multi-weekday batch in one call ✅) or
   delete by id → `await refetch()` → generic error toast. No success toast
   (silent refresh is the feedback).
2. ⚠️ Global busy disables the whole grid for one slot add — downgrade to
   per-action busy; add `patchBoard` instead of refetch. No notifications
   needed (self-managed schedule).

### Emergency / security / users / settings

1. **Emergency** (`app/(staff)/emergency/page.tsx`): `logAccess` → break-glass
   grant (`busy`), identity `reveal` (`revealing`, audit-logged server-side),
   `checkReview` (`checking`). All via `/api/staff/security/*` (service-role +
   caseload check). Correct as-is; keep off realtime except ids.
2. **Security review** (`review-break-glass`): head approves/reviews with busy
   state; audit rows immutable. No change.
3. **Users** (`/api/staff/users/status`): head toggles `is_active` via admin
   client; deactivated accounts are filtered out of all future fan-outs in the
   notify route (✅ good rail). Page refetches the users board.
4. **Settings:** `profiles.update({ full_name })` (own row, RLS) +
   `workspace_settings` upsert (head-only). No notify, none needed.
5. **Registration** (`/api/auth/register`, `/auth/confirm`): admin inserts
   `profiles` + `students` rows; privilege-guard trigger blocks self-elevation
   (migration 00030). No change.

### Fan-out routes + DB triggers (the "who tells whom" layer)

1. **`POST /api/staff/notify`** (`app/api/staff/notify/route.ts`): caller must
   be counselor/head/faculty → dedupe recipients (heads see own actions, others
   skip self-ping) → faculty restricted to heads only (except `chat` DMs to
   office staff) → drop inactive accounts → single multi-row service-role
   insert. ❌ Accepts no `dedupeKey`, so retries/double-fires duplicate rows.
2. **DB triggers** (`00035`): `appointments_notify_heads` (INSERT → assigned
   counselor + active heads) and `feedback_notify_staff` (INSERT → handling
   counselor + heads). These cover exactly the paths clients **cannot** write
   (students are 403 on the notify route). ❌ No trigger on appointment UPDATE
   → student cancels/reschedules are silent to staff (the one fan-out gap).

## 2. Cross-cutting findings

1. **4 → 1 subscription consolidation is the core fix.** A single
   `RealtimeProvider` mounted once in `app/layout.tsx` (inside `QueryProvider`)
   holds one channel per session, and owns the event-ID dedupe set, the
   unread-count context (bell + sidebar pill + nav badges consume it), global
   Sonner dispatch with deep-link `action`, connection status, and resync.
2. **Event envelope:** `{ eventId, type, entity, entityId, actorId, timestamp,
   link, title, body }`. Recipients stay server-side only (never in the
   payload); bodies carry aliases, never sensitive student content (matching
   current trigger behavior). Client dedupes by `eventId` before toasting or
   incrementing the badge.
3. **`/api/staff/notify` must accept and persist `dedupeKey`.** The service
   (`createNotification`) already supports idempotent replay via
   `UNIQUE(notifications.profile_id, dedupe_key)`; the route drops it. This
   kills duplicates from retries and multi-`notifyStaff` actions (e.g.
   referrals `act()` fires 2–3 notifies per action).
4. **One missing fan-out:** student cancel/reschedule has no trigger, and
   students get 403 on the notify route → staff are never told. Add one
   `UPDATE` trigger on `appointments` (status/`scheduled_at` change →
   counselor + heads, `dedupe_key = appt:<id>:<status>:<epoch>`). This is the
   only new trigger proposed; every trigger row carries `dedupe_key` so any
   overlap with client fan-out collapses instead of duplicating.
5. **Incremental over refetch:** extend the existing `patchBoard` helper
   (already proven by notifications/chat) to appointments, referrals, and
   announcements boards (upsert by id; keep `refetch()` as fallback when a
   patch isn't safe). Replace the chat-list invalidate-all with the preview
   patch already used for thread messages.
6. **Read/unread sync:** single-query `markAllRead`
   (`update({ is_read: true }).in("id", ids)`) with rollback on failure;
   subscribe to `notifications` UPDATE in the provider (requires enabling
   UPDATE in the realtime publication) so badges clear live everywhere.
7. **Reconnect + resync:** rely on Supabase auto-reconnect with backoff, plus
   explicit reconcile on RECONNECTED — diff `fetchNotificationsBoard` by id
   since `lastSeenAt` (missed toasts replayed once, deduped) and invalidate
   board keys touched while offline. DB remains the source of truth.
8. **Logging:** a tiny `logEvent()` (console-structured in dev, pluggable sink
   later) for `MUTATION_STARTED/SUCCESS/FAILED` (with duration),
   `REALTIME_EVENT_PUBLISHED/RECEIVED`, `NOTIFICATION_CREATED/DELIVERED`,
   `SUBSCRIPTION_CONNECTED/DISCONNECTED/RECONNECTED` — ids, roles, and
   durations only, never student content.
9. **Explicitly unchanged:** RLS policies + `requireRole` guards +
   `REFERRAL_TRANSITIONS` / move-role gates + `referral_actions` audit trail +
   PSS-10 freshness gate + existing idempotency keys (`appointments.
   idempotency_key`, `chat_messages.id`, `notification_deliveries` ledger).

## 3. Implementation order

1. **Loading lifecycle + duplicate-submit prevention:** new `useMutationAction`
   hook generalizing the `confirmBusyRef` pattern from
   `appointments/page.tsx:runConfirming` (busy-id, ref-guard, try/finally
   resolve, error mapping); faculty-submit disable via
   `formState.isSubmitting`; single-query `markAllRead` with rollback.
2. **Remove sequential ops:** fold the `rejectAppointment` status pre-read into
   the guarded update (matching `completeAppointment`'s shape); leave the
   `triageReferral` resolve-gate two-hop fallback as-is (correctness first).
3. **Separate mutation from background work:** enforce
   mutate → patch/toast → `void notifyStaff({ dedupeKey })` everywhere; route
   accepts and persists `dedupeKey`. The actor's spinner resolves on the DB
   write, never on notification delivery.
4. **Realtime events (DB-triggered where the client can't):** cancel/reschedule
   UPDATE trigger + enable UPDATE in the realtime publication for read
   receipts. Keep client fan-out for staff/faculty moves; keep 00035 triggers
   for booking/feedback.
5. **Incremental UI updates:** `patchBoard` for appointments / referrals /
   announcements; chat preview-patch replaces invalidate-all.
6. **GLOBAL Sonner + bell layer:** `RealtimeProvider` in the root layout;
   delete the 4 duplicate channels (`RealtimeToasts`, `nav-counts-*`,
   `nav-notif-*`, `notif-*`); the open chat thread registers through the
   provider instead of owning a separate client. RLS stays the enforcement
   point; `filter:` stays on every subscription (fixes the two unfiltered
   firehoses).
7. **Notification-center read/unread sync** via provider UPDATE handling.
8. **Reconnect + resync-on-reconnect** (backoff + `lastSeenAt` reconcile).
9. **Measure:** Phase-0 baselines (click→toast latency on assign flows,
   channels per session, refetch payload sizes) vs. final; acceptance bar:
   mutation toast latency unchanged-or-faster, cross-user toast < 2s on
   broadband, 1 notifications subscription per session, zero full-board
   refetches on foreign events.

## 4. Acceptance checklist (web)

- [ ] Spinner + disabled button on every submit; faculty double-click → 1 row.
- [ ] Loading always resolves (success or failure), never hangs.
- [ ] Mutation toast is fast and never blocked by notification delivery.
- [ ] User B on Settings sees assign/confirm toast + badge with no reload;
      clicking the toast deep-links to the record.
- [ ] Bell / unread count updates globally in real time; no duplicate toasts.
- [ ] 1 notifications subscription per session; no resubscribe on navigation.
- [ ] No duplicate inbox rows on retry; mark-all-read = 1 query.
- [ ] Offline 60s → reconnect replays missed toasts exactly once.
- [ ] RLS, audit trail, and business rules intact; `typecheck`, `lint`, and
      `build:web` pass.

## 6. Decisions log (2026-09-17, pre-implementation)

- **Announcements audience → role-filtered by audience.** Publish fan-out
  notifies only the roles in the announcement's `audience` field (all active
  staff when empty). Matches current code; no fan-out query change needed
  beyond `void` + `dedupeKey`.
- **Cancel/reschedule trigger → approved.** One new `UPDATE` trigger on
  `appointments` (status/`scheduled_at` change → counselor + heads,
  `dedupe_key = appt:<id>:<status>:<epoch>`). Only new DB automation in plan.
- **Blocking awaits → bug, fix both.** `announcements/page.tsx:218` and
  `ReferralExcelModal.tsx:273` become fire-and-forget `void notifyStaff` with
  `dedupeKey`; success reflects the DB write.
- **Sequencing → phased PRs.** PR1: blocking-await fixes + faculty
  double-submit guard + single-query `markAllRead` with rollback. PR2:
  `RealtimeProvider` consolidation (4→1 channels, count context, deep-link
  toasts, chat multiplex). PR3: reconnect/resync + structured logging.
- **Unfiltered chat channels → noise, not leak** (verified: `00012`
  `messages_select_participant`, `00023` `staff_messages_select_scoped`;
  Realtime enforces RLS per subscriber). Fixed inside PR2, no separate
  security work.
- **`useMutationAction` wraps busy/error handling only** — guards, transition
  tables, and role-gates stay untouched.
- **`/sessions` + `/availability` live-update → deferred** (provider
  invalidation-only; no per-board patch work in this phase).

## 5. Open questions

1. **Announcements audience** — all staff or role-filtered? (Determines the
   fan-out query.)
2. **Student cancel/reschedule trigger** — approved to add? (Fills the one
   silent gap in staff notification.)
3. Anything in §1 marked ❌ that should be explicitly deferred?
