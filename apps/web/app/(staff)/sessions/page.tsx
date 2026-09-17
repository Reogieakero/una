"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useSessionsCalendar, type CalendarSession } from "@/lib/hooks/use-sessions-calendar";
import { MONTHS, dayKey, startOfDay, weekDays } from "@/lib/calendar";
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
import { MonthGrid } from "@/components/sessions/month-grid";
import { WeekStrip } from "@/components/sessions/week-strip";
import { DaySchedule } from "@/components/sessions/day-schedule";
import { NextSessionTimer } from "@/components/sessions/next-session-timer";
import { SessionDetail } from "@/components/sessions/session-detail";

type View = "month" | "week" | "day";

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
    const now = Date.now();
    let best: CalendarSession | null = null;
    for (const s of visible) {
      const t = new Date(s.scheduled_at).getTime();
      if (Number.isNaN(t) || t <= now) continue;
      if (!best || t < new Date(best.scheduled_at).getTime()) best = s;
    }
    return best;
  }, [visible]);

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

      {!loading && nextSession && (
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
            />
          )}

          <DaySchedule
            sessions={selectedSessions}
            selectedId={selectedId}
            aliases={aliases}
            role={role}
            counselorNames={counselorNames}
            onSelect={setSelectedId}
          />
        </Card>
      </div>
    </div>
  );
}
