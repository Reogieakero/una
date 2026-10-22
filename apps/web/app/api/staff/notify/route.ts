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
 * Privacy (00063): transactional payloads are normalized here, not trusted
 * from the client. `appointment` / `referral` / `chat` rows are ids + generic
 * title only — never a student alias, concern, referral reason, or message
 * text. Recipients are also constrained to people the caller may reach:
 * staff, plus students the caller actually has a case/thread with.
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
  // Replays hit UNIQUE(profiles.profile_id, dedupe_key) and are skipped
  // per-recipient below instead of duplicating the inbox.
  dedupeKey: z.string().trim().min(1).max(200).optional().nullable(),
  // Sonner tone for the recipient toast (migration 00044).
  tone: z.enum(["success", "info", "error"]).optional().nullable(),
});

type NotifyType = z.infer<typeof payloadSchema>["type"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Generic allowlist for clinically sensitive notification titles. */
function safeTitle(type: NotifyType, raw: string): string {
  if (type === "chat") return "New message";
  if (type !== "appointment" && type !== "referral") return raw;
  // Drop "— <alias>" / "— <counselor name>" suffixes and any free text.
  const base = raw.split(" — ")[0]!.split(" - ")[0]!.trim();
  const allowed =
    /^(New session request|Session\b|Follow-up session\b|Referral\b|Counselor assigned$|Appointment update$)/i.test(base);
  if (allowed) return base.slice(0, 120);
  return type === "appointment" ? "Appointment update" : "Referral update";
}

function refFromDedupeKey(key: string | null | undefined): { refType: string | null; refId: string | null } {
  if (!key) return { refType: null, refId: null };
  const [prefix, id] = key.split(":");
  const refType =
    prefix === "appt" ? "appointment"
    : prefix === "referral" ? "referral"
    : prefix === "chat" ? "chat"
    : prefix === "announcement" ? "announcement"
    : prefix === "note" ? "appointment"
    : null;
  return { refType, refId: id && UUID_RE.test(id) ? id : null };
}

/**
 * Recipients the caller is allowed to reach. `null` = all active profiles
 * (head only). Everyone else: all staff, plus students they have a case,
 * session, or referral with.
 */
async function reachableStudents(admin: ReturnType<typeof createAdminClient>, callerId: string, role: string) {
  if (role === "guidance_head") return null;
  const studentIds = new Set<string>();

  if (role === "counselor") {
    const { data: counselor } = await admin
      .from("counselors")
      .select("id")
      .eq("profile_id", callerId)
      .maybeSingle();
    const counselorId = (counselor as { id?: string } | null)?.id;
    if (counselorId) {
      const [{ data: appts }, { data: refs }, { data: threads }] = await Promise.all([
        admin.from("appointments").select("student_id").eq("counselor_id", counselorId),
        admin.from("referrals").select("student_id").eq("assigned_counselor_id", counselorId),
        admin.from("chat_threads").select("student_id").eq("counselor_id", counselorId),
      ]);
      for (const row of (appts ?? []) as { student_id: string | null }[]) {
        if (row.student_id) studentIds.add(row.student_id);
      }
      for (const row of (refs ?? []) as { student_id: string | null }[]) {
        if (row.student_id) studentIds.add(row.student_id);
      }
      for (const row of (threads ?? []) as { student_id: string | null }[]) {
        if (row.student_id) studentIds.add(row.student_id);
      }
    }
  }

  if (role === "faculty") {
    // referrals.referring_faculty_id points at faculty_members.id, not the
    // profile id, so resolve the caller's faculty row first (00060).
    const { data: faculty } = await admin
      .from("faculty_members")
      .select("id")
      .eq("profile_id", callerId)
      .maybeSingle();
    const facultyId = (faculty as { id?: string } | null)?.id;
    if (!facultyId) return new Set<string>();
    const { data: refs } = await admin
      .from("referrals")
      .select("student_id")
      .eq("referring_faculty_id", facultyId);
    for (const row of (refs ?? []) as { student_id: string | null }[]) {
      if (row.student_id) studentIds.add(row.student_id);
    }
  }

  if (!studentIds.size) return new Set<string>();
  const { data: profiles } = await admin
    .from("students")
    .select("profile_id")
    .in("id", [...studentIds]);
  return new Set(
    ((profiles ?? []) as { profile_id: string | null }[])
      .map((s) => s.profile_id)
      .filter((id): id is string => !!id)
  );
}

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

  // Broadcasts are a head-only power; everyone else only sends transactional
  // events. Without this a counselor could borrow `announcement` to put
  // arbitrary text in a student's inbox.
  if (parsed.data.type === "announcement" && callerRole !== "guidance_head") {
    return NextResponse.json({ error: "Only the guidance head can broadcast." }, { status: 403 });
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
  const { data: active } = await admin.from("profiles").select("id, role").in("id", recipients).eq("is_active", true);
  const activeRows = (active ?? []) as { id: string; role: string }[];
  const staffIds = new Set(
    activeRows
      .filter((p) => ["counselor", "guidance_head", "guidance_personnel", "faculty", "admin"].includes(p.role))
      .map((p) => p.id)
  );

  // Students are only reachable when the caller has a real case/thread with
  // them (head: anyone). Blocks cross-student inbox leakage.
  const reachable = await reachableStudents(admin, caller.id, callerRole);
  recipients = activeRows
    .filter((p) => staffIds.has(p.id) || reachable === null || reachable.has(p.id))
    .map((p) => p.id);
  if (!recipients.length) return NextResponse.json({ ok: true, notified: 0 });

  // Sensitive types: ids + generic title, never body/alias/reason/message.
  const sensitive = parsed.data.type === "appointment" || parsed.data.type === "referral" || parsed.data.type === "chat";
  const title = safeTitle(parsed.data.type, parsed.data.title);
  const body = sensitive ? null : parsed.data.body ?? null;
  const { refType, refId } = refFromDedupeKey(parsed.data.dedupeKey);

  const { error } = await admin.from("notifications").insert(
    recipients.map((profile_id) => ({
      profile_id,
      type: parsed.data.type,
      title,
      body,
      link: parsed.data.link ?? null,
      dedupe_key: parsed.data.dedupeKey ?? null,
      ref_type: refType,
      ref_id: refId,
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
