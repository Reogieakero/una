import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/log-event";

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
  // May be empty for faculty: they cannot read other profiles via RLS, so
  // they never know head ids — the route resolves heads server-side below.
  to: z.array(z.string().uuid()).max(500),
  type: z.enum(["appointment", "referral", "announcement", "chat", "assessment", "system"]),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(2000).optional().nullable(),
  link: z.string().startsWith("/").max(300).optional().nullable(),
  // Idempotency: one key per event (e.g. `appt:<id>:assigned:<counselorId>`).
  // Replays hit UNIQUE(notifications.profile_id, dedupe_key) and are skipped
  // per-recipient below instead of duplicating the inbox.
  dedupeKey: z.string().trim().min(1).max(200).optional().nullable(),
  // Sonner tone for the recipient toast (migration 00044). Omitted when the
  // column doesn't exist yet so pre-migration deploys keep working.
  tone: z.enum(["success", "info", "error"]).optional().nullable(),
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
  // Empty recipients are only meaningful for faculty (resolved to heads
  // below); anyone else with nobody to notify is a no-op call.
  if (!parsed.data.to.length && callerRole !== "faculty") {
    return NextResponse.json({ error: "No recipients." }, { status: 400 });
  }
  const isHead = callerRole === "guidance_head";
  // Heads see every transaction (even their own) — everyone else skips self-pings.
  let recipients = [...new Set(parsed.data.to)].filter((id) => isHead || id !== caller.id);

  // Faculty can only ever ping heads (referral filing) — never free-form
  // inboxes. Exception: chat DMs notify the actual counterpart, restricted
  // to office staff (counselors / heads / personnel) so students are never
  // reachable this way.
  if (callerRole === "faculty") {
    if (parsed.data.type === "chat") {
      const { data: staff } = await admin
        .from("profiles")
        .select("id")
        .in("role", ["counselor", "guidance_head", "guidance_personnel"])
        .eq("is_active", true);
      const allowed = new Set(((staff ?? []) as { id: string }[]).map((p) => p.id));
      recipients = recipients.filter((id) => allowed.has(id));
    } else {
      const { data: heads } = await admin.from("profiles").select("id").eq("role", "guidance_head").eq("is_active", true);
      recipients = ((heads ?? []) as { id: string }[]).map((h) => h.id);
    }
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
      dedupe_key: parsed.data.dedupeKey ?? null,
      ...(parsed.data.tone ? { tone: parsed.data.tone } : {}),
    }))
  );
  if (error) {
    // A replayed event collides on UNIQUE(profile_id, dedupe_key) — the rows
    // already exist, so report success instead of a 500. Without a dedupeKey
    // any conflict is a real problem, so still fail loudly.
    if (parsed.data.dedupeKey && (error as { code?: string }).code === "23505") {
      logEvent("NOTIFICATION_CREATED", {
        type: parsed.data.type,
        notified: 0,
        duplicate: true,
        callerRole,
      });
      return NextResponse.json({ ok: true, notified: 0, duplicate: true });
    }
    // Alert surface: fan-out failures are otherwise invisible (fire-and-forget
    // callers). Drain `[dorsu:NOTIFICATION_FAILED]` in prod logs for paging.
    logEvent("NOTIFICATION_FAILED", {
      type: parsed.data.type,
      recipients: recipients.length,
      code: (error as { code?: string }).code ?? null,
      callerRole,
    });
    return NextResponse.json({ error: "Couldn't deliver notifications." }, { status: 500 });
  }

  logEvent("NOTIFICATION_CREATED", {
    type: parsed.data.type,
    notified: recipients.length,
    deduped: Boolean(parsed.data.dedupeKey),
    callerRole,
  });
  return NextResponse.json({ ok: true, notified: recipients.length });
}
