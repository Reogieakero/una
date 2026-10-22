# Chekie Student — DOrSU Guidance Mobile App

The student-facing companion to the DOrSU Guidance platform. Built with **Expo SDK 57**, **expo-router**, **React 19**, and **TypeScript (strict)**, sharing domain logic, validation, and Supabase types with the web app through the monorepo packages.

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
| `/` | Three-page onboarding carousel (chat, booking, check-ins) with Lumi mascot → `/login` |
| `/login` | Email + password sign-in via Supabase Auth; backfills a missing profile/student row |
| `/register` | Student self-registration (name, email, student no., program, year level, strong password). Supabase email confirmation is ON, so rows are created at first login |
| `/(tabs)/home` | Student home: next session from Supabase (tap the card for the shared details/cancel sheet), announcements, quick actions, breathing exercise, mood check |
| `/(tabs)/sessions` | Upcoming / Past / Canceled tabs from Supabase: tap a card for details (assigned counselor, schedule, reference), cancel, reschedule, and post-session rating |
| `/(tabs)/profile` | Student card, onboarding replay, log out *(local mock data)* |
| `/book` | Booking step 1 of 2: concern, mode (in person / online), day and time, anonymous toggle |
| `/check-in` | Booking step 2 of 2: PSS-10 questions; submits the assessment and creates the appointment, then opens chat |
| `/chat` | Two-level messaging: an inbox of the student's `chat_threads` (counselor, last message, closed state), then the conversation. Sends via `sendMessage`, first message lazily calls `openThread`, and counselor replies arrive through a realtime `chat_messages` subscription. Back from a dialog returns to the inbox; back from the inbox leaves Chat. |

Tab bar: `components/TabBar.tsx` (home, book, chat, sessions, profile). Chat is a root stack screen but renders the same tab bar at the bottom (with a `TAB_BAR_BASE` margin above the composer); `/book` still hides it.

---

## What is wired vs. still mocked

**Wired to Supabase / shared services:**

- Authentication: login, logout, student registration (`registerStudentSchema`, strong-password rule), session persistence.
- Profile bootstrap: `lib/supabase/ensureStudent.ts` creates the `profiles` + `students` rows for a signed-in student (RLS-safe, idempotent, alias collision retry).
- Home: upcoming appointments and notifications via `listStudentAppointments`; cancellation via `cancelAppointment`. Notifications now have a real screen (`app/notifications.tsx`) with per-item mark-read, an exact unread badge on the bell/tab bar, and a single realtime subscription (`lib/notifications-context.tsx`) scoped to the signed-in student.
- Reminders: `00065_session_reminders` runs in Postgres every minute and inserts a generic “starts in 10 minutes” notification for the student and the assigned counselor; it arrives through the same realtime bell/toast/inbox path as other notifications.
- Profile: real `profiles` + `students` data; private-bucket photo upload (`expo-image-picker` → `avatars`, signed URL for display), remove, and a student-only “Share photo with my counselor” opt-in that is off by default.
- Sessions: own appointments via `listStudentAppointments` (refresh on focus + pull-to-refresh), a status + assigned-counselor pill on each card, a tap-through details sheet (including a rectangular “Updated by …” badge once staff or the student have moved the session), cancel via `cancelAppointment`, reschedule via the shared reschedule sheet + `rescheduleAppointment` (pending/assigned only — confirmed sessions are locked to the Guidance Office), and one rating per completed session via `submitFeedback`. Home and Sessions share the same details/cancel/reschedule sheets (`components/SessionDetailsModal.tsx`, `components/RescheduleModal.tsx`). Update attribution comes from the student-scoped `appointment_update_info(uuid)` RPC (00064); nothing from `audit_events` is exposed.
- Booking: real counselor availability from `counselor_availability` (`bookableDays` / `bookableSlots`), then `bookAppointment` / `submitPss10` (`@dorsu/shared-services`). Requests land as `pending` for the head to assign.
- Chat: an inbox fed by `listThreads` (counselor, latest message preview, closed state), then `getThreadWithMessages` for the selected dialog, `sendMessage` for sends (first message lazily calls `openThread`, so browsing never creates empty threads), and a `chat_messages` INSERT subscription for live staff replies. The Chat back button is plain (no card); back from a dialog returns to the inbox, then back from the inbox exits. Opening a dialog clears unread chat notifications. Quick replies are plain outline buttons.
- Stress check: `/check-in` without booking params records the PSS-10 only (Home shortcut).
- Stress check-in: scored and persisted with the PSS-10 band; the total is never shown to the student.

**Still local mock data (`data/mock.ts`):**

- Profile identity card.
- PSS-10 question wording/labels (scoring itself is real) and booking day/time presentation.

When replacing mock data, keep the same flow: call `getSupabase()` and a function from `@dorsu/shared-services` — do not add direct table logic to screens.

---

## Project structure

```
app/
  _layout.tsx          Root stack, font loading, splash, safe-area + status bar
  index.tsx            Onboarding carousel
  login.tsx            Supabase email/password sign-in
  register.tsx         Student registration
  (tabs)/
    _layout.tsx        Custom tab bar
    home.tsx           Home dashboard (live data)
    sessions.tsx       Session list (live data)
    profile.tsx        Student profile (mock)
  book.tsx             Booking step 1
  check-in.tsx         PSS-10 + booking step 2 (live writes)
  chat.tsx             Student ↔ Guidance chat (live data + realtime)
components/            Button, Card, Chip, Field, ChatBubble, StatusChip, TabBar,
                       MoodPicker, StarRating, ProgressSegments, mascot, illustrations
lib/
  supabase/client.ts       AsyncStorage-backed typed Supabase client
  supabase/ensureStudent.ts Profile/student bootstrap + friendly DB errors
  onboarding.ts            First-launch flag (AsyncStorage)
data/
  mock.ts                  Local mock content (student card, PSS questions)
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
