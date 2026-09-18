"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SessionNoteAttachment = {
  id: string;
  note_id: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

export type SessionNote = {
  id: string;
  appointment_id: string;
  counselor_id: string;
  content: string;
  is_private: boolean;
  follow_up_required: boolean;
  follow_up_date: string | null;
  /** Follow-up moment (date + time, ISO). Null unless follow-up is needed. */
  follow_up_at: string | null;
  attachments: SessionNoteAttachment[];
  created_at: string;
  updated_at: string;
};

/** Private bucket for note images — never public (unlike announcement covers). */
export const SESSION_NOTE_BUCKET = "session-note-attachments";
/** Max images per session note — mirrored by the API (409/422 past it). */
export const MAX_NOTE_IMAGES = 5;

export const sessionNotesKey = (appointmentId: string) => ["session-notes", appointmentId] as const;

async function fetchSessionNotes(appointmentId: string): Promise<SessionNote[]> {
  const res = await fetch(`/api/session-notes?appointmentId=${encodeURIComponent(appointmentId)}`, {
    credentials: "same-origin",
  });
  const body = (await res.json().catch(() => null)) as { notes?: SessionNote[]; error?: string } | null;
  if (!res.ok) throw new Error(body?.error ?? "Couldn't load session notes.");
  return body?.notes ?? [];
}

/**
 * Private notes for one ended session. Disabled until a session is picked —
 * the modal opens it per completed appointment, so each session's record
 * stays isolated in the cache.
 */
export function useSessionNote(appointmentId: string | null) {
  return useQuery({
    queryKey: appointmentId ? sessionNotesKey(appointmentId) : ["session-notes", "none"],
    queryFn: () => fetchSessionNotes(appointmentId as string),
    enabled: !!appointmentId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export type FollowUpSessionInfo = {
  id: string;
  scheduled_at: string;
  ends_at: string | null;
  status: string;
  action: "minted" | "rescheduled" | "cancelled";
};

export type SaveSessionNoteResult = {
  note: SessionNote;
  /** Set when the save minted, moved, or called off the follow-up session. */
  followUpSession: FollowUpSessionInfo | null;
  /** Scheduling conflict detail — the note itself still saved. */
  followUpError: string | null;
};

export type SaveSessionNoteInput = {
  /** Set when amending an existing note — otherwise a new note is created. */
  noteId?: string;
  content: string;
  followUpRequired: boolean;
  /** ISO datetime of the follow-up moment; null unless follow-up is needed. */
  followUpAt: string | null;
};

/**
 * Create-or-amend mutation for the counselor's private record.
 * Exposes isPending for the save spinner/disabled state; on success the
 * per-session cache is replaced so the modal shows the saved record.
 */
export function useSaveSessionNote(appointmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveSessionNoteInput): Promise<SaveSessionNoteResult> => {
      const res = await fetch("/api/session-notes", {
        method: input.noteId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(
          input.noteId
            ? {
                noteId: input.noteId,
                content: input.content,
                followUpRequired: input.followUpRequired,
                followUpAt: input.followUpAt,
              }
            : {
                appointmentId,
                content: input.content,
                followUpRequired: input.followUpRequired,
                followUpAt: input.followUpAt,
              }
        ),
      });
      const body = (await res.json().catch(() => null)) as {
        note?: SessionNote;
        followUpSession?: FollowUpSessionInfo | null;
        followUpError?: string | null;
        error?: string;
        noteId?: string;
      } | null;
      if (!res.ok) {
        const err = new Error(body?.error ?? "Couldn't save the session note.");
        (err as { noteId?: string }).noteId = body?.noteId;
        throw err;
      }
      const result = body as SaveSessionNoteResult;
      return {
        note: result.note,
        followUpSession: result.followUpSession ?? null,
        followUpError: result.followUpError ?? null,
      };
    },
    onSuccess: ({ note }) => {
      qc.setQueryData<SessionNote[]>(sessionNotesKey(appointmentId), [note]);
    },
  });
}

/**
 * Upload one image to the private bucket and register it on the note.
 * Runs as the caller (storage + row RLS apply); the API re-checks ownership,
 * the 5-image cap, MIME, and size. Removes the orphaned object if the
 * metadata write fails.
 */
export async function uploadSessionNoteImage(
  supabase: SupabaseClient,
  noteId: string,
  file: File
): Promise<SessionNoteAttachment> {
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${noteId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(SESSION_NOTE_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error("Image upload failed — please try again.");
  const res = await fetch("/api/session-notes/attachments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ noteId, storagePath: path, mimeType: file.type, sizeBytes: file.size }),
  });
  const body = (await res.json().catch(() => null)) as { attachment?: SessionNoteAttachment; error?: string } | null;
  if (!res.ok) {
    await supabase.storage.from(SESSION_NOTE_BUCKET).remove([path]).catch(() => {});
    throw new Error(body?.error ?? "Couldn't attach the image.");
  }
  return (body as { attachment: SessionNoteAttachment }).attachment;
}

/** Remove one image — the route deletes the private-bucket bytes + the row. */
export async function deleteSessionNoteAttachment(attachmentId: string): Promise<void> {
  const res = await fetch(`/api/session-notes/attachments?attachmentId=${encodeURIComponent(attachmentId)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Couldn't remove the image.");
  }
}

/** Short-lived (1h) signed URLs for private-bucket previews. */
export async function signAttachmentUrls(
  supabase: SupabaseClient,
  paths: string[]
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    paths.map(async (path) => {
      const { data } = await supabase.storage.from(SESSION_NOTE_BUCKET).createSignedUrl(path, 3600);
      if (data?.signedUrl) out[path] = data.signedUrl;
    })
  );
  return out;
}
