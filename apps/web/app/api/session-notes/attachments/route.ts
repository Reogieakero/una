import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * /api/session-notes/attachments — metadata for the private images attached
 * to a session note (bytes live in the private session-note-attachments
 * bucket, note-scoped as `{note_id}/{uuid}.{ext}`).
 *
 * SECURITY MODEL: same boundary as the note itself.
 * - Counselor-only writes, and only on their own notes. Heads/admins read
 *   (oversight) but never author — mirrors /api/session-notes.
 * - Every query runs as the caller (RLS applies), plus explicit app-layer
 *   ownership + count checks below.
 * - Hard caps: max 5 images per note, image/* MIME only, 5MB per file.
 * - No content is logged or notified; DELETE removes the storage object
 *   first so no orphaned bytes linger in the private bucket.
 */

const MAX_NOTE_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type ProfileLite = { role?: string; is_active?: boolean | null };

async function getCounselor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, counselorId: null as string | null, role: null as string | null, error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).single();
  const p = profile as ProfileLite | null;
  if (p?.is_active === false) {
    return { supabase, counselorId: null as string | null, role: null as string | null, error: NextResponse.json({ error: "Account deactivated." }, { status: 403 }) };
  }
  const role = p?.role ?? null;
  let counselorId: string | null = null;
  if (role === "counselor") {
    const { data: crow } = await supabase.from("counselors").select("id").eq("profile_id", user.id).maybeSingle();
    counselorId = (crow as { id: string } | null)?.id ?? null;
  }
  return { supabase, counselorId, role, error: null as NextResponse | null };
}

const postSchema = z.object({
  noteId: z.string().uuid(),
  storagePath: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(100),
  sizeBytes: z.number().int().positive(),
});

/** GET ?noteId= — list a note's images (owning counselor or head). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const noteId = url.searchParams.get("noteId") ?? "";
  if (!z.string().uuid().safeParse(noteId).success) {
    return NextResponse.json({ error: "Valid noteId required." }, { status: 400 });
  }
  const { supabase, counselorId, role, error } = await getCounselor();
  if (error) return error;
  if (role !== "counselor" && role !== "guidance_head") {
    return NextResponse.json({ error: "Counselors and guidance head only." }, { status: 403 });
  }
  const { data: note } = await supabase
    .from("session_notes")
    .select("id,counselor_id")
    .eq("id", noteId)
    .maybeSingle();
  const n = note as { id: string; counselor_id: string } | null;
  if (!n) return NextResponse.json({ error: "Session note not found." }, { status: 404 });
  if (role === "counselor" && n.counselor_id !== counselorId) {
    return NextResponse.json({ error: "Only the assigned counselor can read these attachments." }, { status: 403 });
  }
  const { data, error: listError } = await supabase
    .from("session_note_attachments")
    .select("id,note_id,storage_path,mime_type,size_bytes,created_at")
    .eq("note_id", noteId)
    .order("created_at", { ascending: true });
  if (listError) return NextResponse.json({ error: "Couldn't load attachments." }, { status: 500 });
  return NextResponse.json({ attachments: data ?? [] });
}

/** POST — register one uploaded image (max 5 per note, images only). */
export async function POST(request: Request) {
  const json = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { supabase, counselorId, role, error } = await getCounselor();
  if (error) return error;
  if (role !== "counselor" || !counselorId) {
    return NextResponse.json({ error: "Only the assigned counselor can attach images." }, { status: 403 });
  }
  const { noteId, storagePath, mimeType, sizeBytes } = parsed.data;
  if (!mimeType.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files can be attached." }, { status: 400 });
  }
  if (sizeBytes > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Images must be under 5MB." }, { status: 400 });
  }
  // Path scoping: the object must live under this note's folder.
  if (!storagePath.startsWith(`${noteId}/`) || storagePath.includes("..")) {
    return NextResponse.json({ error: "Invalid storage path." }, { status: 400 });
  }
  const { data: note } = await supabase
    .from("session_notes")
    .select("id,counselor_id")
    .eq("id", noteId)
    .maybeSingle();
  const n = note as { id: string; counselor_id: string } | null;
  if (!n || n.counselor_id !== counselorId) {
    return NextResponse.json({ error: "Session note not found." }, { status: 404 });
  }
  const { count } = await supabase
    .from("session_note_attachments")
    .select("id", { count: "exact", head: true })
    .eq("note_id", noteId);
  if ((count ?? 0) >= MAX_NOTE_IMAGES) {
    return NextResponse.json({ error: `Up to ${MAX_NOTE_IMAGES} images per session note.` }, { status: 422 });
  }
  const { data, error: insertError } = await supabase
    .from("session_note_attachments")
    .insert({
      note_id: noteId,
      counselor_id: counselorId,
      storage_path: storagePath,
      mime_type: mimeType,
      size_bytes: sizeBytes,
    })
    .select("id,note_id,storage_path,mime_type,size_bytes,created_at")
    .single();
  if (insertError || !data) return NextResponse.json({ error: "Couldn't save the attachment." }, { status: 500 });
  return NextResponse.json({ attachment: data }, { status: 201 });
}

/** DELETE ?attachmentId= — remove one image (row + private-bucket bytes). */
export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const attachmentId = url.searchParams.get("attachmentId") ?? "";
  if (!z.string().uuid().safeParse(attachmentId).success) {
    return NextResponse.json({ error: "Valid attachmentId required." }, { status: 400 });
  }
  const { supabase, counselorId, role, error } = await getCounselor();
  if (error) return error;
  if (role !== "counselor" || !counselorId) {
    return NextResponse.json({ error: "Only the assigned counselor can remove attachments." }, { status: 403 });
  }
  const { data: row } = await supabase
    .from("session_note_attachments")
    .select("id,note_id,counselor_id,storage_path")
    .eq("id", attachmentId)
    .maybeSingle();
  const att = row as { id: string; note_id: string; counselor_id: string; storage_path: string } | null;
  if (!att || att.counselor_id !== counselorId) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }
  // Bytes first so a row delete never orphans private files; a failed object
  // delete still proceeds to drop the row (the path stays unreadable via RLS).
  await supabase.storage.from("session-note-attachments").remove([att.storage_path]);
  const { error: deleteError } = await supabase.from("session_note_attachments").delete().eq("id", att.id).eq("counselor_id", counselorId);
  if (deleteError) return NextResponse.json({ error: "Couldn't remove the attachment." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
