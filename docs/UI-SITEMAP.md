# UI Sitemap and Screen Inventory

This document is the navigable map of DCAS: every web page, every mobile screen, the role that can open it, the journey that connects it, and the routes that exist in policy but not in the app. Use it to plan a demo, review a role's experience, or find the page that owns a behaviour.

**Audience:** demo presenter, UX reviewer, QA, and new developers.

**Source of truth:** `apps/web/app/**/page.tsx`, `apps/mobile/app/**/*.tsx`, `apps/web/components/shared/staff-nav.tsx`, and `packages/shared-services/src/rbac.ts`. The sitemap below was read from those files, not from an older README.

---

## 1. How URLs are formed

### Web (Next.js App Router)

- `app/(public)/…`, `app/(staff)/…`, and `app/(admin)/…` are **route groups**. Parentheses do not appear in the URL.
- `app/(staff)/dashboard/page.tsx` → `/dashboard`.
- `app/(staff)/students/[id]/page.tsx` → `/students/<uuid>`.
- `app/page.tsx` → `/` (the public marketing/landing page).
- `app/api/**/route.ts` are server endpoints, not pages; see [API-REFERENCE.md](API-REFERENCE.md).

### Mobile (expo-router)

- `app/(tabs)/home.tsx` → `/(tabs)/home`, displayed in the tab bar as **Home**.
- Root stack screens such as `app/book.tsx` and `app/chat.tsx` are pushed over the tabs, not tabs themselves.
- `app/index.tsx` is both the launch gate and the onboarding screen.
- `app/_layout.tsx` wraps every screen in the notifications provider and the session-reminder banner.

---

## 2. Web tree

```text
/                                Public landing page
├── /login                       Sign in
├── /register                    Student self-registration
├── /reset-password              Request password reset
└── /update-password             Set a new password from the email link

Staff shell (counselor, guidance head, faculty; admin admitted but mostly fails closed)
├── /dashboard                   Role-specific overview
├── /reports                     Role-scoped reports (head / counselor / faculty)
├── /about                       Staff handbook: how each page works
├── /sessions                    Month / week / day session calendar
├── /appointments                Appointment board and actions
├── /availability                Counselor availability windows
├── /chat                        Threads and direct messages
├── /students                    Alias directory
│   └── /students/[id]           One-student case timeline
├── /referrals                   Referral pipeline
├── /refer-student               Faculty referral form
├── /emergency                   Break-glass access and reveal
├── /announcements               Feed, compose, publish, insights
├── /feedback                    Student feedback
├── /notifications               Full notification inbox
└── /settings                    Profile and preferences

Admin shell (guidance_head)
├── /users                       User directory and status
├── /users/new                   Create a staff account
├── /security                    Break-glass review console
├── /security/events             Audit event trail
└── /backups                     Backup runs and download
```

There are **26 page files**: 1 landing, 4 public auth pages, 16 staff pages (including the dynamic student record), and 5 head-only admin pages.

---

## 3. Web screen inventory

### 3.1 Public

| Route | File | Who | Purpose | Key actions |
|---|---|---|---|---|
| `/` | `app/page.tsx` | Anyone | Marketing/landing page with problem, solution, features, roles, safety, and a guided journey. | Open login/register; read the product story. |
| `/login` | `app/(public)/login/page.tsx` | All roles | Email/password and Google sign-in. | Sign in; go to reset password. |
| `/register` | `app/(public)/register/page.tsx` | Students | Student self-registration with program/year reference lists. | Create account; confirm email. |
| `/reset-password` | `app/(public)/reset-password/page.tsx` | All roles | Request a reset email. | Send reset link. |
| `/update-password` | `app/(public)/update-password/page.tsx` | Recovery session | Set a new password from the email link. | Save password; return to sign-in. |

### 3.2 Staff shell

