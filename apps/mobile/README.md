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
| `/register` | Student self-registration (name, email, student no., program, year level, strong password) |
| `/(tabs)/home` | Student home: upcoming sessions from Supabase, announcements, quick actions, breathing exercise, mood check |
| `/(tabs)/sessions` | Upcoming / Past / Canceled tabs, ratings, reschedule/message entry points *(local mock data)* |
| `/(tabs)/profile` | Student card, onboarding replay, log out *(local mock data)* |
| `/book` | Booking step 1 of 2: concern, mode (in person / online), day and time, anonymous toggle |
| `/check-in` | Booking step 2 of 2: PSS-10 questions; submits the assessment and creates the appointment, then opens chat |
| `/chat` | Anonymous counselor chat with canned replies *(mock conversation)* |

Tab bar: `components/TabBar.tsx` (home, sessions, profile). Stack screens hide the tab bar and navigate with `router.push` / `router.replace`.

---

## What is wired vs. still mocked

**Wired to Supabase / shared services:**

- Authentication: login, logout, student registration (`registerStudentSchema`, strong-password rule), session persistence.
- Profile bootstrap: `lib/supabase/ensureStudent.ts` creates the `profiles` + `students` rows for a signed-in student (RLS-safe, idempotent, alias collision retry).
- Home: upcoming appointments and notifications via `listStudentAppointments`, `listNotifications`; cancellation via `cancelAppointment`.
- Booking: `bookAppointment` (`@dorsu/shared-services`) after a completed PSS-10 via `submitPss10`.
- Stress check-in: scored and persisted with the PSS-10 band; the total is never shown to the student.

**Still local mock data (`data/mock.ts`):**

- Sessions tab content, stats, ratings, and cancel state.
- Chat conversation, counselor replies, and quick replies.
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
    sessions.tsx       Session list (mock)
    profile.tsx        Student profile (mock)
  book.tsx             Booking step 1
  check-in.tsx         PSS-10 + booking step 2 (live writes)
  chat.tsx             Anonymous chat (mock)
components/            Button, Card, Chip, Field, ChatBubble, StatusChip, TabBar,
                       MoodPicker, StarRating, ProgressSegments, mascot, illustrations
lib/
  supabase/client.ts       AsyncStorage-backed typed Supabase client
  supabase/ensureStudent.ts Profile/student bootstrap + friendly DB errors
  onboarding.ts            First-launch flag (AsyncStorage)
data/
  mock.ts                  Local mock content (sessions, chat, student card, PSS questions)
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
