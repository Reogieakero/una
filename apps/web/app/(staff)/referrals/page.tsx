"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Check, CheckCheck, Eye, LayoutGrid, List, X } from "lucide-react";
import { createReferralSchema, type CreateReferralInput } from "@dorsu/shared-schemas";
import { createClient } from "@/lib/supabase/client";
import {
  assignReferral,
  createReferral,
  listReferrals,
  rejectReferral,
  triageReferral,
} from "@dorsu/shared-services";
import { Badge, Button, Card, FieldError, Input, Textarea } from "@/components/ui/primitives";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Dropdown } from "@/components/shared/dropdown";
import { notifyStaff } from "@/lib/notify";
import { cn } from "@/lib/utils";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type Referral = {
  id: string;
  referring_faculty_id: string | null;
  referring_personnel_id: string | null;
  student_id: string;
  reason: string;
  priority: string;
  status: string;
  assigned_counselor_id: string | null;
  created_at: string;
  updated_at: string;
};

type RefAction = {
  id: string;
  referral_id: string;
  actor_profile_id: string;
  action: string;
  note: string | null;
  created_at: string;
};

/** Core strict flow — mirrors appointment statuses (pending → assigned →
 * confirmed → resolved, plus rejected/escalated). Legacy acknowledged /
 * in_progress rows still render under "All" but have no pill and no entry
 * buttons; they exit via counselor resolve / escalate. */
const STATUSES = ["pending", "assigned", "confirmed", "resolved", "escalated", "rejected"] as const;
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

function statusTone(s: string): "info" | "success" | "warning" | "danger" {
  if (s === "resolved") return "success";
  if (s === "escalated" || s === "rejected") return "danger";
  if (s === "assigned" || s === "confirmed") return "info";
  return "warning";
}

function priorityTone(p: string): "info" | "success" | "warning" | "danger" {
  if (p === "urgent") return "danger";
  if (p === "high") return "warning";
  if (p === "medium") return "info";
  return "success";
}

