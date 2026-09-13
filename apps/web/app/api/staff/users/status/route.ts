import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
  const { error } = await admin
    .from("profiles")
    .update({ is_active: parsed.data.isActive })
    .eq("id", parsed.data.userId);
  if (error) return NextResponse.json({ error: "Couldn't update that account." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
