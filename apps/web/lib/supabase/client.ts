import { createBrowserClient, type CookieOptions } from "@supabase/ssr";
import { resolveSupabaseEnv, type TypedSupabaseClient } from "@dorsu/supabase-client";
import { readRememberPreference, withRememberLifetime } from "./remember";

/**
 * Read every cookie as `{ name, value }`. `@supabase/ssr` filters this list
 * down to the auth/PKCE chunks it needs.
 */
function readCookies(): { name: string; value: string }[] {
  if (typeof document === "undefined") return [];
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const separator = part.indexOf("=");
      if (separator === -1) return [];
      const name = part.slice(0, separator);
      const raw = part.slice(separator + 1);
      let value = raw;
      try {
        value = decodeURIComponent(raw);
      } catch {
        // Leave malformed values untouched so the SDK can treat them as absent.
      }
      return [{ name, value }];
    });
}

function writeCookie(name: string, value: string, options: CookieOptions): void {
  if (typeof document === "undefined") return;
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path ?? "/"}`];
  if (typeof options.maxAge === "number") parts.push(`Max-Age=${options.maxAge}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.sameSite) {
    const sameSite = options.sameSite === true ? "strict" : options.sameSite;
    parts.push(`SameSite=${sameSite.charAt(0).toUpperCase()}${sameSite.slice(1)}`);
  }
  if (options.secure) parts.push("Secure");
  if (options.httpOnly) parts.push("HttpOnly");
  document.cookie = parts.join("; ");
}

/**
 * Browser Supabase client (cookie-based). Connection config comes from the
 * shared package; only the cookie storage adapter lives here (principle #5).
 *
 * The custom `getAll`/`setAll` pair lets us honour the "Remember me" choice:
 * Supabase's built-in document cookie storage always writes a 400-day
 * `maxAge`, which would make every session persistent.
 */
export function createClient(): TypedSupabaseClient {
  const { url, anonKey } = resolveSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env["NEXT_PUBLIC_SUPABASE_URL"],
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  });
  return createBrowserClient(url, anonKey, {
    cookies: {
      getAll: () => readCookies(),
      setAll: (cookiesToSet) => {
        // Read at write time: the preference may have changed after the
        // singleton browser client was created.
        const remembered = readRememberPreference();
        cookiesToSet.forEach(({ name, value, options }) =>
          writeCookie(name, value, withRememberLifetime(options, remembered)),
        );
      },
    },
  });
}
