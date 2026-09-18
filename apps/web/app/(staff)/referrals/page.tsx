"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  REFERRALS_BOARD_KEY,
  useReferralsBoard,
  type ReferralStudentOption,
  type ReferralsBoardData,
} from "@/lib/hooks/use-referrals-board";
import { useMutationAction } from "@/lib/hooks/use-mutation-action";
import { patchBoard } from "@/lib/patch-board";
import {
  assignReferral,
  completeAppointment,
  confirmReferralWithSession,
  rejectReferral,
  triageReferral,
} from "@dorsu/shared-services";
import { APPOINTMENTS_BOARD_KEY } from "@/lib/hooks/use-appointments-board";
import type { Appt } from "@/components/appointments/status";
import { Card } from "@/components/ui/primitives";
import { notifyStaff } from "@/lib/notify";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { NO_SESSION_MSG, classificationSummary, referralStudentName, statusLabel, type RefAction, type Referral, type TriageKind } from "@/components/referrals/status";
import { formatWhen, isSessionUpcoming, parseScheduleNote, parseSessionMode } from "@/components/referrals/format-helpers";
import { ReferralActionsLegend, ReferralStatsMenu } from "@/components/referrals/ReferralStats";
import { ReferralsBoard } from "@/components/referrals/ReferralsBoard";
import { ReferralFormModal } from "@/components/referrals/ReferralFormModal";
import { ReferralTrackingModal } from "@/components/referrals/ReferralTrackingModal";
import { SessionNotesModal } from "@/components/appointments/SessionNotesModal";
import { FacultyReferralSection, TriageConfirmDialog } from "@/components/referrals/TriageDialogs";
import { useReferralFilters } from "@/components/referrals/use-referral-filters";

const EMPTY_ROWS: Referral[] = [];
const EMPTY_TRAIL = new Map<string, RefAction[]>();
const EMPTY_MAP = new Map<string, string>();
const EMPTY_COUNSELORS: { id: string; name: string }[] = [];
const EMPTY_IDS: string[] = [];
const EMPTY_STUDENTS: ReferralStudentOption[] = [];
const EMPTY_READY = new Set<string>();

/**
 * Shared /referrals — same role-separated flow as appointments, different
 * start line: appointments start from the student booking directly, referrals
 * start from faculty flagging a student for session.
 * Admin (guidance_head): assign counselor (pending → assigned) + reject
 *   pending referrals only (assigned rows must be unassigned first).
 *   Never confirm / resolve / escalate — those belong to the counselor.
 * Counselor: confirm assigned → confirmed, then resolve once the session is
 *   confirmed, plus escalate when urgent. Never assign / reject. Pending
 *   items wait for assignment.
 * Faculty: flag students via createReferral below.
 * Rules live in referrals/mutations.ts; this page only renders them.
 */
