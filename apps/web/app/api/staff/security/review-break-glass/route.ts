import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/staff/security/review-break-glass — head marks an emergency
 * access reviewed. Browser clients cannot update break_glass_logs (RLS has
 * no update policy — append-only by design), so this route checks the
 * caller is head, then writes with the service key. One review per event.
 */
const payloadSchema = z.object({
  logId: z.string().uuid("Unknown event."),
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
    return NextResponse.json({ error: "Only the guidance head can review access events." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("break_glass_logs")
    .select("id, reviewed_at")
    .eq("id", parsed.data.logId)
    .single();
  if (!existing) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  if ((existing as { reviewed_at: string | null }).reviewed_at) {
    return NextResponse.json({ error: "Already reviewed." }, { status: 409 });
  }

  const { error } = await admin
    .from("break_glass_logs")
    .update({ reviewed_by: caller.id, reviewed_at: new Date().toISOString() })
    .eq("id", parsed.data.logId);
  if (error) return NextResponse.json({ error: "Couldn't record the review." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
