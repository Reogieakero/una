import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { resolveSupabaseEnv } from "@dorsu/supabase-client";
import { homeForRole } from "@/lib/auth/home";
import { REMEMBER_COOKIE, isRemembered, withRememberLifetime } from "@/lib/supabase/remember";

/**
 * GET /auth/confirm — landing target for Supabase email links (recovery,
 * signup confirmation) AND Google OAuth.
 *
 * - Exchanges the `code` for a session, then redirects to `?next=`
 *   (same-origin paths only — open-redirect guard).
 * - Recovery flow (`next=/update-password`) is passed through untouched.
 * - Existing profiles are routed by role; pending staff are sent to the
 *   approval screen and approved-but-incomplete staff to `/complete-profile`.
 *   First-time OAuth users choose Student, Faculty, or Guidance Counselor on
 *   `/register/role` (00075/00076).
 *
 * Cloud note: this URL must be allowlisted in Dashboard → Auth → URL
 * Configuration → Redirect URLs (local: http://localhost:3000/**) along
 * with Google as an enabled provider.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  // OAuth callbacks arrive without `next` (Google button uses a query-free
  // redirectTo) and should land on the role home. Password recovery is the
  // only flow that opts into `/update-password`, and it passes `next`
  // explicitly from /reset-password.
  const rawNext = url.searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") ? rawNext : "/";
  if (!code) return NextResponse.redirect(new URL("/login", url.origin));

  let response = NextResponse.next({ request });
  const remembered = isRemembered(request.cookies.get(REMEMBER_COOKIE)?.value);
  const { url: supabaseUrl, anonKey } = resolveSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env["NEXT_PUBLIC_SUPABASE_URL"],
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  });
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, withRememberLifetime(options, remembered)),
        );
      },
    },
  });
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const dest = new URL("/login", url.origin);
    const final = NextResponse.redirect(dest);
    for (const c of response.cookies.getAll()) final.cookies.set(c.name, c.value, c);
    return final;
  }

  // Recovery flow — session is for setting a new password, don't touch profiles.
  if (next.startsWith("/update-password")) {
    const dest = new URL(next, url.origin);
    const final = NextResponse.redirect(dest);
    for (const c of response.cookies.getAll()) final.cookies.set(c.name, c.value, c);
    return final;
  }

  // OAuth / email-confirm flows — role-aware routing. A first-time OAuth user
  // has no profile yet, so send them to the role picker; the server route that
  // writes the profile is the only place that can assign a role.
  let destPath = next === "/" ? "/" : next;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, approval_status, profile_completed")
        .eq("id", user.id)
        .single();
      if (profile?.role) {
        if (profile.approval_status === "pending") {
          destPath = "/pending-approval";
        } else if (profile.approval_status === "rejected") {
          destPath = "/login?rejected=1";
        } else if (
          profile.profile_completed === false &&
          (profile.role === "faculty" || profile.role === "counselor")
        ) {
          destPath = "/complete-profile";
        } else {
          destPath = homeForRole(profile.role);
        }
      } else {
        destPath = "/register/role";
      }
    }
  } catch {
    // Best-effort: fall through to the requested `next`.
  }
  const dest = new URL(destPath.startsWith("/") ? destPath : "/", url.origin);
  const final = NextResponse.redirect(dest);
  for (const c of response.cookies.getAll()) final.cookies.set(c.name, c.value, c);
  return final;
}
