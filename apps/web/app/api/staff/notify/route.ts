import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/staff/notify — the single fan-out for transaction notifications
 * (audit-trail style: every meaningful action pings whoever is affected).
 * Browser clients cannot insert notifications (service-role only), so this
 * route checks the caller, then writes with the service key.
 *
 * Safety rails: callers are counseling staff (faculty may only ping heads —
 * e.g. filing a referral — never arbitrary inboxes); recipients capped;
 * links constrained to in-app paths.
 */
const payloadSchema = z.object({
  to: z.array(z.string().uuid()).min(1).max(500),
  type: z.enum(["appointment", "referral", "announcement", "chat", "assessment", "system"]),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(2000).optional().nullable(),
  link: z.string().startsWith("/").max(300).optional().nullable(),
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
  const callerRole = (callerProfile as { role: string } | null)?.role;
  if (!callerRole || !["counselor", "guidance_head", "faculty"].includes(callerRole)) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }

  const admin = createAdminClient();
  const isHead = callerRole === "guidance_head";
  // Heads see every transaction (even their own) — everyone else skips self-pings.
  let recipients = [...new Set(parsed.data.to)].filter((id) => isHead || id !== caller.id);

  // Faculty can only ever ping heads (referral filing) — never free-form inboxes.
  if (callerRole === "faculty") {
    const { data: heads } = await admin.from("profiles").select("id").eq("role", "guidance_head").eq("is_active", true);
    recipients = ((heads ?? []) as { id: string }[]).map((h) => h.id);
    if (!recipients.length) return NextResponse.json({ ok: true, notified: 0 });
  }

  // Never ping deactivated accounts.
  const { data: active } = await admin.from("profiles").select("id").in("id", recipients).eq("is_active", true);
  const activeIds = new Set(((active ?? []) as { id: string }[]).map((p) => p.id));
  recipients = recipients.filter((id) => activeIds.has(id));
  if (!recipients.length) return NextResponse.json({ ok: true, notified: 0 });

  const { error } = await admin.from("notifications").insert(
    recipients.map((profile_id) => ({
      profile_id,
      type: parsed.data.type,
      title: parsed.data.title,
      body: parsed.data.body ?? null,
      link: parsed.data.link ?? null,
    }))
  );
  if (error) return NextResponse.json({ error: "Couldn't deliver notifications." }, { status: 500 });

  return NextResponse.json({ ok: true, notified: recipients.length });
}
