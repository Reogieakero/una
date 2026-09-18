"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useSessionsCalendar, SESSIONS_CALENDAR_KEY, type CalendarSession, type SessionsCalendarData } from "@/lib/hooks/use-sessions-calendar";
import { APPOINTMENTS_BOARD_KEY } from "@/lib/hooks/use-appointments-board";
import { COUNSELOR_DASHBOARD_KEY } from "@/lib/hooks/use-counselor-dashboard";
import { useMutationAction } from "@/lib/hooks/use-mutation-action";
import { patchBoard } from "@/lib/patch-board";
import { notifyStaff } from "@/lib/notify";
import { MONTHS, dayKey, isSessionLive, startOfDay, weekDays } from "@/lib/calendar";
import { Button, Card } from "@/components/ui/primitives";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { ACTION_DEFS, formatWhen, type ActionKind } from "@/components/appointments/status";
import { AppointmentConfirmDialogs } from "@/components/appointments/AppointmentConfirmDialogs";
import { SessionNotesModal } from "@/components/appointments/SessionNotesModal";
import { MonthGrid } from "@/components/sessions/month-grid";
import { WeekStrip } from "@/components/sessions/week-strip";
import { DaySchedule } from "@/components/sessions/day-schedule";
import { LiveSessionBanner, NextSessionTimer } from "@/components/sessions/next-session-timer";
import { SessionDetail } from "@/components/sessions/session-detail";

type View = "month" | "week" | "day";

const EMPTY_MAP = new Map<string, string>();

/**
 * Counselor session calendar — month / week / day views over confirmed
 * sessions only (counselor-scheduled, including referral-minted ones;
 * office-wide for the head). Clicking a day shows that day's
 * schedule in the side panel; clicking a session shows its details.
 * Counselors can Complete / mark No-show a started session right from the
 * detail card (same confirm dialog + notify fan-out as /appointments), and
 * the page detects the live-now session from its start time.
 *
 * Data comes from the cached useSessionsCalendar hook, so going back to
 * /sessions renders instantly instead of refetching on every visit.
 */
