import { NextResponse } from "next/server";
import { registerStaffSchema, selfSignupSchema } from "@dorsu/shared-schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { clientIp, hitRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/auth/register — account creation for the web portal.
 *
 * Two paths:
 *
 * 1. **Head-provisioned staff** (`role` is counselor/faculty/guidance_head).
 *    Only a signed-in guidance head may call it. The auth user, profile, and
 *    staff row are written here because browser clients cannot insert into
 *    `profiles` (RLS: service-role only).
 *
 * 2. **Public self-signup** (email + password only). This creates the auth
 *    user and nothing else — the user then signs in and picks Student,
 *    Faculty, or Guidance Counselor on `/register/role`, where
 *    `/api/auth/oauth-profile` writes the profile. Staff self-signups start
 *    `pending` and fill in their real details after head approval (00075/00076).
 *
 * Email is pre-confirmed for both paths (institutional email verification is a
 * separate policy decision; switch to an invite/confirmation flow deliberately).
 */
const STAFF_ROLES = ["counselor", "faculty", "guidance_head"] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

function isStaffRole(role: unknown): role is StaffRole {
  return typeof role === "string" && (STAFF_ROLES as readonly string[]).includes(role);
}

/** "juan.dela.cruz@dorsu.edu.ph" → "Juan Dela Cruz" (temporary display name). */
function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "Staff";
  return local
    .replace(/[._-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Staff";
}

export async function POST(request: Request) {
  // P19: open registration is the highest-abuse surface (creates auth
  // users). Generous per-IP window — 10 attempts / 10 min — so real users
  // never notice; floods get 429 + Retry-After. Per-instance memory (see
  // rate-limit.ts); shared-bucket follow-up is Upstash Redis.
  const gate = hitRateLimit(`register:${clientIp(request)}`, 10, 10 * 60 * 1000);
  if (gate.limited) {
    return NextResponse.json(
      { error: "Too many signup attempts — please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(gate.retryAfterSec) } },
    );
  }

  const admin = createAdminClient();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const requestedRole = body["role"];
  if (isStaffRole(requestedRole)) {
    // Gated path: only the guidance head may provision staff accounts.
    const supabase = await createClient();
    const {
      data: { user: caller },
    } = await supabase.auth.getUser();
    if (!caller) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();
    if (!callerProfile || (callerProfile as { role: string }).role !== "guidance_head") {
      return NextResponse.json({ error: "Only the guidance head can create staff accounts." }, { status: 403 });
    }

    const parsed = registerStaffSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    const staff = parsed.data;
    const role = staff.role;

    const rollback = async (userId: string) => {
      try {
        await admin.auth.admin.deleteUser(userId);
      } catch {
        // Best-effort: surfaces in audit via the failed request log.
      }
    };

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: staff.email,
      password: staff.password,
      email_confirm: true,
      user_metadata: { full_name: staff.fullName },
    });
    if (createError || !created?.user) {
      const msg = createError?.message ?? "Could not create account.";
      const status = /already|exists|registered/i.test(msg) ? 409 : 400;
      return NextResponse.json(
        { error: status === 409 ? "An account with this email already exists." : msg },
        { status },
      );
    }
    const userId = created.user.id;

    const { error: profileError } = await admin.from("profiles").insert({
      id: userId,
      email: staff.email,
      role,
      full_name: staff.fullName,
    });
    if (profileError) {
      await rollback(userId);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    const row = { profile_id: userId, employee_no: staff.employeeNo ?? null };
    const table =
      role === "counselor" ? "counselors" : role === "faculty" ? "faculty_members" : "guidance_heads";
    const extra =
      role === "faculty"
        ? { department: staff.department ?? null }
        : role === "counselor"
          ? { specialization: staff.specialization ?? null }
          : {};
    const { error: staffError } = await admin.from(table).insert({ ...row, ...extra });
    if (staffError) {
      await rollback(userId);
      return NextResponse.json({ error: staffError.message }, { status: 400 });
    }

    return NextResponse.json({ userId, role }, { status: 201 });
  }

  // Public self-signup — credentials only. The profile/role is created after
  // the user picks one on /register/role.
  const parsed = selfSignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // Temporary name; students keep it unless they change it, staff replace it
    // on /complete-profile after approval.
    user_metadata: { full_name: nameFromEmail(email) },
  });
  if (createError || !created?.user) {
    const msg = createError?.message ?? "Could not create account.";
    const status = /already|exists|registered/i.test(msg) ? 409 : 400;
    return NextResponse.json(
      { error: status === 409 ? "An account with this email already exists." : msg },
      { status },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
