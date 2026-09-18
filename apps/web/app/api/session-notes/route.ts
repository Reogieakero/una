import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sessionNoteSchema } from "@dorsu/shared-schemas";
import { syncFollowUpSession, validateFollowUpMoment, type DbClient, type FollowUpSessionResult } from "@dorsu/shared-services";

/**
 * /api/session-notes — the counselor's private clinical record for an ended
 * (completed) session.
 *
 * SECURITY MODEL (defense in depth):
 * - RLS (migration 00009 + 00052) restricts reads to the owning counselor and
 *   guidance_head/admin, and writes to the owning counselor and head/admin.
 *   Every query below runs as the caller, so RLS still applies.
 * - This route re-checks everything at the app layer: active account,
 *   counselor linkage, appointment ownership, and completed-only writes.
 * - Notes attach ONLY to completed appointments — documenting a session that
 *   hasn't ended is rejected, so there is no pre-session note surface.
 * - Writes are counselor-only. Heads/admins get read access (oversight) but
 *   cannot author notes — inserts require a counselors row the head doesn't
 *   have, and this route enforces it explicitly.
 * - Note content is NEVER logged, notified, or audited: no notify() call here
 *   (unlike appointment moves), no logEvent content fields, and migration
 *   00045 deliberately puts no audit trigger on session_notes. The guidance
 *   head IS pinged in realtime, but client-side from SessionNotesModal after
 *   the first save (alias + schedule metadata only) — so the ping rides the
 *   standard notifications → RealtimeProvider sonner path like every other
 *   appointment event.
 */

const followUpAtField = z.string().datetime({ offset: true }).optional().nullable();

const bodySchema = sessionNoteSchema
  .extend({
    followUpRequired: z.boolean().default(false),
    followUpAt: followUpAtField,
  })
  .superRefine((v, ctx) => {
    if (v.followUpRequired && !v.followUpAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pick a follow-up date and time.", path: ["followUpAt"] });
    }
  });

const patchSchema = z
  .object({
    noteId: z.string().uuid(),
    content: z.string().min(10, "Note needs at least 10 characters").max(10000).optional(),
    followUpRequired: z.boolean().optional(),
    followUpAt: followUpAtField,
  })
  .superRefine((v, ctx) => {
    if (v.followUpRequired && v.followUpAt === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pick a follow-up date and time.", path: ["followUpAt"] });
    }
  });

type ProfileLite = { role?: string; is_active?: boolean | null };
type ApptLite = {
  id: string;
  status: string;
  counselor_id: string | null;
  student_id?: string | null;
  mode?: string;
  concern?: string;
  is_anonymous?: boolean;
};
type AttachmentRow = {
  id: string;
  note_id: string;
  counselor_id: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};
type NoteRow = {
  id: string;
  appointment_id: string;
  counselor_id: string;
  content: string | null;
  notes: string | null;
  is_private: boolean;
  follow_up_required: boolean;
  follow_up_date: string | null;
  follow_up_at: string | null;
  created_at: string;
  updated_at: string;
};

const NOTE_SELECT =
  "id,appointment_id,counselor_id,content,notes,is_private,follow_up_required,follow_up_date,follow_up_at,created_at,updated_at";

function toAttachmentPayload(r: AttachmentRow) {
  return {
    id: r.id,
    note_id: r.note_id,
    storage_path: r.storage_path,
    mime_type: r.mime_type,
    size_bytes: r.size_bytes,
    created_at: r.created_at,
  };
}

function toPayload(r: NoteRow, attachments: AttachmentRow[] = []) {
  return {
    id: r.id,
    appointment_id: r.appointment_id,
    counselor_id: r.counselor_id,
    content: r.content ?? r.notes ?? "",
    is_private: r.is_private,
    follow_up_required: r.follow_up_required,
    follow_up_date: r.follow_up_date,
    follow_up_at: r.follow_up_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
    attachments: attachments.map(toAttachmentPayload),
  };
}

/** follow_up_date stays as the compat date twin of the follow-up moment. */
function followUpDateOf(iso: string | null | undefined): string | null {
  return iso ? iso.slice(0, 10) : null;
}

type FollowUpOrigin = {
  id: string;
  student_id: string | null;
  counselor_id: string;
  mode: "in_person" | "online";
  concern: string;
  is_anonymous: boolean;
};

/** Shape the service needs to mint/move a follow-up (mode falls back to in-person). */
function toOrigin(a: ApptLite, counselorId: string): FollowUpOrigin {
  return {
    id: a.id,
    student_id: a.student_id ?? null,
    counselor_id: counselorId,
    mode: a.mode === "online" ? "online" : "in_person",
    concern: a.concern ?? "",
    is_anonymous: a.is_anonymous ?? false,
  };
}

/**
 * Run the follow-up lifecycle (mint / move / call off) without ever failing
 * the note save itself — a scheduling conflict surfaces as followUpError so
 * the modal can say so honestly while the note stays saved.
 */
