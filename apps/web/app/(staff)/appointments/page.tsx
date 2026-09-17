"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BarChart3, CalendarDays, Check, CheckCheck, ChevronDown, Info, Loader2, MapPin, UserX, Video, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  assignAppointment,
  completeAppointment,
  confirmAppointment,
  isMeetUrl,
  markAppointmentNoShow,
  rejectAppointment,
} from "@dorsu/shared-services";
import { useAppointmentsBoard } from "@/lib/hooks/use-appointments-board";
import { Badge, Button, Card, Input } from "@/components/ui/primitives";
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

const EMPTY_APPTS: Appt[] = [];
const EMPTY_MAP = new Map<string, string>();
const EMPTY_IDS: string[] = [];
const EMPTY_COUNSELORS: CounselorOpt[] = [];

const STATUSES = ["pending", "assigned", "confirmed", "completed", "cancelled", "rejected", "no_show"] as const;

function statusTone(s: string): "info" | "success" | "warning" | "danger" | "muted" {
  if (s === "completed") return "success";
  if (s === "cancelled") return "muted";
  if (s === "rejected" || s === "no_show") return "danger";
  if (s === "assigned" || s === "confirmed") return "info";
  return "warning";
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

/** Full schedule line for the detail modal — "Friday, March 6 · 2:00 PM". */
function formatLong(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

/** Terminal-ish states whose schedule is the counselor-set final time. */
function hasSetSchedule(status: string): boolean {
  return ["confirmed", "completed", "no_show"].includes(status);
}

/** Session time still in the future — Complete / No-show unlock once it passes. */
function isUpcomingSession(iso: string): boolean {
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t > Date.now();
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
  { icon: X, label: "Reject", desc: "Pending → rejected", variant: "outline" },
];

const COUNSELOR_LEGEND: { icon: typeof Check; label: string; desc: string; variant: "accent" | "outline" }[] = [
  { icon: Check, label: "Confirm", desc: "Assigned → confirmed + set schedule (+ Meet link when online)", variant: "accent" },
  { icon: CheckCheck, label: "Complete", desc: "Confirmed → completed (once session time passes)", variant: "accent" },
  { icon: UserX, label: "No-show", desc: "Confirmed, student didn't arrive (once session time passes)", variant: "outline" },
];

type ActionKind = "confirm" | "complete" | "no-show" | "reject";

const ACTION_DEFS: Record<
  ActionKind,
  {
    fn: (db: ReturnType<typeof createClient>, apptId: string, scheduledAt?: Date, meetingUrl?: string | null) => Promise<unknown>;
    fail: string;
    doneTitle: string;
    doneBody: (when: string) => string;
    /** Staff-facing success toast line shown to the actor on success. */
    okBody: (when: string) => string;
  }
> = {
  confirm: {
    fn: confirmAppointment,
    fail: "confirm this session",
    doneTitle: "Session confirmed",
    doneBody: (when) => `Your session is scheduled on ${when}. See you then!`,
    okBody: (when) => `Scheduled on ${when} — student notified.`,
  },
  complete: {
    fn: completeAppointment,
    fail: "complete this session",
    doneTitle: "Session completed",
    doneBody: (when) => `Your session on ${when} is marked complete. Feedback helps us improve.`,
    okBody: (when) => `Session on ${when} marked complete.`,
  },
  reject: {
    fn: rejectAppointment,
    fail: "reject this session",
    doneTitle: "Session rejected",
    doneBody: (when) => `Your session request for ${when} was declined by the office. Contact guidance for alternatives.`,
    okBody: (when) => `Request for ${when} declined — student notified.`,
  },
  "no-show": {
    fn: (db, apptId) => markAppointmentNoShow(db, apptId),
    fail: "mark no-show",
    doneTitle: "Marked as no-show",
    doneBody: (when) => `You were marked as no-show for ${when}. Contact the office to rebook.`,
    okBody: (when) => `Marked no-show for ${when}.`,
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

/**
 * Hover/click floating filter menu — 100% the same behavior as the Stats
 * menu: opens on hover or click, closes on mouse leave (short grace),
 * outside click, Escape, or pick. Used by the status / mode / counselor
 * filters so every dropdown on this page feels identical.
 */
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
}

/**
 * Shared /appointments — one URL, strict role-aware UI.
 * Admin (guidance_head): assign counselor (pending → assigned) + reject
 *   pending requests only (assigned rows must be unassigned first).
 *   Never confirm / complete / no-show — those belong to the counselor.
 * Counselor: confirm assigned → confirmed (sets final session time/date,
 *   student notified), then complete / no-show.
 *   Never assign / reject / cancel.
 * Student: cancel + reschedule from the mobile app (never complete).
 */
export default function AppointmentsPage() {
  const { data: board, isLoading, isError, refetch } = useAppointmentsBoard();
  const role = board?.role ?? null;
  const counselorId = board?.counselorId ?? null;
  const rows = board?.appointments ?? EMPTY_APPTS;
  const aliases = board?.aliases ?? EMPTY_MAP;
  const studentProfiles = board?.studentProfiles ?? EMPTY_MAP;
  const headIds = board?.headIds ?? EMPTY_IDS;
  const counselors = board?.counselors ?? EMPTY_COUNSELORS;
  const loading = isLoading && !board;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ appt: Appt; kind: ActionKind } | null>(null);
  // Confirm dialog busy flag — the dialog stays open with a spinner while the
  // move is processing. Ref mirror guards the Escape handler.
  const [confirmBusy, setConfirmBusy] = useState(false);
  const confirmBusyRef = useRef(false);
  // Row detail modal — any row opens it; interactive cells stop propagation.
  const [detail, setDetail] = useState<Appt | null>(null);
  const [scheduleInput, setScheduleInput] = useState("");
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [meetingInput, setMeetingInput] = useState("");
  const [meetingError, setMeetingError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [counselorFilter, setCounselorFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  // Shared portal Dropdown state — only the in-table assign-counselor menus
  // use it now (their scroll container would clip an anchored menu).
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);

  // Stats live in a floating panel — same hover/click behavior as the admin
  // dashboard Stats menu. Closes on mouse leave, outside click, or Escape.
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

  // Status filter — same HoverMenu as mode / counselor below.

  useEffect(() => {
    if (isError) toast.error("Couldn't load appointments right now.");
  }, [isError]);

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
      unassigned: mine.filter((a) => !a.counselor_id && !["completed", "cancelled", "rejected", "no_show"].includes(a.status)).length,
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
      if (role) await refetch();
      return true;
    } catch (e) {
      toast.error(
        e instanceof Error && /future|valid session|meet link|database update|migration|meeting_url|only assigned|only pending|unassign|not found/i.test(e.message)
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
      // Never dismiss mid-processing — the spinner owns the dialog until done.
      if (e.key === "Escape" && !confirmBusyRef.current) {
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
    if (confirmBusyRef.current) return;
    setConfirming(null);
    setMeetingInput("");
    setMeetingError(null);
  };

  // Detail modal: Escape closes, background stays put while open. Scroll-lock
  // is skipped when the confirm dialog already holds it.
  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetail(null);
    };
    document.addEventListener("keydown", onKey);
    if (confirming) return () => document.removeEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [detail, confirming]);

  const runConfirming = async () => {
    if (!confirming || confirmBusyRef.current) return;
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
    // Keep the dialog open with a spinner until the move lands, then pop a
    // success toast so the actor knows it went through.
    confirmBusyRef.current = true;
    setConfirmBusy(true);
    try {
      if (await act(appt.id, def.fn, def.fail, scheduledAt, meetingUrl)) {
        // Student + heads are notified with the counselor-set schedule (and
        // the Meet link for online sessions).
        const studentBody =
          kind === "confirm" && meetingUrl
            ? `${def.doneBody(when)} Join here: ${meetingUrl}`
            : def.doneBody(when);
        void notifyStudent(appt, def.doneTitle, studentBody);
        void notifyHeadsAppt({ ...appt, scheduled_at: scheduledAt?.toISOString() ?? appt.scheduled_at }, kind);
        toast.success(def.doneTitle, { description: def.okBody(when), position: "top-right" });
      }
    } finally {
      confirmBusyRef.current = false;
      setConfirmBusy(false);
      setConfirming(null);
      setMeetingInput("");
      setMeetingError(null);
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
    { label: role === "counselor" ? "My sessions" : "Total sessions", value: stats.total, pick: () => { setStatusFilter("all"); setCounselorFilter("all"); } },
    { label: "Pending", value: stats.pending, pick: () => setStatusFilter("pending") },
    { label: "Assigned", value: stats.assigned, pick: () => setStatusFilter("assigned") },
    { label: "Confirmed", value: stats.confirmed, pick: () => setStatusFilter("confirmed") },
    { label: "Completed", value: stats.completed, pick: () => setStatusFilter("completed") },
    { label: "Unassigned", value: stats.unassigned, pick: () => setCounselorFilter("unassigned") },
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

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold">
            {role === "counselor" ? "My appointments" : "Appointments"}
          </h1>
          <p className="mt-1 max-w-[600px] text-sm leading-relaxed text-ink-muted">
            {role === "counselor"
              ? "Your assigned queue — confirm assigned bookings and set the session schedule (student notified), then mark confirmed ones complete or no-show. Cancels and reschedules come from the student."
              : "Office-wide session board — assign a counselor (pending → assigned) or reject pending requests (unassign assigned ones first). Confirm / complete / no-show belong to the counselor; cancel / reschedule belong to the student."}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
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
              aria-label="Appointment stats"
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
        </div>
      </div>

      {/* Board — filters live inside, above the student table */}
      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 p-4 sm:px-5">
          <Input
            placeholder="Search concern or student alias…"
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
            ariaLabel="Filter by mode"
            buttonLabel={
              <>Mode: {modeFilter === "all" ? "All" : modeFilter === "in_person" ? "In person" : "Online"}</>
            }
            options={[
              { value: "all", label: "All modes" },
              { value: "in_person", label: "In person" },
              { value: "online", label: "Online" },
            ]}
            value={modeFilter}
            onPick={setModeFilter}
          />
          {role !== "counselor" && (
            <HoverMenu
              ariaLabel="Filter by counselor"
              align="right"
              buttonLabel={
                <>
                  Counselor:{" "}
                  {counselorFilter === "all"
                    ? "All"
                    : counselorFilter === "unassigned"
                      ? "Unassigned"
                      : (counselors.find((c) => c.id === counselorFilter)?.name ?? "All")}
                </>
              }
              options={[
                { value: "all", label: "All counselors" },
                { value: "unassigned", label: "Unassigned only" },
                ...counselors.map((c) => ({ value: c.id, label: c.name })),
              ]}
              value={counselorFilter}
              onPick={setCounselorFilter}
            />
          )}
          </div>
        </div>
        <div className="overflow-x-auto">
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
              <tr
                key={a.id}
                onClick={() => setDetail(a)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDetail(a);
                  }
                }}
                tabIndex={0}
                title="View session details"
                aria-label={`View details for the session on ${formatWhen(a.scheduled_at)}`}
                className="cursor-pointer border-b border-ink/5 align-top transition-colors last:border-0 hover:bg-cream/60 focus-visible:outline-none focus-visible:bg-cream"
              >
                <td className="whitespace-nowrap px-4 py-3 font-semibold">{formatWhen(a.scheduled_at)}</td>
                <td className="whitespace-nowrap px-4 py-3">{aliases.get(a.student_id) ?? "Student"}</td>
                <td
                  className="px-4 py-3"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
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
                      onClick={(e) => e.stopPropagation()}
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
                  <td
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {/* Admin: assign happens in the Counselor column; reject lives here (pending only). */}
                      {canReject && a.status === "pending" && (
                        <IconAction label="Reject" variant="outline" icon={X} disabled={busyId === a.id} onClick={() => setConfirming({ appt: a, kind: "reject" })} />
                      )}
                      {canReject && a.status === "assigned" && (
                        <span className="text-xs font-medium text-ink-faint">Assigned — unassign to reject</span>
                      )}
                      {/* Counselor: assigned → confirmed → completed / no-show (after session time). */}
                      {isCounselor && a.status === "assigned" && (
                        <IconAction label="Confirm" variant="accent" icon={Check} disabled={busyId === a.id} onClick={() => setConfirming({ appt: a, kind: "confirm" })} />
                      )}
                      {isCounselor && a.status === "confirmed" && isUpcomingSession(a.scheduled_at) && (
                        <span className="text-xs font-medium text-ink-faint">Upcoming session</span>
                      )}
                      {isCounselor && a.status === "confirmed" && !isUpcomingSession(a.scheduled_at) && (
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
        </div>
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
              <Button size="sm" variant="outline" disabled={confirmBusy} onClick={closeConfirming} autoFocus>
                Back
              </Button>
              <Button
                size="sm"
                variant={confirming.kind === "reject" ? "danger" : "primary"}
                disabled={confirmBusy}
                onClick={runConfirming}
              >
                {confirmBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {confirmBusy ? "Processing…" : CONFIRM_COPY[confirming.kind].ok}
              </Button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="appt-detail-title"
        >
          <div aria-hidden className="absolute inset-0 bg-ink/40" onClick={() => setDetail(null)} />
          <div className="no-scrollbar relative max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white shadow-card sm:max-w-lg">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-6 pb-4 pt-5">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Appointment</p>
                <h2 id="appt-detail-title" className="mt-0.5 font-display text-lg font-bold text-ink">
                  Session details
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={statusTone(detail.status)}>{statusLabel(detail.status)}</Badge>
                <button
                  type="button"
                  aria-label="Close details"
                  onClick={() => setDetail(null)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-cream hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>

            <div className="px-6 py-5">
              {/* Schedule hero */}
              <div className="flex items-center gap-3 rounded-2xl border border-primary-200 bg-blue-50/60 p-4">
                <span
                  aria-hidden
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white shadow-soft"
                >
                  <CalendarDays className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    {hasSetSchedule(detail.status) ? "Session schedule" : "Requested schedule"}
                  </p>
                  <p className="mt-0.5 truncate font-display text-[15px] font-bold text-ink">
                    {formatLong(detail.scheduled_at)}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-ink-faint">
                    {hasSetSchedule(detail.status)
                      ? "Final time set by the counselor — the student was notified."
                      : "Student's requested slot — the final time appears here after the counselor confirms."}
                  </p>
                </div>
              </div>

              {/* People */}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="flex min-w-0 items-center gap-2.5 rounded-2xl border border-ink/10 bg-white p-3">
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-600 font-display text-sm font-bold text-white"
                  >
                    {(aliases.get(detail.student_id) ?? "S").trim().charAt(0).toUpperCase() || "S"}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-ink-faint">Student</span>
                    <span className="block truncate text-sm font-bold text-ink">
                      {aliases.get(detail.student_id) ?? "Student"}
                    </span>
                  </span>
                </div>
                <div className="flex min-w-0 items-center gap-2.5 rounded-2xl border border-ink/10 bg-white p-3">
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-400 font-display text-sm font-bold text-ink"
                  >
                    {counselorName(detail.counselor_id).trim().charAt(0).toUpperCase() || "C"}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-ink-faint">Counselor</span>
                    <span className="block truncate text-sm font-bold text-ink">
                      {counselorName(detail.counselor_id)}
                    </span>
                  </span>
                </div>
              </div>

              {/* Mode */}
              <div className="mt-3 flex items-center gap-2 rounded-2xl bg-cream px-4 py-3 text-sm">
                {detail.mode === "online" ? (
                  <Video className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
                ) : (
                  <MapPin className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
                )}
                <span className="font-bold text-ink">{detail.mode === "online" ? "Online" : "In person"}</span>
                {detail.mode === "online" && detail.meeting_url && (
                  <a
                    href={detail.meeting_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800 transition-colors hover:bg-blue-200"
                    aria-label={`Join the Google Meet scheduled for ${formatWhen(detail.scheduled_at)}`}
                  >
                    <Video className="h-3 w-3" aria-hidden />
                    Join Meet
                  </a>
                )}
              </div>

              {/* Concern */}
              <div className="mt-3 rounded-2xl border border-ink/10 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Concern</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{detail.concern}</p>
              </div>

              {detail.mode === "online" && detail.meeting_url && (
                <a
                  href={detail.meeting_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary-600 px-4 py-2.5 text-sm font-bold text-white shadow-soft transition-colors hover:bg-primary-700"
                  aria-label={`Join the Google Meet scheduled for ${formatLong(detail.scheduled_at)}`}
                >
                  <Video className="h-4 w-4" aria-hidden />
                  Join Google Meet
                </a>
              )}

              <div className="mt-4 flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setDetail(null)} autoFocus>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
