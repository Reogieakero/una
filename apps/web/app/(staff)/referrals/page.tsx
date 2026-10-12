"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  fetchReferralCard,
  patchReferralRow,
  useReferralsBoard,
  type ReferralStudentOption,
} from "@/lib/hooks/use-referrals-board";
import { clampPage, clampPageSize } from "@/lib/pagination";
import { useMutationAction } from "@/lib/hooks/use-mutation-action";
import { useClearSectionBadge } from "@/lib/hooks/use-clear-section-badge";
import {
  assignReferral,
  completeAppointment,
  confirmReferralWithSession,
  isMeetUrl,
  rejectReferral,
  rescheduleAppointmentByCounselor,
  triageReferral,
} from "@dorsu/shared-services";
import { APPOINTMENTS_BOARD_KEY } from "@/lib/hooks/use-appointments-board";
import { SESSIONS_CALENDAR_KEY } from "@/lib/hooks/use-sessions-calendar";
import type { Appt } from "@/components/appointments/status";
import { ACTION_DEFS, formatScheduleRange } from "@/components/appointments/status";
import { AppointmentConfirmDialogs } from "@/components/appointments/AppointmentConfirmDialogs";
import {
  composeLocal,
  defaultSchedule,
  selectionFitsScope,
  type ScheduleSelection,
} from "@/components/appointments/SlotSchedulePicker";
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
import { formatWhen, isSessionUpcoming, latestSessionSchedule, parseScheduleNote, parseSessionMode } from "@/components/referrals/format-helpers";
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
const EMPTY_REFERRAL_STATS = { total: 0, pending: 0, assigned: 0, confirmed: 0, resolved: 0, unassigned: 0 };

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
  return (
    <Suspense
      fallback={
        <div className="animate-pulse space-y-4" aria-hidden>
          <div className="h-8 w-48 rounded-lg bg-ink/10" />
          <div className="h-12 rounded-lg bg-ink/10" />
          <div className="h-12 rounded-lg bg-ink/10" />
        </div>
      }
    >
      <ReferralsPageInner />
    </Suspense>
  );
}

