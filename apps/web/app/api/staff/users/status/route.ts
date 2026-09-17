import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/log-event";

/**
 * POST /api/staff/users/status — head/admin activates or deactivates an
 * account. Browser clients cannot write `is_active` (RLS: service-role
 * only), so this route enforces RBAC in code, then writes with the
 * service key. Deactivation takes effect at the next guard/login check.
 */
const payloadSchema = z.object({
  userId: z.string().uuid("Unknown user."),
  isActive: z.boolean(),
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
  if (!callerProfile || (callerProfile as { role: string }).role !== "guidance_head") {
    return NextResponse.json({ error: "Only the guidance head can manage accounts." }, { status: 403 });
  }
  if (parsed.data.userId === caller.id) {
    return NextResponse.json({ error: "You can't change your own account status." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("profiles")
    .select("is_active")
    .eq("id", parsed.data.userId)
    .single();
  const wasActive = (before as { is_active: boolean } | null)?.is_active ?? null;
  const { error } = await admin
    .from("profiles")
    .update({ is_active: parsed.data.isActive })
    .eq("id", parsed.data.userId);
  if (error) {
    logEvent("MUTATION_FAILED", {
      label: "users.status",
      rowId: parsed.data.userId,
      code: (error as { code?: string }).code ?? null,
    });
    return NextResponse.json({ error: "Couldn't update that account." }, { status: 500 });
  }

  // Service-role writes carry no auth.uid(), so the audit trigger would log
  // 'system' — this route knows the real caller, so it writes its own row
  // with actor + IP. Best-effort: the account change itself already committed.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip");
  try {
    const { error: auditError } = await admin.from("audit_events").insert({
      actor_profile_id: caller.id,
      actor_role: "guidance_head",
      action: parsed.data.isActive ? "users.activate" : "users.deactivate",
      entity: "profiles",
      entity_id: parsed.data.userId,
      status_before: wasActive === null ? null : wasActive ? "active" : "inactive",
      status_after: parsed.data.isActive ? "active" : "inactive",
      diff: { is_active: { from: wasActive, to: parsed.data.isActive } },
      source: "web",
      result: "success",
      ip: ip && /^[0-9a-fA-F.:]+$/.test(ip) ? ip : null,
    });
    if (auditError) {
      // Committed fact, missing audit row — the §4 nightmare case. Loud log;
      // the change stands, investigation follows.
      logEvent("AUDIT_FAILED", {
        action: "users.status",
        entityId: parsed.data.userId,
        actorId: caller.id,
        code: (auditError as { code?: string }).code ?? null,
      });
    }
  } catch {
    logEvent("AUDIT_FAILED", {
      action: "users.status",
      entityId: parsed.data.userId,
      actorId: caller.id,
    });
  }

  return NextResponse.json({ ok: true });
}
