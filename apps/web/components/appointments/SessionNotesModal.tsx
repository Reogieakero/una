"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ImagePlus, Loader2, Lock, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button } from "@/components/ui/primitives";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { imageValidationError } from "@/components/announcements/image-upload";
import { createClient } from "@/lib/supabase/client";
import { notifyStaff } from "@/lib/notify";
import type { BoardSlot } from "@/lib/hooks/use-appointments-board";
import { slotWindowsForDate, startOptionsForDate, validScheduleDates } from "./SlotSchedulePicker";
import {
  MAX_NOTE_IMAGES,
  deleteSessionNoteAttachment,
  signAttachmentUrls,
  uploadSessionNoteImage,
  useSaveSessionNote,
  useSessionNote,
  type SessionNoteAttachment,
} from "@/lib/hooks/use-session-notes";
import { formatScheduleRange, formatWhen } from "./status";
import type { Appt } from "./status";
import { timeAgoLong } from "@/lib/format";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** ISO → local "YYYY-MM-DDTHH:mm" for the DateTimePicker. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Local "YYYY-MM-DDTHH:mm" → ISO, or null when unparseable. */
function localToISO(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Default follow-up seed — first bookable moment inside availability. */
function seedFollowUpLocal(slots: BoardSlot[]): string {
  for (const date of validScheduleDates(slots)) {
    const starts = startOptionsForDate(slots, date);
    if (starts.length) return `${date}T${starts[0]}`;
  }
  return "";
}

function to12hLabel(mins: number): string {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${pad(m)} ${period}`;
}

/** Local "YYYY-MM-DDTHH:mm" → true when the moment sits inside one slot window. */
function momentInScope(slots: BoardSlot[], local: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return false;
  const t = Number(m[4]) * 60 + Number(m[5]);
  // Same 15-minute-room rule as the schedule start options: the moment must
  // leave room for at least a session start inside the window.
  return slotWindowsForDate(slots, `${m[1]}-${m[2]}-${m[3]}`).some((w) => t >= w.start && t + 15 <= w.end);
}

/** Covering window label for the hint line, e.g. "9:00 AM–12:00 PM". */
function coveringWindowLabel(slots: BoardSlot[], local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const t = Number(m[4]) * 60 + Number(m[5]);
  const win = slotWindowsForDate(slots, `${m[1]}-${m[2]}-${m[3]}`).find((w) => t >= w.start && t + 15 <= w.end);
  return win ? `${to12hLabel(win.start)}–${to12hLabel(win.end)}` : null;
}

function formatFollowUp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

type PendingImage = { key: string; file: File; preview: string };

/**
 * SessionNotesModal — the counselor's private clinical record for one ended
 * (completed) session.
 *
 * - Counselors (editable): document the session (min 10 chars), optionally
 *   flag a follow-up (the date + time picker only appears when checked, and
 *   only offers moments inside their availability), attach up to 5 images,
 *   amend later. One note per session — the route returns 409 if one already
 *   exists, and this modal converges to edit mode.
 * - A saved follow-up mints a real follow-up session (confirmed) that shows
 *   on the sessions page with a Follow-up badge; amending moves it, removing
 *   the flag calls it off. Heads + student are notified like any other
 *   appointment event (realtime sonner), metadata only.
 * - Guidance head (read-only): oversight view of the same record.
 * - Privacy: content is fetched per-session and never leaves this modal —
 *   no notifications, no exports, no audit-trail copies (see
 *   /api/session-notes). Images live in a private bucket behind signed URLs.
 *   A lock notice says so on-screen.
 */
export function SessionNotesModal({
  appt,
  studentLabel,
  studentProfileId,
  editable,
  headIds,
  slots = [],
  onClose,
}: {
  appt: Appt | null;
  studentLabel: string;
  /** Student profile id — notified when a follow-up session is scheduled/moved/cancelled. */
  studentProfileId: string | null;
  /** Counselors edit their own ended sessions; the head views read-only. */
  editable: boolean;
  /** Guidance-head profile ids — pinged once when a note is first documented. */
  headIds: string[];
  /** Counselor availability — the follow-up picker only offers in-scope moments. */
  slots?: BoardSlot[];
  onClose: () => void;
}) {
  const appointmentId = appt?.id ?? null;
  const { data, isPending, isError, error, refetch, isFetching } = useSessionNote(appointmentId);
  const save = useSaveSessionNote(appointmentId ?? "");
  const existing = data?.[0] ?? null;

  const [content, setContent] = useState("");
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [followUpAtLocal, setFollowUpAtLocal] = useState("");
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const seededRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const savedAttachments: SessionNoteAttachment[] = existing?.attachments ?? [];
  const busy = save.isPending || uploading;

  // Seed the form from the saved record (once per note) — later keystrokes
  // must never be clobbered by background refetches.
  useEffect(() => {
    if (!existing || seededRef.current === existing.id) return;
    seededRef.current = existing.id;
    setContent(existing.content);
    setFollowUpRequired(existing.follow_up_required);
    setFollowUpAtLocal(existing.follow_up_at ? toLocalInput(existing.follow_up_at) : "");
  }, [existing]);
  useEffect(() => {
    seededRef.current = null;
    setContent("");
    setFollowUpRequired(false);
    setFollowUpAtLocal("");
    setPending((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.preview));
      return [];
    });
    setSignedUrls({});
  }, [appointmentId]);

  // Short-lived signed URLs for the private-bucket thumbnails.
  useEffect(() => {
    if (!savedAttachments.length) return;
    const missing = savedAttachments.map((a) => a.storage_path).filter((p) => !(p in signedUrls));
    if (!missing.length) return;
    let cancelled = false;
    void signAttachmentUrls(createClient(), missing).then((urls) => {
      if (!cancelled) setSignedUrls((prev) => ({ ...prev, ...urls }));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id, savedAttachments.length]);

  // Self-contained dialog chrome (Escape + scroll lock), like the detail modal.
  useEffect(() => {
    if (!appt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy && !removingId) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appt, busy, removingId]);

  if (!appt) return null;

  const trimmed = content.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < 10;
  const followUpAtISO = followUpRequired ? localToISO(followUpAtLocal) : null;
  const followUpInFuture = !followUpAtISO || new Date(followUpAtISO).getTime() > Date.now();
  const followUpInScope = !followUpRequired || (followUpAtLocal !== "" && momentInScope(slots, followUpAtLocal));
  // Bookable days need a real 15-minute start (not just a sliver of cover) —
  // otherwise a day looks enabled with no selectable time. Empty state below
  // points at /availability instead of letting the save fail server-side.
  const isBookableDay = (dateISO: string) => startOptionsForDate(slots, dateISO).length > 0;
  const hasScopeDates = validScheduleDates(slots).some(isBookableDay);
  const followUpValid =
    !followUpRequired || (followUpAtISO !== null && followUpInFuture && followUpInScope && hasScopeDates);
  const canSave = editable && !busy && trimmed.length >= 10 && trimmed.length <= 10000 && followUpValid;
  const imageCount = savedAttachments.length + pending.length;
  const scopeWindow = followUpRequired && followUpAtLocal ? coveringWindowLabel(slots, followUpAtLocal) : null;

  const handleFollowUpToggle = (checked: boolean) => {
    setFollowUpRequired(checked);
    // The picker only exists while follow-up is needed — keep a still-valid
    // moment, otherwise seed the first bookable moment inside availability.
    setFollowUpAtLocal(checked ? (followUpAtLocal && momentInScope(slots, followUpAtLocal) ? followUpAtLocal : seedFollowUpLocal(slots)) : "");
  };

  const handlePickFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_NOTE_IMAGES - imageCount;
    if (room <= 0) {
      toast.error(`Up to ${MAX_NOTE_IMAGES} images per session note.`, { position: "top-right" });
      return;
    }
    const next: PendingImage[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      const problem = imageValidationError(file);
      if (problem) {
        toast.error(problem, { position: "top-right" });
        continue;
      }
      next.push({ key: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file, preview: URL.createObjectURL(file) });
    }
    if (next.length) setPending((prev) => [...prev, ...next].slice(0, MAX_NOTE_IMAGES - savedAttachments.length));
  };

  const handleRemovePending = (key: string) => {
    setPending((prev) => {
      const target = prev.find((p) => p.key === key);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((p) => p.key !== key);
    });
  };

  const handleRemoveSaved = async (id: string) => {
    if (removingId) return;
    setRemovingId(id);
    try {
      await deleteSessionNoteAttachment(id);
      await refetch();
      toast.success("Image removed", { position: "top-right" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove the image.", { position: "top-right" });
    } finally {
      setRemovingId(null);
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    // First documentation pings the guidance head (realtime sonner via the
    // notifications INSERT → RealtimeProvider toast path, same as every other
    // appointment event). Amendments stay silent to avoid inbox noise. The
    // notification carries alias + schedule metadata ONLY — never note content.
    const wasNew = !existing;
    try {
      const result = await save.mutateAsync({
        noteId: existing?.id,
        content: trimmed,
        followUpRequired,
        followUpAt: followUpAtISO,
      });
      const note = result.note;
      seededRef.current = note.id;
      if (wasNew) {
        void notifyStaff(headIds, {
          type: "appointment",
          title: "Session note documented",
          body: `${studentLabel} · ${formatWhen(appt.scheduled_at)}`,
          link: `/appointments#focus-${appt.id}`,
          dedupeKey: `note:${appt.id}:documented`,
          tone: "info",
        });
      }
      // A minted / moved / called-off follow-up is a real session event:
      // heads and the student get the same realtime sonner + inbox row as
      // any other appointment move (alias + schedule metadata ONLY — never
      // note content). The appt:<id> dedupe prefix also live-patches the
      // sessions boards via RealtimeProvider.
      const fs = result.followUpSession;
      if (fs) {
        const when = formatWhen(fs.scheduled_at);
        const event =
          fs.action === "minted"
            ? { verb: "confirmed" as const, title: "Follow-up session scheduled", tone: "success" as const }
            : fs.action === "rescheduled"
              ? { verb: "rescheduled" as const, title: "Follow-up session rescheduled", tone: "info" as const }
              : { verb: "cancelled" as const, title: "Follow-up session cancelled", tone: "error" as const };
        const dedupeKey = `appt:${fs.id}:${event.verb}`;
        void notifyStaff(headIds, {
          type: "appointment",
          title: event.title,
          body: `${studentLabel} · ${when}`,
          link: `/appointments#focus-${fs.id}`,
          dedupeKey,
          tone: event.tone,
        });
        if (studentProfileId) {
          const studentBody =
            fs.action === "minted"
              ? `Your follow-up session is scheduled on ${when}. See you then!`
              : fs.action === "rescheduled"
                ? `Your follow-up session is moved to ${when}. See you then!`
                : `Your follow-up session on ${when} was cancelled. Contact the office to rebook.`;
          void notifyStaff([studentProfileId], {
            type: "appointment",
            title: event.title,
            body: studentBody,
            link: "/appointments",
            dedupeKey,
            tone: event.tone,
          });
        }
      }
      // Images picked before the first save upload now that the note exists.
      const queued = pending.slice(0, MAX_NOTE_IMAGES - note.attachments.length);
      if (queued.length) {
        setUploading(true);
        try {
          const supabase = createClient();
          for (const p of queued) {
            await uploadSessionNoteImage(supabase, note.id, p.file);
          }
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Some images couldn't be attached.", { position: "top-right" });
        } finally {
          queued.forEach((p) => URL.revokeObjectURL(p.preview));
          setPending((prev) => prev.filter((p) => !queued.some((q) => q.key === p.key)));
          setUploading(false);
          await refetch();
        }
      }
      toast.success(existing ? "Session note updated" : "Session note saved", {
        description: fs
          ? `Follow-up ${fs.action === "minted" ? `scheduled for ${formatWhen(fs.scheduled_at)}` : fs.action === "rescheduled" ? `moved to ${formatWhen(fs.scheduled_at)}` : "called off"} — sessions page updated, head and student notified.`
          : result.followUpError ?? "Stored privately — only you and the guidance head can read it.",
        position: "top-right",
      });
      if (result.followUpError) {
        toast.error(result.followUpError, { position: "top-right" });
      }
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't save the session note.";
      // A 409 means a note landed first (double-submit / second tab) —
      // refetch so the form converges to editing that record.
      if (/already exists/i.test(msg)) void refetch();
      toast.error(msg, { position: "top-right" });
    }
  };

  const renderThumbs = (items: { key: string; src: string | undefined; label: string; onRemove?: () => void; removing?: boolean }[]) => (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {items.map((item) => (
        <div key={item.key} className="group relative aspect-square overflow-hidden rounded-xl border border-ink/10 bg-cream">
          {item.src ? (
            <button
              type="button"
              onClick={() => item.src && window.open(item.src, "_blank", "noopener,noreferrer")}
              aria-label={`View ${item.label} full size`}
              className="h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.src} alt={item.label} className="h-full w-full object-cover" />
            </button>
          ) : (
            <span className="flex h-full w-full items-center justify-center" role="status" aria-label={`Loading ${item.label}`}>
              <Loader2 className="h-4 w-4 animate-spin text-ink-faint" aria-hidden />
            </span>
          )}
          {item.onRemove && (
            <button
              type="button"
              onClick={item.onRemove}
              disabled={item.removing || busy}
              aria-label={`Remove ${item.label}`}
              className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-white transition hover:bg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-50"
            >
              {item.removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
            </button>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-notes-title"
    >
      <div aria-hidden className="absolute inset-0 bg-ink/40" onClick={() => !busy && !removingId && onClose()} />
      <div className="no-scrollbar relative max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white shadow-card sm:max-w-lg">
        <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-6 pb-4 pt-5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Confidential record</p>
            <h2 id="session-notes-title" className="mt-0.5 font-display text-lg font-bold text-ink">
              Session notes
            </h2>
            <p className="mt-0.5 truncate text-[13px] font-medium text-ink-muted">
              {studentLabel} · {formatScheduleRange(appt.scheduled_at, appt.ends_at ?? null)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge tone="info">
              <span className="inline-flex items-center gap-1">
                <Lock className="h-3 w-3" aria-hidden />
                Private
              </span>
            </Badge>
            <button
              type="button"
              aria-label="Close session notes"
              onClick={onClose}
              disabled={busy || !!removingId}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-cream hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-50"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="flex items-start gap-2 rounded-2xl bg-cream px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {editable
              ? "Only you and the guidance head can read this — notes and images never appear in notifications, exports, or the audit trail."
              : "Oversight view — only the assigned counselor and the guidance head can read this record."}
          </p>

          {isPending ? (
            <div className="flex items-center gap-2 py-8 text-sm font-medium text-ink-muted" role="status" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading session notes…
            </div>
          ) : isError && !data ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4" role="alert">
              <p className="text-sm font-bold text-red-800">Couldn&apos;t load the notes</p>
              <p className="mt-1 text-[13px] text-red-700">
                {(error as Error)?.message ?? "Something went wrong."}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                Try again
              </button>
            </div>
          ) : editable ? (
            <>
              <div>
                <label htmlFor="session-note-content" className="text-[13px] font-bold text-ink">
                  What happened in this session?
                </label>
                <textarea
                  id="session-note-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  maxLength={10000}
                  disabled={busy}
                  placeholder="Observations, interventions used, student response, plan… (at least 10 characters)"
                  className="mt-1.5 w-full rounded-2xl border border-ink/15 bg-white px-4 py-3 text-sm leading-relaxed text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-60"
                />
                <div className="mt-1 flex items-center justify-between text-xs font-medium">
                  <span className={tooShort ? "text-red-600" : "text-ink-faint"}>
                    {tooShort ? `Need ${10 - trimmed.length} more characters` : `${trimmed.length}/10000`}
                  </span>
                  {data && isFetching && <span className="text-ink-faint">Refreshing…</span>}
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-ink/10 p-4">
                <label className="flex cursor-pointer items-center gap-2.5 text-sm font-bold text-ink">
                  <input
                    type="checkbox"
                    checked={followUpRequired}
                    onChange={(e) => handleFollowUpToggle(e.target.checked)}
                    disabled={busy}
                    className="h-4 w-4 accent-primary-600"
                  />
                  Follow-up needed
                </label>
                {followUpRequired && (
                  <div>
                    <p className="text-[13px] font-bold text-ink" id="session-note-followup-label">
                      Follow-up date and time <span className="font-medium text-ink-faint">(inside your availability)</span>
                    </p>
                    {hasScopeDates ? (
                      <div className="mt-1.5">
                        <DateTimePicker
                          value={followUpAtLocal}
                          onChange={setFollowUpAtLocal}
                          ariaLabel="Follow-up date and time"
                          isDayEnabled={isBookableDay}
                          isTimeEnabled={(dateISO, h, min) => {
                            const t = h * 60 + min;
                            return slotWindowsForDate(slots, dateISO).some((w) => t >= w.start && t + 15 <= w.end);
                          }}
                          scopeHint={
                            scopeWindow
                              ? `Inside your ${scopeWindow} slot.`
                              : "Pick a day and time inside your availability slots."
                          }
                        />
                      </div>
                    ) : (
                      <p className="mt-1.5 rounded-2xl border border-ink/15 bg-white px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
                        You have no availability windows in the next 28 days — follow-ups must fall inside them.{" "}
                        <Link href="/availability" className="font-bold text-primary-700 hover:underline">
                          Set your slots first
                        </Link>
                        .
                      </p>
                    )}
                    {!followUpValid && hasScopeDates && (
                      <p className="mt-1 text-xs font-semibold text-red-600">
                        {!followUpInFuture
                          ? "Follow-ups must be in the future."
                          : "Pick a follow-up date and time inside your availability."}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2 rounded-2xl border border-ink/10 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-bold text-ink">
                    Supporting images{" "}
                    <span className="font-medium text-ink-faint">
                      ({imageCount}/{MAX_NOTE_IMAGES})
                    </span>
                  </p>
                  {imageCount < MAX_NOTE_IMAGES && (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3 py-1.5 text-xs font-bold text-ink-soft shadow-card transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-50"
                    >
                      <ImagePlus className="h-4 w-4" aria-hidden />
                      Add images
                    </button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  aria-label="Attach supporting images"
                  disabled={busy}
                  onChange={(e) => {
                    handlePickFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                {(savedAttachments.length > 0 || pending.length > 0) &&
                  renderThumbs([
                    ...savedAttachments.map((a) => ({
                      key: a.id,
                      src: signedUrls[a.storage_path],
                      label: "attached image",
                      onRemove: () => void handleRemoveSaved(a.id),
                      removing: removingId === a.id,
                    })),
                    ...pending.map((p) => ({
                      key: p.key,
                      src: p.preview,
                      label: "image to attach",
                      onRemove: () => handleRemovePending(p.key),
                    })),
                  ])}
                <p className="text-xs font-medium text-ink-faint">
                  JPG, PNG, or WEBP up to 5MB each — stored privately with this note.
                </p>
              </div>

              {existing && (
                <p className="text-xs font-medium text-ink-faint">
                  Documented {timeAgoLong(existing.created_at)}
                  {existing.updated_at !== existing.created_at && ` · edited ${timeAgoLong(existing.updated_at)}`}
                </p>
              )}
            </>
          ) : (
            <>
              {existing ? (
                <>
                  <div className="rounded-2xl border border-ink/10 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Note</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{existing.content}</p>
                  </div>
                  <ul className="space-y-2">
                    <li className="flex items-center justify-between gap-3 rounded-xl bg-cream px-4 py-3 text-sm">
                      <span className="font-semibold text-ink-soft">Follow-up needed</span>
                      <span className="font-bold text-ink">{existing.follow_up_required ? "Yes" : "No"}</span>
                    </li>
                    {existing.follow_up_at && (
                      <li className="flex items-center justify-between gap-3 rounded-xl bg-cream px-4 py-3 text-sm">
                        <span className="font-semibold text-ink-soft">Follow-up date and time</span>
                        <span className="font-bold text-ink">{formatFollowUp(existing.follow_up_at)}</span>
                      </li>
                    )}
                    <li className="flex items-center justify-between gap-3 rounded-xl bg-cream px-4 py-3 text-sm">
                      <span className="font-semibold text-ink-soft">Documented</span>
                      <span className="font-bold text-ink">{timeAgoLong(existing.created_at)}</span>
                    </li>
                  </ul>
                  {savedAttachments.length > 0 && (
                    <div className="space-y-2 rounded-2xl border border-ink/10 p-4">
                      <p className="text-[13px] font-bold text-ink">
                        Supporting images{" "}
                        <span className="font-medium text-ink-faint">({savedAttachments.length})</span>
                      </p>
                      {renderThumbs(
                        savedAttachments.map((a) => ({
                          key: a.id,
                          src: signedUrls[a.storage_path],
                          label: "attached image",
                        }))
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="py-6 text-center text-sm text-ink-muted">
                  No session note documented for this session yet.
                </p>
              )}
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={onClose} disabled={busy || !!removingId}>
              Close
            </Button>
            {editable && (
              <Button size="sm" variant="accent" onClick={() => void handleSave()} disabled={!canSave}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {uploading ? "Attaching images…" : existing ? "Save changes" : "Save note"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