| Route | File | Who | Purpose | Key actions |
|---|---|---|---|---|
| `/dashboard` | `app/(staff)/dashboard/page.tsx` | Counselor, head, faculty | Role-specific overview: head sees office signals, counselor sees the queue and today, faculty sees own referrals. | Open a board; jump to a session; read pipeline signals. |
| `/reports` | `app/(staff)/reports/page.tsx` | Counselor, head, faculty | Reports: sessions, referrals, feedback, screenings, wellbeing trend, cohort stress, data quality. | Change date range and cohort grouping; export Excel; head reads digest. |
| `/about` | `app/(staff)/about/page.tsx` | Counselor, head, faculty | Plain-language staff handbook for the pipeline and pages. | Read; follow links into the app. |
| `/sessions` | `app/(staff)/sessions/page.tsx` | Counselor, head | Calendar of sessions in month/week/day views. | Open a session; complete, no-show, open notes, remove Meet link. |
| `/appointments` | `app/(staff)/appointments/page.tsx` | Counselor, head | Appointment board with status buckets. | Head: assign, unassign, reject. Counselor: confirm, reschedule, complete, no-show, waiver, Meet link. |
| `/availability` | `app/(staff)/availability/page.tsx` | Counselor, head | Weekly availability windows. | Counselor: create/edit/delete slots. Head: view the office's slots, read-only. |
| `/chat` | `app/(staff)/chat/page.tsx` | Counselor, head, faculty | Student threads, staff messages, unread counts. | Open a thread; send; close; mark read. |
| `/students` | `app/(staff)/students/page.tsx` | Counselor, head | Alias directory with workload context. | Search/filter; open a student record. |
| `/students/[id]` | `app/(staff)/students/[id]/page.tsx` | Counselor, head | One-student timeline grouped by month. | Read sessions, referrals, screenings, feedback, note markers, follow-ups; open a note on demand. |
| `/referrals` | `app/(staff)/referrals/page.tsx` | Counselor, head, faculty | Referral pipeline and paper-form detail. | Head: assign/reject. Counselor: confirm (mints a session), resolve, escalate, reject. Faculty: track own referral. |
| `/refer-student` | `app/(staff)/refer-student/page.tsx` | Faculty | File a referral by exact student number. | Look up the exact student; complete concern, priority, and paper fields; submit. |
| `/emergency` | `app/(staff)/emergency/page.tsx` | Counselor, head | Break-glass access to identity. | Log access with justification; reveal after review; view grant status. |
| `/announcements` | `app/(staff)/announcements/page.tsx` | Counselor, head, faculty | Newsfeed, composer, and insights. | Head: draft, publish, unpublish, delete, attach image, read insights. Others: read targeted posts. |
| `/feedback` | `app/(staff)/feedback/page.tsx` | Counselor, head | Student session feedback. | Read ratings/comments; filter. |
| `/notifications` | `app/(staff)/notifications/page.tsx` | Signed-in staff | Full notification inbox with deep links. | Mark read; follow a link to the owning page. |
| `/settings` | `app/(staff)/settings/page.tsx` | Counselor, head, faculty, admin | Own profile, avatar, and preferences. | Edit profile; upload avatar; sign out. |

### 3.3 Admin shell (head only)

| Route | File | Who | Purpose | Key actions |
|---|---|---|---|---|
| `/users` | `app/(admin)/users/page.tsx` | Guidance head | User directory with role/status filters and counts. | Filter; activate/deactivate through the privileged route. |
| `/users/new` | `app/(admin)/users/new/page.tsx` | Guidance head | Create a counselor or faculty account. | Submit a staff registration. |
| `/security` | `app/(admin)/security/page.tsx` | Guidance head | Break-glass review console. | Review a grant; inspect access rows. |
| `/security/events` | `app/(admin)/security/events/page.tsx` | Guidance head | Audit event trail. | Filter and read audit events (no clinical content). |
| `/backups` | `app/(admin)/backups/page.tsx` | Guidance head | Backup runs and artifacts. | Run a manual backup; download an artifact; read run status. |

### 3.4 Important overlays (not separate routes)

These are dialogs inside the pages above. They are listed because testers often look for a URL and do not find one.

| Overlay | Lives on | What it does |
|---|---|---|
| Appointment detail | `/appointments`, `/sessions` | Shows the session, Meet link, waiver state, and actions. |
| Confirm dialog | `/appointments` | Picks a final time inside availability; creates or pastes a Meet link. |
| Waiver dialog | Complete action | Captures a 10–500 character operational reason. |
| Session notes editor | Completed session | Freeform or S.O.A.P.; saves `session_notes`; attachments. |
| Referral form | `/refer-student`, `/referrals` | Digitized paper referral with concern, priority, and case classification. |
| Excel import/export | `/referrals`, `/reports` | Referral workbook and report workbook. |
| Announcement composer | `/announcements` | Title, body, audience, image, draft/publish. |
| Break-glass log/reveal | `/emergency` | Justification, grant status, reveal. |
| User status confirm | `/users` | Activate/deactivate a staff account. |

