"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { assignAppointment, isMeetUrl } from "@dorsu/shared-services";
import {
  APPOINTMENTS_BOARD_KEY,
  useAppointmentsBoard,
  type AppointmentsBoardData,
} from "@/lib/hooks/use-appointments-board";
import { useMutationAction } from "@/lib/hooks/use-mutation-action";
import { patchBoard } from "@/lib/patch-board";
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
import { ACTION_DEFS, formatScheduleRange, formatWhen } from "@/components/appointments/status";
import type { ActionKind, Appt, CounselorOpt } from "@/components/appointments/status";
import {
  composeLocal,
  defaultSchedule,
  selectionFitsScope,
  type ScheduleSelection,
} from "@/components/appointments/SlotSchedulePicker";
import { useAppointmentFilters } from "@/components/appointments/use-appointment-filters";
import { AppointmentsBoard } from "@/components/appointments/AppointmentsBoard";
import { AppointmentConfirmDialogs } from "@/components/appointments/AppointmentConfirmDialogs";
import { AppointmentDetailModal } from "@/components/appointments/AppointmentDetailModal";
import { SessionNotesModal } from "@/components/appointments/SessionNotesModal";
import { AppointmentsHeader } from "@/components/appointments/AppointmentsHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const EMPTY_APPTS: Appt[] = [];
const EMPTY_MAP = new Map<string, string>();
const EMPTY_IDS: string[] = [];
const EMPTY_COUNSELORS: CounselorOpt[] = [];

/**
 * Shared /appointments — one URL, strict role-aware UI.
 * Admin (guidance_head): assign counselor (pending → assigned) + reject
 *   pending requests only (assigned rows must be unassigned first).
 * Counselor: confirm assigned → confirmed (sets final session time/date
 *   inside own availability slots, student notified), reschedule
 *   assigned/confirmed sessions inside own slots, then complete / no-show.
 * Student: cancel + reschedule from the mobile app (never complete).
 */
