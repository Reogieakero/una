import { NextResponse } from "next/server";
import { registerStaffSchema, registerStudentSchema } from "@dorsu/shared-schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/register — the ONLY writer of profiles/role rows at signup.
 * Browser clients cannot insert into `profiles` (RLS: service-role/trigger
 * only), so registration goes through here with the service key.
 *
 * - Public self-registration is STUDENTS ONLY (`role` forced to `student`).
 *   Staff roles (`counselor`, `faculty`, `guidance_head`) require a signed-in
 *   `guidance_head` caller — an open role picker would be a privilege-escalation hole.
 * - Creates `auth.users` (email pre-confirmed so students can sign in
 *   immediately; switch `email_confirm` to an invite flow if the registrar
 *   later requires verified institutional email), then `profiles`, then the
 *   role row (`students` incl. generated `anonymous_alias`, or the matching
 *   staff table). Any DB failure rolls the auth user back (no orphans).
 */
const STAFF_ROLES = ["counselor", "faculty", "guidance_head"] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

function isStaffRole(role: unknown): role is StaffRole {
  return typeof role === "string" && (STAFF_ROLES as readonly string[]).includes(role);
}

/** System alias for anonymous mode (dictionary §2), e.g. "Client-4821". */
async function generateAlias(admin: ReturnType<typeof createAdminClient>): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const alias = `Client-${Math.floor(1000 + Math.random() * 9000)}`;
    const { data } = await admin
      .from("students")
      .select("profile_id")
      .eq("anonymous_alias", alias)
      .maybeSingle();
    if (!data) return alias;
  }
  throw new Error("Could not generate a unique anonymous alias — please retry.");
}

export async function POST(request: Request) {
  const admin = createAdminClient();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const role = typeof body["role"] === "string" ? body["role"] : "student";
  let staff: { employeeNo?: string; department?: string; specialization?: string } | null = null;

  if (isStaffRole(role)) {
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
    staff = { employeeNo: parsed.data.employeeNo, department: parsed.data.department, specialization: parsed.data.specialization };
    Object.assign(body, { ...parsed.data, role });
  } else if (role !== "student") {
    return NextResponse.json({ error: "Unknown role." }, { status: 400 });
  }

  let v: { email: string; password: string; fullName: string };
  let studentFields: { studentNo: string; program: string; yearLevel: string } | null = null;
  if (role === "student") {
    const parsedStudent = registerStudentSchema.safeParse(body);
    if (!parsedStudent.success) {
      return NextResponse.json(
        { error: parsedStudent.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }
    v = parsedStudent.data;
    studentFields = parsedStudent.data;
  } else {
    v = body as unknown as { email: string; password: string; fullName: string };
  }

  const rollback = async (userId: string) => {
    try {
      await admin.auth.admin.deleteUser(userId);
    } catch {
      // Best-effort: surfaces in audit via the failed request log.
    }
  };

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: v.email,
    password: v.password,
    email_confirm: true,
    user_metadata: { full_name: v.fullName },
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
    email: v.email,
    role,
    full_name: v.fullName,
  });
  if (profileError) {
    await rollback(userId);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  if (role === "student") {
    if (!studentFields) {
      await rollback(userId);
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }
    const s = studentFields;
    let alias: string;
    try {
      alias = await generateAlias(admin);
    } catch (e) {
      await rollback(userId);
      return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
    const { error: studentError } = await admin.from("students").insert({
      profile_id: userId,
      student_no: s.studentNo,
      program: s.program,
      year_level: s.yearLevel,
      anonymous_alias: alias,
    });
    if (studentError) {
      await rollback(userId);
      const msg = /duplicate|unique|23505/i.test(studentError.message)
        ? "That student number is already registered."
        : studentError.message;
      return NextResponse.json({ error: msg }, { status: 409 });
    }
  } else {
    const row = { profile_id: userId, employee_no: staff?.employeeNo ?? null };
    const table =
      role === "counselor"
        ? "counselors"
        : role === "faculty"
          ? "faculty_members"
          : role === "guidance_head"
            ? "guidance_heads"
            : null;
    if (table) {
      const extra = role === "faculty" ? { department: staff?.department ?? null } : role === "counselor" ? { specialization: staff?.specialization ?? null } : {};
      const { error: staffError } = await admin.from(table).insert({ ...row, ...extra });
      if (staffError) {
        await rollback(userId);
        return NextResponse.json({ error: staffError.message }, { status: 400 });
      }
    }
  }

  return NextResponse.json({ userId, role }, { status: 201 });
}
