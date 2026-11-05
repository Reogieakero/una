import { NextResponse } from "next/server";
import { oauthProfileSchema } from "@dorsu/shared-schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { homeForRole } from "@/lib/auth/home";
import { clientIp, hitRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/auth/oauth-profile — assigns the staff role to a first-time web
 * user (Google or email). The staff portal is counselor/faculty only; students
 * register in the mobile app.
 *
 * The browser cannot insert into `profiles` (RLS: service-role only), so this
 * route owns the write. Both roles are created with `approval_status = 'pending'`,
 * `is_active = false`, and `profile_completed = false`. They can authenticate
 * and reach /pending-approval, but the staff guards and RLS keep them out of
 * the workspace. Their role row (`faculty_members`/`counselors`) is deliberately
 * created only on approval, so no staff-scoped RLS path opens before sign-off.
 * Once approved they fill in their real name/employee details on
 * /complete-profile (00076).
 */
export async function POST(request: Request) {
  const gate = hitRateLimit(`oauth-profile:${clientIp(request)}`, 10, 10 * 60 * 1000);
  if (gate.limited) {
    return NextResponse.json(
      { error: "Too many attempts — please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(gate.retryAfterSec) } },
    );
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = oauthProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Choose a role." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const admin = createAdminClient();

  // One profile per auth user. If a profile already exists, send the client to
  // the right place instead of letting it create a second role.
  const { data: existing } = await admin
    .from("profiles")
    .select("role, approval_status, profile_completed")
    .eq("id", user.id)
    .maybeSingle();
  if (existing) {
    const row = existing as {
      role: string;
      approval_status: string;
      profile_completed: boolean;
    };
    return NextResponse.json(
      {
        error: "This account already has a Chekie profile.",
        redirectTo:
          row.approval_status === "pending"
            ? "/pending-approval"
            : row.approval_status === "approved" && !row.profile_completed
              ? "/complete-profile"
              : homeForRole(row.role),
      },
      { status: 409 },
    );
  }

  const role = parsed.data.role;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName =
    (typeof meta["full_name"] === "string" && meta["full_name"].trim()) ||
    (typeof meta["name"] === "string" && meta["name"].trim()) ||
    (typeof user.email === "string" ? user.email.split("@")[0] : "Staff");

  const { error: profileError } = await admin.from("profiles").insert({
    id: user.id,
    email: user.email ?? "",
    role,
    full_name: fullName,
    // No external OAuth avatar: Google URLs cannot be gated by storage RLS.
    avatar_url: null,
    is_active: false,
    approval_status: "pending",
    // Replace the temporary name/details on /complete-profile after approval.
    profile_completed: false,
  });
  if (profileError) {
    const duplicate = /duplicate|unique|23505/i.test(profileError.message);
    return NextResponse.json(
      {
        error: duplicate
          ? "An account with this email already exists."
          : profileError.message,
      },
      { status: duplicate ? 409 : 400 },
    );
  }

  // Best-effort inbox ping so the head sees the request without hunting for
  // it. The approval itself never depends on this insert succeeding.
  try {
    const { data: heads } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "guidance_head")
      .eq("is_active", true);
    const recipients = ((heads ?? []) as { id: string }[]).map((h) => h.id);
    if (recipients.length) {
      await admin.from("notifications").insert(
        recipients.map((profile_id) => ({
          profile_id,
          type: "system",
          title: "Staff account awaiting approval",
          body: `${fullName} signed up as ${role === "counselor" ? "a guidance counselor" : "faculty"}.`,
          link: "/users",
          dedupe_key: `staff-signup:${user.id}`,
          tone: "info",
        })),
      );
    }
  } catch {
    // The pending row is already committed; approval is still possible.
  }

  return NextResponse.json({ role, redirectTo: "/pending-approval" }, { status: 201 });
}