---

## 4. Mobile tree

```text
/                         Launch gate + first-run onboarding (device flag)
├── /login                Sign in (email/password, Google)
├── /register             Student registration
└── (tabs)
    ├── /(tabs)/home      Greeting, next session, announcements, mood check, breathing, quick actions
    ├── /(tabs)/sessions  Upcoming / Past / Canceled lists
    └── /(tabs)/profile   Profile, avatar, onboarding replay, logout

Root stack (pushed over the tabs)
├── /book                 Booking step 1 of 2: concern, mode, day, slot, alias
├── /check-in             PSS-10; booking step 2, pre-session check-in, or standalone stress check
├── /chat                 Counselor inbox and conversation
└── /notifications        Notification inbox
```

The tab bar shows five items: **Home, Book, Chat, Sessions, Profile**. Only Home, Sessions, and Profile are real tab screens; Book and Chat are root stack screens presented as tab items. This is why pressing Book or Chat pushes a screen rather than switching a tab.

### 4.1 Mobile screen inventory

| Route | File | Purpose | Key actions | Reads / writes |
|---|---|---|---|---|
| `/` | `app/index.tsx` | First-run onboarding and session gate. | Read three onboarding pages; **Get started**; route to home or login. | Device onboarding flag; Supabase session. |
| `/login` | `app/login.tsx` | Student sign-in. | Email/password; Google; go to register. | Auth session. |
| `/register` | `app/register.tsx` | Student registration. | Name, email, student number, program, year, password; Google path. | `auth.users`, `profiles`, `students`. |
| `/(tabs)/home` | `app/(tabs)/home.tsx` | Student home. | Open next session; read announcements; pick a mood (not saved); breathing exercise; quick actions. | `appointments`, `announcements`, `notifications`, `profiles`. |
| `/(tabs)/sessions` | `app/(tabs)/sessions.tsx` | Upcoming, Past, Canceled sessions. | Open details; cancel; reschedule; rate; start a pre-session check-in. | `appointments`, `feedback`, `pss10_assessments`. |
| `/(tabs)/profile` | `app/(tabs)/profile.tsx` | Profile and preferences. | Upload avatar; toggle share-photo consent; replay onboarding; log out. | `profiles`, `students`, Storage. |
| `/book` | `app/book.tsx` | Booking step 1 of 2. | Pick concern, mode (in person/online), day, slot; **Book under my alias**; continue. | `counselor_availability`. |
| `/check-in` | `app/check-in.tsx` | PSS-10 in three modes. | Answer 10 items; submit. Booking mode creates the appointment after the score; pre-session mode links to an appointment; standalone mode saves a screening. | `pss10_assessments`, `appointments`. |
| `/chat` | `app/chat.tsx` | Counselor inbox and conversation. | Open a counselor thread; send; read. | `chat_threads`, `chat_messages`, `notifications`. |
| `/notifications` | `app/notifications.tsx` | Notification inbox. | Mark read; follow a deep link. | `notifications`. |

### 4.2 Local-only behaviours (not database features)

| Behaviour | Where | Why it is local |
|---|---|---|
| Onboarding "seen" flag | `/` | Per-install preference; replayable from Profile. |
| Mood picker | Home | A self-check moment; **not persisted** and not a screening. Do not call it mood history. |
| Breathing exercise | Home | Plays a bundled audio guide; nothing clinical is stored. |
| Program/year list | Register | Fixed DOrSU reference list, not user data. |
| Quick-reply chips | Chat | Text shortcuts. |

---

## 5. Role access matrix

`Yes` means the role can reach the page under the current layout and page guards. `Read` means the page opens but the role's actions are limited. `No` means the page redirects or the sidebar hides it. `Mobile` means the capability lives in the student app instead of the web.