export default function ReferralsPage() {
  const qc = useQueryClient();
  const { data: board, isLoading, isError, refetch } = useReferralsBoard();
  const rows = board?.rows ?? EMPTY_ROWS;
  const trail = board?.trail ?? EMPTY_TRAIL;
  const actorNames = board?.actorNames ?? EMPTY_MAP;
  const aliases = board?.aliases ?? EMPTY_MAP;
  const counselors = board?.counselors ?? EMPTY_COUNSELORS;
  const counselorProfiles = board?.counselorProfiles ?? EMPTY_MAP;
  const facultyNames = board?.facultyNames ?? EMPTY_MAP;
  const facultyProfiles = board?.facultyProfiles ?? EMPTY_MAP;
  const headIds = board?.headIds ?? EMPTY_IDS;
  const students = board?.students ?? EMPTY_STUDENTS;
  const me = board?.me ?? null;
  const role = board?.role ?? null;
  const facultyId = board?.facultyId ?? null;
  const counselorId = board?.counselorId ?? null;
  const studentProfiles = board?.studentProfiles ?? EMPTY_MAP;
  // Students with a confirmed/completed scheduled session — only their
  // referrals may resolve (same flow as appointment sessions).
  const readyStudents = board?.readyStudents ?? EMPTY_READY;
  const loading = isLoading && !board;
  const { busyId, run: runMutation } = useMutationAction();
  const filters = useReferralFilters();
  const { statusFilter, priorityFilter, assigneeFilter, query, resetFilters } = filters;
  const [confirming, setConfirming] = useState<{ ref: Referral; to: TriageKind } | null>(null);
  const [formRef, setFormRef] = useState<Referral | null>(null);
  const [trackRef, setTrackRef] = useState<Referral | null>(null);
  // Linked session opened for optional confidential documentation after a
  // counselor resolve (notes + images + follow-up — all skippable).
  const [notesAppt, setNotesAppt] = useState<Appt | null>(null);

  useEffect(() => {
    if (isError) toast.error("Couldn't load referrals right now.");
  }, [isError]);

  const canSubmit = role === "faculty";
  const canTriage = role === "counselor" || role === "guidance_head";

  const isCounselor = role === "counselor";
  const canAssign = role === "guidance_head";
  const canReject = role === "guidance_head";
  const canSeeActions = canAssign || canReject || isCounselor;

  // Counselor scope mirrors appointments — my assigned cases only. Other
  // counselors' cases stay out of my queue and my numbers (enforced by RLS
  // too — unlinked counselors simply see an empty inbox until setup).
  const mine = useMemo(
    () => (isCounselor && counselorId ? rows.filter((r) => r.assigned_counselor_id === counselorId) : rows),
    [rows, isCounselor, counselorId]
  );

  const stats = useMemo(() => {
    const src = isCounselor ? mine : rows;
    return {
      total: src.length,
      pending: src.filter((r) => r.status === "pending").length,
      assigned: src.filter((r) => r.status === "assigned").length,
      confirmed: src.filter((r) => r.status === "confirmed").length,
      resolved: src.filter((r) => r.status === "resolved").length,
      unassigned: src.filter((r) => !r.assigned_counselor_id && r.status !== "resolved" && r.status !== "rejected").length,
    };
  }, [rows, mine, isCounselor]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mine
      .filter((r) => (statusFilter === "all" ? true : r.status === statusFilter))
      .filter((r) => (priorityFilter === "all" ? true : r.priority === priorityFilter))
      .filter((r) =>
        isCounselor
          ? true
          : assigneeFilter === "all"
            ? true
            : assigneeFilter === "unassigned"
              ? !r.assigned_counselor_id
              : r.assigned_counselor_id === assigneeFilter
      )
      .filter((r) => {
        if (!q) return true;
        const alias = referralStudentName(r, aliases);
        return `${alias} ${classificationSummary(r.case_classification)} ${r.classification_other ?? ""} ${r.reason}`.toLowerCase().includes(q);
      });
  }, [mine, isCounselor, statusFilter, priorityFilter, assigneeFilter, query, aliases]);

  // Counselor-set session time per referral, parsed from confirm notes.
  const sessionSchedule = useMemo(() => {
    const m = new Map<string, string>();
    for (const [refId, actions] of trail) {
      const confirm = actions.find((a) => a.action === "confirmed" && parseScheduleNote(a.note));
      const iso = confirm ? parseScheduleNote(confirm.note) : null;
      if (iso) m.set(refId, iso);
    }
    return m;
  }, [trail]);

  // Counselor-set session mode per referral (same confirm notes).
  const sessionMode = useMemo(() => {
    const m = new Map<string, "in_person" | "online">();
    for (const [refId, actions] of trail) {
      const confirm = actions.find((a) => a.action === "confirmed" && parseScheduleNote(a.note));
      const mode = confirm ? parseSessionMode(confirm.note) : null;
      if (mode) m.set(refId, mode);
    }
    return m;
  }, [trail]);

  // Latest escalation moment per referral (for SLA chips).
  const escalatedAt = useMemo(() => {
    const m = new Map<string, string>();
    for (const [refId, actions] of trail) {
      const last = actions.find((a) => a.action === "escalated");
      if (last) m.set(refId, last.created_at);
    }
    return m;
  }, [trail]);

  const counselorName = (id: string | null) =>
    !id ? "Unassigned" : (counselors.find((c) => c.id === id)?.name ?? "Counselor");

  const referrerLabel = (r: Referral): string => {
    if (r.referring_faculty_id) return facultyNames.get(r.referring_faculty_id) ?? "Faculty";
    return "Guidance office";
  };

  const shortReason = (r: string) => (r.length > 140 ? `${r.slice(0, 140)}…` : r);

  const canResolve = (ref: Referral) =>
    (ref.student_id ? readyStudents.has(ref.student_id) : false) ||
    // Walk-ins have no student record — a confirmed session minted from the
    // referral itself unlocks resolve (upcoming-time rule still applies below).
    sessionSchedule.has(ref.id);

  const askConfirm = (ref: Referral, to: TriageKind) => {
    if (to === "resolved" && !canResolve(ref)) {
      toast.error(NO_SESSION_MSG);
      return;
    }
    // Resolve unlocks once the counselor-set session time passes (mirrors
    // the appointment page's Upcoming session rule).
    if (to === "resolved" && isSessionUpcoming(sessionSchedule.get(ref.id))) {
      toast.error("Session hasn't happened yet — resolve unlocks once the session time passes.");
      return;
    }
    setConfirming({ ref, to });
  };

  const patchRow = (id: string, patch: { status?: string; assigned_counselor_id?: string | null }) =>
    patchBoard<ReferralsBoardData>(qc, [...REFERRALS_BOARD_KEY], (prev) => ({
      ...prev,
      rows: prev.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));

  /**
   * After a counselor resolve, offer the optional confidential record for the
   * linked session (notes + images + follow-up, all skippable — closing the
   * modal documents nothing). The minted session is ended first when it is
   * still confirmed-past, so the loop truly closes and the note (which
   * requires a completed session) can be written. Anything unexpected fails
   * silent — the resolve itself already succeeded.
   */
  const openResolveNotes = async (ref: Referral) => {
    try {
      const db = createClient();
      const { data } = await db
        .from("appointments")
        .select("id,student_id,counselor_id,scheduled_at,ends_at,mode,status,concern,meeting_url,is_follow_up,follow_up_of")
        .eq("source_referral_id", ref.id)
        .order("scheduled_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      let row = (data ?? null) as Appt | null;
      if (!row || row.counselor_id !== counselorId || !counselorId) return;
      if (row.status === "confirmed" && !isSessionUpcoming(row.scheduled_at)) {
        const completed = await completeAppointment(db, row.id).catch(() => null);
        if (
          completed &&
          typeof completed === "object" &&
          (completed as { id?: unknown }).id === row.id
        ) {
          row = { ...row, ...(completed as Partial<Appt>) };
          // The sessions board still shows it confirmed — reconcile behind the modal.
          void qc.invalidateQueries({ queryKey: [...APPOINTMENTS_BOARD_KEY] }).catch(() => {});
        } else {
          const { data: reread } = await db
            .from("appointments")
            .select("id,student_id,counselor_id,scheduled_at,ends_at,mode,status,concern,meeting_url,is_follow_up,follow_up_of")
            .eq("id", row.id)
            .maybeSingle();
          row = (reread as Appt | null) ?? row;
        }
      }
      // Only ended sessions carry the confidential record — an upcoming
      // linked session (resolved via another session) documents nothing here.
      if (row.status !== "completed") return;
      setNotesAppt(row);
    } catch {
      // Documentation is optional — resolve already succeeded.
    }
  };

  const act = async (
    ref: Referral,
    to: TriageKind,
    note?: string,
    opts?: { scheduledIso?: string; endsAtIso?: string; mode?: "in_person" | "online"; meetingUrl?: string | null }
  ) => {
    if (!me) return;
    const result = await runMutation(
      ref.id,
      async () => {
        const db = createClient();
        // Counselor confirm mints the session itself (assigned/escalated →
        // confirmed + a confirmed appointments row via source_referral_id),
        // so the board, the calendar, and the resolve gate always agree.
        // The schedule note keeps the human-readable trail alongside it.
        if (to === "confirmed" && opts?.scheduledIso) {
          return confirmReferralWithSession(db, {
            referralId: ref.id,
            actorProfileId: me,
            scheduledAt: new Date(opts.scheduledIso),
            mode: opts.mode ?? "in_person",
            meetingUrl: opts.meetingUrl ?? null,
            endsAt: opts.endsAtIso ? new Date(opts.endsAtIso) : null,
          });
        } else if (to === "rejected") return rejectReferral(db, ref.id, me);
        return triageReferral(db, { referralId: ref.id, actorProfileId: me, status: to, actionNote: note });
      },
      {
        label: "move that referral",
        friendly:
          /confirmed session|sessions must be|valid session|valid date|valid end|after the start|meet link|no account|only the (assigned|handling)|only pending|unassign|unknown session|availability|slot|overlap|free window|can't (move|assign|unassign|reject|confirm|resolve|escalate|acknowledge|start|triage)/i,
      }
    );
    if (!result.ok) return;
    const updated = result.data as { status?: string; assigned_counselor_id?: string | null } | null;
    if (updated && typeof updated === "object") {
      patchRow(ref.id, {
        ...(typeof updated.status === "string" ? { status: updated.status } : { status: to }),
        ...(updated.assigned_counselor_id !== undefined
          ? { assigned_counselor_id: updated.assigned_counselor_id }
          : {}),
      });
    } else {
      patchRow(ref.id, { status: to });
    }
      const key = `referral:${ref.id}:${to}`;
      const tone = to === "rejected" || to === "escalated" ? "error" as const : undefined;
      const focusLink = `/referrals#focus-${ref.id}`;
      const alias = referralStudentName(ref, aliases);
      const when = opts?.scheduledIso ? formatWhen(opts.scheduledIso) : null;
      const officeBody = `"${shortReason(ref.reason)}" — ${alias} · now ${statusLabel(to).toLowerCase()}${when ? ` · session ${when}` : ""}.`;
      if (to === "confirmed" && when) {
        // Student + referrer + heads hear the counselor-set schedule.
        void notifyStaff([ref.student_id ? studentProfiles.get(ref.student_id) : undefined], {
          type: "appointment",
          title: "Session confirmed",
          body: `Your session is scheduled on ${when}${opts?.mode === "online" && opts?.meetingUrl ? `. Join here: ${opts.meetingUrl}` : ""}. See you then!`,
          link: "/appointments",
          dedupeKey: key,
        });
      }
      if (to === "escalated") {
        const referrer = ref.referring_faculty_id ? facultyProfiles.get(ref.referring_faculty_id) : null;
        void notifyStaff(
          [...headIds, ref.assigned_counselor_id ? counselorProfiles.get(ref.assigned_counselor_id) : null, referrer],
          {
            type: "referral",
            title: "Referral escalated",
            body: `"${shortReason(ref.reason)}" was escalated — please review.`,
            link: focusLink,
            dedupeKey: key,
            tone: "error",
          }
        );
      } else {
        const referrer = ref.referring_faculty_id ? facultyProfiles.get(ref.referring_faculty_id) : null;
        void notifyStaff([referrer], {
          type: "referral",
          title: `Referral ${statusLabel(to).toLowerCase()}`,
          body: `"${shortReason(ref.reason)}" is now ${statusLabel(to).toLowerCase()}.`,
          link: focusLink,
          dedupeKey: key,
          ...(tone ? { tone } : {}),
        });
        void notifyStaff(headIds, {
          type: "referral",
          title: `Referral ${statusLabel(to).toLowerCase()}`,
          body: officeBody,
          link: focusLink,
          dedupeKey: key,
          ...(tone ? { tone } : {}),
        });
        // The referred student hears their own case close (walk-ins have no
        // profile — skip silently rather than posting an empty fan-out).
        if (to === "resolved") {
          const studentProfile = ref.student_id ? studentProfiles.get(ref.student_id) : undefined;
          if (studentProfile) {
            void notifyStaff([studentProfile], {
              type: "referral",
              title: "Referral resolved",
              body: "Your case with the guidance office is now resolved. Thank you for reaching out.",
              link: "/appointments",
              dedupeKey: key,
            });
          }
        }
      }
      // Background reconcile — never awaited, never blocks the toast.
      void refetch().catch(() => {});
      // Success feedback for the actor — pops top-right on completion.
      const okTitle =
        to === "confirmed"
          ? "Session confirmed"
          : to === "resolved"
            ? "Referral resolved"
            : to === "escalated"
              ? "Referral escalated"
              : "Referral rejected";
      const okDesc =
        to === "confirmed" && when
          ? `Session scheduled on ${when} — student notified.`
          : to === "confirmed"
            ? "Student notified."
            : to === "escalated"
              ? "Leadership notified."
              : "Referral closed.";
      toast.success(okTitle, { description: okDesc, position: "top-right" });
      // Resolving a live case offers the optional confidential record for
      // the linked session (same SessionNotes flow as completing one).
      if (to === "resolved" && isCounselor) void openResolveNotes(ref);
  };

  const assign = async (ref: Referral, counselorId: string) => {
    if (!me || (ref.assigned_counselor_id ?? "") === counselorId) return;
    const result = await runMutation(
      ref.id,
      () => assignReferral(createClient(), ref.id, counselorId || null, me),
      {
        label: "assign that referral",
        friendly: /can't (move|assign|unassign|reject|confirm|resolve|escalate)|unknown counselor/i,
      }
    );
    if (!result.ok) return;
    const updated = result.data as { status?: string; assigned_counselor_id?: string | null } | null;
    patchRow(ref.id, {
      status: (updated && typeof updated === "object" && typeof updated.status === "string" ? updated.status : undefined) ?? (counselorId ? "assigned" : "pending"),
      assigned_counselor_id: counselorId || null,
    });
      if (counselorId) {
        const key = `referral:${ref.id}:assigned:${counselorId}`;
        void notifyStaff([counselorProfiles.get(counselorId)], {
          type: "referral",
          title: "Referral assigned to you",
          body: `"${shortReason(ref.reason)}" — please triage it.`,
          link: `/referrals#focus-${ref.id}`,
          dedupeKey: key,
          tone: "info",
        });
      const alias = referralStudentName(ref, aliases);
        void notifyStaff(headIds, {
          type: "referral",
          title: `Referral assigned — ${counselorName(counselorId)}`,
          body: `"${shortReason(ref.reason)}" — ${alias}.`,
          link: `/referrals#focus-${ref.id}`,
          dedupeKey: key,
          tone: "info",
        });
        toast.success(`Referral assigned — ${counselorName(counselorId)}`, { position: "top-right" });
      } else {
        toast.success("Referral unassigned", { position: "top-right" });
      }
      // Background reconcile — never awaited, never blocks the toast.
      void refetch().catch(() => {});
  };

  const closeConfirming = useCallback(() => setConfirming(null), []);
  const closeForm = useCallback(() => setFormRef(null), []);
  const openForm = useCallback((r: Referral) => {
    setFormRef(r);
  }, []);

  if (!loading && (!role || !["counselor", "guidance_head", "faculty"].includes(role))) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">Referrals</h1>
        <Card><p className="text-sm text-ink-muted">Only counselors, the guidance head, and faculty can open referrals.</p></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Referrals</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {loading ? (
            <div aria-hidden>
              <div className="h-8 w-48 animate-pulse rounded-lg bg-ink/10" />
              <div className="mt-2 h-4 w-full max-w-[600px] animate-pulse rounded bg-ink/10" />
              <div className="mt-1.5 h-4 w-2/3 max-w-[400px] animate-pulse rounded bg-ink/10" />
            </div>
          ) : (
            <>
              <h1 className="font-display text-2xl font-bold">{isCounselor ? "My referrals" : "Referrals"}</h1>
              <p className="mt-1 max-w-[600px] text-sm leading-relaxed text-ink-muted">
                {role === "faculty"
                  ? "Flag a student for counseling follow-up — pick the kind of concern (academic, behavioral, relational), describe what you observed, set urgency, and the office triages from here."
                  : isCounselor
                    ? "Your assigned queue — confirm assigned referrals: setting the schedule creates the session itself (student notified), then resolve once the session time passes. Reschedule its session from Appointments when plans move; cancels come from the student."
                    : "Office-wide referral board — assign a counselor (pending → assigned) or reject pending referrals (unassign assigned ones first). Confirm / resolve / escalate belong to the counselor."}
              </p>
            </>
          )}
        </div>
        {(canTriage || loading) && (
          <div className="flex shrink-0 items-start gap-2">
            {loading ? (
              <>
                <div className="h-10 w-24 animate-pulse rounded-full bg-ink/10" aria-hidden />
                <div className="h-10 w-40 animate-pulse rounded-full bg-ink/10" aria-hidden />
              </>
            ) : (
              <>
                <ReferralStatsMenu
                  stats={stats}
                  isCounselor={isCounselor}
                  onPickStatus={(s) => filters.setStatusFilter(s)}
                  onPickUnassigned={() => filters.setAssigneeFilter("unassigned")}
                  onReset={resetFilters}
                />
                {canSeeActions && <ReferralActionsLegend role={role} />}
              </>
            )}
          </div>
        )}
      </div>

      {isCounselor && !counselorId && !loading && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-card">
          <p className="text-sm font-bold text-amber-800">Counselor record not linked yet</p>
          <p className="mt-1 text-[13px] text-amber-700">
            Your login works, but no counselor row is linked to your account — only cases the head assigns to you will appear here. Ask the guidance head to finish setup.
          </p>
        </div>
      )}

      {(canTriage || loading) && (
        <ReferralsBoard
          loading={loading}
          role={role}
          isCounselor={isCounselor}
          canAssign={canAssign}
          canReject={canReject}
          canSeeActions={canSeeActions}
          visible={visible}
          totalCount={mine.length}
          trail={trail}
          aliases={aliases}
          actorNames={actorNames}
          facultyNames={facultyNames}
          counselors={counselors}
          sessionSchedule={sessionSchedule}
          escalatedAt={escalatedAt}
          busyId={busyId}
          filters={filters}
          canResolve={canResolve}
          counselorName={counselorName}
          referrerLabel={referrerLabel}
          onAssign={(ref, id) => void assign(ref, id)}
          onAskConfirm={askConfirm}
          // Every view opens the official Counseling Referral Form directly.
          onViewReason={openForm}
          onTrack={setTrackRef}
        />
      )}

      {/* Faculty submit */}
      {canSubmit && (
        <FacultyReferralSection
          facultyId={facultyId}
          students={students}
          headIds={headIds}
          rows={rows}
          aliases={aliases}
          openMenuKey={filters.openMenuKey}
          onOpenMenuChange={filters.setOpenMenuKey}
          myName={board?.myName ?? "Faculty"}
          onViewForm={openForm}
          onSubmitted={() => {
            refetch().catch(() => {});
          }}
        />
      )}

      {/* Triage confirm */}
      <TriageConfirmDialog
        confirming={confirming}
        aliases={aliases}
        sessionSchedule={sessionSchedule}
        slots={board?.slots ?? []}
        openMenuKey={filters.openMenuKey}
        onOpenMenuChange={filters.setOpenMenuKey}
        canResolve={canResolve}
        onClose={closeConfirming}
        onSubmit={act}
      />

      {/* Official-form record (modal + print/PDF) */}
      <ReferralFormModal
        referral={formRef}
        referrerName={formRef ? referrerLabel(formRef) : ""}
        onClose={closeForm}
      />

      {/* Tracking overlay — same as the faculty Sent history */}
      <ReferralTrackingModal
        referral={trackRef}
        alias={trackRef ? referralStudentName(trackRef, aliases) : ""}
        counselorName={
          trackRef?.assigned_counselor_id
            ? counselorName(trackRef.assigned_counselor_id)
            : "Unassigned — waiting for head"
        }
        sessionIso={trackRef ? (sessionSchedule.get(trackRef.id) ?? null) : null}
        sessionMode={trackRef ? (sessionMode.get(trackRef.id) ?? null) : null}
        trail={trackRef ? (trail.get(trackRef.id) ?? []) : []}
        actorNames={actorNames}
        onClose={() => setTrackRef(null)}
      />

      {/* Optional confidential record after a counselor resolve */}
      <SessionNotesModal
        appt={notesAppt}
        studentLabel={notesAppt?.student_id ? (aliases.get(notesAppt.student_id) ?? "Student") : "Walk-in"}
        studentProfileId={notesAppt?.student_id ? (studentProfiles.get(notesAppt.student_id) ?? null) : null}
        editable={isCounselor}
        headIds={headIds}
        slots={board?.slots ?? []}
        onClose={() => setNotesAppt(null)}
      />
    </div>
  );
}
