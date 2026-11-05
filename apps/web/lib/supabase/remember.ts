/**
 * "Remember me" support for cookie-based auth.
 *
 * `@supabase/ssr` always writes auth cookies with a 400-day `maxAge`, so a
 * non-persistent session cannot be requested through `cookieOptions`. Instead
 * we persist the user's choice in a small preference cookie and strip the
 * lifetime from auth cookie writes when they opted out. Middleware reads the
 * same preference so a refreshed token does not silently become persistent
 * again after the browser has been closed.
 */

export const REMEMBER_COOKIE = "chekie-remember";

/** Keep the preference for as long as the default Supabase auth cookie. */
export const REMEMBER_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

/**
 * Defaults to remembered so flows without a checkbox (OAuth, registration,
 * password recovery) keep their existing persistent-session behaviour.
 */
export function isRemembered(value: string | null | undefined): boolean {
  return value !== "0";
}

export function readRememberPreference(): boolean {
  if (typeof document === "undefined") return true;
  const prefix = `${REMEMBER_COOKIE}=`;
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  if (!match) return true;
  return isRemembered(decodeURIComponent(match.slice(prefix.length)));
}

export function writeRememberPreference(remember: boolean): void {
  if (typeof document === "undefined") return;
  document.cookie = [
    `${REMEMBER_COOKIE}=${remember ? "1" : "0"}`,
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${REMEMBER_COOKIE_MAX_AGE}`,
  ].join("; ");
}

/**
 * Remove `maxAge`/`expires` from a cookie options object when the user did not
 * choose "remember me". A cookie without those attributes is a session cookie,
 * so the browser drops it when the window closes.
 *
 * Explicit deletions (`maxAge: 0` or an expiry in the past) are preserved —
 * sign-out and stale-chunk cleanup depend on them.
 */
export function withRememberLifetime<T extends { maxAge?: number; expires?: Date }>(
  options: T,
  remembered: boolean,
): T {
  if (remembered) return options;
  const deleting =
    options.maxAge === 0 ||
    (options.expires !== undefined && options.expires.getTime() <= Date.now());
  if (deleting) return options;
  const { maxAge: _maxAge, expires: _expires, ...rest } = options;
  return rest as T;
}
