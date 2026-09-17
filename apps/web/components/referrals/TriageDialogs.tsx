"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { createReferralSchema, type CreateReferralInput } from "@dorsu/shared-schemas";
import { createClient } from "@/lib/supabase/client";
import { createReferral, isMeetUrl } from "@dorsu/shared-services";
import { upsertReferralRow, type BoardSlot, type ReferralsRow } from "@/lib/hooks/use-referrals-board";
import { Badge, Button, Card, FieldError, Input, Textarea } from "@/components/ui/primitives";
import { SlotSchedulePicker, composeLocal, defaultSchedule, selectionFitsScope, type ScheduleSelection } from "@/components/appointments/SlotSchedulePicker";
import { Dropdown } from "@/components/shared/dropdown";
import { IconAction } from "@/components/shared/icon-action";
import { notifyStaff } from "@/lib/notify";
import { Eye } from "lucide-react";
import { ReferralFormSheet, type SheetStudent } from "./ReferralFormSheet";
import {
  NO_SESSION_MSG,
  PRIORITIES,
  TRIAGE_COPY,
  classificationSummary,
  priorityTone,
  referralStudentName,
  statusLabel,
  statusTone,
  type Referral,
  type TriageKind,
} from "./status";
import {
  isSessionUpcoming,
  timeAgo,
} from "./format-helpers";

/**
 * Triage confirm dialog — confirm (with session schedule + mode), resolve,
 * escalate (with required note), reject. Owns its field state, prefill,
 * validation, and busy flag; the page only owns which referral is confirming
 * and performs the mutation via onSubmit.
 */