export default function AppointmentsPage() {
  const qc = useQueryClient();
  const { data: board, isLoading, isError, refetch } = useAppointmentsBoard();
  const { busyId, run: runMutation } = useMutationAction();
  const role = board?.role ?? null;
  const counselorId = board?.counselorId ?? null;
  const rows = board?.appointments ?? EMPTY_APPTS;
  const aliases = board?.aliases ?? EMPTY_MAP;
  const studentProfiles = board?.studentProfiles ?? EMPTY_MAP;
  const headIds = board?.headIds ?? EMPTY_IDS;
  const counselors = board?.counselors ?? EMPTY_COUNSELORS;
  const slots = board?.slots ?? [];
  const loading = isLoading && !board;
  const [confirming, setConfirming] = useState<{ appt: Appt; kind: ActionKind } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const confirmBusyRef = useRef(false);
  const [detail, setDetail] = useState<Appt | null>(null);
  const [notesAppt, setNotesAppt] = useState<Appt | null>(null);
  const [sched, setSched] = useState<ScheduleSelection | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [meetingInput, setMeetingInput] = useState("");
  const [meetingError, setMeetingError] = useState<string | null>(null);
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);

  const { query, setQuery, statusFilter, setStatusFilter, modeFilter, setModeFilter, counselorFilter, setCounselorFilter, kindFilter, setKindFilter, kindCounts, stats, visible } =
    useAppointmentFilters({ rows, role, counselorId, aliases });

  useEffect(() => { if (isError) toast.error("Couldn't load appointments right now."); }, [isError]);

  const canAssign = role === "guidance_head";
  const canReject = role === "guidance_head";
  const isCounselor = role === "counselor";
  const canSeeActions = canAssign || canReject || isCounselor;
  const counselorName = (id: string | null) =>
    !id ? "Unassigned" : (counselors.find((c) => c.id === id)?.name ?? "Counselor");

  // Shared mutation runner: busy state resolves the moment the DB write
  // settles (inside the hook's finally) — the row is patched locally and the
  // full-board refetch reconciles in the background, so the spinner never
  // waits on refetches or notification delivery.
  const patchRow = (id: string, patch: Partial<Appt>) =>
    patchBoard<AppointmentsBoardData>(qc, [...APPOINTMENTS_BOARD_KEY], (prev) => ({
      ...prev,
      appointments: prev.appointments.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));

  const act = async (
    id: string,
    fn: (db: ReturnType<typeof createClient>, apptId: string, scheduledAt?: Date, meetingUrl?: string | null, endsAt?: Date | null) => Promise<unknown>,
    label: string,
    scheduledAt?: Date,
    meetingUrl?: string | null,
    endsAt?: Date | null,
  ): Promise<boolean> => {
    const result = await runMutation(
      id,
      () => fn(createClient(), id, scheduledAt, meetingUrl, endsAt),
      {
        label,
        friendly:
          /future|valid session|valid date|valid end|after the start|meet link|database update|migration|meeting_url|only assigned|assigned or confirmed|only pending|unassign|not found|availability|slot|overlap|free window/i,
      }
    );
    if (!result.ok) return false;
    const updated = result.data as Partial<Appt> | null;
    if (updated && typeof updated === "object" && (updated as { id?: unknown }).id === id) {
      const { id: _drop, ...fields } = updated as Partial<Appt> & { id?: string };
      patchRow(id, fields);
    }
    // Background reconcile — never awaited, never blocks the toast.
    void refetch().catch(() => {});
    return true;
  };

  const notifyStudent = (appt: Appt, title: string, body: string, dedupeKey: string, tone?: "success" | "info" | "error") =>
    notifyStaff([appt.student_id ? studentProfiles.get(appt.student_id) : undefined], { type: "appointment", title, body, link: "/appointments", dedupeKey, ...(tone ? { tone } : {}) });

  const KIND_PAST: Record<ActionKind, string> = { confirm: "confirmed", complete: "completed", reject: "rejected", "no-show": "no-show", reschedule: "rescheduled" };
  const KIND_TONE: Record<ActionKind, "success" | "error"> = { confirm: "success", complete: "success", reject: "error", "no-show": "error", reschedule: "success" };
  const notifyHeadsAppt = (appt: Appt, kind: ActionKind, extra?: string) => {
    const alias = appt.student_id ? (aliases.get(appt.student_id) ?? "Student") : "Walk-in";
    const when = formatWhen(appt.scheduled_at);
    return notifyStaff(headIds, { type: "appointment", title: `Session ${KIND_PAST[kind]}${extra ? ` — ${extra}` : ""}`, body: `${alias} · ${when}`, link: `/appointments#focus-${appt.id}`, dedupeKey: `appt:${appt.id}:${KIND_PAST[kind]}`, tone: KIND_TONE[kind] });
  };

  // Seed-once key so a late-arriving slots refetch fills the picker without
  // wiping a selection the counselor already made.
  const schedSeedRef = useRef<string | null>(null);
  useEffect(() => {
    if (confirming?.kind === "confirm" || confirming?.kind === "reschedule") {
      const key = `${confirming.kind}:${confirming.appt.id}`;
      if (schedSeedRef.current !== key) {
        schedSeedRef.current = key;
        // Rescheduling reopens on the current schedule when it still fits
        // the scope, otherwise the first valid window.
        const seed =
          confirming.kind === "reschedule" ? new Date(confirming.appt.scheduled_at) : null;
        setSched(defaultSchedule(slots, seed && !Number.isNaN(seed.getTime()) ? seed : null));
        setScheduleError(null);
        setMeetingInput(confirming.appt.meeting_url ?? "");
        setMeetingError(null);
      }
    } else {
      schedSeedRef.current = null;
    }
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !confirmBusyRef.current) { setConfirming(null); setMeetingInput(""); setMeetingError(null); }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [confirming, slots]);

  const closeConfirming = () => {
    if (confirmBusyRef.current) return;
    setConfirming(null);
    setMeetingInput("");
    setMeetingError(null);
  };

  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDetail(null); };
    document.addEventListener("keydown", onKey);
    if (confirming) return () => document.removeEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [detail, confirming]);

  const runConfirming = async () => {
    if (!confirming || confirmBusyRef.current) return;
    const { appt, kind } = confirming;
    const def = ACTION_DEFS[kind];
    let scheduledAt: Date | undefined;
    let endsAt: Date | null = null;
    let when = formatWhen(appt.scheduled_at);
    let meetingUrl: string | null = null;
    if (kind === "confirm" || kind === "reschedule") {
      if (!sched) { setScheduleError("Pick a date and time inside your availability slots."); return; }
      if (!selectionFitsScope(slots, sched)) { setScheduleError("That window is outside your availability slots — pick one inside."); return; }
      scheduledAt = composeLocal(sched.date, sched.start);
      endsAt = composeLocal(sched.date, sched.end);
      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) { setScheduleError("Sessions must be scheduled in the future."); return; }
      if (Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= scheduledAt.getTime()) { setScheduleError("The end time must be after the start time."); return; }
      when = formatScheduleRange(scheduledAt.toISOString(), endsAt.toISOString());
      if (appt.mode === "online") {
        const link = meetingInput.trim();
        if (!link) { setMeetingError("Paste the Google Meet link for this online session."); return; }
        if (!isMeetUrl(link)) { setMeetingError("That doesn't look like a Google Meet link — paste a meet.google.com link."); return; }
        meetingUrl = link;
      }
    }
    confirmBusyRef.current = true;
    setConfirmBusy(true);
    try {
      if (await act(appt.id, def.fn, def.fail, scheduledAt, meetingUrl, endsAt)) {
        const studentBody = (kind === "confirm" || kind === "reschedule") && meetingUrl ? `${def.doneBody(when)} Join here: ${meetingUrl}` : def.doneBody(when);
        void notifyStudent(appt, def.doneTitle, studentBody, `appt:${appt.id}:${KIND_PAST[kind]}`, KIND_TONE[kind]);
        void notifyHeadsAppt({ ...appt, scheduled_at: scheduledAt?.toISOString() ?? appt.scheduled_at }, kind);
        toast.success(def.doneTitle, { description: def.okBody(when), position: "top-right" });
        // The session just ended — hand the counselor straight to the private
        // record so the note is documented while it's fresh.
        if (kind === "complete") setNotesAppt({ ...appt, status: "completed" });
      }
    } finally {
      confirmBusyRef.current = false;
      setConfirmBusy(false);
      setConfirming(null);
      setMeetingInput("");
      setMeetingError(null);
    }
  };

  const handleAssign = (appt: Appt, v: string | null) => {
    if (!v && !appt.counselor_id) return;
    const name = v ? (counselors.find((c) => c.id === v)?.name ?? "Your counselor") : null;
    void (async () => {
      const ok = await act(appt.id, (db, apptId) => assignAppointment(db, apptId, v || null), "assign a counselor");
      if (!ok) return;
      const key = `appt:${appt.id}:assigned:${v ?? "none"}`;
      if (name) void notifyStudent(appt, "Counselor assigned", `${name} will handle your session on ${formatWhen(appt.scheduled_at)}.`, key, "info");
      const alias = appt.student_id ? (aliases.get(appt.student_id) ?? "Student") : "Walk-in";
      void notifyStaff(headIds, { type: "appointment", title: `Session assigned — ${name ?? "unassigned"}`, body: `${alias} · ${formatWhen(appt.scheduled_at)}`, link: `/appointments#focus-${appt.id}`, dedupeKey: key, tone: "info" });
      toast.success(name ? `Counselor assigned — ${name}` : "Counselor unassigned", { position: "top-right" });
    })();
  };

  if (!loading && (role === "faculty" || (role && !["counselor", "guidance_head"].includes(role)))) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">Appointments</h1>
        <Card><p className="text-sm text-ink-muted">Your role can&apos;t open appointments. Refer students via the Referrals page instead.</p></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink href="/">Home</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>Appointments</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <AppointmentsHeader role={role} canSeeActions={canSeeActions} loading={loading} stats={stats} onSelectStatus={setStatusFilter} onSelectCounselor={setCounselorFilter} />

      <Tabs value={kindFilter} onValueChange={(v) => setKindFilter(v as "appointments" | "followups")}>
        <TabsList aria-label="Session type">
          <TabsTrigger value="appointments">
            Appointments{!loading && <span className="ml-1.5 opacity-70">({kindCounts.appointments})</span>}
          </TabsTrigger>
          <TabsTrigger value="followups">
            Follow-up sessions{!loading && <span className="ml-1.5 opacity-70">({kindCounts.followups})</span>}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="p-0">
        <AppointmentsBoard
          visible={visible} loading={loading}
          query={query} setQuery={setQuery}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          modeFilter={modeFilter} setModeFilter={setModeFilter}
          counselorFilter={counselorFilter} setCounselorFilter={setCounselorFilter}
          counselors={counselors} aliases={aliases} role={role}
          busyId={busyId} canAssign={canAssign} canReject={canReject} isCounselor={isCounselor} canSeeActions={canSeeActions}
          counselorName={counselorName} openMenuKey={openMenuKey} setOpenMenuKey={setOpenMenuKey}
          onAssign={handleAssign} onDetail={setDetail} onConfirming={setConfirming}
          onNotes={setNotesAppt} kindFilter={kindFilter}
        />
      </Card>

      <AppointmentConfirmDialogs
        confirming={confirming} aliases={aliases}
        slots={slots} sched={sched} onSchedChange={(v) => { setSched(v); setScheduleError(null); }} scheduleError={scheduleError}
        meetingInput={meetingInput} onMeetingChange={(v) => { setMeetingInput(v); setMeetingError(null); }} meetingError={meetingError}
        confirmBusy={confirmBusy} onClose={closeConfirming} onSubmit={runConfirming}
      />
      <AppointmentDetailModal
        detail={detail}
        aliases={aliases}
        counselorName={counselorName}
        onClose={() => setDetail(null)}
        canSeeNotes={isCounselor || role === "guidance_head"}
        onNotes={(a) => { setDetail(null); setNotesAppt(a); }}
      />
      <SessionNotesModal
        appt={notesAppt}
        studentLabel={notesAppt?.student_id ? (aliases.get(notesAppt.student_id) ?? "Student") : "Walk-in"}
        studentProfileId={notesAppt?.student_id ? (studentProfiles.get(notesAppt.student_id) ?? null) : null}
        editable={isCounselor}
        headIds={headIds}
        slots={slots}
        onClose={() => setNotesAppt(null)}
      />
    </div>
  );
}
