import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resolveSupabaseEnv } from "@dorsu/supabase-client";

/**
 * GET /auth/confirm — landing target for Supabase email links (recovery,
 * signup confirmation) AND Google OAuth.
 *
 * - Exchanges the `code` for a session, then redirects to `?next=`
 *   (same-origin paths only — open-redirect guard).
 * - Recovery flow (`next=/update-password`) is passed through untouched.
 * - OAuth / all other flows are role-routed: existing profiles go to their
 *   role home; first-time Google users get a `student` profile + `students`
 *   row auto-provisioned (student_no stays null until they complete it).
 *
 * Cloud note: this URL must be allowlisted in Dashboard → Auth → URL
 * Configuration → Redirect URLs (local: http://localhost:3000/**) along
 * with Google as an enabled provider.
 */
function homeForRole(role: string | null | undefined): string {
  switch (role) {
    case "counselor":
      return "/dashboard";
    case "faculty":
      return "/referrals";
    case "guidance_head":
      return "/dashboard";
    case "student":
    default:
      return "/";
  }
}

async function generateAlias(admin: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const alias = `Client-${Math.floor(1000 + Math.random() * 9000)}`;
    const { data } = await admin
      .from("students")
      .select("profile_id")
      .eq("anonymous_alias", alias)
      .maybeSingle();
    if (!data) return alias;
  }
  return `Client-${Date.now().toString().slice(-6)}`;
}
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const rawNext = url.searchParams.get("next") ?? "/update-password";
  const next = rawNext.startsWith("/") ? rawNext : "/update-password";
  if (!code) return NextResponse.redirect(new URL("/login", url.origin));

  let response = NextResponse.next({ request });
  const { url: supabaseUrl, anonKey } = resolveSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env["NEXT_PUBLIC_SUPABASE_URL"],
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  });
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
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

  // OAuth / email-confirm flows — role-aware routing + first-time Google
  // student auto-provision (browser clients can't insert into `profiles`).
  let destPath = next === "/" ? "/" : next;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile?.role) {
        destPath = homeForRole(profile.role);
      } else {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const admin = createAdminClient();
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
        const fullName =
          (typeof meta["full_name"] === "string" && meta["full_name"]) ||
          (typeof meta["name"] === "string" && meta["name"]) ||
          (typeof user.email === "string" ? user.email.split("@")[0] : "Student");
        const avatarUrl =
          typeof meta["avatar_url"] === "string"
            ? (meta["avatar_url"] as string)
            : typeof meta["picture"] === "string"
              ? (meta["picture"] as string)
              : null;
        const { error: profileError } = await admin.from("profiles").insert({
          id: user.id,
          email: user.email ?? "",
          role: "student",
          full_name: fullName,
          avatar_url: avatarUrl,
        });
        if (!profileError) {
          const alias = await generateAlias(admin);
          await admin.from("students").insert({
            profile_id: user.id,
            anonymous_alias: alias,
          });
        }
        destPath = "/";
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