export default function SessionCalendarPage() {
  const qc = useQueryClient();
  const { data: calendar, isLoading, isError, refetch } = useSessionsCalendar();
  const { busyId, run: runMutation } = useMutationAction();
  const role = calendar?.role ?? null;
  const counselorId = calendar?.counselorId ?? null;
  const rows = calendar?.sessions ?? [];
  const aliases = calendar?.aliases ?? EMPTY_MAP;
  const counselorNames = calendar?.counselorNames ?? EMPTY_MAP;
  const studentProfiles = calendar?.studentProfiles ?? EMPTY_MAP;
  const headIds = calendar?.headIds ?? [];
  const slots = calendar?.slots ?? [];
  const loading = isLoading && !calendar;
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ appt: CalendarSession; kind: Extract<ActionKind, "complete" | "no-show"> } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const confirmBusyRef = useRef(false);
  // Confidential record opened right after a Complete — same handoff as
  // /appointments, so the note is documented while the session is fresh.
  const [notesAppt, setNotesAppt] = useState<CalendarSession | null>(null);

  // Ticking clock (30s) — drives live-session detection everywhere below.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (isError) toast.error("Couldn't load the session calendar right now.");
  }, [isError]);

  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !confirmBusyRef.current) setConfirming(null);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [confirming]);

  // Confirmed only (hook queries confirmed, this guards any cached rows).
  const visible = useMemo(
    () =>
      rows
        .filter((a) => a.status === "confirmed")
        .filter((a) => (role === "counselor" && counselorId ? a.counselor_id === counselorId : true)),
    [rows, role, counselorId]
  );

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarSession[]>();
    for (const s of visible) {
      const k = dayKey(new Date(s.scheduled_at));
      const arr = map.get(k) ?? [];
      arr.push(s);
      map.set(k, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    }
    return map;
  }, [visible]);

  const today = useMemo(() => new Date(), []);
  const todayCount = byDay.get(dayKey(today))?.length ?? 0;
  const weekCount = useMemo(
    () => weekDays(cursor).reduce((n, d) => n + (byDay.get(dayKey(d))?.length ?? 0), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cursor, byDay]
  );

  const selectedSessions = byDay.get(dayKey(selectedDay)) ?? [];
  const selected = selectedId ? visible.find((s) => s.id === selectedId) ?? null : null;

  // Nearest upcoming confirmed session — drives the countdown banner.
  const nextSession = useMemo(() => {
    const nowMs = Date.now();
    let best: CalendarSession | null = null;
    for (const s of visible) {
      const t = new Date(s.scheduled_at).getTime();
      if (Number.isNaN(t) || t <= nowMs) continue;
      if (!best || t < new Date(best.scheduled_at).getTime()) best = s;
    }
    return best;
  }, [visible]);

  // Live-now session — start time reached, end not yet passed. Drives the
  // live banner, row badges, and detail actions (recomputed on the 30s tick).
  const liveSession = useMemo(() => {
    let best: CalendarSession | null = null;
    for (const s of visible) {
      if (!isSessionLive(s.scheduled_at, s.ends_at, now)) continue;
      if (!best || new Date(s.scheduled_at).getTime() < new Date(best.scheduled_at).getTime()) best = s;
    }
    return best;
  }, [visible, now]);

  const isCounselor = role === "counselor";

  // Instant local patch (the terminal row drops out of the confirmed-only
  // calendar at once) + background reconcile of every related board, so the
  // outcome lands across the system without waiting on refetches.
  const patchSessionStatus = (id: string, status: string) => {
    patchBoard<SessionsCalendarData>(qc, [...SESSIONS_CALENDAR_KEY], (prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => (s.id === id ? { ...s, status } : s)),
    }));
    void qc.invalidateQueries({ queryKey: [...APPOINTMENTS_BOARD_KEY] }).catch(() => {});
    void qc.invalidateQueries({ queryKey: [...COUNSELOR_DASHBOARD_KEY] }).catch(() => {});
    void refetch().catch(() => {});
  };

  const notifyStudent = (appt: CalendarSession, title: string, body: string, dedupeKey: string, tone?: "success" | "info" | "error") =>
    notifyStaff([appt.student_id ? studentProfiles.get(appt.student_id) : undefined], { type: "appointment", title, body, link: "/appointments", dedupeKey, ...(tone ? { tone } : {}) });

  const notifyHeadsSession = (appt: CalendarSession, kind: "complete" | "no-show") => {
    const alias = appt.student_id ? (aliases.get(appt.student_id) ?? "Student") : "Walk-in";
    const when = formatWhen(appt.scheduled_at);
    const title = kind === "complete" ? "Session completed" : "Session marked no-show";
    return notifyStaff(headIds, {
      type: "appointment",
      title: `${title} — ${alias}`,
      body: `${alias} · ${when}`,
      link: `/appointments#focus-${appt.id}`,
      dedupeKey: `appt:${appt.id}:${kind === "complete" ? "completed" : "no-show"}`,
      tone: kind === "complete" ? "success" : "error",
    });
  };

  const runOutcome = async () => {
    if (!confirming || confirmBusyRef.current) return;
    const { appt, kind } = confirming;
    const def = ACTION_DEFS[kind];
    const when = formatWhen(appt.scheduled_at);
    confirmBusyRef.current = true;
    setConfirmBusy(true);
    try {
      const result = await runMutation(appt.id, () => def.fn(createClient(), appt.id), {
        label: kind === "complete" ? "complete this session" : "mark no-show",
        friendly: /only assigned|assigned or confirmed|not found|availability/i,
      });
      if (!result.ok) return;
      patchSessionStatus(appt.id, kind === "complete" ? "completed" : "no_show");
      void notifyStudent(appt, def.doneTitle, def.doneBody(when), `appt:${appt.id}:${kind === "complete" ? "completed" : "no-show"}`, kind === "complete" ? "success" : "error");
      void notifyHeadsSession(appt, kind);
      toast.success(def.doneTitle, { description: def.okBody(when), position: "top-right" });
      if (selectedId === appt.id) setSelectedId(null);
      // The session just ended — hand the counselor straight to the private
      // record so the note is documented while it's fresh.
      if (kind === "complete") setNotesAppt({ ...appt, status: "completed" });
    } finally {
      confirmBusyRef.current = false;
      setConfirmBusy(false);
      setConfirming(null);
    }
  };

  const closeConfirming = () => {
    if (confirmBusyRef.current) return;
    setConfirming(null);
  };

  // Live-now alert — when a session's start time arrives while this page is
  // open (or is already live on load), toast once per session with a View
  // shortcut, and ping the student so nobody misses the start. The
  // appt:<id>:live dedupe key collapses multi-tab repeats server-side, and
  // sessionStorage stops repeat toasts across reloads.
  const liveNotifiedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (loading || !visible.length) return;
    for (const s of visible) {
      if (!isSessionLive(s.scheduled_at, s.ends_at, now)) continue;
      if (liveNotifiedRef.current.has(s.id)) continue;
      liveNotifiedRef.current.add(s.id);
      const alias = s.student_id ? (aliases.get(s.student_id) ?? "Student") : "Walk-in";
      const when = formatWhen(s.scheduled_at);
      let seen = false;
      try { seen = window.sessionStorage.getItem(`live-notified-${s.id}`) !== null; } catch { seen = false; }
      if (seen) continue;
      try { window.sessionStorage.setItem(`live-notified-${s.id}`, "1"); } catch { /* private mode — ref guard still applies */ }
      toast.message(`Session is live now — ${alias}`, {
        id: `live-${s.id}`,
        description: `${when} · ${s.mode === "online" ? "Online" : "In person"}`,
        position: "top-right",
        action: {
          label: "View",
          onClick: () => {
            setSelectedDay(startOfDay(new Date(s.scheduled_at)));
            setSelectedId(s.id);
          },
        },
      });
      // Only the owning counselor fires the student ping.
      if (isCounselor && counselorId && s.counselor_id === counselorId) {
        void notifyStaff([s.student_id ? studentProfiles.get(s.student_id) : undefined], {
          type: "appointment",
          title: "Your session is starting now",
          body: `Your session on ${when} is live now. Join your counselor${s.mode === "online" ? " with your Meet link" : ""}.`,
          link: "/appointments",
          dedupeKey: `appt:${s.id}:live`,
          tone: "info",
        });
      }
    }
  }, [loading, visible, now, aliases, isCounselor, counselorId, studentProfiles]);

  const goToday = () => {
    const n = new Date();
    setCursor(n);
    setSelectedDay(startOfDay(n));
    setSelectedId(null);
  };
  const step = (dir: 1 | -1) => {
    setCursor((c) => {
      const n = new Date(c);
      if (view === "month") n.setMonth(c.getMonth() + dir);
      else if (view === "week") n.setDate(c.getDate() + dir * 7);
      else n.setDate(c.getDate() + dir);
      return n;
    });
  };

  const pickDay = (d: Date) => {
    setSelectedDay(startOfDay(d));
    setSelectedId(null);
  };
  const pickSession = (s: CalendarSession) => {
    setSelectedDay(startOfDay(new Date(s.scheduled_at)));
    setSelectedId(s.id);
  };
  const expandDay = (d: Date) => {
    setSelectedDay(startOfDay(d));
    setSelectedId(null);
    setView("day");
  };

  const title =
    view === "month"
      ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
      : view === "week"
        ? `Week of ${weekDays(cursor)[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
        : selectedDay.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  if (!loading && (!role || !["counselor", "guidance_head"].includes(role))) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">Session calendar</h1>
        <Card><p className="text-sm text-ink-muted">Only counselors and the guidance head can open the session calendar.</p></Card>
      </div>
    );
  }

  const gridProps = {
    cursor,
    byDay,
    aliases,
    today,
    selectedDay,
    selectedId,
    onPickDay: pickDay,
    onPickSession: pickSession,
    onExpandDay: expandDay,
  };

  return (
    <div className="space-y-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Session calendar</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Session calendar</h1>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            {role === "counselor" ? "Your sessions" : "Office-wide sessions"} — click a day to see its schedule, click a session for details.
            {" "}{todayCount} today · {weekCount} this week.
          </p>
        </div>
        {/* View switcher */}
        <div className="flex rounded border border-ink/15 bg-white p-1 shadow-card" role="tablist" aria-label="Calendar view">
          {((["month", "week", "day"] as View[])).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn(
                "h-8 rounded px-4 text-[13px] font-bold transition-colors",
                view === v ? "bg-primary-600 text-white shadow-soft" : "text-ink-soft hover:bg-cream"
              )}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {!loading && liveSession && (
        <LiveSessionBanner
          session={liveSession}
          alias={
            liveSession.student_id ? (aliases.get(liveSession.student_id) ?? "Student") : "Walk-in"
          }
          onSelect={pickSession}
        />
      )}
      {!loading && !liveSession && nextSession && (
        <NextSessionTimer
          session={nextSession}
          alias={
            nextSession.student_id ? (aliases.get(nextSession.student_id) ?? "Student") : "Walk-in"
          }
          onSelect={pickSession}
        />
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Calendar */}        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={goToday}>Today</Button>
              <button
                type="button"
                aria-label="Previous"
                onClick={() => step(-1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-ink/15 bg-white text-ink transition-colors hover:border-primary-400 hover:bg-cream"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Next"
                onClick={() => step(1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-ink/15 bg-white text-ink transition-colors hover:border-primary-400 hover:bg-cream"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
            <span className="hidden items-center gap-1.5 text-xs font-semibold text-ink-faint sm:inline-flex">
              <CalendarDays className="h-4 w-4" aria-hidden /> {visible.length} sessions
            </span>
          </div>

          {loading ? (
            <div className="animate-pulse space-y-2 pt-4" aria-hidden>
              <div className="h-10 rounded-lg bg-ink/10" />
              <div className="h-40 rounded-lg bg-ink/10" />
            </div>
          ) : view === "month" ? (
            <MonthGrid {...gridProps} />
          ) : (
            <WeekStrip {...gridProps} daysClickable={view === "week"} />
          )}
        </Card>

        {/* Schedule panel */}
        <Card className="h-fit xl:sticky xl:top-20">
          <h2 className="font-display text-base font-bold text-ink">
            Schedule — {selectedDay.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            {selectedSessions.length
              ? `${selectedSessions.length} session${selectedSessions.length > 1 ? "s" : ""} this day.`
              : "No sessions scheduled this day."}
          </p>

          {selected && (
            <SessionDetail
              session={selected}
              alias={selected.student_id ? (aliases.get(selected.student_id) ?? "Student") : "Walk-in"}
              counselorName={selected.counselor_id ? (counselorNames.get(selected.counselor_id) ?? "Counselor") : "Unassigned"}
              showCounselor={role === "guidance_head"}
              onClear={() => setSelectedId(null)}
              now={now}
              canManage={isCounselor && !!counselorId && selected.counselor_id === counselorId}
              busy={busyId === selected.id}
              onComplete={() => setConfirming({ appt: selected, kind: "complete" })}
              onNoShow={() => setConfirming({ appt: selected, kind: "no-show" })}
            />
          )}

          <DaySchedule
            sessions={selectedSessions}
            selectedId={selectedId}
            aliases={aliases}
            role={role}
            counselorNames={counselorNames}
            onSelect={setSelectedId}
            now={now}
          />
        </Card>
      </div>

      <AppointmentConfirmDialogs
        confirming={confirming}
        aliases={aliases}
        slots={[]}
        sched={null}
        onSchedChange={() => {}}
        scheduleError={null}
        meetingInput=""
        onMeetingChange={() => {}}
        meetingError={null}
        confirmBusy={confirmBusy}
        onClose={closeConfirming}
        onSubmit={() => void runOutcome()}
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
