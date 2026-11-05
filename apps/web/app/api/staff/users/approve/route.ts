import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/log-event";

/**
 * POST /api/staff/users/approve — the guidance head approves a self-registered
 * faculty or guidance-counselor account (00075/00076).
 *
 * Approval is also where the role row (`faculty_members` or `counselors`) is
 * created. Until then the pending profile has no staff row, so staff-scoped RLS
 * (referrals, chat, appointments) has nothing to attach to. The profile keeps
 * `profile_completed = false`; the approver's new account fills in its real
 * name/employee details on /complete-profile before entering the workspace.
 */
const payloadSchema = z.object({
  userId: z.string().uuid("Unknown user."),
});

const SELF_SERVICE_STAFF = new Set(["faculty", "counselor"]);

export async function POST(request: Request) {
  const json = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
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
  if (!callerProfile || (callerProfile as { role: string }).role !== "guidance_head") {
    return NextResponse.json(
      { error: "Only the guidance head can approve staff accounts." },
      { status: 403 },
    );
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("role, approval_status, full_name")
    .eq("id", parsed.data.userId)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const row = target as { role: string; approval_status: string; full_name: string | null };
  if (!SELF_SERVICE_STAFF.has(row.role)) {
    return NextResponse.json(
      { error: "Only self-registered staff accounts need approval." },
      { status: 400 },
    );
  }
  if (row.approval_status === "approved") {
    return NextResponse.json({ ok: true, alreadyApproved: true });
  }
  if (row.approval_status !== "pending") {
    return NextResponse.json({ error: "This account can't be approved." }, { status: 409 });
  }

  const approvedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await admin
    .from("profiles")
    .update({
      approval_status: "approved",
      is_active: true,
      approved_by: caller.id,
      approved_at: approvedAt,
    })
    .eq("id", parsed.data.userId)
    .in("role", ["faculty", "counselor"])
    .eq("approval_status", "pending")
    .select("id");
  if (updateError || !updated?.length) {
    logEvent("MUTATION_FAILED", {
      label: "users.approve_staff",
      rowId: parsed.data.userId,
      code: (updateError as { code?: string } | null)?.code ?? null,
    });
    return NextResponse.json({ error: "Couldn't approve that account." }, { status: 500 });
  }

  // Create the role record now that the head has signed off. If this fails,
  // roll the approval back so the account can't sit in a half-provisioned state.
  const table = row.role === "counselor" ? "counselors" : "faculty_members";
  const { error: roleRowError } = await admin
    .from(table)
    .upsert({ profile_id: parsed.data.userId }, { onConflict: "profile_id", ignoreDuplicates: true });
  if (roleRowError) {
    await admin
      .from("profiles")
      .update({
        approval_status: "pending",
        is_active: false,
        approved_by: null,
        approved_at: null,
      })
      .eq("id", parsed.data.userId);
    logEvent("MUTATION_FAILED", {
      label: "users.approve_staff.role_row",
      rowId: parsed.data.userId,
      code: (roleRowError as { code?: string }).code ?? null,
    });
    return NextResponse.json({ error: "Couldn't finish approving that account." }, { status: 500 });
  }

  // Service-role writes carry no auth.uid(), so record the real actor.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip");
  try {
    const { error: auditError } = await admin.from("audit_events").insert({
      actor_profile_id: caller.id,
      actor_role: "guidance_head",
      action: "users.approve_staff",
      entity: "profiles",
      entity_id: parsed.data.userId,
      status_before: "pending",
      status_after: "approved",
      diff: { approval_status: { from: "pending", to: "approved" }, role: row.role },
      source: "web",
      result: "success",
      ip: ip && /^[0-9a-fA-F.:]+$/.test(ip) ? ip : null,
    });
    if (auditError) {
      logEvent("AUDIT_FAILED", {
        action: "users.approve_staff",
        entityId: parsed.data.userId,
        actorId: caller.id,
        code: (auditError as { code?: string } | null)?.code ?? null,
      });
    }
  } catch {
    logEvent("AUDIT_FAILED", {
      action: "users.approve_staff",
      entityId: parsed.data.userId,
      actorId: caller.id,
    });
  }

  return NextResponse.json({ ok: true });
}
