import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { getSupabase } from './client';
import { finishOAuthAccount } from './studentSetup';

export type GoogleAuthOutcome =
  | { status: 'success'; next: 'home' | 'complete-profile'; fullName: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

/**
 * Deep link Supabase sends the in-app browser back to.
 * Dev builds: dorsu-mental://auth/callback
 * Expo Go:   exp://<host>/--/auth/callback
 * Both must be allowlisted in Supabase → Auth → URL Configuration.
 */
export function googleRedirectUrl(): string {
  return Linking.createURL('auth/callback');
}

function readParam(url: string, key: string): string | null {
  const { queryParams } = Linking.parse(url);
  const value = queryParams?.[key];
  return typeof value === 'string' ? value : null;
}

function friendlyOAuthError(message: string): string {
  if (/access_denied|cancel/i.test(message)) return 'Google sign-in was cancelled.';
  if (/provider is not enabled|unsupported provider|validation_failed/i.test(message)) {
    return 'Google sign-in is not enabled yet. Please use email or contact the Guidance Office.';
  }
  if (/already.*(registered|exists)|email.*already/i.test(message)) {
    return 'This email already has an account. Log in with your email and password instead.';
  }
  if (/failed to fetch|network request failed|networkerror/i.test(message)) {
    return "Can't reach the server. Check your connection and try again.";
  }
  return message;
}

/**
 * Same behaviour as the web "Continue with Google" button, but for a native
 * app: open the provider in an in-app browser, catch the PKCE code on the
 * deep link, exchange it for a session, then finish the student rows.
 */
export async function continueWithGoogle(): Promise<GoogleAuthOutcome> {
  const supabase = getSupabase();
  const redirectTo = googleRedirectUrl();

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        // We open the URL ourselves so the app keeps control of the callback.
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) return { status: 'error', message: friendlyOAuthError(error.message) };
    if (!data?.url) {
      return { status: 'error', message: "Google sign-in couldn't start. Please try again." };
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'cancel' || result.type === 'dismiss') return { status: 'cancelled' };
    if (result.type !== 'success') {
      return { status: 'error', message: "Google sign-in didn't finish. Please try again." };
    }

    const oauthError = readParam(result.url, 'error_description') ?? readParam(result.url, 'error');
    if (oauthError) return { status: 'error', message: friendlyOAuthError(oauthError) };

    const code = readParam(result.url, 'code');
    if (!code) {
      return { status: 'error', message: "Google didn't send a sign-in code. Please try again." };
    }

    const { data: exchanged, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) return { status: 'error', message: friendlyOAuthError(exchangeError.message) };
    if (!exchanged.user) {
      return { status: 'error', message: "Google sign-in didn't return an account. Please try again." };
    }

    const setup = await finishOAuthAccount(supabase);
    if (!setup.ok) return { status: 'error', message: setup.error };

    return {
      status: 'success',
      next: setup.needsStudentDetails ? 'complete-profile' : 'home',
      fullName: setup.fullName,
    };
  } catch (e) {
    return {
      status: 'error',
      message: friendlyOAuthError(e instanceof Error ? e.message : 'Google sign-in failed. Please try again.'),
    };
  }
}
