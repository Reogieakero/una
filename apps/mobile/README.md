# Chekie Student — DOrSU Guidance Mobile App

The student-facing companion to the DOrSU Guidance platform. Built with **Expo SDK 58**, **expo-router**, **React 19**, and **TypeScript (strict)**, sharing domain logic, validation, and Supabase types with the web app through the monorepo packages.

Students can log in, book a session, complete a PSS-10 stress check-in, and review session/chat surfaces in the brand's "sunrise" design system.

---

## Run

From the repo root:

```bash
pnpm install
pnpm --filter @dorsu/mobile dev
```

Or from this folder:

```bash
npx expo start
```

Then press `i` (iOS simulator), `a` (Android emulator), or scan the QR code with Expo Go.

### Environment

The app reads the shared Supabase project through `EXPO_PUBLIC_*` variables (see the root `.env.example`). Create `apps/mobile/.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Connection resolution lives in `@dorsu/supabase-client`; the app only owns the AsyncStorage session adapter (`lib/supabase/client.ts`). Never put the service-role key in a mobile env file.

### Typecheck / lint

```bash
pnpm --filter @dorsu/mobile typecheck
pnpm --filter @dorsu/mobile lint
```

---

## Routes

Flat expo-router structure (no `(auth)` / `(student)` groups):

| Route | Purpose |
|---|---|
| `/` | Launch gate: existing session → Home, returning visitor → Login, brand-new install → three-page onboarding carousel (chat, booking, check-ins). `?replay=1` (from Profile) reopens the carousel |
| `/login` | Email + password sign-in via Supabase Auth; **Continue with Google**; backfills a missing profile/student row |
| `/register` | Student self-registration (name, email, student no., program, year level, strong password) or **Sign up with Google** (school details completed on the same screen via `?google=1`). Supabase email confirmation is ON, so rows are created at first login |
| `/(tabs)/home` | Student home: next session from Supabase (tap the card for the shared details/cancel sheet), announcements, quick actions, breathing exercise, mood check |
| `/(tabs)/sessions` | Upcoming / Past / Canceled tabs from Supabase: tap a card for details (assigned counselor, schedule, reference), cancel, reschedule, and post-session rating |
| `/(tabs)/profile` | Student card from `profiles` + `students`, avatar upload, onboarding replay, log out |
| `/book` | Booking step 1 of 2: concern, mode (in person / online), day and time, anonymous toggle |
| `/check-in` | Booking step 2 of 2: PSS-10 questions; submits the assessment and creates the appointment, then opens chat |
| `/chat` | Two-level messaging: the inbox lists the counselors from the student's confirmed/completed sessions (`messageableCounselors`), then the conversation. Tapping a counselor lazily calls `openThread({ counselorId })` (one open thread per counselor), sends via `sendMessage`, and replies arrive through a realtime `chat_messages` subscription. Back from a dialog returns to the inbox; back from the inbox leaves Chat. |

Tab bar: `components/TabBar.tsx` (home, book, chat, sessions, profile). Chat is a root stack screen but renders the same tab bar at the bottom (with a `TAB_BAR_BASE` margin above the composer); `/book` still hides it.

---

## What is wired vs. still mocked

**Wired to Supabase / shared services:**

- Authentication: login, logout, student registration (`registerStudentSchema`, strong-password rule), session persistence.
- **Google sign-in / sign-up:** `Continue with Google` opens the provider in an in-app browser, exchanges the PKCE code, and bootstraps the student rows. New Google users finish student number/faculty/year on `/register?google=1`. Setup is documented in [`docs/google-signin.md`](../../docs/google-signin.md).
- Profile bootstrap: `lib/supabase/ensureStudent.ts` creates the `profiles` + `students` rows for a signed-in student (RLS-safe, idempotent, alias collision retry).
- Home: upcoming appointments and notifications via `listStudentAppointments`; cancellation via `cancelAppointment`. Notifications now have a real screen (`app/notifications.tsx`) with per-item mark-read, an exact unread badge on the bell/tab bar, and a single realtime subscription (`lib/notifications-context.tsx`) scoped to the signed-in student.
- Reminders: `00065_session_reminders` runs in Postgres every minute and inserts a generic “starts in 10 minutes” notification for the student and the assigned counselor; it arrives through the same realtime bell/toast/inbox path as other notifications.
- Profile: real `profiles` + `students` data; private-bucket photo upload (`expo-image-picker` → `avatars`, signed URL for display), remove, and a student-only “Share photo with my counselor” opt-in that is off by default.
- Sessions: own appointments via `listStudentAppointments` (refresh on focus + pull-to-refresh), a status + assigned-counselor pill on each card, a tap-through details sheet (including a rectangular “Updated by …” badge once staff or the student have moved the session), cancel via `cancelAppointment`, reschedule via the shared reschedule sheet + `rescheduleAppointment` (pending/assigned at any time; confirmed sessions until 24 hours before the start — inside that window the app directs the student to the Guidance Office), and one rating per completed session via `submitFeedback`. Home and Sessions share the same details/cancel/reschedule sheets (`components/SessionDetailsModal.tsx`, `components/RescheduleModal.tsx`). Update attribution comes from the student-scoped `appointment_update_info(uuid)` RPC (00064); nothing from `audit_events` is exposed.
- Booking: real counselor availability from `counselor_availability` (`bookableDays` / `bookableSlots`), then `bookAppointment` / `submitPss10` (`@dorsu/shared-services`). Requests land as `pending` for the head to assign.
- Chat: the inbox is anchored on the student's counselors - `messageableCounselors` derives one contact per counselor from confirmed/completed appointments, and tapping one reuses or lazily opens the thread bound to that counselor (`openThread({ counselorId })`, idempotent per student+counselor). Contacts and threads bound to a `guidance_head` are hidden (`counselor_directory` now returns the profile role, 00074) because heads are not chat participants. Leftover/closed threads stay in a "Conversations" list underneath; there is no counselor-less "Guidance Office" thread anymore (those rows are invisible to the staff inbox, which filters by counselor id). `getThreadWithMessages` loads the selected dialog, `sendMessage` sends, and a `chat_messages` INSERT subscription delivers live staff replies. Migration `00073_chat_message_notify` also drops a generic "New message" notification on the counselor when the student writes. The Chat back button is plain (no card); back from a dialog returns to the inbox, then back from the inbox exits. Opening a dialog clears unread chat notifications. Quick replies are plain outline buttons.
- Stress check: `/check-in` without booking params records the PSS-10 only (Home shortcut).
- Stress check-in: scored and persisted with the PSS-10 band; the total is never shown to the student.

**No local mock data remains in `data/mock.ts`.** That file was removed in P1. The
profile card reads `profiles` + `students`, and the PSS-10 wording/labels now come
from `@dorsu/shared-services` (`pss10-instrument.ts`). Booking day/time presentation
uses real counselor availability, not fixtures.

When adding data, keep the same flow: call `getSupabase()` and a function from
`@dorsu/shared-services` — do not add direct table logic to screens.

---

## Project structure

```
app/
  _layout.tsx          Root stack, font loading, splash, safe-area + status bar
  index.tsx            Launch gate + onboarding carousel (first launch only)
  login.tsx            Supabase email/password sign-in
  register.tsx         Student registration
  (tabs)/
    _layout.tsx        Custom tab bar
    home.tsx           Home dashboard (live data)
    sessions.tsx       Session list (live data)
    profile.tsx        Student profile (live)
  book.tsx             Booking step 1
  check-in.tsx         PSS-10 + booking step 2 (live writes)
  chat.tsx             Student ↔ Guidance chat (live data + realtime)
