import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { resolveSupabaseEnv } from "@dorsu/supabase-client";
import { homeForRole } from "@/lib/auth/home";
import { REMEMBER_COOKIE, isRemembered, withRememberLifetime } from "./remember";

/**
 * Screens that never read the session server-side. Skipping the remote
 * `getUser()` on these keeps sign-in ↔ registration navigation instant; the
 * session is validated/refreshed on the next protected navigation instead.
 */
const PUBLIC_AUTH_PATHS = new Set([
  "/login",
  "/register",
  "/reset-password",
  "/update-password",
]);

function isPublicAuthPath(pathname: string) {
  return PUBLIC_AUTH_PATHS.has(pathname) || pathname.startsWith("/auth/");
}

/** Refreshes the auth cookie on every request; route guards live in layouts. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = resolveSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env["NEXT_PUBLIC_SUPABASE_URL"],
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  });
  const remembered = isRemembered(request.cookies.get(REMEMBER_COOKIE)?.value);
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, withRememberLifetime(options, remembered)),
        );
      },
    },
  });
  const user = isPublicAuthPath(request.nextUrl.pathname)
    ? null
    : (await supabase.auth.getUser()).data.user;

  // A remembered staff session should not dump the user back on the marketing
  // page when they open the site root. Students intentionally stay on "/"
  // (their home is the mobile app), so only non-student destinations redirect.
  if (user && request.nextUrl.pathname === "/") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active, approval_status, profile_completed")
      .eq("id", user.id)
      .single();
    if (profile) {
      const incompleteStaff =
        profile.profile_completed === false &&
        (profile.role === "faculty" || profile.role === "counselor");
      const destination =
        profile.approval_status === "pending"
          ? "/pending-approval"
          : profile.approval_status === "rejected" || profile.is_active === false
            ? "/"
            : incompleteStaff
              ? "/complete-profile"
              : homeForRole(profile.role);
      if (destination !== "/") {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = destination;
        redirectUrl.search = "";
        const redirectResponse = NextResponse.redirect(redirectUrl);
        for (const cookie of response.cookies.getAll()) {
          redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
        }
        return redirectResponse;
      }
    }
  }

  return response;
}
