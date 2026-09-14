"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, CheckCheck, UserX, Video, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  assignAppointment,
  completeAppointment,
  confirmAppointment,
  isMeetUrl,
  listCounselorAppointments,
  listOfficeAppointments,
  markAppointmentNoShow,
  rejectAppointment,
} from "@dorsu/shared-services";
import { Badge, Button, Card, Input } from "@/components/ui/primitives";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Dropdown } from "@/components/shared/dropdown";
import { notifyStaff } from "@/lib/notify";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type Appt = {
  id: string;
  student_id: string;
  counselor_id: string | null;
  scheduled_at: string;
  mode: string;
  status: string;
  concern: string;
  meeting_url: string | null;
};

type CounselorOpt = { id: string; name: string };

const STATUSES = ["pending", "assigned", "confirmed", "completed", "cancelled", "rejected", "no_show"] as const;

function statusTone(s: string): "info" | "success" | "warning" | "danger" {
  if (s === "completed") return "success";
  if (s === "cancelled" || s === "rejected" || s === "no_show") return "danger";
  if (s === "assigned" || s === "confirmed") return "info";
  return "warning";
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

/** "no_show" → "No show", "pending" → "Pending". */
function statusLabel(s: string): string {
  const spaced = s.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** ISO → picker value (local tz), minutes snapped to the quarter hour. */
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  d.setMinutes(Math.round(d.getMinutes() / 15) * 15, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const HEAD_LEGEND: { icon: typeof Check; label: string; desc: string; variant: "accent" | "outline" }[] = [
  { icon: Check, label: "Assign", desc: "Pending → assigned", variant: "accent" },
  { icon: X, label: "Reject", desc: "Pending / assigned → rejected", variant: "outline" },
];

const COUNSELOR_LEGEND: { icon: typeof Check; label: string; desc: string; variant: "accent" | "outline" }[] = [
  { icon: Check, label: "Confirm", desc: "Assigned → confirmed + set schedule (+ Meet link when online)", variant: "accent" },
  { icon: CheckCheck, label: "Complete", desc: "Confirmed → completed", variant: "accent" },
  { icon: UserX, label: "No-show", desc: "Confirmed, student didn't arrive", variant: "outline" },
];

type ActionKind = "confirm" | "complete" | "no-show" | "reject";

const ACTION_DEFS: Record<
  ActionKind,
  {
    fn: (db: ReturnType<typeof createClient>, apptId: string, scheduledAt?: Date, meetingUrl?: string | null) => Promise<unknown>;
    fail: string;
    doneTitle: string;
    doneBody: (when: string) => string;
  }
> = {
  confirm: {
    fn: confirmAppointment,
    fail: "confirm this session",
    doneTitle: "Session confirmed",
    doneBody: (when) => `Your session is scheduled on ${when}. See you then!`,
  },
  complete: {
    fn: completeAppointment,
    fail: "complete this session",
    doneTitle: "Session completed",
    doneBody: (when) => `Your session on ${when} is marked complete. Feedback helps us improve.`,
  },
  reject: {
    fn: rejectAppointment,
    fail: "reject this session",
    doneTitle: "Session rejected",
    doneBody: (when) => `Your session request for ${when} was declined by the office. Contact guidance for alternatives.`,
  },
  "no-show": {
    fn: (db, apptId) => markAppointmentNoShow(db, apptId),
    fail: "mark no-show",
    doneTitle: "Marked as no-show",
    doneBody: (when) => `You were marked as no-show for ${when}. Contact the office to rebook.`,
  },
};

const CONFIRM_COPY: Record<ActionKind, { title: string; body: string; ok: string }> = {
  confirm: { title: "Confirm and schedule this session?", body: "Set the final session date and time. The student will be notified with this schedule.", ok: "Confirm session" },
  complete: { title: "Mark this session complete?", body: "The session was held and is now done. This can't be undone.", ok: "Mark complete" },
  reject: { title: "Reject this session?", body: "The request ends as Rejected and leaves the counselor queue. This can't be undone.", ok: "Reject session" },
  "no-show": { title: "Mark as no-show?", body: "The session was confirmed but the student didn't arrive.", ok: "Mark no-show" },
};

/** Icon-only action button — meaning comes from the filter-card legend + tooltip. */
function IconAction({  label,
  variant,
  disabled,
  onClick,
  icon: Icon,
}: {
  label: string;
  variant: "accent" | "outline";
  disabled?: boolean;
  onClick: () => void;
  icon: typeof Check;
}) {
  return (
    <Button
      size="sm"
      variant={variant}
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-label={label}
      className="px-2.5"
    >
      <Icon className="h-4 w-4" aria-hidden />
    </Button>
  );
}

/**
 * Shared /appointments — one URL, strict role-aware UI.
 * Admin (guidance_head): assign counselor (pending → assigned) + reject.
 *   Never confirm / complete / no-show — those belong to the counselor.
 * Counselor: confirm assigned → confirmed (sets final session time/date,
 *   student notified), then complete / no-show.
 *   Never assign / reject / cancel.
 * Student: cancel + reschedule from the mobile app (never complete).
 */
export default function AppointmentsPage() {
  const [role, setRole] = useState<string | null>(null);
  const [counselorId, setCounselorId] = useState<string | null>(null);
  const [rows, setRows] = useState<Appt[]>([]);
  const [aliases, setAliases] = useState<Map<string, string>>(new Map());
  const [studentProfiles, setStudentProfiles] = useState<Map<string, string>>(new Map());
  const [headIds, setHeadIds] = useState<string[]>([]);
  const [counselors, setCounselors] = useState<CounselorOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ appt: Appt; kind: ActionKind } | null>(null);
  const [scheduleInput, setScheduleInput] = useState("");
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [meetingInput, setMeetingInput] = useState("");
  const [meetingError, setMeetingError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [counselorFilter, setCounselorFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);

  const reload = async (r: string, cid: string | null) => {
    const supabase = createClient();
    const data =
      r === "counselor" && cid
        ? await listCounselorAppointments(supabase, cid)
        : await listOfficeAppointments(supabase);
    setRows((data ?? []) as Appt[]);

    const studentIds = [...new Set(((data ?? []) as Appt[]).map((a) => a.student_id))];
    if (studentIds.length) {
      const { data: students } = await supabase
        .from("students")
        .select("id, profile_id, anonymous_alias")
        .in("id", studentIds.slice(0, 500));
      const studentRows = ((students ?? []) as { id: string; profile_id: string; anonymous_alias: string | null }[]);
      setAliases(new Map(studentRows.map((s) => [s.id, s.anonymous_alias ?? "Student"])));
      setStudentProfiles(new Map(studentRows.map((s) => [s.id, s.profile_id])));
    }
    const { data: counselorRows } = await supabase.from("counselors").select("id, profile_id").limit(100);
    const profileIds = ((counselorRows ?? []) as { id: string; profile_id: string }[]).map((c) => c.profile_id);
    let names = new Map<string, string>();
    if (profileIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", profileIds);
      names = new Map(((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? "Counselor"]));
    }
    setCounselors(
      ((counselorRows ?? []) as { id: string; profile_id: string }[]).map((c) => ({
        id: c.id,
        name: names.get(c.profile_id) ?? "Counselor",
      }))
    );
    const { data: headRows } = await supabase.from("profiles").select("id").eq("role", "guidance_head").eq("is_active", true);
    setHeadIds(((headRows ?? []) as { id: string }[]).map((h) => h.id));
  };

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        const r = (profile as { role: string } | null)?.role ?? null;
        setRole(r);
        let cid: string | null = null;
        if (r === "counselor") {
          const { data } = await supabase.from("counselors").select("id").eq("profile_id", user.id).single();
          cid = (data as { id: string } | null)?.id ?? null;
          setCounselorId(cid);
        }
        if (r && r !== "faculty") await reload(r, cid);
      } catch {
        toast.error("Couldn't load appointments right now.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canAssign = role === "guidance_head";
  const canReject = role === "guidance_head";
  const isCounselor = role === "counselor";
  const canSeeActions = canAssign || canReject || isCounselor;
  const counselorName = (id: string | null) =>
    !id ? "Unassigned" : (counselors.find((c) => c.id === id)?.name ?? "Counselor");

  const stats = useMemo(() => {
    const mine = role === "counselor" && counselorId ? rows.filter((a) => a.counselor_id === counselorId) : rows;
    return {
      total: mine.length,
      pending: mine.filter((a) => a.status === "pending").length,
      assigned: mine.filter((a) => a.status === "assigned").length,
      confirmed: mine.filter((a) => a.status === "confirmed").length,
      completed: mine.filter((a) => a.status === "completed").length,
      unassigned: mine.filter((a) => !a.counselor_id).length,
    };
  }, [rows, role, counselorId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((a) => (role === "counselor" && counselorId ? a.counselor_id === counselorId : true))
      .filter((a) => (statusFilter === "all" ? true : a.status === statusFilter))
      .filter((a) => (modeFilter === "all" ? true : a.mode === modeFilter))
      .filter((a) =>
        counselorFilter === "all" ? true : counselorFilter === "unassigned" ? !a.counselor_id : a.counselor_id === counselorFilter
      )
      .filter((a) =>
        !q
          ? true
          : a.concern.toLowerCase().includes(q) || (aliases.get(a.student_id) ?? "").toLowerCase().includes(q)
      );
  }, [rows, role, counselorId, statusFilter, modeFilter, counselorFilter, query, aliases]);

  const act = async (
    id: string,
    fn: (db: ReturnType<typeof createClient>, apptId: string, scheduledAt?: Date, meetingUrl?: string | null) => Promise<unknown>,
    label: string,
    scheduledAt?: Date,
    meetingUrl?: string | null,
    notify?: { title: string; body: string }
  ): Promise<boolean> => {
    setBusyId(id);
    try {
      await fn(createClient(), id, scheduledAt, meetingUrl);
      if (role) await reload(role, counselorId);
      return true;
    } catch (e) {
      toast.error(
        e instanceof Error && /future|valid session|meet link|database update|migration|meeting_url|only assigned|not found/i.test(e.message)
          ? e.message
          : `Couldn't ${label} — the session may have changed status. Reload and try again.`
      );
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const notifyStudent = (appt: Appt, title: string, body: string) =>
    notifyStaff([studentProfiles.get(appt.student_id)], { type: "appointment", title, body, link: "/appointments" });

  const KIND_PAST: Record<ActionKind, string> = {
    confirm: "confirmed",
    complete: "completed",
    reject: "rejected",
    "no-show": "no-show",
  };

  const notifyHeadsAppt = (appt: Appt, kind: ActionKind, extra?: string) => {
    const alias = aliases.get(appt.student_id) ?? "Student";
    const when = formatWhen(appt.scheduled_at);
    return notifyStaff(headIds, {
      type: "appointment",
      title: `Session ${KIND_PAST[kind]}${extra ? ` — ${extra}` : ""}`,
      body: `${alias} · ${when}`,
      link: "/appointments",
    });
  };

  // Confirm dialog: Escape closes, background stays put while open.
  // Prefill the counselor schedule picker with the requested slot, and the
  // Meet link input with any previously saved link (online sessions).
  useEffect(() => {
    if (confirming?.kind === "confirm") {
      setScheduleInput(toLocalInputValue(confirming.appt.scheduled_at));
      setScheduleError(null);
      setMeetingInput(confirming.appt.meeting_url ?? "");
      setMeetingError(null);
    }
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setConfirming(null);
        setMeetingInput("");
        setMeetingError(null);
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [confirming]);

  const closeConfirming = () => {
    setConfirming(null);
    setMeetingInput("");
    setMeetingError(null);
  };

  const runConfirming = async () => {
    if (!confirming) return;
    const { appt, kind } = confirming;
    const def = ACTION_DEFS[kind];
    // Counselor schedules the final session time on confirm.
    let scheduledAt: Date | undefined;
    let when = formatWhen(appt.scheduled_at);
    // Online sessions additionally need their Google Meet link.
    let meetingUrl: string | null = null;
    if (kind === "confirm") {
      if (!scheduleInput) {
        setScheduleError("Set the session date and time.");
        return;
      }
      scheduledAt = new Date(scheduleInput);
      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
        setScheduleError("Sessions must be scheduled in the future.");
        return;
      }
      when = formatWhen(scheduledAt.toISOString());
      if (appt.mode === "online") {
        const link = meetingInput.trim();
        if (!link) {
          setMeetingError("Paste the Google Meet link for this online session.");
          return;
        }
        if (!isMeetUrl(link)) {
          setMeetingError("That doesn't look like a Google Meet link — paste a meet.google.com link.");
          return;
        }
        meetingUrl = link;
      }
    }
    setConfirming(null);
    setMeetingInput("");
    setMeetingError(null);
    if (await act(appt.id, def.fn, def.fail, scheduledAt, meetingUrl)) {
      // Student + heads are notified with the counselor-set schedule (and
      // the Meet link for online sessions).
      const studentBody =
        kind === "confirm" && meetingUrl
          ? `${def.doneBody(when)} Join here: ${meetingUrl}`
          : def.doneBody(when);
      void notifyStudent(appt, def.doneTitle, studentBody);
      void notifyHeadsAppt({ ...appt, scheduled_at: scheduledAt?.toISOString() ?? appt.scheduled_at }, kind);
    }
  };

  if (!loading && (role === "faculty" || (role && !["counselor", "guidance_head"].includes(role)))) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">Appointments</h1>
        <Card><p className="text-sm text-ink-muted">Your role can&apos;t open appointments. Refer students via the Referrals page instead.</p></Card>
      </div>
    );
  }

  const statCards = [
    { label: role === "counselor" ? "My sessions" : "Total sessions", value: stats.total },
    { label: "Pending", value: stats.pending },
    { label: "Assigned", value: stats.assigned },
    { label: "Confirmed", value: stats.confirmed },
    { label: "Completed", value: stats.completed },
    { label: "Unassigned", value: stats.unassigned },
  ];

  return (
    <div className="space-y-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Appointments</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="font-display text-2xl font-bold">
          {role === "counselor" ? "My appointments" : "Appointments"}
        </h1>
        <p className="mt-1 max-w-[600px] text-sm leading-relaxed text-ink-muted">
          {role === "counselor"
            ? "Your assigned queue — confirm assigned bookings and set the session schedule (student notified), then mark confirmed ones complete or no-show. Cancels and reschedules come from the student."
            : "Office-wide session board — assign a counselor (pending → assigned) or reject the request. Confirm / complete / no-show belong to the counselor; cancel / reschedule belong to the student."}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg border border-ink/10 bg-white p-5 shadow-card">
                <div className="h-3.5 w-2/3 rounded-full bg-ink/10" />
                <div className="mt-3 h-8 w-1/3 rounded-lg bg-ink/10" />
              </div>
            ))
          : statCards.map((s) => (
              <div key={s.label} className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
                <p className="text-[13px] font-medium text-ink-muted">{s.label}</p>
                <p className="mt-1 font-display text-3xl font-bold text-ink">{s.value}</p>
              </div>
            ))}
      </div>

      {/* Filters */}
      <Card className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {["all", ...STATUSES].map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? "primary" : "outline"}
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "All" : statusLabel(s)}
            </Button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Dropdown
            menuKey="mode"
            openMenuKey={openMenuKey}
            onOpenChange={setOpenMenuKey}
            value={modeFilter}
            onChange={setModeFilter}
            ariaLabel="Filter by mode"
            options={[
              { value: "all", label: "All modes" },
              { value: "in_person", label: "In person" },
              { value: "online", label: "Online" },
            ]}
          />
          {role !== "counselor" && (
            <Dropdown
              menuKey="counselor"
              openMenuKey={openMenuKey}
              onOpenChange={setOpenMenuKey}
              value={counselorFilter}
              onChange={setCounselorFilter}
              ariaLabel="Filter by counselor"
              options={[
                { value: "all", label: "All counselors" },
                { value: "unassigned", label: "Unassigned only" },
                ...counselors.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          )}
          <Input
            placeholder="Search concern or student alias…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <p className="text-xs font-medium text-ink-faint">
          Showing {visible.length} of {rows.length} sessions · student names stay private (aliases only).
        </p>
        {canSeeActions && (
          <div className="rounded-xl border border-ink/10 bg-cream px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              {role === "guidance_head" ? "Admin actions" : "Counselor actions"}
            </p>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {(role === "guidance_head" ? HEAD_LEGEND : COUNSELOR_LEGEND).map((l) => (
                <li key={l.label} className="flex items-center gap-2 text-[13px]">
                  <span
                    aria-hidden
                    className={
                      l.variant === "accent"
                        ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent-400 text-ink"
                        : "inline-flex h-6 w-6 items-center justify-center rounded-full border border-ink/15 bg-white text-ink"
                    }
                  >
                    <l.icon className="h-3.5 w-3.5" />
                  </span>
                  <span>
                    <span className="font-bold text-ink">{l.label}</span>
                    <span className="text-ink-muted"> · {l.desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Board */}
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-xs uppercase text-ink-muted">
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Counselor</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Concern</th>
              {canSeeActions && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((a) => (
              <tr key={a.id} className="border-b border-ink/5 align-top last:border-0">
                <td className="whitespace-nowrap px-4 py-3 font-semibold">{formatWhen(a.scheduled_at)}</td>
                <td className="whitespace-nowrap px-4 py-3">{aliases.get(a.student_id) ?? "Student"}</td>
                <td className="px-4 py-3">
                  {canAssign ? (
                    <Dropdown
                      menuKey={`assign-${a.id}`}
                      openMenuKey={openMenuKey}
                      onOpenChange={setOpenMenuKey}
                      value={a.counselor_id ?? ""}
                      onChange={(v) => {
                        if (!v && !a.counselor_id) return;
                        const name = v ? (counselors.find((c) => c.id === v)?.name ?? "Your counselor") : null;
                        void (async () => {
                          const ok = await act(a.id, (db, apptId) => assignAppointment(db, apptId, v || null), "assign a counselor");
                          if (!ok) return;
                          if (name) {
                            void notifyStudent(a, "Counselor assigned", `${name} will handle your session on ${formatWhen(a.scheduled_at)}.`);
                          }
                          const alias = aliases.get(a.student_id) ?? "Student";
                          void notifyStaff(headIds, {
                            type: "appointment",
                            title: `Session assigned — ${name ?? "unassigned"}`,
                            body: `${alias} · ${formatWhen(a.scheduled_at)}`,
                            link: "/appointments",
                          });
                        })();
                      }}
                      ariaLabel={`Assign counselor for session ${formatWhen(a.scheduled_at)}`}
                      buttonClassName="max-w-[170px] rounded-xl px-2.5 py-1.5 text-[13px]"
                      disabled={busyId === a.id}
                      options={[
                        { value: "", label: "Unassigned" },
                        ...counselors.map((c) => ({ value: c.id, label: c.name })),
                      ]}
                    />
                  ) : (
                    <span className="whitespace-nowrap">{counselorName(a.counselor_id)}</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {a.mode === "online" ? "Online" : "In person"}
                  {a.mode === "online" && a.meeting_url && (
                    <a
                      href={a.meeting_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800 transition-colors hover:bg-blue-200"
                      aria-label={`Join the Google Meet for the session on ${formatWhen(a.scheduled_at)}`}
                    >
                      <Video className="h-3 w-3" aria-hidden />
                      Join Meet
                    </a>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <Badge tone={statusTone(a.status)}>{statusLabel(a.status)}</Badge>
                </td>
                <td className="max-w-[220px] truncate px-4 py-3" title={a.concern}>{a.concern}</td>
                {canSeeActions && (
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {/* Admin: assign happens in the Counselor column; reject lives here. */}
                      {canReject && (a.status === "pending" || a.status === "assigned") && (
                        <IconAction label="Reject" variant="outline" icon={X} disabled={busyId === a.id} onClick={() => setConfirming({ appt: a, kind: "reject" })} />
                      )}
                      {/* Counselor: assigned → confirmed → completed / no-show. */}
                      {isCounselor && a.status === "assigned" && (
                        <IconAction label="Confirm" variant="accent" icon={Check} disabled={busyId === a.id} onClick={() => setConfirming({ appt: a, kind: "confirm" })} />
                      )}
                      {isCounselor && a.status === "confirmed" && (
                        <>
                          <IconAction label="Complete" variant="accent" icon={CheckCheck} disabled={busyId === a.id} onClick={() => setConfirming({ appt: a, kind: "complete" })} />
                          <IconAction label="No-show" variant="outline" icon={UserX} disabled={busyId === a.id} onClick={() => setConfirming({ appt: a, kind: "no-show" })} />
                        </>
                      )}
                      {(a.status === "completed" || a.status === "cancelled" || a.status === "rejected" || a.status === "no_show") && (
                        <span className="text-xs font-medium text-ink-faint">Terminal</span>
                      )}
                      {canReject && (a.status === "confirmed" || a.status === "completed" || a.status === "cancelled" || a.status === "rejected" || a.status === "no_show") && (
                        <span className="text-xs font-medium text-ink-faint">Counselor / student step</span>
                      )}
                      {isCounselor && a.status === "pending" && (
                        <span className="text-xs font-medium text-ink-faint">Waiting for assignment</span>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !visible.length && (
          <p className="px-4 py-8 text-center text-sm text-ink-muted">
            No sessions match these filters. Try clearing the search or choosing another status.
          </p>
        )}
        {loading && (
          <div className="animate-pulse space-y-3 p-4" aria-hidden>
            <div className="h-10 rounded-xl bg-ink/10" />
            <div className="h-10 rounded-xl bg-ink/10" />
            <div className="h-10 rounded-xl bg-ink/10" />
          </div>
        )}
      </Card>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="appt-confirm-title"
          aria-describedby="appt-confirm-desc"
        >
          <div aria-hidden className="absolute inset-0 bg-ink/40" onClick={closeConfirming} />
          <div className="no-scrollbar relative max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-card sm:max-w-md">
            <h2 id="appt-confirm-title" className="font-display text-lg font-bold text-ink">
              {CONFIRM_COPY[confirming.kind].title}
            </h2>
            <p id="appt-confirm-desc" className="mt-1 text-sm leading-relaxed text-ink-muted">
              {CONFIRM_COPY[confirming.kind].body}
            </p>
            <p className="mt-3 truncate rounded-xl bg-cream px-3 py-2 text-[13px] font-semibold text-ink-soft">
              {aliases.get(confirming.appt.student_id) ?? "Student"} · requested {formatWhen(confirming.appt.scheduled_at)}
            </p>
            {confirming.kind === "confirm" && (
              <div className="mt-3">
                <span className="mb-1.5 block text-xs font-bold text-ink-muted">
                  Session date and time
                </span>
                <DateTimePicker
                  id="confirm-schedule"
                  value={scheduleInput}
                  onChange={(v) => {
                    setScheduleInput(v);
                    setScheduleError(null);
                  }}
                />
                {scheduleError ? (
                  <p className="mt-1.5 text-xs font-semibold text-red-600">{scheduleError}</p>
                ) : (
                  <p className="mt-1.5 text-[11px] font-medium text-ink-faint">
                    This becomes the final schedule — the student is notified with this time.
                  </p>
                )}
              </div>
            )}
            {confirming.kind === "confirm" && confirming.appt.mode === "online" && (
              <div className="mt-3">
                <label className="mb-1.5 block text-xs font-bold text-ink-muted" htmlFor="confirm-meet-link">
                  Google Meet link
                </label>
                <Input
                  id="confirm-meet-link"
                  type="url"
                  inputMode="url"
                  placeholder="https://meet.google.com/abc-defg-hij"
                  value={meetingInput}
                  onChange={(e) => {
                    setMeetingInput(e.target.value);
                    setMeetingError(null);
                  }}
                />
                {meetingError ? (
                  <p className="mt-1.5 text-xs font-semibold text-red-600">{meetingError}</p>
                ) : (
                  <p className="mt-1.5 text-[11px] font-medium text-ink-faint">
                    Paste the Google Meet for this session — the student joins with this link.
                  </p>
                )}
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={closeConfirming} autoFocus>
                Back
              </Button>
              <Button
                size="sm"
                variant={confirming.kind === "reject" ? "danger" : "primary"}
                onClick={runConfirming}
              >
                {CONFIRM_COPY[confirming.kind].ok}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