function ReferralsPageInner() {
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Numbered pager state lives in the URL (?page=&size=) so filtered views
  // stay bookmarkable. Structured filters ride the board query server-side;
  // changing any of them resets to page 1 (cursor chain is filter-keyed).
  const page = clampPage(searchParams.get("page"));
  const size = clampPageSize(searchParams.get("size"));
  const gotoPage = useCallback(
    (p: number, s: number = size) => {
      router.replace(`/referrals?page=${p}&size=${s}`, { scroll: false });
    },
    [router, size]
  );
  const filters = useReferralFilters();
  const { data: board, isLoading, isError, refetch } = useReferralsBoard({
    page,
    size,
    status: filters.statusFilter,
    priority: filters.priorityFilter,
    assignee: filters.assigneeFilter,
  });
  // Structured picks reset to page 1 — cursors belong to a filter signature.
  const pickStatus = useCallback(
    (s: string) => {
      filters.setStatusFilter(s);
      gotoPage(1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gotoPage]
  );
  const pickPriority = useCallback(
    (p: string) => {
      filters.setPriorityFilter(p);
      gotoPage(1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gotoPage]
  );
  const pickAssignee = useCallback(
    (a: string) => {
      filters.setAssigneeFilter(a);
      gotoPage(1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gotoPage]
  );
  const resetAll = useCallback(() => {
    filters.resetFilters();
    gotoPage(1);
  }, [filters, gotoPage]);
  const viewFilters = useMemo(
    () => ({ ...filters, setStatusFilter: pickStatus, setPriorityFilter: pickPriority, setAssigneeFilter: pickAssignee }),
    [filters, pickStatus, pickPriority, pickAssignee]
  );
  const rows = board?.rows ?? EMPTY_ROWS;
  const trail = board?.trail ?? EMPTY_TRAIL;
  const actorNames = board?.actorNames ?? EMPTY_MAP;
  const boardAliases = board?.aliases ?? EMPTY_MAP;
  const counselors = board?.counselors ?? EMPTY_COUNSELORS;
  const counselorProfiles = board?.counselorProfiles ?? EMPTY_MAP;
  const boardFacultyNames = board?.facultyNames ?? EMPTY_MAP;
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
  // Visiting the section clears its sidebar badge (badges count unread
  // notification rows, not page views).
  useClearSectionBadge("/referrals", !loading && !!board);

  const slots = board?.slots ?? [];

  // Counselor reschedule of the referral's upcoming linked session — resolves
  // the minted appointment, verifies it is still movable, and opens the same
  // schedule dialog as /appointments (slots-scoped, Meet link for online).
  const askReschedule = async (ref: Referral) => {
    if (!isCounselor || !counselorId) return;
    try {
      const { data } = await createClient()
        .from("appointments")
        .select("id,student_id,counselor_id,scheduled_at,ends_at,mode,status,concern,meeting_url,is_follow_up,follow_up_of")
        .eq("source_referral_id", ref.id)
        .order("scheduled_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const row = (data ?? null) as Appt | null;
      if (
        !row ||
        row.counselor_id !== counselorId ||
        !["assigned", "confirmed"].includes(row.status) ||
        !isSessionUpcoming(row.scheduled_at)
      ) {
        toast.message("No upcoming session to reschedule for this referral.");
        return;
      }
      setSched(defaultSchedule(slots, new Date(row.scheduled_at)));
      setScheduleError(null);
      setMeetingInput(row.meeting_url ?? "");
      setMeetingError(null);
      setRescheduling({ ref, appt: row });
    } catch {
      toast.error("Couldn't load that session — please try again.");
    }
  };

  const closeRescheduling = () => {
    if (reschedBusyRef.current) return;
    setRescheduling(null);
    setMeetingInput("");
    setMeetingError(null);
    setScheduleError(null);
  };

  const runReschedule = async () => {
    if (!rescheduling || reschedBusyRef.current) return;
    const { ref, appt } = rescheduling;
    if (!sched) { setScheduleError("Pick a date and time inside your availability slots."); return; }
    if (!selectionFitsScope(slots, sched)) { setScheduleError("That window is outside your availability slots — pick one inside."); return; }
    const scheduledAt = composeLocal(sched.date, sched.start);
    const endsAt = composeLocal(sched.date, sched.end);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) { setScheduleError("Sessions must be scheduled in the future."); return; }
    if (Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= scheduledAt.getTime()) { setScheduleError("The end time must be after the start time."); return; }
    const when = formatScheduleRange(scheduledAt.toISOString(), endsAt.toISOString());
    let meetingUrl: string | null = null;
    if (appt.mode === "online") {
      const link = meetingInput.trim();
      if (!link) { setMeetingError("Paste the Google Meet link for this online session."); return; }
      if (!isMeetUrl(link)) { setMeetingError("That doesn't look like a Google Meet link — paste a meet.google.com link."); return; }
      meetingUrl = link;
    }
    reschedBusyRef.current = true;
    setReschedBusy(true);
    try {
      const result = await runMutation(
        ref.id,
        () => rescheduleAppointmentByCounselor(createClient(), appt.id, scheduledAt, endsAt),
        {
          label: "reschedule that session",
          friendly: /future|valid session|valid date|valid end|after the start|meet link|only assigned|assigned or confirmed|availability|slot|overlap|free window/i,
        }
      );
      if (!result.ok) return;
      const def = ACTION_DEFS.reschedule;
      const studentBody = meetingUrl ? `${def.doneBody(when)} Join here: ${meetingUrl}` : def.doneBody(when);
      const studentProfile = appt.student_id ? studentProfiles.get(appt.student_id) : undefined;
      void notifyStaff([studentProfile], {
        type: "appointment",
        title: def.doneTitle,
        body: studentBody,
        link: "/appointments",
        dedupeKey: `appt:${appt.id}:rescheduled`,
        tone: "success",
      });
      const alias = referralStudentName(ref, aliases);
      void notifyStaff(headIds, {
        type: "appointment",
        title: `Session rescheduled — ${alias}`,
        body: `${alias} · ${when}`,
        link: `/appointments#focus-${appt.id}`,
        dedupeKey: `appt:${appt.id}:rescheduled`,
        tone: "success",
      });
      // The referring faculty hears the move on the referral itself (their
      // channel — the reschedule also lands in the trail + schedule log).
      const referrer = ref.referring_faculty_id ? facultyProfiles.get(ref.referring_faculty_id) : null;
      void notifyStaff([referrer], {
        type: "referral",
        title: "Session rescheduled",
        body: `"${shortReason(ref.reason)}" — ${alias} · new session ${when}.`,
        link: `/referrals#focus-${ref.id}`,
        dedupeKey: `referral:${ref.id}:rescheduled`,
        tone: "info",
      });
      // The trail gains the reschedule entry — reconcile every surface that
      // reads it, plus the moved session's boards (debounced, non-blocking).
      scheduleReconcile("all");
      toast.success(def.doneTitle, { description: def.okBody(when), position: "top-right" });
    } finally {
      reschedBusyRef.current = false;
      setReschedBusy(false);
      setRescheduling(null);
      setMeetingInput("");
      setMeetingError(null);
      setScheduleError(null);
    }
  };
  const { busyId, run: runMutation } = useMutationAction();
  // P15: trailing-edge background reconcile — coalesces rapid successive
  // triage actions into one pass instead of a full reload per click. The
  // optimistic patchRow above already renders the change; this only
  // reconciles trails/aliases/stats (and, for session-minting moves, the
  // session boards too).
  const reconcileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (reconcileTimer.current) clearTimeout(reconcileTimer.current);
    },
    []
  );
  const scheduleReconcile = (scope: "referrals" | "all" = "referrals") => {
    if (reconcileTimer.current) clearTimeout(reconcileTimer.current);
    reconcileTimer.current = setTimeout(() => {
      void refetch().catch(() => {});
      if (scope === "all") {
        void qc.invalidateQueries({ queryKey: [...APPOINTMENTS_BOARD_KEY] }).catch(() => {});
        void qc.invalidateQueries({ queryKey: [...SESSIONS_CALENDAR_KEY] }).catch(() => {});
      }
    }, 1500);
  };
  const { query } = filters;
  // Deep-link fallback rows (fetched by id when the link target is not on
  // the loaded page) + their display names. Kept outside the query cache so
  // paging stays exact; merged into the views below.
  const [extraRows, setExtraRows] = useState<Referral[]>([]);
  const [extraAliases, setExtraAliases] = useState<Map<string, string>>(new Map());
  const [extraFacultyNames, setExtraFacultyNames] = useState<Map<string, string>>(new Map());
  // Board maps merged with deep-link fallback names (see ensureRow below).
  const aliases = useMemo(() => {
    if (!extraAliases.size) return boardAliases;
    const m = new Map(boardAliases);
    for (const [k, v] of extraAliases) m.set(k, v);
    return m;
  }, [boardAliases, extraAliases]);
  const facultyNames = useMemo(() => {
    if (!extraFacultyNames.size) return boardFacultyNames;
    const m = new Map(boardFacultyNames);
    for (const [k, v] of extraFacultyNames) m.set(k, v);
    return m;
  }, [boardFacultyNames, extraFacultyNames]);
  const [confirming, setConfirming] = useState<{ ref: Referral; to: TriageKind } | null>(null);
  const [formRef, setFormRef] = useState<Referral | null>(null);
  const [trackRef, setTrackRef] = useState<Referral | null>(null);
  // Counselor reschedule of the referral's upcoming linked session — same
  // confirm dialog + slot scoping as /appointments.
  const [rescheduling, setRescheduling] = useState<{ ref: Referral; appt: Appt } | null>(null);
  const [sched, setSched] = useState<ScheduleSelection | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [meetingInput, setMeetingInput] = useState("");
  const [meetingError, setMeetingError] = useState<string | null>(null);
  const [reschedBusy, setReschedBusy] = useState(false);
  const reschedBusyRef = useRef(false);
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

  // Rows are already role- and filter-scoped server-side (RLS + keyset
  // query); `mine` only merges deep-link fallback rows fetched by id.
  const mine = useMemo(() => {
    if (!extraRows.length) return rows;
    const seen = new Set(rows.map((r) => r.id));
    return [...extraRows.filter((r) => !seen.has(r.id)), ...rows];
  }, [rows, extraRows]);

  // Server stats (RLS-scoped status RPC) — office-wide for the head, own
  // queue for counselors, own filings for faculty.
  const stats = board?.stats ?? EMPTY_REFERRAL_STATS;

  // Only free-text search stays client-side, over the loaded page (structured
  // filters already applied server-side). The board labels this honestly.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mine;
    return mine.filter((r) => {
      const alias = referralStudentName(r, aliases);
      return `${alias} ${classificationSummary(r.case_classification)} ${r.classification_other ?? ""} ${r.reason}`.toLowerCase().includes(q);
    });
  }, [mine, query, aliases]);

  // Counselor-set session time per referral — confirm note, overridden by
  // every later reschedule in the trail.
  const sessionSchedule = useMemo(() => {
    const m = new Map<string, string>();
    for (const [refId, actions] of trail) {
      const iso = latestSessionSchedule(actions, null);
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

  // Deep-link row resolver — loaded page first, single-row fetch fallback
  // (stashed in extraRows so paging stays exact and modals keep working).
  const ensureRow = useCallback(
    async (id: string): Promise<Referral | null> => {
      const found = mine.find((r) => r.id === id) ?? rows.find((r) => r.id === id) ?? null;
      if (found) return found;
      try {
        const card = await fetchReferralCard(id);
        setExtraRows((prev) => (prev.some((r) => r.id === card.row.id) ? prev : [...prev, card.row as Referral]));
        if (card.alias && card.row.student_id) {
          const sid = card.row.student_id;
          const alias = card.alias;
          setExtraAliases((prev) => (prev.get(sid) === alias ? prev : new Map(prev).set(sid, alias)));
        }
        if (card.facultyName && card.row.referring_faculty_id) {
          const fid = card.row.referring_faculty_id;
          const fname = card.facultyName;
          setExtraFacultyNames((prev) => (prev.get(fid) === fname ? prev : new Map(prev).set(fid, fname)));
        }
        return card.row as Referral;
      } catch {
        return null;
      }
    },
    [mine, rows]
  );

  // Deep-link from the dashboard: /referrals#triage-<id> opens the confirm
  // dialog straight on the record so counselors never hunt for the row.
  // Consumed once — the hash is handed to the row highlighter (#focus-) so
  // the record stays visible behind/after the dialog.
  const triageLinkRef = useRef(false);
  useEffect(() => {
    if (triageLinkRef.current || loading || !board) return;
    const m = window.location.hash.match(/^#triage-(.+)$/);
    if (!m) return;
    triageLinkRef.current = true;
    let id: string | null = null;
    try { id = decodeURIComponent(m[1]); } catch { id = null; }
    if (!id) return;
    void (async () => {
      const ref = await ensureRow(id as string);
      if (ref && ref.status === "assigned" && canTriage) {
        askConfirm(ref, "confirmed");
      }
    })();
    window.history.replaceState(null, "", `#focus-${id}`);
    window.dispatchEvent(new Event("hashchange"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, board]);

  const patchRow = (id: string, patch: { status?: string; assigned_counselor_id?: string | null }) =>
    patchReferralRow(qc, id, patch);

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
          /confirmed session|sessions must be|valid session|valid date|valid end|after the start|meet link|no account|only the (assigned|handling)|only pending|unassign|unknown session|availability|slot|overlap|free window|just taken|already taken|taken|can't (move|assign|unassign|reject|confirm|resolve|escalate|acknowledge|start|triage)/i,
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
      // Background reconcile (debounced) — never awaited, never blocks the toast.
      scheduleReconcile();
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
      // Background reconcile (debounced) — never awaited, never blocks the toast.
      scheduleReconcile();
  };

  const closeConfirming = useCallback(() => setConfirming(null), []);
  const closeForm = useCallback(() => setFormRef(null), []);

  useEffect(() => {
    if (!rescheduling) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !reschedBusyRef.current) closeRescheduling();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [rescheduling]);
  const openForm = useCallback((r: Referral) => {
    setFormRef(r);
  }, []);

  // Deep-link from other pages: /referrals#focus-<id> auto-opens the
  // official-form overlay for that record (consumed once) so nobody hunts
  // rows. The hash stays so the row ring still highlights behind it.
  // Counselors resolve within their own queue; other roles use all rows.
  const focusLinkRef = useRef(false);
  useEffect(() => {
    if (focusLinkRef.current || loading || !board) return;
    const m = window.location.hash.match(/^#focus-(.+)$/);
    if (!m) return;
    focusLinkRef.current = true;
    let id: string | null = null;
    try { id = decodeURIComponent(m[1]); } catch { id = null; }
    if (!id) return;
    void (async () => {
      const found = await ensureRow(id as string);
      if (found) openForm(found);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, board]);

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
                  onPickStatus={pickStatus}
                  onPickUnassigned={() => pickAssignee("unassigned")}
                  onReset={resetAll}
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
          totalApprox={board?.totalApprox ?? 0}
          page={page}
          size={size}
          hasMore={board?.hasMore ?? false}
          onPageChange={(p) => gotoPage(p)}
          onSizeChange={(s) => gotoPage(1, s)}
          searchActive={query.trim().length > 0}
          trail={trail}
          aliases={aliases}
          actorNames={actorNames}
          facultyNames={facultyNames}
          counselors={counselors}
          sessionSchedule={sessionSchedule}
          escalatedAt={escalatedAt}
          busyId={busyId}
          filters={viewFilters}
          canResolve={canResolve}
          counselorName={counselorName}
          referrerLabel={referrerLabel}
          onAssign={(ref, id) => void assign(ref, id)}
          onAskConfirm={askConfirm}
          onReschedule={(ref) => void askReschedule(ref)}
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

      {/* Counselor reschedule of the linked upcoming session */}
      <AppointmentConfirmDialogs
        confirming={rescheduling ? { appt: rescheduling.appt, kind: "reschedule" } : null}
        aliases={aliases}
        slots={slots}
        sched={sched}
        onSchedChange={(v) => { setSched(v); setScheduleError(null); }}
        scheduleError={scheduleError}
        meetingInput={meetingInput}
        onMeetingChange={(v) => { setMeetingInput(v); setMeetingError(null); }}
        meetingError={meetingError}
        confirmBusy={reschedBusy}
        onClose={closeRescheduling}
        onSubmit={() => void runReschedule()}
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
