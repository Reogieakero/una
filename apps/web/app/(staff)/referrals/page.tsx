"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, CheckCheck, Eye, Play } from "lucide-react";
import { createReferralSchema, type CreateReferralInput } from "@dorsu/shared-schemas";
import { createClient } from "@/lib/supabase/client";
import {
  createReferral,
  escalateStaleUrgent,
  isReferralOverdue,
  listReferrals,
  triageReferral,
} from "@dorsu/shared-services";
import { Badge, Button, Card, FieldError, Input, Textarea } from "@/components/ui/primitives";
import { Dropdown } from "@/components/shared/dropdown";
import { ReportBars } from "@/components/shared/reports-charts";
import { notifyStaff } from "@/lib/notify";
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

const STATUSES = ["pending", "acknowledged", "in_progress", "resolved", "escalated"] as const;
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

function statusTone(s: string): "info" | "success" | "warning" | "danger" {
  if (s === "resolved") return "success";
  if (s === "escalated") return "danger";
  if (s === "in_progress" || s === "acknowledged") return "info";
  return "warning";
}

function priorityTone(p: string): "info" | "success" | "warning" | "danger" {
  if (p === "urgent") return "danger";
  if (p === "high") return "warning";
  if (p === "medium") return "info";
  return "success";
}

function statusLabel(s: string): string {
  const spaced = s.replace("_", " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
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

/** Compact age ("45m", "3h", "2d") for SLA chips. */
function ageShort(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

const ACTION_LEGEND: { icon: typeof Eye; label: string; desc: string; variant: "accent" | "outline" }[] = [
  { icon: Eye, label: "Acknowledge", desc: "Pending → acknowledged", variant: "accent" },
  { icon: Play, label: "Start", desc: "Acknowledged → in progress", variant: "accent" },
  { icon: CheckCheck, label: "Resolve", desc: "Close the referral", variant: "accent" },
  { icon: AlertTriangle, label: "Escalate", desc: "Flag as urgent", variant: "outline" },
];

/** Icon-only triage button — meaning comes from the filter-card legend + tooltip. */
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
  icon: typeof Eye;
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

type TriageKind = "acknowledged" | "in_progress" | "resolved" | "escalated";

const TRIAGE_COPY: Record<TriageKind, { title: string; body: string; ok: string }> = {
  acknowledged: { title: "Acknowledge this referral?", body: "Someone owns it from here — the student stops waiting in the dark.", ok: "Acknowledge" },
  in_progress: { title: "Start working this referral?", body: "Moves it to In progress and records you in the trail.", ok: "Start progress" },
  resolved: { title: "Resolve this referral?", body: "Closes the loop. Make sure follow-up (if any) is booked first.", ok: "Resolve" },
  escalated: { title: "Escalate this referral?", body: "Flags it as needing urgent attention from leadership.", ok: "Escalate" },
};

const NEXT_ACTIONS: Record<string, TriageKind[]> = {
  pending: ["acknowledged", "escalated"],
  acknowledged: ["in_progress", "resolved", "escalated"],
  in_progress: ["resolved", "escalated"],
  escalated: ["acknowledged", "resolved"],
  resolved: [],
};

const ACTION_ICON: Record<TriageKind, typeof Eye> = {
  acknowledged: Eye,
  in_progress: Play,
  resolved: CheckCheck,
  escalated: AlertTriangle,
};

/**
 * Shared /referrals — faculty submit via createReferral, counseling staff
 * triage via triageReferral. One URL, role-aware UI; rules in services.
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
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ ref: Referral; to: TriageKind } | null>(null);
  const [escalateNote, setEscalateNote] = useState("");
  const [escalateError, setEscalateError] = useState<string | null>(null);
  const [confirmEscalateAll, setConfirmEscalateAll] = useState(false);
  const [studentPick, setStudentPick] = useState("");

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
        .select("id, anonymous_alias")
        .in("id", studentIds.slice(0, 300));
      setAliases(
        new Map(
          ((studentRows ?? []) as { id: string; anonymous_alias: string | null }[]).map((s) => [s.id, s.anonymous_alias ?? "Student"])
        )
      );
    }

    const { data: counselorRows } = await supabase.from("counselors").select("id, profile_id").limit(100);
    const crows = ((counselorRows ?? []) as { id: string; profile_id: string }[]);
    if (crows.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", crows.map((c) => c.profile_id));
      const names = new Map(((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? "Counselor"]));
      setCounselors(crows.map((c) => ({ id: c.id, name: names.get(c.profile_id) ?? "Counselor" })));
      setCounselorProfiles(new Map(crows.map((c) => [c.id, c.profile_id])));
      const { data: headRows } = await supabase.from("profiles").select("id").eq("role", "guidance_head").eq("is_active", true);
      setHeadIds(((headRows ?? []) as { id: string }[]).map((h) => h.id));
    }

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

  const stats = useMemo(() => {
    const open = rows.filter((r) => r.status !== "resolved");
    return {
      total: rows.length,
      pending: rows.filter((r) => r.status === "pending").length,
      active: rows.filter((r) => ["acknowledged", "in_progress"].includes(r.status)).length,
      resolved: rows.filter((r) => r.status === "resolved").length,
      escalated: rows.filter((r) => r.status === "escalated").length,
      unassigned: open.filter((r) => !r.assigned_counselor_id).length,
      urgent: rows.filter((r) => r.priority === "urgent" && r.status !== "resolved").length,
      overdue: rows.filter((r) => r.status === "pending" && r.priority === "urgent" && isReferralOverdue(r.created_at)).length,
    };
  }, [rows]);

  const overdueList = useMemo(
    () => rows.filter((r) => r.status === "pending" && r.priority === "urgent" && isReferralOverdue(r.created_at)),
    [rows]
  );

  const flow = useMemo(() => {
    const resolved = rows.filter((r) => r.status === "resolved");
    const avgDays =
      resolved.length
        ? resolved.reduce((a, r) => a + (new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()), 0) /
          resolved.length /
          (24 * 60 * 60 * 1000)
        : null;
    const open = rows.filter((r) => r.status !== "resolved").sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    const oldest = open[0] ?? null;
    const perStudent = new Map<string, number>();
    for (const r of rows) perStudent.set(r.student_id, (perStudent.get(r.student_id) ?? 0) + 1);
    const repeats = [...perStudent.entries()]
      .filter(([, n]) => n > 1)
      .map(([id, n]) => ({ id, n, alias: aliases.get(id) ?? "Student" }))
      .sort((a, b) => b.n - a.n);
    const byPriority = (["low", "medium", "high", "urgent"] as const).map((p) => ({
      label: statusLabel(p),
      value: rows.filter((r) => r.priority === p).length,
      color: p === "urgent" ? "#EF4444" : p === "high" ? "#F59E0B" : p === "medium" ? "#3B82F6" : "#94A3B8",
    }));
    const pipeline = (["pending", "acknowledged", "in_progress", "resolved"] as const).map((s) => ({
      label: statusLabel(s),
      value: rows.filter((r) => r.status === s).length,
    }));
    return { avgDays, resolvedCount: resolved.length, oldest, repeats, byPriority, pipeline };
  }, [rows, aliases]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => (statusFilter === "all" ? true : r.status === statusFilter))
      .filter((r) => (priorityFilter === "all" ? true : r.priority === priorityFilter))
      .filter((r) =>
        assigneeFilter === "all"
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
  }, [rows, statusFilter, priorityFilter, assigneeFilter, query, aliases]);

  const counselorName = (id: string | null) =>
    !id ? "Unassigned" : (counselors.find((c) => c.id === id)?.name ?? "Counselor");

  const referrerLabel = (r: Referral): string => {
    if (r.referring_faculty_id) return facultyNames.get(r.referring_faculty_id) ?? "Faculty";
    return "Guidance office";
  };

  const shortReason = (r: string) => (r.length > 140 ? `${r.slice(0, 140)}…` : r);

  const act = async (ref: Referral, to: TriageKind, note?: string) => {
    if (!me) return;
    setBusyId(ref.id);
    try {
      await triageReferral(createClient(), { referralId: ref.id, actorProfileId: me, status: to, actionNote: note });
      const alias = aliases.get(ref.student_id) ?? "Student";
      const officeBody = `"${shortReason(ref.reason)}" — ${alias} · now ${statusLabel(to).toLowerCase()}.`;
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
    } catch {
      toast.error("Couldn't move that referral — please reload and try again.");
    } finally {
      setBusyId(null);
    }
  };

  const runConfirming = () => {
    if (!confirming) return;
    if (confirming.to === "escalated" && escalateNote.trim().length < 10) {
      setEscalateError("Say why this is urgent and what was already tried (at least 10 characters).");
      return;
    }
    const { ref, to } = confirming;
    const note = to === "escalated" ? escalateNote.trim() : undefined;
    setConfirming(null);
    setEscalateNote("");
    setEscalateError(null);
    void act(ref, to, note);
  };

  // Latest escalation moment per referral (for SLA chips).
  const escalatedAt = useMemo(() => {
    const m = new Map<string, string>();
    for (const [refId, actions] of trail) {
      const last = actions.find((a) => a.action === "escalated");
      if (last) m.set(refId, last.created_at);
    }
    return m;
  }, [trail]);

  const assign = async (ref: Referral, counselorId: string) => {
    if (!me || (ref.assigned_counselor_id ?? "") === counselorId) return;
    setBusyId(ref.id);
    try {
      await triageReferral(createClient(), {
        referralId: ref.id,
        actorProfileId: me,
        status: ref.status as TriageKind,
        assignedCounselorId: counselorId || null,
        actionNote: counselorId ? `Assigned to ${counselorName(counselorId)}` : "Unassigned",
      });
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
    } catch {
      toast.error("Couldn't assign that referral — please reload and try again.");
    } finally {
      setBusyId(null);
    }
  };

  const runEscalateAll = async () => {
    if (!me) return;
    setConfirmEscalateAll(false);
    setBusyId("__all__");
    try {
      const n = await escalateStaleUrgent(createClient(), me);
      toast.success(n ? `${n} stale urgent referral${n === 1 ? " was" : "s were"} escalated.` : "Nothing stale — all urgent referrals are fresh.");
      if (n > 0) {
        await notifyStaff(headIds, {
          type: "referral",
          title: `${n} stale urgent referral${n === 1 ? " was" : "s were"} auto-escalated`,
          body: "Urgent referrals sat unacknowledged over 24h. Review the escalated queue.",
          link: "/referrals",
        });
      }
      await reload();
    } catch {
      toast.error("Couldn't run auto-escalation — please try again.");
    } finally {
      setBusyId(null);
    }
  };

  if (!loading && (!role || !["counselor", "guidance_head", "faculty"].includes(role))) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">Referrals</h1>
        <Card><p className="text-sm text-ink-muted">Only counselors, the guidance head, and faculty can open referrals.</p></Card>
      </div>
    );
  }

  const statCards = [
    { label: "Total referrals", value: stats.total },
    { label: "Pending", value: stats.pending },
    { label: "In motion", value: stats.active },
    { label: "Resolved", value: stats.resolved },
    { label: "Escalated", value: stats.escalated },
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
        <h1 className="font-display text-2xl font-bold">Referrals</h1>
        <p className="mt-1 max-w-[600px] text-sm leading-relaxed text-ink-muted">
          {role === "faculty"
            ? "Flag a student for counseling follow-up — the office triages from here."
            : "The student referral inbox — acknowledge, assign, work, and resolve. Stale urgent cases surface up top."}
        </p>
      </div>

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

          {/* Overdue urgent */}
          {!loading && overdueList.length > 0 && (
            <Card className="border-red-300 bg-red-50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-bold text-red-800">
                    {overdueList.length} urgent referral{overdueList.length === 1 ? "" : "s"} unacknowledged over 24h
                  </h2>
                  <p className="mt-0.5 text-[13px] text-red-700">
                    {overdueList.map((r) => aliases.get(r.student_id) ?? "Student").join(", ")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busyId === "__all__"}
                  onClick={() => setConfirmEscalateAll(true)}
                >
                  Escalate all
                </Button>
              </div>
            </Card>
          )}

          {/* Resolution flow + priority mix */}
          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
              <h2 className="font-display text-base font-bold text-ink">Resolution flow</h2>
              <p className="mt-0.5 text-[13px] text-ink-muted">Where every referral sits in the pipeline.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {flow.pipeline.map((s, i) => (
                  <span key={s.label} className="flex items-center gap-2">
                    <span className="rounded-xl bg-cream px-3 py-2 text-center">
                      <span className="block font-display text-xl font-bold text-ink">{s.value}</span>
                      <span className="block text-[11px] font-bold text-ink-muted">{s.label}</span>
                    </span>
                    {i < flow.pipeline.length - 1 && (
                      <span aria-hidden className="font-bold text-ink-faint">→</span>
                    )}
                  </span>
                ))}
                {stats.escalated > 0 && (
                  <span className="rounded-xl bg-red-50 px-3 py-2 text-center ring-1 ring-red-200">
                    <span className="block font-display text-xl font-bold text-red-700">{stats.escalated}</span>
                    <span className="block text-[11px] font-bold text-red-600">Escalated</span>
                  </span>
                )}
              </div>
              <ul className="mt-3 space-y-1.5 text-[13px] text-ink-muted">
                <li>
                  Avg. time to resolve:{" "}
                  <span className="font-bold text-ink">
                    {flow.avgDays === null ? "—" : `${flow.avgDays.toFixed(1)} days (${flow.resolvedCount} resolved)`}
                  </span>
                </li>
                <li>
                  Oldest waiting:{" "}
                  <span className="font-bold text-ink">
                    {flow.oldest
                      ? `${aliases.get(flow.oldest.student_id) ?? "Student"} · ${timeAgo(flow.oldest.created_at)} (${statusLabel(flow.oldest.status)})`
                      : "inbox clear"}
                  </span>
                </li>
                <li>
                  Referred more than once:{" "}
                  <span className="font-bold text-ink">
                    {flow.repeats.length
                      ? flow.repeats.map((r) => `${r.alias} (${r.n})`).join(", ")
                      : "none — every referral is a first flag"}
                  </span>
                </li>
              </ul>
            </section>
            <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
              <h2 className="font-display text-base font-bold text-ink">Priority mix</h2>
              <p className="mt-0.5 text-[13px] text-ink-muted">Urgency across all referrals — red end first.</p>
              {rows.length ? (
                <ReportBars data={flow.byPriority} />
              ) : (
                <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[13px] text-ink-muted">No referrals yet.</p>
              )}
            </section>
          </div>

          {/* Filters */}
          <Card className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Dropdown
                menuKey="ref-status"
                openMenuKey={openMenuKey}
                onOpenChange={setOpenMenuKey}
                value={statusFilter}
                onChange={setStatusFilter}
                ariaLabel="Filter by status"
                options={[
                  { value: "all", label: "All statuses" },
                  ...STATUSES.map((s) => ({ value: s, label: statusLabel(s) })),
                ]}
              />
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
              <Dropdown
                menuKey="ref-assignee"
                openMenuKey={openMenuKey}
                onOpenChange={setOpenMenuKey}
                value={assigneeFilter}
                onChange={setAssigneeFilter}
                ariaLabel="Filter by assignee"
                options={[
                  { value: "all", label: "All assignees" },
                  { value: "unassigned", label: "Unassigned only" },
                  ...counselors.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
              <Input
                placeholder="Search reason or student…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="rounded-xl border border-ink/10 bg-cream px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Action legend</p>
              <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                {ACTION_LEGEND.map((l) => (
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
            <p className="text-xs font-medium text-ink-faint">
              Showing {visible.length} of {rows.length} referrals · {stats.urgent} urgent open.
            </p>
          </Card>

          {/* Board */}
          <div className="space-y-3">
            {loading &&
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-lg border border-ink/10 bg-white p-5 shadow-card" aria-hidden>
                  <div className="h-4 w-1/3 rounded-full bg-ink/10" />
                  <div className="mt-3 h-12 rounded-xl bg-ink/10" />
                </div>
              ))}
            {!loading &&
              visible.map((r) => {
                const history = trail.get(r.id) ?? [];
                const actions = NEXT_ACTIONS[r.status] ?? [];
                return (
                  <Card key={r.id} className="space-y-3">
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
                    <div className="grid gap-2 text-[13px] sm:grid-cols-3">
                      <p className="text-ink-muted">
                        Student <span className="font-bold text-ink">{aliases.get(r.student_id) ?? "Student"}</span>
                      </p>
                      <p className="text-ink-muted">
                        Referred by <span className="font-bold text-ink">{referrerLabel(r)}</span>
                      </p>
                      <div className="flex items-center gap-2 text-ink-muted">
                        <span className="shrink-0">Handling</span>
                        <Dropdown
                          menuKey={`ref-assign-${r.id}`}
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
                      </div>
                    </div>
                    {actions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {actions.map((s) => {
                          const Icon = ACTION_ICON[s];
                          return (
                            <IconAction
                              key={s}
                              label={statusLabel(s)}
                              variant={s === "escalated" ? "outline" : "accent"}
                              icon={Icon}
                              disabled={busyId === r.id}
                              onClick={() => setConfirming({ ref: r, to: s })}
                            />
                          );
                        })}
                      </div>
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
              <Card><p className="text-center text-sm text-ink-muted">No referrals match these filters.</p></Card>
            )}
          </div>
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
          <div aria-hidden className="absolute inset-0 bg-ink/40" onClick={() => { setConfirming(null); setEscalateNote(""); setEscalateError(null); }} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-card">
            <h2 id="ref-confirm-title" className="font-display text-lg font-bold text-ink">
              {TRIAGE_COPY[confirming.to].title}
            </h2>
            <p id="ref-confirm-desc" className="mt-1 text-sm leading-relaxed text-ink-muted">
              {TRIAGE_COPY[confirming.to].body}
            </p>
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
            <p className="mt-3 line-clamp-2 rounded-xl bg-cream px-3 py-2 text-[13px] font-semibold text-ink-soft">
              {aliases.get(confirming.ref.student_id) ?? "Student"} · {confirming.ref.reason}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => { setConfirming(null); setEscalateNote(""); setEscalateError(null); }} autoFocus>
                Back
              </Button>
              <Button
                size="sm"
                variant={confirming.to === "escalated" ? "danger" : "primary"}
                onClick={runConfirming}
              >
                {TRIAGE_COPY[confirming.to].ok}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Escalate-all confirm */}
      {confirmEscalateAll && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="ref-escall-title"
        >
          <div aria-hidden className="absolute inset-0 bg-ink/40" onClick={() => setConfirmEscalateAll(false)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-card">
            <h2 id="ref-escall-title" className="font-display text-lg font-bold text-ink">
              Escalate {overdueList.length} stale referral{overdueList.length === 1 ? "" : "s"}?
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              Every urgent referral unacknowledged over 24h moves to Escalated and is logged in the trail.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirmEscalateAll(false)} autoFocus>
                Back
              </Button>
              <Button size="sm" variant="danger" onClick={runEscalateAll}>
                Escalate all
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
