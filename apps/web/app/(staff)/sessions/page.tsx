"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Video, MapPin } from "lucide-react";
import { useSessionsCalendar } from "@/lib/hooks/use-sessions-calendar";
import { Badge, Button, Card } from "@/components/ui/primitives";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

type Session = {
  id: string;
  student_id: string;
  counselor_id: string | null;
  scheduled_at: string;
  mode: string;
  status: string;
  concern: string;
  meeting_url: string | null;
};

type View = "month" | "week" | "day";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Status → pill colors (same language as dashboard + appointments). */
const STATUS_PILL: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  assigned: "bg-indigo-100 text-indigo-800",
  confirmed: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-ink/10 text-ink-muted",
  rejected: "bg-red-100 text-red-700",
  no_show: "bg-red-100 text-red-700",
};

function statusLabel(s: string): string {
  const spaced = s.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 42 cells (6 weeks) starting Sunday, covering the cursor month. */
function monthCells(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/** 7 days (Sun–Sat) of the cursor week. */
function weekDays(cursor: Date): Date[] {
  const start = new Date(cursor);
  start.setDate(cursor.getDate() - cursor.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatLong(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · ${formatTime(iso)}`;
}

const EMPTY_MAP = new Map<string, string>();

/**
 * Counselor session calendar — month / week / day views over confirmed
 * sessions only (counselor-scheduled, including referral-minted ones;
 * office-wide for the head). Clicking a day shows that day's
 * schedule in the side panel; clicking a session shows its details.
 *
 * Data comes from the cached useSessionsCalendar hook, so going back to
 * /sessions renders instantly instead of refetching on every visit.
 */
export default function SessionCalendarPage() {
  const { data: calendar, isLoading, isError } = useSessionsCalendar();
  const role = calendar?.role ?? null;
  const counselorId = calendar?.counselorId ?? null;
  const rows = calendar?.sessions ?? [];
  const aliases = calendar?.aliases ?? EMPTY_MAP;
  const counselorNames = calendar?.counselorNames ?? EMPTY_MAP;
  const loading = isLoading && !calendar;
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (isError) toast.error("Couldn't load the session calendar right now.");
  }, [isError]);

  // Confirmed only (hook queries confirmed, this guards any cached rows).
  const visible = useMemo(
    () =>
      rows
        .filter((a) => a.status === "confirmed")
        .filter((a) => (role === "counselor" && counselorId ? a.counselor_id === counselorId : true)),
    [rows, role, counselorId]
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Session[]>();
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
  const pickSession = (s: Session) => {
    setSelectedDay(startOfDay(new Date(s.scheduled_at)));
    setSelectedId(s.id);
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

  const cells = view === "month" ? monthCells(cursor) : weekDays(cursor);

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
        <div className="flex rounded-full border border-ink/15 bg-white p-1 shadow-card" role="tablist" aria-label="Calendar view">
          {(["month", "week", "day"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-full px-4 py-1.5 text-[13px] font-bold transition-colors",
                view === v ? "bg-primary-600 text-white shadow-soft" : "text-ink-soft hover:bg-cream"
              )}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Calendar */}
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={goToday}>Today</Button>
              <button
                type="button"
                aria-label="Previous"
                onClick={() => step(-1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-ink/15 bg-white text-ink transition-colors hover:border-primary-400 hover:bg-cream"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Next"
                onClick={() => step(1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-ink/15 bg-white text-ink transition-colors hover:border-primary-400 hover:bg-cream"
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
              <div className="h-10 rounded-xl bg-ink/10" />
              <div className="h-40 rounded-xl bg-ink/10" />
            </div>
          ) : (
            <div className="mt-4">
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map((w) => (
                  <span key={w} className="pb-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                    {w}
                  </span>
                ))}
              </div>
              <div className={cn("grid grid-cols-7 gap-1", view === "month" && "auto-rows-[minmax(88px,1fr)]")}>
                {cells.map((d, i) => {
                  const k = dayKey(d);
                  const daySessions = byDay.get(k) ?? [];
                  const isToday = sameDay(d, today);
                  const isSelected = sameDay(d, selectedDay);
                  const outside = view === "month" && d.getMonth() !== cursor.getMonth();
                  const shown = view === "month" ? daySessions.slice(0, 2) : daySessions.slice(0, 4);
                  return (
                    <button
                      key={`${k}-${i}`}
                      type="button"
                      onClick={() => {
                        if (view === "day") return;
                        pickDay(d);
                      }}
                      aria-label={`${d.toLocaleDateString("en-US", { month: "long", day: "numeric" })}, ${daySessions.length} sessions`}
                      className={cn(
                        "rounded-2xl border p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                        view === "month" ? "min-h-[88px]" : "min-h-[120px]",
                        isSelected
                          ? "border-primary-500 bg-blue-50/60 ring-1 ring-primary-400"
                          : "border-ink/10 bg-white hover:border-primary-300 hover:bg-cream/60",
                        outside && "bg-cream/50 opacity-60"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold",
                          isToday ? "bg-primary-600 text-white shadow-soft" : outside ? "text-ink-faint" : "text-ink"
                        )}
                      >
                        {d.getDate()}
                      </span>
                      <span className="mt-1 space-y-1">
                        {shown.map((s) => (
                          <span
                            key={s.id}
                            role="button"
                            tabIndex={0}
                            aria-label={`${aliases.get(s.student_id) ?? "Student"} at ${formatTime(s.scheduled_at)}, ${statusLabel(s.status)}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              pickSession(s);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                pickSession(s);
                              }
                            }}
                            className={cn(
                              "block w-full cursor-pointer truncate rounded-lg px-1.5 py-0.5 text-[11px] font-bold",
                              STATUS_PILL[s.status] ?? "bg-ink/10 text-ink-muted",
                              selectedId === s.id && "ring-2 ring-ink/40"
                            )}
                          >
                            {formatTime(s.scheduled_at)} · {aliases.get(s.student_id) ?? "Student"}
                          </span>
                        ))}
                        {daySessions.length > shown.length && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDay(startOfDay(d));
                              setSelectedId(null);
                              setView("day");
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.stopPropagation();
                                setSelectedDay(startOfDay(d));
                                setView("day");
                              }
                            }}
                            className="block cursor-pointer px-1.5 text-[11px] font-bold text-primary-700 hover:underline"
                          >
                            +{daySessions.length - shown.length} more
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
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
            <div className="mt-3 rounded-2xl border border-primary-200 bg-blue-50/60 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-sm font-bold text-ink">
                  {aliases.get(selected.student_id) ?? "Student"}
                </p>
                <button
                  type="button"
                  aria-label="Clear selection"
                  onClick={() => setSelectedId(null)}
                  className="text-xs font-bold text-ink-faint hover:text-ink"
                >
                  ✕
                </button>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                <Clock className="h-3.5 w-3.5 text-ink-muted" aria-hidden /> {formatLong(selected.scheduled_at)}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-muted">
                {selected.mode === "online"
                  ? <Video className="h-3.5 w-3.5" aria-hidden />
                  : <MapPin className="h-3.5 w-3.5" aria-hidden />}
                {selected.mode === "online" ? "Online" : "In person"}
                <span aria-hidden>·</span>
                <Badge tone={
                  selected.status === "completed" ? "success"
                    : selected.status === "rejected" || selected.status === "no_show" ? "danger"
                      : selected.status === "cancelled" ? "muted"
                      : selected.status === "assigned" || selected.status === "confirmed" ? "info" : "warning"
                }>
                  {statusLabel(selected.status)}
                </Badge>
              </p>
              {selected.mode === "online" && selected.meeting_url && (
                <a
                  href={selected.meeting_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-4 py-1.5 text-[13px] font-bold text-white shadow-soft transition-colors hover:bg-primary-700"
                  aria-label={`Join the Google Meet scheduled for ${formatLong(selected.scheduled_at)}`}
                >
                  <Video className="h-3.5 w-3.5" aria-hidden />
                  Join Google Meet
                </a>
              )}
              {role === "guidance_head" && (
                <p className="mt-1 text-[13px] text-ink-muted">
                  Counselor: <span className="font-semibold text-ink">{selected.counselor_id ? (counselorNames.get(selected.counselor_id) ?? "Counselor") : "Unassigned"}</span>
                </p>
              )}
              <p className="mt-2 border-t border-ink/10 pt-2 text-[13px] leading-relaxed text-ink-soft">{selected.concern}</p>
            </div>
          )}

          <ul className="mt-3 space-y-2">
            {selectedSessions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
                  aria-current={s.id === selectedId}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors",
                    s.id === selectedId
                      ? "border-primary-500 bg-blue-50/60"
                      : "border-ink/10 bg-white hover:border-primary-300 hover:bg-cream/60"
                  )}
                >
                  <span className="w-20 shrink-0 text-[13px] font-bold text-ink">{formatTime(s.scheduled_at)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink">{aliases.get(s.student_id) ?? "Student"}</span>
                    <span className="block truncate text-xs text-ink-muted">
                      {s.mode === "online" ? "Online" : "In person"}
                      {role === "guidance_head" && s.counselor_id ? ` · ${counselorNames.get(s.counselor_id) ?? "Counselor"}` : ""}
                    </span>
                  </span>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", STATUS_PILL[s.status] ?? "bg-ink/10 text-ink-muted")}>
                    {statusLabel(s.status)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!selectedSessions.length && (
            <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-center text-[13px] text-ink-muted">
              Pick another day — confirmed and upcoming sessions land here.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