async function syncNoteFollowUp(db: DbClient, origin: FollowUpOrigin, wantAt: string | null) {
  try {
    const followUpSession = await syncFollowUpSession(db, origin, wantAt ? new Date(wantAt) : null);
    return { followUpSession, followUpError: null as string | null };
  } catch (e) {
    return {
      followUpSession: null as FollowUpSessionResult | null,
      followUpError: e instanceof Error ? e.message : "Couldn't schedule the follow-up session.",
    };
  }
}

async function getCaller() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null as null, role: null as string | null, counselorId: null as string | null, error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).single();
  const p = profile as ProfileLite | null;
  if (p?.is_active === false) {
    return { supabase, user: null as null, role: null as string | null, counselorId: null as string | null, error: NextResponse.json({ error: "Account deactivated." }, { status: 403 }) };
  }
  const role = p?.role ?? null;
  let counselorId: string | null = null;
  if (role === "counselor") {
    const { data: crow } = await supabase.from("counselors").select("id").eq("profile_id", user.id).maybeSingle();
    counselorId = (crow as { id: string } | null)?.id ?? null;
  }
  return { supabase, user, role, counselorId, error: null as NextResponse | null };
}

/** GET ?appointmentId= — notes for one session (owning counselor or head). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const appointmentId = url.searchParams.get("appointmentId") ?? "";
  if (!z.string().uuid().safeParse(appointmentId).success) {
    return NextResponse.json({ error: "Valid appointmentId required." }, { status: 400 });
  }
  const { supabase, user, role, counselorId, error } = await getCaller();
  if (error || !user) return error ?? NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (role !== "counselor" && role !== "guidance_head") {
    return NextResponse.json({ error: "Counselors and guidance head only." }, { status: 403 });
  }

  const { data: appt } = await supabase
    .from("appointments")
    .select("id,status,counselor_id")
    .eq("id", appointmentId)
    .maybeSingle();
  const a = appt as ApptLite | null;
  if (!a) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  if (role === "counselor" && (a.counselor_id !== counselorId || !counselorId)) {
    return NextResponse.json({ error: "Only the assigned counselor can read these notes." }, { status: 403 });
  }

  const { data, error: notesError } = await supabase
    .from("session_notes")
    .select(NOTE_SELECT)
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: true });
  if (notesError) return NextResponse.json({ error: "Couldn't load session notes." }, { status: 500 });
  const notes = ((data ?? []) as NoteRow[]);
  let attachments: AttachmentRow[] = [];
  if (notes.length) {
    const { data: attRows } = await supabase
      .from("session_note_attachments")
      .select("id,note_id,counselor_id,storage_path,mime_type,size_bytes,created_at")
      .in(
        "note_id",
        notes.map((n) => n.id)
      )
      .order("created_at", { ascending: true });
    attachments = ((attRows ?? []) as AttachmentRow[]);
  }
  return NextResponse.json({
    notes: notes.map((n) => toPayload(n, attachments.filter((a) => a.note_id === n.id))),
  });
}

/** POST — counselor documents a completed session (one note per session). */
export async function POST(request: Request) {
  const json = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { supabase, user, role, counselorId, error } = await getCaller();
  if (error || !user) return error ?? NextResponse.json({ error: "Sign in required." }, { status: 401 });
  // Heads read for oversight but never author — clinical notes belong to the
  // treating counselor (who holds the counselors row this FK needs).
  if (role !== "counselor" || !counselorId) {
    return NextResponse.json({ error: "Only the assigned counselor can document a session." }, { status: 403 });
  }

  const { data: appt } = await supabase
    .from("appointments")
    .select("id,status,counselor_id,student_id,mode,concern,is_anonymous")
    .eq("id", parsed.data.appointmentId)
    .maybeSingle();
  const a = appt as ApptLite | null;
  if (!a) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  if (a.counselor_id !== counselorId) {
    return NextResponse.json({ error: "Only the assigned counselor can document this session." }, { status: 403 });
  }
  if (a.status !== "completed") {
    return NextResponse.json({ error: "Session notes can only be documented once the session has ended." }, { status: 422 });
  }
  // Follow-ups must respect the counselor's availability — same scope gate
  // as scheduling a session (the picker already constrains choices; this is
  // the bypass-proof enforcement).
  if (parsed.data.followUpRequired && parsed.data.followUpAt) {
    try {
      await validateFollowUpMoment(supabase, counselorId, new Date(parsed.data.followUpAt));
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Follow-up is outside your availability." },
        { status: 422 }
      );
    }
  }

  const { data: existing } = await supabase
    .from("session_notes")
    .select("id")
    .eq("appointment_id", a.id)
    .eq("counselor_id", counselorId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "A note already exists for this session — edit it instead.", noteId: (existing as { id: string }).id }, { status: 409 });
  }

  const text = parsed.data.content.trim();
  const { data, error: insertError } = await supabase
    .from("session_notes")
    .insert({
      appointment_id: a.id,
      counselor_id: counselorId,
      // notes/content twins (migration 00020) stay in sync; always private.
      content: text,
      notes: text,
      is_private: true,
      follow_up_required: parsed.data.followUpRequired,
      follow_up_date: followUpDateOf(parsed.data.followUpAt),
      follow_up_at: parsed.data.followUpAt ?? null,
    })
    .select(NOTE_SELECT)
    .single();
  if (insertError || !data) return NextResponse.json({ error: "Couldn't save the session note." }, { status: 500 });
  // A documented follow-up is a real session: mint it confirmed so it shows
  // on the sessions page and notifies like any other session.
  let followUpSession: FollowUpSessionResult | null = null;
  let followUpError: string | null = null;
  if (parsed.data.followUpRequired && parsed.data.followUpAt) {
    ({ followUpSession, followUpError } = await syncNoteFollowUp(supabase, toOrigin(a, counselorId), parsed.data.followUpAt));
  }
  return NextResponse.json({ note: toPayload(data as NoteRow), followUpSession, followUpError }, { status: 201 });
}