| Route | Student | Counselor | Guidance head | Faculty | Admin |
|---|---|---|---|---|---|
| `/` | Yes | Yes | Yes | Yes | Yes |
| `/login`, `/register`, `/reset-password` | Yes | Yes | Yes | Yes | Yes |
| `/update-password` | Recovery | Recovery | Recovery | Recovery | Recovery |
| `/dashboard` | Mobile | Yes | Yes | Yes | No |
| `/reports` | Mobile | Yes | Yes | Yes (own referrals) | No |
| `/about` | No | Yes | Yes | Yes | No |
| `/sessions` | Mobile | Yes | Yes | No | No |
| `/appointments` | Mobile | Yes | Yes | No | No |
| `/availability` | Mobile | Yes | Read | No | No |
| `/chat` | Mobile | Yes | Yes | Yes | No |
| `/students` | No | Yes | Yes | No | No |
| `/students/[id]` | No | Yes | Yes | No | No |
| `/referrals` | No | Yes | Yes | Yes (own) | No |
| `/refer-student` | No | No | No (action exists, no nav) | Yes | No |
| `/emergency` | No | Yes | Yes | No | No |
| `/announcements` | Mobile feed | Read | Yes | Read | No |
| `/feedback` | Mobile rating | Yes | Yes | No | No |
| `/notifications` | Mobile | Yes | Yes | Yes | Yes (bell/inbox) |
| `/settings` | No | Yes | Yes | Yes | Yes |
| `/users`, `/users/new` | No | No | Yes | No | No |
| `/security`, `/security/events` | No | No | Yes | No | No |
| `/backups` | No | No | Yes | No | No |

Notes:

- The **student** column is intentionally mostly `Mobile`. There is no student web portal; `app/(staff)/layout.tsx` rejects the student role.
- **Admin** is narrower than its name suggests. It enters the staff shell, but only `/settings` is written to allow it; the sidebar hides every other link. Office administration is performed by `guidance_head`.
- `guidance_personnel` exists in `shared-types` but has no route or action policy entry, so it cannot reach any page in this revision.
- The sidebar is a convenience, not a security boundary. `rbac.ts`, route-group `requireRole(...)`, page-level role checks, and RLS are the enforcement layers.

---

## 6. Primary journeys

### 6.1 Student: first run to a confirmed session

```text
/  (onboarding) → /register → /login → /(tabs)/home
  → /book (concern, mode, day, slot, alias)
  → /check-in (PSS-10)
  → /chat (lands here after booking)
  → /(tabs)/sessions (status pending, then assigned, then confirmed)
  → /(tabs)/sessions → reschedule or cancel (rules apply)
  → /check-in?appointmentId=… (pre-session, from 7 days before)
  → session happens
  → /(tabs)/sessions → rate once
```

Route hops that surprise testers:

- Booking ends in **Chat**, not Sessions. The request exists, but the student sees the conversation surface first.
- The pre-session check-in is the **same** `/check-in` screen with an `appointmentId` parameter; it is not a separate route.
- A confirmed session can be rescheduled by the student until **24 hours** before start. Inside that window the app tells the student to contact the Guidance Office.
- **Canceled** is the UI spelling in the sessions tab; the database status is `cancelled`.

### 6.2 Counselor: a working day

```text
/login → /dashboard
  → /appointments (confirm assigned requests; set time; Meet link)
  → /sessions (calendar; open a session)
  → complete or no-show (fresh PSS-10 or audited waiver)
  → notes editor (freeform or S.O.A.P.)
  → /students → /students/[id] (timeline; notes on demand)
  → /availability (own slots)
  → /chat (student threads and staff messages)
  → /referrals (assigned referrals; confirm into a session)
  → /feedback (session ratings)
```

### 6.3 Guidance head: office operations

```text
/login → /dashboard
  → /appointments (assign or reject pending requests)
  → /reports (wellbeing trend, cohort stress, data quality, export)
  → /users (accounts) → /users/new (staff)
  → /security (review break-glass) → /security/events (audit)
  → /backups (run and download)
  → /announcements (compose, publish, insights)
  → /referrals (assign or reject referrals)
  → /emergency (reveal in a crisis)
```

### 6.4 Faculty: refer and track

```text
/login → /dashboard
  → /refer-student (exact student number, concern, priority, paper fields)
  → /referrals (own referral status and trail)
  → /reports (own-referral report)
  → /chat (staff messaging rules apply)
  → /announcements (read targeted posts)
```

### 6.5 Admin: settings only

```text
/login → /settings
```

The admin account can edit its own profile and sign out. It cannot open the office boards, analytics, security console, or backups.

---

## 7. Navigation map

### Web sidebar groups

