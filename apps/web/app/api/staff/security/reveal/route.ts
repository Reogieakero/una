import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/staff/security/reveal — resolve a student's real identity under
 * an active break-glass grant. The caller must hold an unexpired grant row
 * for that student (logged with justification); the head holds the same
 * requirement so every reveal is attributable. Each successful reveal writes
 * its own audit_logs row — grant + views are independently traceable.
 */
const payloadSchema = z.object({
  studentId: z.string().uuid("Unknown student."),
});

export async function POST(request: Request) {
  const json = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

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
  if (!callerProfile || !["counselor", "guidance_head"].includes((callerProfile as { role: string }).role)) {
    return NextResponse.json({ error: "Only counselors and the guidance head may reveal identities." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: grant } = await admin
    .from("break_glass_logs")
    .select("id, expires_at")
    .eq("accessor_profile_id", caller.id)
    .eq("student_id", parsed.data.studentId)
    .gt("expires_at", new Date().toISOString())
    .order("accessed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!grant) {
    return NextResponse.json(
      { error: "No active emergency grant for this student — log emergency access first." },
      { status: 403 }
    );
  }

  const { data: student } = await admin
    .from("students")
    .select("id, profile_id, student_no, program, year_level, college, contact_no, anonymous_alias")
    .eq("id", parsed.data.studentId)
    .single();
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const s = student as {
    profile_id: string;
    student_no: string;
    program: string | null;
    year_level: string | null;
    college: string | null;
    contact_no: string | null;
    anonymous_alias: string | null;
  };
  const { data: profile } = await admin.from("profiles").select("full_name, email").eq("id", s.profile_id).single();
  const p = (profile ?? {}) as { full_name: string | null; email?: string };

  await admin.from("audit_logs").insert({
    actor_profile_id: caller.id,
    action: "break_glass.reveal",
    entity: "students",
    entity_id: parsed.data.studentId,
    metadata: { break_glass_id: (grant as { id: string }).id },
  });

  return NextResponse.json({
    ok: true,
    identity: {
      fullName: p.full_name,
      email: p.email ?? null,
      studentNo: s.student_no,
      program: s.program,
      yearLevel: s.year_level,
      college: s.college,
      contactNo: s.contact_no,
      alias: s.anonymous_alias,
    },
    expiresAt: (grant as { expires_at: string }).expires_at,
  });
}