/** PATCH — counselor amends their own note (content / follow-up only). */
export async function PATCH(request: Request) {
  const json = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  if (parsed.data.content === undefined && parsed.data.followUpRequired === undefined && parsed.data.followUpAt === undefined) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  const { supabase, user, role, counselorId, error } = await getCaller();
  if (error || !user) return error ?? NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (role !== "counselor" || !counselorId) {
    return NextResponse.json({ error: "Only the assigned counselor can edit session notes." }, { status: 403 });
  }

  const { data: current } = await supabase
    .from("session_notes")
    .select("id,appointment_id,counselor_id,follow_up_required,follow_up_at")
    .eq("id", parsed.data.noteId)
    .maybeSingle();
  const cur = current as { id: string; appointment_id: string; counselor_id: string; follow_up_required: boolean; follow_up_at: string | null } | null;
  if (!cur || cur.counselor_id !== counselorId) {
    return NextResponse.json({ error: "Session note not found." }, { status: 404 });
  }
  // Effective follow-up state after this patch — validated like a new note so
  // an amended follow-up can't escape the availability scope either.
  const effRequired = parsed.data.followUpRequired ?? cur.follow_up_required;
  const effAt = parsed.data.followUpAt !== undefined ? parsed.data.followUpAt : cur.follow_up_at;
  if (effRequired && !effAt) {
    return NextResponse.json({ error: "Pick a follow-up date and time." }, { status: 400 });
  }
  if (effRequired && effAt) {
    try {
      await validateFollowUpMoment(supabase, counselorId, new Date(effAt));
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Follow-up is outside your availability." },
        { status: 422 }
      );
    }
  }

  const patch: {
    updated_at: string;
    content?: string;
    notes?: string;
    follow_up_required?: boolean;
    follow_up_date?: string | null;
    follow_up_at?: string | null;
  } = { updated_at: new Date().toISOString() };
  if (parsed.data.content !== undefined) {
    const text = parsed.data.content.trim();
    patch.content = text;
    patch.notes = text;
  }
  if (parsed.data.followUpRequired !== undefined) patch.follow_up_required = parsed.data.followUpRequired;
  if (parsed.data.followUpAt !== undefined) {
    patch.follow_up_at = parsed.data.followUpAt;
    patch.follow_up_date = followUpDateOf(parsed.data.followUpAt);
  }
  if (parsed.data.followUpRequired === false) {
    // Unchecking clears the moment entirely — no orphaned datetime lingers.
    patch.follow_up_required = false;
    patch.follow_up_at = null;
    patch.follow_up_date = null;
  }

  const { data, error: updateError } = await supabase
    .from("session_notes")
    .update(patch)
    .eq("id", cur.id)
    .eq("counselor_id", counselorId)
    .select(NOTE_SELECT)
    .single();
  if (updateError || !data) return NextResponse.json({ error: "Couldn't update the session note." }, { status: 500 });
  const { data: attRows } = await supabase
    .from("session_note_attachments")
    .select("id,note_id,counselor_id,storage_path,mime_type,size_bytes,created_at")
    .eq("note_id", cur.id)
    .order("created_at", { ascending: true });
  // Keep the minted follow-up in step with the note: move it to an amended
  // moment, mint it if follow-up was newly added, call it off if removed.
  let followUpSession: FollowUpSessionResult | null = null;
  let followUpError: string | null = null;
  const { data: originRow } = await supabase
    .from("appointments")
    .select("id,status,counselor_id,student_id,mode,concern,is_anonymous")
    .eq("id", cur.appointment_id)
    .maybeSingle();
  const origin = originRow as ApptLite | null;
  if (origin && origin.counselor_id === counselorId) {
    ({ followUpSession, followUpError } = await syncNoteFollowUp(
      supabase,
      toOrigin(origin, counselorId),
      effRequired ? effAt : null
    ));
  }
  return NextResponse.json({
    note: toPayload(data as NoteRow, ((attRows ?? []) as AttachmentRow[])),
    followUpSession,
    followUpError,
  });
}