The sidebar comes from `STAFF_NAV_GROUPS` in `components/shared/staff-nav.tsx`; links are filtered by role and de-duplicated.

| Group | Links |
|---|---|
| **Overview** | Dashboard, Reports, About |
| **Sessions** | Session calendar, Appointments, Availability, Chat |
| **People** | Users (head), Students (counselor/head), Referrals (counselor/head/faculty) |
| **Manage** | Refer Student (faculty), Emergency access (counselor/head), Add staff (head), Announcements (counselor/head/faculty), Feedback (counselor/head), Security (head), Backups (head), Settings (all shell roles) |

The top bar carries the notification bell, the profile menu, and sign-out. On narrow screens the sidebar becomes a drawer opened from the menu button.

### Mobile tab bar

| Item | Destination | Real tab? |
|---|---|---|
| Home | `/(tabs)/home` | Yes |
| Book | `/book` | No — root stack push |
| Chat | `/chat` | No — root stack push |
| Sessions | `/(tabs)/sessions` | Yes |
| Profile | `/(tabs)/profile` | Yes |

---

## 8. Dead routes and inconsistencies

These are real findings from comparing `rbac.ts`, the sidebar, and the page tree. They are listed so a reviewer does not discover them as surprises.

| Item | What the code says | What actually happens |
|---|---|---|
| `/analytics` | `rbac.ts` grants it to `guidance_head`; `homeRouteFor("guidance_head")` and `homeRouteFor("admin")` return it. | **No page exists.** The web `homeForRole` sends the head to `/dashboard` and admin to `/settings`, so the dead route is normally avoided. Opening `/analytics` directly is a 404. |
| `/resources` | `rbac.ts` grants it to `student`. | **No page or mobile screen exists.** |
| `/appointments/new` | `rbac.ts` grants it to `student`. | **No page exists.** Students book through mobile `/book`. |
| `/emergency` | Used by the sidebar and page, but absent from the `AppRoute` union and `routePolicy`. | The page is protected by the staff layout and its own role checks, not by `canVisitRoute`. |
| `/students/[id]` | Real page, but absent from `AppRoute`. | Reached from `/students`; guarded by the staff layout and page checks. |
| `/update-password` | Real public page, but absent from `AppRoute`. | Reached from the recovery email link. |
| `/notifications` | `routePolicy` excludes `admin`, but the page has no explicit role redirect. | Admin can reach it from the bell; it is not a sensitive page. |
| Student `/appointments` | `routePolicy` allows `student`. | No student web page exists; the student equivalent is mobile `/(tabs)/sessions`. |
| `rbac.ts` "prefix match" comment | The comment says route groups use prefix matching. | `canVisitRoute` is an **exact** lookup. Do not rely on a parent entry to cover a child route. |

**Recommendation (documentation, not code):** either delete the dead `AppRoute` entries or implement the pages. Until then, treat `rbac.ts` as a policy sketch for those five names, not as a route inventory.

---

## 9. State and feedback patterns

Every data-bearing screen follows the same interaction contract:

| State | What the user sees |
|---|---|
| Loading | A skeleton or a board-level loading row; the route-pending overlay covers navigation. |
| Empty | A short sentence explaining what will appear, not a blank table. |
| Error | A sentence-case message with a retry or reload instruction. |
| Optimistic write | The row patches immediately; a failure rolls the row back and shows a toast. |
| Realtime update | The board cache patches from an event; no full refresh and no polling. |
| Permission denied | The page redirects or the action is hidden; the server/RLS still rejects the write. |

These patterns matter for Objective 1 and Objective 11: they are designed in, but they are not a substitute for a measured usability study.

---

## 10. Verification checklist

1. Count the page files: `Get-ChildItem apps/web/app -Recurse -Filter page.tsx` (26 at the time of writing).
2. Count the mobile screens: `Get-ChildItem apps/mobile/app -Recurse -Filter *.tsx` (10 route files plus two layouts).
3. Open `components/shared/staff-nav.tsx` and confirm the four sidebar groups and role filters.
4. Open `rbac.ts` and compare the access matrix in §5.
5. Visit each dead route in §8 and confirm the finding (expect 404 for `/analytics`, `/resources`, `/appointments/new`).
6. Walk the student journey in §6.1 on a device or simulator and confirm the landing screen after booking is Chat.
7. Confirm that admin can open `/settings` and is redirected from `/dashboard`.
