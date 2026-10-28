# Google sign-in (web + mobile)

Both apps offer **Continue with Google** against the same Supabase project.
The feature is implemented in code; it starts working once the two dashboards
below are configured. Nothing in the repo stores a Google secret.

---

## 1. Supabase → Authentication → Providers → Google

1. Enable **Google**.
2. Paste the **Client ID** and **Client secret** from Google Cloud (step 2).
3. Save.

## 2. Google Cloud Console → APIs & Services → Credentials

1. Create an **OAuth client ID** of type **Web application**.
2. Add an **Authorized redirect URI**:

   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```

   This is Supabase's callback, **not** the app's. There is only one entry
   needed for web, iOS, and Android.
3. Copy the client ID / secret into Supabase (step 1).

## 3. Supabase → Authentication → URL Configuration

Add every redirect the apps can return to:

| Environment | Redirect URL |
|---|---|
| Web (local) | `http://localhost:3000/**` |
| Web (production) | `https://<your-domain>/**` |
| Mobile dev build / TestFlight / Play | `dorsu-mental://**` |
| Expo Go | `exp://**` |

`supabase/config.toml` already lists the local values:

```toml
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000/**", "exp://**", "dorsu-mental://**"]
```

Hosted projects do **not** read `config.toml` — set these in the dashboard.

---

## How each app uses Google

### Web

`apps/web/components/auth/GoogleButton.tsx` → `signInWithOAuth` (PKCE) →
Supabase → `/auth/confirm?code=...` → exchanges the code, auto-provisions a
`profiles` + `students` row for first-time users, then routes to the role home.

### Mobile

`apps/mobile/lib/supabase/googleAuth.ts` (`continueWithGoogle`):

1. `signInWithOAuth` with `skipBrowserRedirect: true` and
   `redirectTo = Linking.createURL('auth/callback')`.
2. Opens the provider in an in-app browser (`expo-web-browser`).
3. Reads `code` from the returned deep link and calls
   `exchangeCodeForSession` (PKCE verifier is in AsyncStorage).
4. `finishOAuthAccount()` runs `ensureStudentRows`, then checks whether the
   student number, program, and year level exist.

Because Google never supplies school details, a **first-time Google user** is
routed to `/register?google=1` — the same screen in a "Finish your account"
mode that asks only for student number, faculty, and year level. Existing
students skip it.

`apps/mobile/lib/supabase/client.ts` must keep `flowType: 'pkce'` and
`detectSessionInUrl: false`; the app owns the redirect.

---

## Verifying

1. Web: log out → `/login` → Continue with Google → lands on the role home.
2. Mobile: log out → Continue with Google → consent → app returns.
   - Existing student → Home.
   - New student → "Finish your account" → Home after saving.
3. Cancel the consent screen → no error, no session, stay on login.

## Common failures

| Symptom | Cause |
|---|---|
| `redirect_uri_mismatch` (Google page) | Redirect URI in Google Cloud is not `https://<ref>.supabase.co/auth/v1/callback` |
| Returns to login with no session | Mobile redirect scheme missing from Supabase URL Configuration |
| `provider is not enabled` | Google provider disabled in Supabase |
| "This email already has an account" | The email already signs in with a password; use that login |
| Works on web, fails in Expo Go | `exp://**` missing from the redirect allowlist |