export function TriageConfirmDialog({
  confirming,
  aliases,
  sessionSchedule,
  slots,
  openMenuKey,
  onOpenMenuChange,
  canResolve,
  onClose,
  onSubmit,
}: {
  confirming: { ref: Referral; to: TriageKind } | null;
  aliases: Map<string, string>;
  sessionSchedule: Map<string, string>;
  slots: BoardSlot[];
  openMenuKey: string | null;
  onOpenMenuChange: (k: string | null) => void;
  canResolve: (ref: Referral) => boolean;
  onClose: () => void;
  onSubmit: (
    ref: Referral,
    to: TriageKind,
    note: string | undefined,
    opts: { scheduledIso?: string; endsAtIso?: string; mode?: "in_person" | "online"; meetingUrl?: string | null }
  ) => Promise<void>;
}) {
  // Dialog stays open with a spinner while the move (confirm mints a
  // session + notifies) is processing.
  const [busy, setBusy] = useState(false);
  const [escalateNote, setEscalateNote] = useState("");
  const [escalateError, setEscalateError] = useState<string | null>(null);
  const [sched, setSched] = useState<ScheduleSelection | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState<"in_person" | "online">("in_person");
  const [meetInput, setMeetInput] = useState("");
  const [meetError, setMeetError] = useState<string | null>(null);

  const resetFields = () => {
    setEscalateNote("");
    setEscalateError(null);
    setSched(null);
    setScheduleError(null);
    setSessionMode("in_person");
    setMeetInput("");
    setMeetError(null);
  };

  // Confirm dialog prefill — existing session time when it still fits the
  // availability scope, otherwise the first valid window. Seeded once per
  // dialog open so a late slots refetch fills the picker without wiping it.
  const schedSeedRef = useRef<string | null>(null);
  useEffect(() => {
    if (confirming?.to === "confirmed") {
      const key = confirming.ref.id;
      if (schedSeedRef.current !== key) {
        schedSeedRef.current = key;
        const existing = sessionSchedule.get(confirming.ref.id);
        const seed = existing ? new Date(existing) : null;
        setSched(defaultSchedule(slots, seed && !Number.isNaN(seed.getTime()) ? seed : null));
        setScheduleError(null);
        setSessionMode("in_person");
        setMeetInput("");
        setMeetError(null);
      }
    } else {
      schedSeedRef.current = null;
    }
    if (confirming && confirming.to !== "escalated") setEscalateError(null);
  }, [confirming, sessionSchedule, slots]);

  // Confirm dialog: Escape closes, background stays put while open.
  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => {
      // Never dismiss mid-processing — the spinner owns the dialog until done.
      if (e.key === "Escape" && !busy) {
        resetFields();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [confirming, busy, onClose]);

  if (!confirming) return null;

  const run = async () => {
    if (busy) return;
    if (confirming.to === "resolved" && !canResolve(confirming.ref)) {
      toast.error(NO_SESSION_MSG);
      return;
    }
    if (confirming.to === "resolved" && isSessionUpcoming(sessionSchedule.get(confirming.ref.id))) {
      toast.error("Session hasn't happened yet — resolve unlocks once the session time passes.");
      return;
    }
    // Counselor schedules the final session inside their availability
    // slots — same gate as the appointment page, plus the mode (Meet link
    // required online). Confirming mints the session row itself.
    let scheduledIso: string | undefined;
    let endsAtIso: string | undefined;
    let meetingUrl: string | null = null;
    if (confirming.to === "confirmed") {
      if (!sched) {
        setScheduleError("Pick a date and time inside your availability slots.");
        return;
      }
      if (!selectionFitsScope(slots, sched)) {
        setScheduleError("That window is outside your availability slots — pick one inside.");
        return;
      }
      const scheduledAt = composeLocal(sched.date, sched.start);
      const endsAt = composeLocal(sched.date, sched.end);
      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
        setScheduleError("Sessions must be scheduled in the future.");
        return;
      }
      if (Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= scheduledAt.getTime()) {
        setScheduleError("The end time must be after the start time.");
        return;
      }
      scheduledIso = scheduledAt.toISOString();
      endsAtIso = endsAt.toISOString();
      if (sessionMode === "online") {
        const link = meetInput.trim();
        if (!link) {
          setMeetError("Paste the Google Meet link for this online session.");
          return;
        }
        if (!isMeetUrl(link)) {
          setMeetError("That doesn't look like a Google Meet link — paste a meet.google.com link.");
          return;
        }
        meetingUrl = link;
      }
    }
    if (confirming.to === "escalated" && escalateNote.trim().length < 10) {
      setEscalateError("Say why this is urgent and what was already tried (at least 10 characters).");
      return;
    }
    const { ref, to } = confirming;
    const note = to === "escalated" ? escalateNote.trim() : undefined;
    // Keep the dialog open with a spinner until the move lands, so the user
    // knows the confirm is processing (session mint + notifications).
    setBusy(true);
    try {
      await onSubmit(ref, to, note, { scheduledIso, endsAtIso, mode: sessionMode, meetingUrl });
    } finally {
      resetFields();
      setBusy(false);
      onClose();
    }
  };

  const close = () => {
    if (busy) return;
    resetFields();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="ref-confirm-title"
      aria-describedby="ref-confirm-desc"
    >
      <div aria-hidden className="absolute inset-0 bg-ink/40" onClick={close} />
      <div className="no-scrollbar relative max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-card sm:max-w-md">
        <h2 id="ref-confirm-title" className="font-display text-lg font-bold text-ink">
          {TRIAGE_COPY[confirming.to].title}
        </h2>
        <p id="ref-confirm-desc" className="mt-1 text-sm leading-relaxed text-ink-muted">
          {TRIAGE_COPY[confirming.to].body}
        </p>
        <p className="mt-3 line-clamp-2 rounded-xl bg-cream px-3 py-2 text-[13px] font-semibold text-ink-soft">
          {referralStudentName(confirming.ref, aliases)} · {confirming.ref.reason}
        </p>
        {confirming.to === "confirmed" && (
          <div className="mt-3">
            <SlotSchedulePicker
              slots={slots}
              value={sched}
              onChange={(v) => {
                setSched(v);
                setScheduleError(null);
              }}
            />
            {scheduleError ? (
              <p className="mt-1.5 text-xs font-semibold text-red-600">{scheduleError}</p>
            ) : (
              <p className="mt-1.5 text-[11px] font-medium text-ink-faint">
                Confirming creates the session itself — the student is notified with this time.
              </p>
            )}
          </div>
        )}
        {confirming.to === "confirmed" && (
          <div className="mt-3 grid gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-ink-muted" htmlFor="ref-session-mode">
                Session mode
              </label>
              <Dropdown
                menuKey="ref-confirm-mode"
                openMenuKey={openMenuKey}
                onOpenChange={onOpenMenuChange}
                value={sessionMode}
                onChange={(v) => setSessionMode(v as "in_person" | "online")}
                ariaLabel="Session mode"
                options={[
                  { value: "in_person", label: "In person" },
                  { value: "online", label: "Online" },
                ]}
              />
            </div>
            {sessionMode === "online" && (
              <div>
                <label className="mb-1 block text-xs font-bold text-ink-muted" htmlFor="ref-meet-link">
                  Google Meet link
                </label>
                <Input
                  id="ref-meet-link"
                  type="url"
                  inputMode="url"
                  placeholder="https://meet.google.com/abc-defg-hij"
                  value={meetInput}
                  onChange={(e) => {
                    setMeetInput(e.target.value);
                    setMeetError(null);
                  }}
                />
                {meetError ? (
                  <p className="mt-1.5 text-xs font-semibold text-red-600">{meetError}</p>
                ) : (
                  <p className="mt-1.5 text-[11px] font-medium text-ink-faint">
                    Paste the Google Meet for this session — the student joins with this link.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        {confirming.to === "escalated" && (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-bold text-ink-muted" htmlFor="escalate-note">
              Why is this urgent, and what was already tried? (required)
            </label>
            <Textarea
              id="escalate-note"
              rows={3}
              value={escalateNote}
              onChange={(e) => {
                setEscalateNote(e.target.value);
                if (escalateError) setEscalateError(null);
              }}
              placeholder="e.g. Panic attacks twice this week; intake done, needs head review today."
            />
            <FieldError message={escalateError ?? undefined} />
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={close} autoFocus>
            Back
          </Button>
          <Button
            size="sm"
            variant={confirming.to === "escalated" || confirming.to === "rejected" ? "danger" : "primary"}
            disabled={busy || (confirming.to === "confirmed" && !sched)}
            onClick={run}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {busy ? "Processing…" : TRIAGE_COPY[confirming.to].ok}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Faculty submit section — the digitized Counseling Referral Form sheet
 * plus an office-routing card (urgency), plus the faculty's own read-only
 * view of the queue below with official-form view buttons.
 */
export function FacultyReferralSection({
  facultyId,
  students,
  headIds,
  rows,
  aliases,
  openMenuKey,
  onOpenMenuChange,
  onSubmitted,
  showQueue = true,
  myName,
  onViewForm,
}: {
  facultyId: string | null;
  students: SheetStudent[];
  headIds: string[];
  rows: Referral[];
  aliases: Map<string, string>;
  openMenuKey: string | null;
  onOpenMenuChange: (k: string | null) => void;
  onSubmitted: () => void;
  /** Set false on the dedicated /refer-student page (tracking lives on /referrals). */
  showQueue?: boolean;
  myName: string;
  onViewForm?: (r: Referral) => void;
}) {
  const form = useForm<CreateReferralInput>({
    resolver: zodResolver(createReferralSchema),
    defaultValues: { priority: "medium", caseClassification: [] },
  });
  const { handleSubmit, formState, reset, setValue, watch } = form;
  const priorityValue = watch("priority") ?? "medium";
  const [studentPick, setStudentPick] = useState("");
  // Same-tick double-click guard — the disabled button covers re-renders,
  // this ref covers two submits dispatched before React flushes state.
  const submitRef = useRef(false);
  const submitting = formState.isSubmitting || submitRef.current;
  const qc = useQueryClient();
  const todayLabel = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <form
        className="space-y-4"
        onSubmit={handleSubmit(async (v) => {
          if (submitRef.current) return;
          if (!facultyId) {
            toast.error("Your faculty record isn't linked yet — ask the guidance head to finish setup.");
            return;
          }
          submitRef.current = true;
          try {
            const created = (await createReferral(createClient(), {
              studentId: v.studentId,
              reason: v.reason,
              priority: v.priority,
              studentGender: v.studentGender || undefined,
              studentAge: v.studentAge || undefined,
              relationToClient: v.relationToClient || undefined,
              caseClassification: v.caseClassification,
              classificationOther: v.classificationOther || undefined,
              referringFacultyId: facultyId,
            })) as { id?: string } | null;
            reset();
            setStudentPick("");
            toast.success("Referral submitted — the guidance office will triage it.");
            // Instant list update: prepend the created row (with its alias)
            // so the history shows it with the toast — refetch reconciles after.
            if (created?.id) {
              const alias = v.studentId
                ? (students.find((s) => s.id === v.studentId)?.alias ?? null)
                : null;
              upsertReferralRow(qc, created as unknown as ReferralsRow, alias);
            }
            const kinds = classificationSummary(v.caseClassification);
            void notifyStaff(headIds, {
              type: "referral",
              title: `New ${v.priority} referral (${kinds})`,
              body: v.reason.length > 120 ? `${v.reason.slice(0, 120)}…` : v.reason,
              link: created?.id ? `/referrals#focus-${created.id}` : "/referrals",
              ...(created?.id ? { dedupeKey: `referral:${created.id}:created` } : {}),
              tone: "info",
            });
            onSubmitted();
          } finally {
            submitRef.current = false;
          }
        })}
      >
        <div className="rounded-lg border border-ink/10 bg-white p-4 shadow-card sm:p-6">
          <ReferralFormSheet
            mode="fill"
            form={form}
            students={students}
            studentPick={studentPick}
            onStudentPick={(val) => {
              setStudentPick(val);
              setValue("studentId", val, { shouldValidate: true });
            }}
            openMenuKey={openMenuKey}
            onOpenMenuChange={onOpenMenuChange}
            referrerName={myName}
            dateLabel={todayLabel}
          />
        </div>

        <Card>
          <h2 className="font-display font-bold">Office routing</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            Not part of the paper form — helps the office triage faster.
          </p>
          <div className="mt-3 grid items-end gap-3 md:grid-cols-[240px_minmax(0,1fr)]">
            <div>
              <label className="mb-1 block text-xs font-bold text-ink-muted">Urgency</label>
              <Dropdown
                menuKey="ref-new-priority"
                openMenuKey={openMenuKey}
                onOpenChange={onOpenMenuChange}
                value={priorityValue}
                onChange={(val) => setValue("priority", val as CreateReferralInput["priority"], { shouldValidate: true })}
                ariaLabel="Referral urgency"
                options={PRIORITIES.map((p) => ({ value: p, label: statusLabel(p) }))}
              />
              <FieldError message={formState.errors.priority?.message} />
            </div>
            <div className="md:justify-self-end">
              <Button disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {submitting ? "Submitting…" : "Submit referral"}
              </Button>
            </div>
          </div>
        </Card>
      </form>

      {/* Faculty's own view of the queue is read-only context below the form */}
      {showQueue && !!rows.length && (
        <div className="space-y-3">
          {rows.slice(0, 10).map((r) => (
            <Card key={r.id} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-ink">{referralStudentName(r, aliases)}</span>
                <Badge tone="info">{classificationSummary(r.case_classification)}</Badge>
                <Badge tone={priorityTone(r.priority)}>{statusLabel(r.priority)}</Badge>
                <Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge>
                <span className="ml-auto text-[11px] font-medium text-ink-faint">{timeAgo(r.created_at)}</span>
              </div>
              <p className="text-sm">{r.reason}</p>
              {onViewForm && (
                <div className="flex justify-end">
                  <IconAction label="View official form" variant="outline" icon={Eye} onClick={() => onViewForm(r)} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
