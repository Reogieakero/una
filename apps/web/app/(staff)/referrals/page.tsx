"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, BarChart3, Check, CheckCheck, ChevronDown, Eye, Info, LayoutGrid, List, Loader2, X } from "lucide-react";
import { createReferralSchema, type CreateReferralInput } from "@dorsu/shared-schemas";
import { createClient } from "@/lib/supabase/client";
import { useReferralsBoard } from "@/lib/hooks/use-referrals-board";
import {
  assignReferral,
  confirmReferralWithSession,
  createReferral,
  isMeetUrl,
  REFERRAL_SCHEDULE_NOTE_PREFIX,
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

const EMPTY_ROWS: Referral[] = [];
const EMPTY_TRAIL = new Map<string, RefAction[]>();
const EMPTY_MAP = new Map<string, string>();
const EMPTY_COUNSELORS: { id: string; name: string }[] = [];
const EMPTY_IDS: string[] = [];
const EMPTY_STUDENTS: { id: string; label: string }[] = [];
const EMPTY_READY = new Set<string>();

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
  return days === 1 ? "yesterday" : `${days}d ago`;
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
 * Schedule display — the counselor-set session time is stored as a
 * structured trail note (REFERRAL_SCHEDULE_NOTE_PREFIX + ISO) on the
 * confirm action, and parsed back here. Confirming also mints the real
 * session row (see confirmReferralWithSession), so the note and the
 * calendar always agree.
 */
function parseScheduleNote(note: string | null): string | null {
  if (!note || !note.startsWith(REFERRAL_SCHEDULE_NOTE_PREFIX)) return null;
  const candidate = note.slice(REFERRAL_SCHEDULE_NOTE_PREFIX.length).trim().split(" ")[0];
  const d = new Date(candidate);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const HEAD_LEGEND: { icon: typeof Check; label: string; desc: string; variant: "accent" | "outline" }[] = [
  { icon: Check, label: "Assign", desc: "Pending → assigned", variant: "accent" },
  { icon: X, label: "Reject", desc: "Pending → rejected", variant: "outline" },
];

const COUNSELOR_LEGEND: { icon: typeof Check; label: string; desc: string; variant: "accent" | "outline" }[] = [
  { icon: Check, label: "Confirm", desc: "Assigned → confirmed + creates session", variant: "accent" },
  { icon: CheckCheck, label: "Resolve", desc: "Confirmed → resolved (once session time passes)", variant: "accent" },
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

/**
 * Hover/click floating filter menu — the same behavior as the Stats menu
 * on /appointments: opens on hover or click, closes on mouse leave (short
 * grace), outside click, Escape, or pick.
 */
/** Session time still in the future — Resolve unlocks once it passes (mirrors /appointments). */
function isSessionUpcoming(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t > Date.now();
}

// SSR-safe layout effect (this page server-renders, effects run on client).
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Viewport-clamped floating panel position.
 * Panels render `position: fixed` (never absolute), so an open menu can never
 * stretch the page and force a horizontal scrollbar. Coordinates come from the
 * anchor's rect, clamped to 8px page margins, and follow scroll/resize while
 * open. Hover/click/outside-click/Escape behavior is unchanged — the panel
 * stays a DOM child of its anchor wrapper.
 */
function useClampedPanel(
  open: boolean,
  anchorRef: { current: HTMLElement | null },
  width: number,
  prefer: "left" | "right" = "left"
) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const w = Math.min(width, window.innerWidth - 16);
      const raw = prefer === "right" ? r.right - w : r.left;
      const left = Math.max(8, Math.min(raw, window.innerWidth - w - 8));
      setPos({ top: r.bottom + 8, left, width: w });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef, width, prefer]);

  return pos;
}