components/            Button, Card, Chip, Field, ChatBubble, StatusChip, TabBar,
                       MoodPicker, StarRating, ProgressSegments, mascot, illustrations
lib/
  supabase/client.ts       AsyncStorage-backed typed Supabase client
  supabase/ensureStudent.ts Profile/student bootstrap + friendly DB errors
  supabase/googleAuth.ts   Google OAuth (in-app browser + PKCE exchange)
  supabase/studentSetup.ts Finishes OAuth accounts; saves school details
  onboarding.ts            First-launch flag (AsyncStorage)
data/
  academics.ts              DOrSU faculties and year levels for registration
theme.ts               Colors, type scale, spacing, radii, button/input sizes, hit slop
```

---

## Design system

`theme.ts` is the single source of truth for mobile styling:

- **Palette:** cream `#FFF8E1`, ink `#14315C`, blue `#2563B8`, sun `#FFC93C`, danger `#D92D20`.
- **Type:** DM Sans, sizes 10–16 only (`fontSize.xxs` → `fontSize.xl`).
- **Radii:** 4 for inputs/chips/accents, 16 for buttons and cards.
- **Sizes:** 32px buttons, 44px inputs, 16px screen padding, `hitSlop` on small pressables.
- **Cards:** flat white with a soft shadow and a cream underline.

Use `StyleSheet.create` for screen styles and these tokens everywhere — no ad-hoc hex values or font sizes. NativeWind is configured (metro + `global.css`) but current screens use `StyleSheet`.

Icons come from `lucide-react-native/icons/<name>` (per-icon imports keep the bundle small).

---

## Notes and gotchas

- **Monorepo Metro:** `metro.config.js` watches the workspace root and allows `.mjs` resolution so pnpm-symlinked packages and per-icon lucide imports work.
- **React 19 here, React 18 on web.** Shared packages (`@dorsu/*`) must stay framework-free; never move React-dependent UI into them.
- **Typed routes:** `experiments.typedRoutes` is on. After adding a route, restart the dev server so expo-router regenerates `.expo/types`.
- **No test runner** is configured in this repo. Verify with typecheck and a manual run.
- **Deep links:** scheme `dorsu-mental` (also allowed by the local Supabase auth config).
- **Audio:** the home breathing guide uses `expo-audio` and `assets/audio/breath-guide.mp3`.

## Related docs

- Root [`AGENTS.md`](../../AGENTS.md) — architecture rules, commands, shared-package boundaries.
- [`docs/realtime-audit.md`](../../docs/realtime-audit.md) — web realtime/notification architecture.
- [`docs/google-signin.md`](../../docs/google-signin.md) — Google OAuth setup for Supabase, Google Cloud, and mobile redirects.