/** "no_show" → "No show", "pending" → "Pending". */
function statusLabel(s: string): string {
  const spaced = s.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} ago`;
}

/** Compact age ("45m", "3h", "2d") for escalation chips. */
function ageShort(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** ISO → picker value (local tz), minutes snapped to the quarter hour. */
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  d.setMinutes(Math.round(d.getMinutes() / 15) * 15, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Default schedule offer — tomorrow, snapped to the quarter hour. */
function defaultScheduleInput(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setMinutes(Math.round(d.getMinutes() / 15) * 15, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Schedule persistence — referrals has no scheduled_at column, so the
 * counselor-set session time is stored as a structured trail note
 * ("Session scheduled for <ISO>") on the confirm action. Same schedule
 * discipline as appointment confirm, different storage.
 */
const SCHEDULE_NOTE_PREFIX = "Session scheduled for ";

function parseScheduleNote(note: string | null): string | null {
  if (!note || !note.startsWith(SCHEDULE_NOTE_PREFIX)) return null;
  const candidate = note.slice(SCHEDULE_NOTE_PREFIX.length).trim().split(" ")[0];
  const d = new Date(candidate);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const HEAD_LEGEND: { icon: typeof Check; label: string; desc: string; variant: "accent" | "outline" }[] = [
  { icon: Check, label: "Assign", desc: "Pending → assigned", variant: "accent" },
  { icon: X, label: "Reject", desc: "Pending / assigned → rejected", variant: "outline" },
];

const COUNSELOR_LEGEND: { icon: typeof Check; label: string; desc: string; variant: "accent" | "outline" }[] = [
  { icon: Check, label: "Confirm", desc: "Assigned → confirmed + set schedule", variant: "accent" },
  { icon: CheckCheck, label: "Resolve", desc: "Confirmed → resolved (needs session)", variant: "accent" },
  { icon: AlertTriangle, label: "Escalate", desc: "Flag as urgent", variant: "outline" },
];

/** Icon-only action button — meaning comes from the filter-card legend + tooltip. */
function IconAction({
  label,
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

/** Strict triage moves — assign happens in the Counselor column, never here. */
type TriageKind = "confirmed" | "resolved" | "escalated" | "rejected";

const TRIAGE_COPY: Record<TriageKind, { title: string; body: string; ok: string }> = {
  confirmed: { title: "Confirm and schedule this session?", body: "Set the final session date and time. The student will be notified with this schedule.", ok: "Confirm session" },
  resolved: { title: "Resolve this referral?", body: "Closes the loop — the student needs a confirmed session with a schedule first. Resolve stays blocked until then.", ok: "Resolve" },
  escalated: { title: "Escalate this referral?", body: "Flags it as needing urgent attention from leadership.", ok: "Escalate" },
  rejected: { title: "Reject this referral?", body: "The referral ends as Rejected and leaves the queue. This can't be undone.", ok: "Reject referral" },
};

/**
 * Next moves per status, split by role — same split as appointments:
 * admin assigns + rejects, counselor confirms + resolves + escalates. Pending
 * items wait for assignment; assigned items wait for counselor confirmation.
 * Legacy acknowledged / in_progress only exit via counselor resolve/escalate.
 */
const COUNSELOR_NEXT: Record<string, TriageKind[]> = {
  pending: [],
  assigned: ["confirmed", "escalated"],
  confirmed: ["resolved", "escalated"],
  escalated: ["confirmed", "resolved"],
  acknowledged: ["resolved", "escalated"],
  in_progress: ["resolved", "escalated"],
  resolved: [],
  rejected: [],
};

const HEAD_NEXT: Record<string, TriageKind[]> = {
  pending: ["rejected"],
  assigned: ["rejected"],
  acknowledged: [],
  in_progress: [],
  confirmed: [],
  escalated: [],
  resolved: [],
  rejected: [],
};

const ACTION_ICON: Record<TriageKind, typeof Check> = {
  confirmed: Check,
  resolved: CheckCheck,
  escalated: AlertTriangle,
  rejected: X,
};

/** Shown whenever resolve is attempted without a confirmed scheduled session. */
const NO_SESSION_MSG =
  "Resolve needs a confirmed session first — confirm the student's appointment with its schedule before closing this referral.";

/**
 * Shared /referrals — same role-separated flow as appointments, different
 * start line: appointments start from the student booking directly, referrals
 * start from faculty flagging a student for session.
 * Admin (guidance_head): assign counselor (pending → assigned) + reject.
 *   Never confirm / resolve / escalate — those belong to the counselor.
 * Counselor: confirm assigned → confirmed, then resolve once the session is
 *   confirmed, plus escalate when urgent. Never assign / reject. Pending
 *   items wait for assignment.
 * Faculty: flag students via createReferral below.
 * Rules live in referrals/mutations.ts; this page only renders them.
 */
export default function ReferralsPage() {
  const [rows, setRows] = useState<Referral[]>([]);
  const [trail, setTrail] = useState<Map<string, RefAction[]>>(new Map());
  const [actorNames, setActorNames] = useState<Map<string, string>>(new Map());
  const [aliases, setAliases] = useState<Map<string, string>>(new Map());
  const [counselors, setCounselors] = useState<{ id: string; name: string }[]>([]);
  const [counselorProfiles, setCounselorProfiles] = useState<Map<string, string>>(new Map());
  const [facultyNames, setFacultyNames] = useState<Map<string, string>>(new Map());
  const [facultyProfiles, setFacultyProfiles] = useState<Map<string, string>>(new Map());
  const [headIds, setHeadIds] = useState<string[]>([]);
  const [students, setStudents] = useState<{ id: string; label: string }[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [facultyId, setFacultyId] = useState<string | null>(null);
  const [counselorId, setCounselorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const [query, setQuery] = useState("");
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ ref: Referral; to: TriageKind } | null>(null);
  const [reasonRef, setReasonRef] = useState<Referral | null>(null);
  const [escalateNote, setEscalateNote] = useState("");
  const [escalateError, setEscalateError] = useState<string | null>(null);
  const [scheduleInput, setScheduleInput] = useState("");
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [studentPick, setStudentPick] = useState("");
  const [studentProfiles, setStudentProfiles] = useState<Map<string, string>>(new Map());
  // Students with a confirmed/completed scheduled session — only their
  // referrals may resolve (same flow as appointment sessions).
  const [readyStudents, setReadyStudents] = useState<Set<string>>(new Set());

  const { register, handleSubmit, formState, reset, setValue, watch } = useForm<CreateReferralInput>({
    resolver: zodResolver(createReferralSchema),
    defaultValues: { priority: "medium" },
  });
  const priorityValue = watch("priority") ?? "medium";

  const reload = async () => {
    const supabase = createClient();
    const data = ((await listReferrals(supabase)) ?? []) as Referral[];
    setRows(data);

    const { data: actions } = await supabase
      .from("referral_actions")
      .select("id, referral_id, actor_profile_id, action, note, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    const grouped = new Map<string, RefAction[]>();
    for (const a of ((actions ?? []) as RefAction[])) {
      if (!grouped.has(a.referral_id)) grouped.set(a.referral_id, []);
      grouped.get(a.referral_id)!.push(a);
    }
    setTrail(grouped);
    const actorIds = [...new Set(((actions ?? []) as RefAction[]).map((a) => a.actor_profile_id))];
    if (actorIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", actorIds.slice(0, 200));
      setActorNames(
        new Map(((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? "Staff"]))
      );
    }

    const studentIds = [...new Set(data.map((r) => r.student_id))];
    if (studentIds.length) {
      const { data: studentRows } = await supabase
        .from("students")
        .select("id, profile_id, anonymous_alias")
        .in("id", studentIds.slice(0, 300));
      const srows = ((studentRows ?? []) as { id: string; profile_id: string; anonymous_alias: string | null }[]);
      setAliases(new Map(srows.map((s) => [s.id, s.anonymous_alias ?? "Student"])));
      setStudentProfiles(new Map(srows.map((s) => [s.id, s.profile_id])));
      // Resolve gate — which referred students already hold a confirmed (or
      // completed) session with a schedule. RLS-scoped, so counselors only
      // ever see their own sessions here.
      const { data: sessionRows } = await supabase
        .from("appointments")
        .select("student_id")
        .in("student_id", studentIds.slice(0, 300))
        .in("status", ["confirmed", "completed"])
        .not("scheduled_at", "is", null);
      setReadyStudents(
        new Set(((sessionRows ?? []) as { student_id: string }[]).map((a) => a.student_id))
      );
    } else {
      setReadyStudents(new Set());
    }

    const { data: counselorRows } = await supabase.from("counselors").select("id, profile_id").limit(100);
    const crows = ((counselorRows ?? []) as { id: string; profile_id: string }[]);
    if (crows.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", crows.map((c) => c.profile_id));
      const names = new Map(((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? "Counselor"]));
      setCounselors(crows.map((c) => ({ id: c.id, name: names.get(c.profile_id) ?? "Counselor" })));
      setCounselorProfiles(new Map(crows.map((c) => [c.id, c.profile_id])));
    }
    const { data: headRows } = await supabase.from("profiles").select("id").eq("role", "guidance_head").eq("is_active", true);
    setHeadIds(((headRows ?? []) as { id: string }[]).map((h) => h.id));

    const facIds = [...new Set(data.map((r) => r.referring_faculty_id).filter(Boolean))] as string[];
    if (facIds.length) {
      const { data: facRows } = await supabase.from("faculty_members").select("id, profile_id").in("id", facIds.slice(0, 100));
      const frows = ((facRows ?? []) as { id: string; profile_id: string }[]);
      if (frows.length) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", frows.map((f) => f.profile_id));
        const names = new Map(((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? "Faculty"]));
        setFacultyNames(new Map(frows.map((f) => [f.id, names.get(f.profile_id) ?? "Faculty"])));
        setFacultyProfiles(new Map(frows.map((f) => [f.id, f.profile_id])));
      }
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setMe(user.id);
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        const r = (profile as { role: string } | null)?.role ?? null;
        setRole(r);
        if (r === "counselor") {
          const { data: c } = await supabase.from("counselors").select("id").eq("profile_id", user.id).single();
          if ((c as { id: string } | null)?.id) setCounselorId((c as { id: string }).id);
        }
        if (r === "faculty") {
          const { data } = await supabase.from("faculty_members").select("id").eq("profile_id", user.id).single();
          if ((data as { id: string } | null)?.id) setFacultyId((data as { id: string }).id);
          const { data: studentRows } = await supabase
            .from("students")
            .select("id, anonymous_alias, student_no")
            .order("created_at", { ascending: false })
            .limit(200);
          setStudents(
            ((studentRows ?? []) as { id: string; anonymous_alias: string | null; student_no: string }[]).map((s) => ({
              id: s.id,
              label: `${s.anonymous_alias ?? "Student"} · ${s.student_no}`,
            }))
          );
        }
        if (r && ["counselor", "guidance_head", "faculty"].includes(r)) await reload();
      } catch {
        toast.error("Couldn't load referrals right now.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSubmit = role === "faculty";
  const canTriage = role === "counselor" || role === "guidance_head";

  const isCounselor = role === "counselor";
  const canAssign = role === "guidance_head";
  const canReject = role === "guidance_head";
  const canSeeActions = canAssign || canReject || isCounselor;

  // Counselor scope mirrors appointments — my assigned cases only. Other
  // counselors' cases stay out of my queue and my numbers. Unlinked
  // counselors fall back to the full inbox until setup finishes.
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
        const alias = aliases.get(r.student_id) ?? "";
        return `${alias} ${r.reason}`.toLowerCase().includes(q);
      });
  }, [mine, isCounselor, statusFilter, priorityFilter, assigneeFilter, query, aliases]);

  const counselorName = (id: string | null) =>
    !id ? "Unassigned" : (counselors.find((c) => c.id === id)?.name ?? "Counselor");

  const referrerLabel = (r: Referral): string => {
    if (r.referring_faculty_id) return facultyNames.get(r.referring_faculty_id) ?? "Faculty";
    return "Guidance office";
  };

  const shortReason = (r: string) => (r.length > 140 ? `${r.slice(0, 140)}…` : r);

  const canResolve = (ref: Referral) => readyStudents.has(ref.student_id);

  const askConfirm = (ref: Referral, to: TriageKind) => {
    if (to === "resolved" && !canResolve(ref)) {
      toast.error(NO_SESSION_MSG);
      return;
    }
    setConfirming({ ref, to });
  };

  const act = async (ref: Referral, to: TriageKind, note?: string, scheduledIso?: string) => {
    if (!me) return;
    setBusyId(ref.id);
    try {
      const db = createClient();
      // Counselor sets the final session time on confirm — same discipline
      // as appointment confirm. The schedule is stored as a structured
      // trail note (referrals has no scheduled_at column) and the student
      // is notified with that time.
      if (to === "confirmed" && scheduledIso) {
        await triageReferral(db, {
          referralId: ref.id,
          actorProfileId: me,
          status: to,
          actionNote: `${SCHEDULE_NOTE_PREFIX}${scheduledIso}`,
        });
      } else if (to === "rejected") await rejectReferral(db, ref.id, me);
      else await triageReferral(db, { referralId: ref.id, actorProfileId: me, status: to, actionNote: note });
      const alias = aliases.get(ref.student_id) ?? "Student";
      const when = scheduledIso ? formatWhen(scheduledIso) : null;
      const officeBody = `"${shortReason(ref.reason)}" — ${alias} · now ${statusLabel(to).toLowerCase()}${when ? ` · session ${when}` : ""}.`;
      if (to === "confirmed" && when) {
        // Student + referrer + heads hear the counselor-set schedule.
        await notifyStaff([studentProfiles.get(ref.student_id)], {
          type: "appointment",
          title: "Session confirmed",
          body: `Your session is scheduled on ${when}. See you then!`,
          link: "/appointments",
        });
      }
      if (to === "escalated") {
        const referrer = ref.referring_faculty_id ? facultyProfiles.get(ref.referring_faculty_id) : null;
        await notifyStaff(
          [...headIds, ref.assigned_counselor_id ? counselorProfiles.get(ref.assigned_counselor_id) : null, referrer],
          {
            type: "referral",
            title: "Referral escalated",
            body: `"${shortReason(ref.reason)}" was escalated — please review.`,
            link: "/referrals",
          }
        );
      } else {
        const referrer = ref.referring_faculty_id ? facultyProfiles.get(ref.referring_faculty_id) : null;
        await notifyStaff([referrer], {
          type: "referral",
          title: `Referral ${statusLabel(to).toLowerCase()}`,
          body: `"${shortReason(ref.reason)}" is now ${statusLabel(to).toLowerCase()}.`,
          link: "/referrals",
        });
        await notifyStaff(headIds, {
          type: "referral",
          title: `Referral ${statusLabel(to).toLowerCase()}`,
          body: officeBody,
          link: "/referrals",
        });
      }
      await reload();
    } catch (e) {
      toast.error(
        e instanceof Error && /confirmed session|can't (move|assign|unassign|reject|confirm|resolve|escalate|acknowledge|start)/i.test(e.message)
          ? e.message
          : "Couldn't move that referral — please reload and try again."
      );
    } finally {
      setBusyId(null);
    }
  };

  const runConfirming = () => {
    if (!confirming) return;
    if (confirming.to === "resolved" && !canResolve(confirming.ref)) {
      toast.error(NO_SESSION_MSG);
      return;
    }
    // Counselor schedules the final session time on confirm — same gate
    // as the appointment page.
    let scheduledIso: string | undefined;
    if (confirming.to === "confirmed") {
      if (!scheduleInput) {
        setScheduleError("Set the session date and time.");
        return;
      }
      const scheduledAt = new Date(scheduleInput);
      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
        setScheduleError("Sessions must be scheduled in the future.");
        return;
      }
      scheduledIso = scheduledAt.toISOString();
    }
    if (confirming.to === "escalated" && escalateNote.trim().length < 10) {
      setEscalateError("Say why this is urgent and what was already tried (at least 10 characters).");
      return;
    }
    const { ref, to } = confirming;
    const note = to === "escalated" ? escalateNote.trim() : undefined;
    setConfirming(null);
    setEscalateNote("");
    setEscalateError(null);
    setScheduleInput("");
    setScheduleError(null);
    void act(ref, to, note, scheduledIso);
  };

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

  // Latest escalation moment per referral (for SLA chips).
  const escalatedAt = useMemo(() => {
    const m = new Map<string, string>();
    for (const [refId, actions] of trail) {
      const last = actions.find((a) => a.action === "escalated");
      if (last) m.set(refId, last.created_at);
    }
    return m;
  }, [trail]);

  const roleActions = (status: string): TriageKind[] =>
    isCounselor ? (COUNSELOR_NEXT[status] ?? []) : (HEAD_NEXT[status] ?? []);

  const assign = async (ref: Referral, counselorId: string) => {
    if (!me || (ref.assigned_counselor_id ?? "") === counselorId) return;
    setBusyId(ref.id);
    try {
      await assignReferral(createClient(), ref.id, counselorId || null, me);
      if (counselorId) {
        await notifyStaff([counselorProfiles.get(counselorId)], {
          type: "referral",
          title: "Referral assigned to you",
          body: `"${shortReason(ref.reason)}" — please triage it.`,
          link: "/referrals",
        });
        const alias = aliases.get(ref.student_id) ?? "Student";
        await notifyStaff(headIds, {
          type: "referral",
          title: `Referral assigned — ${counselorName(counselorId)}`,
          body: `"${shortReason(ref.reason)}" — ${alias}.`,
          link: "/referrals",
        });
      }
      await reload();
    } catch (e) {
      toast.error(
        e instanceof Error && /can't (move|assign|unassign|reject|confirm|resolve|escalate)|unknown counselor/i.test(e.message)
          ? e.message
          : "Couldn't assign that referral — please reload and try again."
      );
    } finally {
      setBusyId(null);
    }
  };

  // Confirm dialog: Escape closes, background stays put while open.
  // Prefill the counselor schedule picker — existing session time when
  // re-confirming, otherwise tomorrow, same as the appointment page.
  useEffect(() => {
    if (confirming?.to === "confirmed") {
      const existing = sessionSchedule.get(confirming.ref.id);
      setScheduleInput(existing ? toLocalInputValue(existing) : defaultScheduleInput());
      setScheduleError(null);
    }
    if (!confirming) return;
    if (confirming.to !== "escalated") setEscalateError(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setConfirming(null);
        setEscalateNote("");
        setEscalateError(null);
        setScheduleInput("");
        setScheduleError(null);
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // Prefill reads the schedule once per dialog open; reloads only happen
    // after an action lands (dialog already closed).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirming]);

  // Reason viewer: Escape closes, background stays put while open.
  useEffect(() => {
    if (!reasonRef) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReasonRef(null);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [reasonRef]);

  if (!loading && (!role || !["counselor", "guidance_head", "faculty"].includes(role))) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">Referrals</h1>
        <Card><p className="text-sm text-ink-muted">Only counselors, the guidance head, and faculty can open referrals.</p></Card>
      </div>
    );
  }

  const statCards = [
    { label: isCounselor ? "My referrals" : "Total referrals", value: stats.total },
    { label: "Pending", value: stats.pending },
    { label: "Assigned", value: stats.assigned },
    { label: "Confirmed", value: stats.confirmed },
    { label: "Resolved", value: stats.resolved },
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
            <BreadcrumbPage>Referrals</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="font-display text-2xl font-bold">{isCounselor ? "My referrals" : "Referrals"}</h1>
        <p className="mt-1 max-w-[600px] text-sm leading-relaxed text-ink-muted">
          {role === "faculty"
            ? "Flag a student for counseling follow-up — the office triages from here."
            : isCounselor
              ? "Your assigned queue — confirm assigned referrals and set the session schedule (student notified), then resolve once it's confirmed. Cancels and reschedules come from the student."
              : "Office-wide referral board — assign a counselor (pending → assigned) or reject the request. Confirm / resolve / escalate belong to the counselor."}
        </p>
      </div>

      {isCounselor && !counselorId && !loading && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-card">
          <p className="text-sm font-bold text-amber-800">Counselor record not linked yet</p>
          <p className="mt-1 text-[13px] text-amber-700">
            Showing the full inbox until your counselor record is linked. Ask the guidance head to finish setup.
          </p>
        </div>
      )}

      {canTriage && (
        <>
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
                menuKey="ref-priority"
                openMenuKey={openMenuKey}
                onOpenChange={setOpenMenuKey}
                value={priorityFilter}
                onChange={setPriorityFilter}
                ariaLabel="Filter by priority"
                options={[
                  { value: "all", label: "All priorities" },
                  ...PRIORITIES.map((p) => ({ value: p, label: statusLabel(p) })),
                ]}
              />
              {role !== "counselor" && (
                <Dropdown
                  menuKey="ref-assignee"
                  openMenuKey={openMenuKey}
                  onOpenChange={setOpenMenuKey}
                  value={assigneeFilter}
                  onChange={setAssigneeFilter}
                  ariaLabel="Filter by assignee"
                  options={[
                    { value: "all", label: "All counselors" },
                    { value: "unassigned", label: "Unassigned only" },
                    ...counselors.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
              )}
              <Input
                placeholder="Search reason or student…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-ink-faint">
                Showing {visible.length} of {mine.length} referrals · student names stay private (aliases only).
              </p>
              <div className="flex rounded-full border border-ink/15 bg-white p-1 shadow-card" role="group" aria-label="Board layout">
                {(
                  [
                    { v: "list", label: "List", Icon: List },
                    { v: "grid", label: "Grid", Icon: LayoutGrid },
                  ] as const
                ).map(({ v, label, Icon }) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    onClick={() => setView(v)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-bold transition-colors",
                      view === v ? "bg-primary-600 text-white shadow-soft" : "text-ink-soft hover:bg-cream"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {label}
                  </button>
                ))}
              </div>
            </div>
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

          {/* Board — list */}
          {view === "list" && (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-xs uppercase text-ink-muted">
                  <th className="px-4 py-3">Referred</th>
                  <th className="px-4 py-3">Session</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Referred by</th>
                  <th className="px-4 py-3">Counselor</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Reason</th>
                  {canSeeActions && <th className="px-4 py-3">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const actions = roleActions(r.status);
                  return (
                    <tr key={r.id} className="border-b border-ink/5 align-top last:border-0">
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="font-semibold">{formatWhen(r.created_at)}</span>
                        <span className="block text-[11px] font-medium text-ink-faint">{timeAgo(r.created_at)}</span>
                        {r.status === "escalated" && escalatedAt.get(r.id) && (
                          <span className="mt-1 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                            {ageShort(escalatedAt.get(r.id)!)} since escalation
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {sessionSchedule.get(r.id) ? (
                          <span className="font-semibold">{formatWhen(sessionSchedule.get(r.id)!)}</span>
                        ) : (
                          <span className="font-medium text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{aliases.get(r.student_id) ?? "Student"}</td>
                      <td className="whitespace-nowrap px-4 py-3">{referrerLabel(r)}</td>
                      <td className="px-4 py-3">
                        {canAssign ? (
                          <Dropdown
                            menuKey={`ref-assign-${r.id}`}
                            openMenuKey={openMenuKey}
                            onOpenChange={setOpenMenuKey}
                            value={r.assigned_counselor_id ?? ""}
                            onChange={(v) => void assign(r, v)}
                            ariaLabel={`Assign counselor for referral from ${aliases.get(r.student_id) ?? "student"}`}
                            buttonClassName="max-w-[170px] rounded-xl px-2.5 py-1.5 text-[13px]"
                            disabled={busyId === r.id}
                            options={[
                              { value: "", label: "Unassigned" },
                              ...counselors.map((c) => ({ value: c.id, label: c.name })),
                            ]}
                          />
                        ) : (
                          <span className="whitespace-nowrap">{counselorName(r.assigned_counselor_id)}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Badge tone={priorityTone(r.priority)}>{statusLabel(r.priority)}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <IconAction label="View reason" variant="outline" icon={Eye} onClick={() => setReasonRef(r)} />
                      </td>
                      {canSeeActions && (
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {/* Admin: assign happens in the Counselor column; reject lives here. */}
                            {canReject && (r.status === "pending" || r.status === "assigned") && (
                              <IconAction label="Reject" variant="outline" icon={X} disabled={busyId === r.id} onClick={() => askConfirm(r, "rejected")} />
                            )}
                            {/* Counselor: assigned → confirmed → resolved / escalated. */}
                            {isCounselor &&
                              actions.map((s) => {
                                const Icon = ACTION_ICON[s];
                                const blocked = s === "resolved" && !canResolve(r);
                                return (
                                  <IconAction
                                    key={s}
                                    label={blocked ? "Resolve (needs a confirmed session first)" : TRIAGE_COPY[s].ok}
                                    variant={s === "escalated" || s === "rejected" ? "outline" : "accent"}
                                    icon={Icon}
                                    disabled={busyId === r.id}
                                    onClick={() => askConfirm(r, s)}
                                  />
                                );
                              })}
                            {(r.status === "resolved" || r.status === "rejected") && (
                              <span className="text-xs font-medium text-ink-faint">Terminal</span>
                            )}
                            {canReject &&
                              (r.status === "confirmed" ||
                                r.status === "resolved" ||
                                r.status === "escalated" ||
                                r.status === "rejected" ||
                                r.status === "acknowledged" ||
                                r.status === "in_progress") && (
                                <span className="text-xs font-medium text-ink-faint">Counselor step</span>
                              )}
                            {isCounselor && r.status === "pending" && (
                              <span className="text-xs font-medium text-ink-faint">Waiting for assignment</span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!loading && !visible.length && (
              <p className="px-4 py-8 text-center text-sm text-ink-muted">
                No referrals match these filters. Try clearing the search or choosing another status.
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
          )}

          {/* Board — grid cards with real labeled buttons */}
          {view === "grid" && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {loading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-lg border border-ink/10 bg-white p-5 shadow-card" aria-hidden>
                    <div className="h-4 w-1/3 rounded-full bg-ink/10" />
                    <div className="mt-3 h-16 rounded-xl bg-ink/10" />
                    <div className="mt-3 h-9 w-1/2 rounded-full bg-ink/10" />
                  </div>
                ))}
              {!loading &&
                visible.map((r) => {
                  const history = trail.get(r.id) ?? [];
                  const actions = roleActions(r.status);
                  return (
                    <Card key={r.id} className="space-y-3 rounded-lg">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={priorityTone(r.priority)}>{statusLabel(r.priority)}</Badge>
                        <Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge>
                        {r.status === "escalated" && escalatedAt.get(r.id) && (
                          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                            {ageShort(escalatedAt.get(r.id)!)} since escalation
                          </span>
                        )}
                        <span className="ml-auto text-[11px] font-medium text-ink-faint">{timeAgo(r.created_at)}</span>
                      </div>
                      <p className="text-sm leading-relaxed text-ink">{r.reason}</p>
                      <div className="grid gap-2 text-[13px] sm:grid-cols-2">
                        <p className="text-ink-muted">
                          Student <span className="font-bold text-ink">{aliases.get(r.student_id) ?? "Student"}</span>
                        </p>
                        <p className="text-ink-muted">
                          Referred by <span className="font-bold text-ink">{referrerLabel(r)}</span>
                        </p>
                        <p className="text-ink-muted">
                          Referred <span className="font-bold text-ink">{formatWhen(r.created_at)}</span>
                        </p>
                        <p className="text-ink-muted">
                          Session{" "}
                          <span className="font-bold text-ink">
                            {sessionSchedule.get(r.id) ? formatWhen(sessionSchedule.get(r.id)!) : "—"}
                          </span>
                        </p>
                        <div className="flex items-center gap-2 text-ink-muted sm:col-span-2">
                          <span className="shrink-0">Handling</span>
                          {canAssign ? (
                            <Dropdown
                              menuKey={`ref-grid-assign-${r.id}`}
                              openMenuKey={openMenuKey}
                              onOpenChange={setOpenMenuKey}
                              value={r.assigned_counselor_id ?? ""}
                              onChange={(v) => void assign(r, v)}
                              ariaLabel={`Assign counselor for referral from ${aliases.get(r.student_id) ?? "student"}`}
                              buttonClassName="rounded-xl px-2.5 py-1.5 text-[13px]"
                              disabled={busyId === r.id}
                              options={[
                                { value: "", label: "Unassigned" },
                                ...counselors.map((c) => ({ value: c.id, label: c.name })),
                              ]}
                            />
                          ) : (
                            <span className="font-bold text-ink">{counselorName(r.assigned_counselor_id)}</span>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-auto px-2.5"
                            title="View reason"
                            aria-label="View reason"
                            onClick={() => setReasonRef(r)}
                          >
                            <Eye className="h-4 w-4" aria-hidden />
                          </Button>
                        </div>
                      </div>
                      {actions.length > 0 || (canReject && (r.status === "pending" || r.status === "assigned")) ? (
                        <div className="flex flex-wrap gap-2">
                          {/* Admin: assign happens in the Handling row; reject lives here. */}
                          {canReject && (r.status === "pending" || r.status === "assigned") && (
                            <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => askConfirm(r, "rejected")}>
                              {TRIAGE_COPY.rejected.ok}
                            </Button>
                          )}
                          {/* Counselor: assigned → confirmed → resolved / escalated. */}
                          {isCounselor &&
                            actions.map((s) => {
                              const blocked = s === "resolved" && !canResolve(r);
                              return (
                                <Button
                                  key={s}
                                  size="sm"
                                  variant={s === "escalated" || s === "rejected" ? "outline" : "accent"}
                                  title={blocked ? "Resolve (needs a confirmed session first)" : TRIAGE_COPY[s].ok}
                                  disabled={busyId === r.id}
                                  onClick={() => askConfirm(r, s)}
                                >
                                  {TRIAGE_COPY[s].ok}
                                </Button>
                              );
                            })}
                        </div>
                      ) : (
                        <p className="text-xs font-medium text-ink-faint">
                          {r.status === "pending" && isCounselor && "Waiting for assignment — the head assigns a counselor first."}
                          {(r.status === "assigned" || r.status === "confirmed" || r.status === "escalated") && !isCounselor && "Waiting for counselor confirmation."}
                          {(r.status === "resolved" || r.status === "rejected") && "Terminal — no further moves."}
                        </p>
                      )}
                      {history.length > 0 && (
                        <details className="rounded-xl bg-cream px-4 py-2.5 text-[13px]">
                          <summary className="cursor-pointer font-bold text-ink-soft">
                            Trail · {history.length} entr{history.length === 1 ? "y" : "ies"}
                          </summary>
                          <ul className="mt-2 space-y-1.5">
                            {history.map((h) => (
                              <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-2 text-ink-muted">
                                <span>
                                  <span className="font-bold text-ink">{actorNames.get(h.actor_profile_id) ?? "Staff"}</span>
                                  {" → "}
                                  <span className="font-semibold">{statusLabel(h.action)}</span>
                                  {h.note && <span className="italic"> — {h.note}</span>}
                                </span>
                                <span className="text-[11px] font-medium text-ink-faint">{timeAgo(h.created_at)}</span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </Card>
                  );
                })}
              {!loading && !visible.length && (
                <Card><p className="text-center text-sm text-ink-muted">No referrals match these filters. Try clearing the search or choosing another status.</p></Card>
              )}
            </div>
          )}
        </>
      )}

      {/* Faculty submit */}
      {canSubmit && (
        <Card>
          <h2 className="font-display font-bold">Refer a student</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">Pick the student, describe what you observed, set urgency.</p>
          <form
            className="mt-3 grid gap-3 md:grid-cols-2"
            onSubmit={handleSubmit(async (v) => {
              if (!facultyId) {
                toast.error("Your faculty record isn't linked yet — ask the guidance head to finish setup.");
                return;
              }
              await createReferral(createClient(), {
                studentId: v.studentId,
                reason: v.reason,
                priority: v.priority,
                referringFacultyId: facultyId,
              });
              reset();
              setStudentPick("");
              toast.success("Referral submitted — the guidance office will triage it.");
              await notifyStaff(headIds, {
                type: "referral",
                title: `New ${v.priority} referral`,
                body: v.reason.length > 140 ? `${v.reason.slice(0, 140)}…` : v.reason,
                link: "/referrals",
              });
              reload().catch(() => {});
            })}
          >
            <div className="md:col-span-1">
              <label className="mb-1 block text-xs font-bold text-ink-muted">Student</label>
              <Dropdown
                menuKey="ref-student"
                openMenuKey={openMenuKey}
                onOpenChange={setOpenMenuKey}
                value={studentPick}
                onChange={(val) => {
                  setStudentPick(val);
                  setValue("studentId", val, { shouldValidate: true });
                }}
                ariaLabel=" referred student"
                options={students.map((s) => ({ value: s.id, label: s.label }))}
              />
              <FieldError message={formState.errors.studentId?.message} />
            </div>
            <div className="md:col-span-1">
              <label className="mb-1 block text-xs font-bold text-ink-muted">Priority</label>
              <Dropdown
                menuKey="ref-new-priority"
                openMenuKey={openMenuKey}
                onOpenChange={setOpenMenuKey}
                value={priorityValue}
                onChange={(val) => setValue("priority", val as CreateReferralInput["priority"], { shouldValidate: true })}
                ariaLabel="Referral priority"
                options={PRIORITIES.map((p) => ({ value: p, label: statusLabel(p) }))}
              />
              <FieldError message={formState.errors.priority?.message} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-bold text-ink-muted">Reason</label>
              <Textarea rows={3} placeholder="What did you observe? Be specific and kind." {...register("reason")} />
              <FieldError message={formState.errors.reason?.message} />
            </div>
            <div className="md:col-span-2">
              <Button>Submit referral</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Faculty's own view of the queue is read-only context below the form */}
      {role === "faculty" && !!rows.length && (
        <div className="space-y-3">
          {rows.slice(0, 10).map((r) => (
            <Card key={r.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge tone={priorityTone(r.priority)}>{statusLabel(r.priority)}</Badge>
                <Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge>
                <span className="ml-auto text-[11px] font-medium text-ink-faint">{timeAgo(r.created_at)}</span>
              </div>
              <p className="text-sm">{r.reason}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Triage confirm */}
      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="ref-confirm-title"
          aria-describedby="ref-confirm-desc"
        >
          <div aria-hidden className="absolute inset-0 bg-ink/40" onClick={() => { setConfirming(null); setEscalateNote(""); setEscalateError(null); setScheduleInput(""); setScheduleError(null); }} />
          <div className="no-scrollbar relative max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-card sm:max-w-md">
            <h2 id="ref-confirm-title" className="font-display text-lg font-bold text-ink">
              {TRIAGE_COPY[confirming.to].title}
            </h2>
            <p id="ref-confirm-desc" className="mt-1 text-sm leading-relaxed text-ink-muted">
              {TRIAGE_COPY[confirming.to].body}
            </p>
            <p className="mt-3 line-clamp-2 rounded-xl bg-cream px-3 py-2 text-[13px] font-semibold text-ink-soft">
              {aliases.get(confirming.ref.student_id) ?? "Student"} · {confirming.ref.reason}
            </p>
            {confirming.to === "confirmed" && (
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
              <Button size="sm" variant="outline" onClick={() => { setConfirming(null); setEscalateNote(""); setEscalateError(null); setScheduleInput(""); setScheduleError(null); }} autoFocus>
                Back
              </Button>
              <Button
                size="sm"
                variant={confirming.to === "escalated" || confirming.to === "rejected" ? "danger" : "primary"}
                onClick={runConfirming}
              >
                {TRIAGE_COPY[confirming.to].ok}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reason viewer */}
      {reasonRef && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ref-reason-title"
        >
          <div aria-hidden className="absolute inset-0 bg-ink/40" onClick={() => setReasonRef(null)} />
          <div className="no-scrollbar relative max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-card sm:max-w-md">
            <h2 id="ref-reason-title" className="font-display text-lg font-bold text-ink">
              Referral reason
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone={priorityTone(reasonRef.priority)}>{statusLabel(reasonRef.priority)}</Badge>
              <Badge tone={statusTone(reasonRef.status)}>{statusLabel(reasonRef.status)}</Badge>
            </div>
            <dl className="mt-3 space-y-1.5 text-[13px]">
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 font-medium text-ink-faint">Student</dt>
                <dd className="font-bold text-ink">{aliases.get(reasonRef.student_id) ?? "Student"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 font-medium text-ink-faint">Referred by</dt>
                <dd className="font-bold text-ink">{referrerLabel(reasonRef)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 font-medium text-ink-faint">Referred</dt>
                <dd className="font-bold text-ink">{formatWhen(reasonRef.created_at)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 font-medium text-ink-faint">Counselor</dt>
                <dd className="font-bold text-ink">{counselorName(reasonRef.assigned_counselor_id)}</dd>
              </div>
              {sessionSchedule.get(reasonRef.id) && (
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 font-medium text-ink-faint">Session</dt>
                  <dd className="font-bold text-ink">{formatWhen(sessionSchedule.get(reasonRef.id)!)}</dd>
                </div>
              )}
            </dl>
            <p className="mt-3 whitespace-pre-wrap rounded-xl bg-cream px-4 py-3 text-sm leading-relaxed text-ink">
              {reasonRef.reason}
            </p>
            {(trail.get(reasonRef.id) ?? []).length > 0 && (
              <div className="mt-3 rounded-xl border border-ink/10 px-4 py-3">
                <p className="text-xs font-bold text-ink-muted">
                  Trail · {(trail.get(reasonRef.id) ?? []).length} entr{(trail.get(reasonRef.id) ?? []).length === 1 ? "y" : "ies"}
                </p>
                <ul className="mt-2 space-y-1.5 text-[13px]">
                  {(trail.get(reasonRef.id) ?? []).map((h) => (
                    <li key={h.id} className="text-ink-muted">
                      <span className="font-bold text-ink">{actorNames.get(h.actor_profile_id) ?? "Staff"}</span>
                      {" → "}
                      <span className="font-semibold">{statusLabel(h.action)}</span>
                      {h.note && <span className="italic"> — {h.note}</span>}
                      <span className="block text-[11px] font-medium text-ink-faint">{timeAgo(h.created_at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setReasonRef(null)} autoFocus>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