function HoverMenu({
  buttonLabel,
  ariaLabel,
  options,
  value,
  onPick,
  align = "left",
}: {
  buttonLabel: React.ReactNode;
  ariaLabel: string;
  options: { value: string; label: string }[];
  value: string;
  onPick: (v: string) => void;
  /** Menu edge — preferred side; the panel is viewport-clamped either way. */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelPos = useClampedPanel(open, ref, 224, align);

  const openMenu = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  };
  const scheduleClose = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 150);
  };
  const toggle = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open ]);

  return (
    <div ref={ref} className="shrink-0" onMouseEnter={openMenu} onMouseLeave={scheduleClose}>
      <button
        type="button"
        onClick={toggle}
        onFocus={openMenu}
        onBlur={scheduleClose}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3.5 py-1.5 text-[13px] font-bold text-ink-soft shadow-card transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      >
        <span className="max-w-44 truncate">{buttonLabel}</span>
        <ChevronDown aria-hidden className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          style={{ top: panelPos?.top, left: panelPos?.left, width: panelPos?.width ?? 224 }}
          className="menu-scroll fixed z-50 max-h-60 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-xl border border-ink/10 bg-white py-1 shadow-card"
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <li key={o.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-[13px] transition hover:bg-cream focus-visible:outline-none focus-visible:bg-cream",
                    active ? "font-bold text-primary-700" : "font-medium text-ink-soft hover:text-ink"
                  )}
                >
                  <span className="truncate">{o.label}</span>
                  {active && <Check aria-hidden className="h-4 w-4 shrink-0 text-primary-600" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}const TRIAGE_COPY: Record<TriageKind, { title: string; body: string; ok: string }> = {
  confirmed: { title: "Confirm and schedule this session?", body: "Set the final session date and time plus how you'll meet. Confirming creates the session itself — the student is notified with the schedule.", ok: "Confirm session" },
  resolved: { title: "Resolve this referral?", body: "Closes the loop — the student needs a confirmed session with a schedule first, and the session time must have passed. Resolve stays blocked until then.", ok: "Resolve" },
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
  assigned: [],
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const [query, setQuery] = useState("");
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ ref: Referral; to: TriageKind } | null>(null);
  // Triage dialog busy flag — the dialog stays open with a spinner while the
  // move (confirm mints a session + notifies) is processing.
  const [confirmBusy, setConfirmBusy] = useState(false);
  // Ref mirror for the Escape handler (its effect doesn't re-subscribe on busy).
  const confirmBusyRef = useRef(false);
  const [reasonRef, setReasonRef] = useState<Referral | null>(null);
  const [escalateNote, setEscalateNote] = useState("");
  const [escalateError, setEscalateError] = useState<string | null>(null);
  const [scheduleInput, setScheduleInput] = useState("");
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState<"in_person" | "online">("in_person");
  const [meetInput, setMeetInput] = useState("");
  const [meetError, setMeetError] = useState<string | null>(null);
  const [studentPick, setStudentPick] = useState("");

  const { register, handleSubmit, formState, reset, setValue, watch } = useForm<CreateReferralInput>({
    resolver: zodResolver(createReferralSchema),
    defaultValues: { priority: "medium" },
  });
  const priorityValue = watch("priority") ?? "medium";

  // Stats live in a floating panel — same hover/click behavior as the
  // /appointments Stats menu. Closes on mouse leave, outside click, or Escape.
  const [statsOpen, setStatsOpen] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  const statsCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openStats = () => {
    if (statsCloseTimer.current) clearTimeout(statsCloseTimer.current);
    setStatsOpen(true);
  };
  const scheduleStatsClose = () => {
    if (statsCloseTimer.current) clearTimeout(statsCloseTimer.current);
    statsCloseTimer.current = setTimeout(() => setStatsOpen(false), 150);
  };
  const toggleStats = () => {
    if (statsCloseTimer.current) clearTimeout(statsCloseTimer.current);
    setStatsOpen((v) => !v);
  };

  useEffect(() => {
    if (!statsOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (statsRef.current && !statsRef.current.contains(e.target as Node)) setStatsOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStatsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      if (statsCloseTimer.current) clearTimeout(statsCloseTimer.current);
    };
  }, [statsOpen]);

  // Viewport-clamped (fixed) positions — open panels can never widen the page.
  const statsPos = useClampedPanel(statsOpen, statsRef, 288, "right");

  // Actions legend in its own floating panel beside Stats — same hover/click
  // behavior. One item per line (never horizontal).
  const [legendOpen, setLegendOpen] = useState(false);
  const legendRef = useRef<HTMLDivElement>(null);
  const legendCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openLegend = () => {
    if (legendCloseTimer.current) clearTimeout(legendCloseTimer.current);
    setLegendOpen(true);
  };
  const scheduleLegendClose = () => {
    if (legendCloseTimer.current) clearTimeout(legendCloseTimer.current);
    legendCloseTimer.current = setTimeout(() => setLegendOpen(false), 150);
  };
  const toggleLegend = () => {
    if (legendCloseTimer.current) clearTimeout(legendCloseTimer.current);
    setLegendOpen((v) => !v);
  };

  useEffect(() => {
    if (!legendOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (legendRef.current && !legendRef.current.contains(e.target as Node)) setLegendOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLegendOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      if (legendCloseTimer.current) clearTimeout(legendCloseTimer.current);
    };
  }, [legendOpen]);

  const legendPos = useClampedPanel(legendOpen, legendRef, 320, "right");

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
    // Resolve unlocks once the counselor-set session time passes (mirrors
    // the appointment page's Upcoming session rule).
    if (to === "resolved" && isSessionUpcoming(sessionSchedule.get(ref.id))) {
      toast.error("Session hasn't happened yet — resolve unlocks once the session time passes.");
      return;
    }
    setConfirming({ ref, to });
  };

  const act = async (
    ref: Referral,
    to: TriageKind,
    note?: string,
    opts?: { scheduledIso?: string; mode?: "in_person" | "online"; meetingUrl?: string | null }
  ) => {
    if (!me) return;
    setBusyId(ref.id);
    try {
      const db = createClient();
      // Counselor confirm mints the session itself (assigned/escalated →
      // confirmed + a confirmed appointments row via source_referral_id),
      // so the board, the calendar, and the resolve gate always agree.
      // The schedule note keeps the human-readable trail alongside it.
      if (to === "confirmed" && opts?.scheduledIso) {
        await confirmReferralWithSession(db, {
          referralId: ref.id,
          actorProfileId: me,
          scheduledAt: new Date(opts.scheduledIso),
          mode: opts.mode ?? "in_person",
          meetingUrl: opts.meetingUrl ?? null,
        });
      } else if (to === "rejected") await rejectReferral(db, ref.id, me);
      else await triageReferral(db, { referralId: ref.id, actorProfileId: me, status: to, actionNote: note });
      const alias = aliases.get(ref.student_id) ?? "Student";
      const when = opts?.scheduledIso ? formatWhen(opts.scheduledIso) : null;
      const officeBody = `"${shortReason(ref.reason)}" — ${alias} · now ${statusLabel(to).toLowerCase()}${when ? ` · session ${when}` : ""}.`;
      if (to === "confirmed" && when) {
        // Student + referrer + heads hear the counselor-set schedule.
        await notifyStaff([studentProfiles.get(ref.student_id)], {
          type: "appointment",
          title: "Session confirmed",
          body: `Your session is scheduled on ${when}${opts?.mode === "online" && opts?.meetingUrl ? `. Join here: ${opts.meetingUrl}` : ""}. See you then!`,
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
      await refetch();
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
    } catch (e) {
      toast.error(
        e instanceof Error && /confirmed session|sessions must be|valid session|meet link|only the (assigned|handling)|only pending|unassign|unknown session|can't (move|assign|unassign|reject|confirm|resolve|escalate|acknowledge|start|triage)/i.test(e.message)
          ? e.message
          : "Couldn't move that referral — please reload and try again."
      );
    } finally {
      setBusyId(null);
    }
  };

  const runConfirming = async () => {
    if (!confirming || confirmBusy) return;
    if (confirming.to === "resolved" && !canResolve(confirming.ref)) {
      toast.error(NO_SESSION_MSG);
      return;
    }
    if (confirming.to === "resolved" && isSessionUpcoming(sessionSchedule.get(confirming.ref.id))) {
      toast.error("Session hasn't happened yet — resolve unlocks once the session time passes.");
      return;
    }
    // Counselor schedules the final session time on confirm — same gate
    // as the appointment page, plus the mode (Meet link required online).
    // Confirming mints the session row itself.
    let scheduledIso: string | undefined;
    let meetingUrl: string | null = null;
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
    confirmBusyRef.current = true;
    setConfirmBusy(true);
    try {
      await act(ref, to, note, { scheduledIso, mode: sessionMode, meetingUrl });
    } finally {
      confirmBusyRef.current = false;
      setConfirmBusy(false);
      setConfirming(null);
      setEscalateNote("");
      setEscalateError(null);
      setScheduleInput("");
      setScheduleError(null);
      setSessionMode("in_person");
      setMeetInput("");
      setMeetError(null);
    }
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
      await refetch();
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
      setSessionMode("in_person");
      setMeetInput("");
      setMeetError(null);
    }
    if (!confirming) return;
    if (confirming.to !== "escalated") setEscalateError(null);
    const onKey = (e: KeyboardEvent) => {
      // Never dismiss mid-processing — the spinner owns the dialog until done.
      if (e.key === "Escape" && !confirmBusyRef.current) {
        setConfirming(null);
        setEscalateNote("");
        setEscalateError(null);
        setScheduleInput("");
        setScheduleError(null);
        setSessionMode("in_person");
        setMeetInput("");
        setMeetError(null);
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

  const resetFilters = () => {
    setStatusFilter("all");
    setPriorityFilter("all");
    setAssigneeFilter("all");
    setQuery("");
  };

  const statCards = [
    { label: isCounselor ? "My referrals" : "Total referrals", value: stats.total, pick: resetFilters },
    { label: "Pending", value: stats.pending, pick: () => setStatusFilter("pending") },
    { label: "Assigned", value: stats.assigned, pick: () => setStatusFilter("assigned") },
    { label: "Confirmed", value: stats.confirmed, pick: () => setStatusFilter("confirmed") },
    { label: "Resolved", value: stats.resolved, pick: () => setStatusFilter("resolved") },
    { label: "Unassigned", value: stats.unassigned, pick: () => setAssigneeFilter("unassigned") },
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
                  ? "Flag a student for counseling follow-up — the office triages from here."
                  : isCounselor
                    ? "Your assigned queue — confirm assigned referrals: setting the schedule creates the session itself (student notified), then resolve once the session time passes. Cancels and reschedules come from the student."
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
          <div ref={statsRef} onMouseEnter={openStats} onMouseLeave={scheduleStatsClose}>
            <button
              type="button"
              onClick={toggleStats}
              onFocus={openStats}
              onBlur={scheduleStatsClose}
              aria-haspopup="dialog"
              aria-expanded={statsOpen}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3.5 py-2 text-[13px] font-bold text-ink-soft shadow-card transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <BarChart3 className="h-4 w-4" aria-hidden />
              Stats
              <ChevronDown
                aria-hidden
                className={cn("h-4 w-4 transition-transform", statsOpen && "rotate-180")}
              />
            </button>
            {statsOpen && (
              <div
                role="dialog"
                aria-label="Referral stats"
                style={{ top: statsPos?.top, left: statsPos?.left, width: statsPos?.width ?? 288 }}
                className="fixed z-50 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-ink/10 bg-white py-1 shadow-card"
              >
                {loading ? (
                  <div className="animate-pulse px-4 py-3" aria-hidden>
                    <div className="h-10 rounded-lg bg-ink/10" />
                    <div className="mt-2 h-10 rounded-lg bg-ink/10" />
                    <div className="mt-2 h-10 rounded-lg bg-ink/10" />
                  </div>
                ) : (
                  statCards.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => {
                        s.pick();
                        setStatsOpen(false);
                      }}
                      title={`Filter by ${s.label}`}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-cream focus-visible:outline-none focus-visible:bg-cream"
                    >
                      <span className="text-[13px] font-medium text-ink-muted">{s.label}</span>
                      <span className="font-display text-xl font-bold text-ink">{s.value}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          {canSeeActions && (
            <div ref={legendRef} onMouseEnter={openLegend} onMouseLeave={scheduleLegendClose}>
              <button
                type="button"
                onClick={toggleLegend}
                onFocus={openLegend}
                onBlur={scheduleLegendClose}
                aria-haspopup="dialog"
                aria-expanded={legendOpen}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3.5 py-2 text-[13px] font-bold text-ink-soft shadow-card transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <Info className="h-4 w-4" aria-hidden />
                {role === "guidance_head" ? "Admin actions" : "Counselor actions"}
                <ChevronDown
                  aria-hidden
                  className={cn("h-4 w-4 transition-transform", legendOpen && "rotate-180")}
                />
              </button>
              {legendOpen && (
                <div
                  role="dialog"
                  aria-label={role === "guidance_head" ? "Admin actions legend" : "Counselor actions legend"}
                  style={{ top: legendPos?.top, left: legendPos?.left, width: legendPos?.width ?? 320 }}
                  className="fixed z-50 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-ink/10 bg-white px-4 py-3 shadow-card"
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    {role === "guidance_head" ? "Admin actions" : "Counselor actions"}
                  </p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {(role === "guidance_head" ? HEAD_LEGEND : COUNSELOR_LEGEND).map((l) => (
                      <li key={l.label} className="flex items-center gap-2 text-[13px]">
                        <span
                          aria-hidden
                          className={
                            l.variant === "accent"
                              ? "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-400 text-ink"
                              : "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink/15 bg-white text-ink"
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
            </div>
          )}
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
        <>
          {/* Board — filters live inside, above the referral list */}
          <Card className="p-0">
            {loading ? (
              <div className="p-4 sm:px-5" aria-hidden>
                <div className="flex animate-pulse flex-wrap items-center gap-3">
                  <div className="h-10 w-full rounded-full bg-ink/10 sm:w-56" />
                  <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
                    <div className="h-9 w-32 rounded-full bg-ink/10" />
                    <div className="h-9 w-32 rounded-full bg-ink/10" />
                  </div>
                </div>
                <div className="mt-4 animate-pulse space-y-3">
                  <div className="h-12 rounded-xl bg-ink/10" />
                  <div className="h-12 rounded-xl bg-ink/10" />
                  <div className="h-12 rounded-xl bg-ink/10" />
                  <div className="h-12 rounded-xl bg-ink/10" />
                </div>
              </div>
            ) : (
              <>
            <div className="flex flex-wrap items-center gap-3 p-4 sm:px-5">
              <Input
                placeholder="Search reason or student…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full sm:w-56"
              />
              <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
                <HoverMenu
                  ariaLabel="Filter by status"
                  buttonLabel={<>Status: {statusFilter === "all" ? "All" : statusLabel(statusFilter)}</>}
                  options={["all", ...STATUSES].map((s) => ({ value: s, label: s === "all" ? "All" : statusLabel(s) }))}
                  value={statusFilter}
                  onPick={setStatusFilter}
                />
                <HoverMenu
                  ariaLabel="Filter by priority"
                  buttonLabel={
                    <>Priority: {priorityFilter === "all" ? "All" : statusLabel(priorityFilter)}</>
                  }
                  options={[
                    { value: "all", label: "All priorities" },
                    ...PRIORITIES.map((p) => ({ value: p, label: statusLabel(p) })),
                  ]}
                  value={priorityFilter}
                  onPick={setPriorityFilter}
                />
                {role !== "counselor" && (
                  <HoverMenu
                    ariaLabel="Filter by assignee"
                    buttonLabel={
                      <>
                        Counselor:{" "}
                        {assigneeFilter === "all"
                          ? "All"
                          : assigneeFilter === "unassigned"
                            ? "Unassigned"
                            : (counselors.find((c) => c.id === assigneeFilter)?.name ?? "All")}
                      </>
                    }
                    options={[
                      { value: "all", label: "All counselors" },
                      { value: "unassigned", label: "Unassigned only" },
                      ...counselors.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                    value={assigneeFilter}
                    onPick={setAssigneeFilter}
                  />
                )}
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
            </div>
            <p className="px-4 text-xs font-medium text-ink-faint sm:px-5">
              Showing {visible.length} of {mine.length} referrals · student names stay private (aliases only).
            </p>

          {/* Board — list */}
          {view === "list" && (
          <div className="mt-3 overflow-x-auto">
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
                  // Resolve unlocks once the counselor-set session time passes.
                  const upcoming = isSessionUpcoming(sessionSchedule.get(r.id));
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
                            {/* Admin: assign happens in the Counselor column; reject lives here (pending only). */}
                            {canReject && r.status === "pending" && (
                              <IconAction label="Reject" variant="outline" icon={X} disabled={busyId === r.id} onClick={() => askConfirm(r, "rejected")} />
                            )}
                            {canReject && r.status === "assigned" && (
                              <span className="text-xs font-medium text-ink-faint">Assigned — unassign to reject</span>
                            )}
                            {/* Counselor: assigned → confirmed → resolved / escalated (resolve after session time). */}
                            {isCounselor && r.status === "confirmed" && upcoming && (
                              <span className="text-xs font-medium text-ink-faint">Upcoming session</span>
                            )}
                            {isCounselor &&
                              !(r.status === "confirmed" && upcoming) &&
                              actions.map((s) => {
                                if (s === "resolved" && upcoming) return null;
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
            {!visible.length && (
              <p className="px-4 py-8 text-center text-sm text-ink-muted">
                No referrals match these filters. Try clearing the search or choosing another status.
              </p>
            )}
          </div>
          )}

          {/* Board — grid cards with real labeled buttons */}
          {view === "grid" && (
            <div className="grid gap-4 p-4 sm:px-5 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((r) => {
                  const history = trail.get(r.id) ?? [];
                  const actions = roleActions(r.status);
                  // Resolve unlocks once the counselor-set session time passes.
                  const upcoming = isSessionUpcoming(sessionSchedule.get(r.id));
                  const showUpcoming = isCounselor && r.status === "confirmed" && upcoming;
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
                      {showUpcoming ? (
                        <p className="text-xs font-medium text-ink-faint">Upcoming session</p>
                      ) : actions.length > 0 || (canReject && r.status === "pending") ? (
                        <div className="flex flex-wrap gap-2">
                          {/* Admin: assign happens in the Handling row; reject lives here (pending only). */}
                          {canReject && r.status === "pending" && (
                            <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => askConfirm(r, "rejected")}>
                              {TRIAGE_COPY.rejected.ok}
                            </Button>
                          )}
                          {/* Counselor: assigned → confirmed → resolved / escalated (resolve after session time). */}
                          {isCounselor &&
                            actions.map((s) => {
                              if (s === "resolved" && upcoming) return null;
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
                          {r.status === "assigned" && canReject && "Assigned — unassign to reject."}
                          {(r.status === "assigned" || r.status === "confirmed" || r.status === "escalated") && !isCounselor && !canReject && "Waiting for counselor confirmation."}
                          {(r.status === "confirmed" || r.status === "escalated") && canReject && "Waiting for counselor confirmation."}
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
              {!visible.length && (
                <Card><p className="text-center text-sm text-ink-muted">No referrals match these filters. Try clearing the search or choosing another status.</p></Card>
              )}
            </div>
          )}
              </>
            )}
          </Card>
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
              refetch().catch(() => {});
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
          <div aria-hidden className="absolute inset-0 bg-ink/40" onClick={() => { if (confirmBusyRef.current) return; setConfirming(null); setEscalateNote(""); setEscalateError(null); setScheduleInput(""); setScheduleError(null); setSessionMode("in_person"); setMeetInput(""); setMeetError(null); }} />
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
                    onOpenChange={setOpenMenuKey}
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
              <Button size="sm" variant="outline" disabled={confirmBusy} onClick={() => { setConfirming(null); setEscalateNote(""); setEscalateError(null); setScheduleInput(""); setScheduleError(null); setSessionMode("in_person"); setMeetInput(""); setMeetError(null); }} autoFocus>
                Back
              </Button>
              <Button
                size="sm"
                variant={confirming.to === "escalated" || confirming.to === "rejected" ? "danger" : "primary"}
                disabled={confirmBusy}
                onClick={runConfirming}
              >
                {confirmBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {confirmBusy ? "Processing…" : TRIAGE_COPY[confirming.to].ok}
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
