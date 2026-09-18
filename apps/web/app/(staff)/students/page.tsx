"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useStudentsBoard } from "@/lib/hooks/use-students-board";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { STRESS_META } from "@/lib/report-palette";
import { Card } from "@/components/ui/primitives";
import { StudentTable, type Student } from "@/components/students/StudentTable";
import { RiskSummary } from "@/components/students/RiskSummary";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type ApptLite = { student_id: string; scheduled_at: string; status: string };
type RefLite = { student_id: string; status: string; priority: string };
type ScreenLite = { student_id: string; band: string; created_at: string };

const EMPTY_ROWS: Student[] = [];
const EMPTY_APPTS: ApptLite[] = [];
const EMPTY_REFS: RefLite[] = [];
const EMPTY_SCREENS: ScreenLite[] = [];

const OPEN_REFERRALS = ["pending", "assigned", "acknowledged", "in_progress", "confirmed", "escalated"];
const URGENT_PRIORITIES = ["urgent", "high"];

/**
 * Shared /students — one URL, role-aware UI (same pattern as /appointments).
 * Privacy-safe directory: aliases only, plus per-student workload aggregates
 * (sessions, open referrals, latest screening band).
 */
export default function StudentsPage() {
  const { data: board, isLoading, isError } = useStudentsBoard();
  const role = board?.role ?? null;
  const counselorId = board?.counselorId ?? null;
  const rows = board?.rows ?? EMPTY_ROWS;
  const appts = board?.appts ?? EMPTY_APPTS;
  const refs = board?.refs ?? EMPTY_REFS;
  const screens = board?.screens ?? EMPTY_SCREENS;
  const loading = isLoading && !board;
  const [query, setQuery] = useState("");
  const [programFilter, setProgramFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [collegeFilter, setCollegeFilter] = useState("all");

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

  useEffect(() => {
    if (isError) toast.error("Couldn't load students right now.");
  }, [isError]);

  const now = Date.now();

  const perStudent = useMemo(() => {
    const m = new Map<
      string,
      {
        total: number;
        completed: number;
        upcoming: number;
        missed: number;
        nextAt: string | null;
        lastAt: string | null;
        openRefs: number;
        urgentRefs: number;
        band: string | null;
      }
    >();
    const get = (id: string) => {
      let e = m.get(id);
      if (!e) {
        e = { total: 0, completed: 0, upcoming: 0, missed: 0, nextAt: null, lastAt: null, openRefs: 0, urgentRefs: 0, band: null };
        m.set(id, e);
      }
      return e;
    };
    for (const a of appts) {
      const e = get(a.student_id);
      e.total += 1;
      if (a.status === "completed") e.completed += 1;
      if (a.status === "cancelled" || a.status === "rejected" || a.status === "no_show") e.missed += 1;
      if (!e.lastAt || a.scheduled_at > e.lastAt) e.lastAt = a.scheduled_at;
      if (["pending", "assigned", "confirmed"].includes(a.status) && new Date(a.scheduled_at).getTime() >= now) {
        e.upcoming += 1;
        if (!e.nextAt || a.scheduled_at < e.nextAt) e.nextAt = a.scheduled_at;
      }
    }
    for (const r of refs) {
      if (!OPEN_REFERRALS.includes(r.status)) continue;
      const e = get(r.student_id);
      e.openRefs += 1;
      if (URGENT_PRIORITIES.includes(r.priority)) e.urgentRefs += 1;
    }
    const seen = new Set<string>();
    for (const s of screens) {
      if (!seen.has(s.student_id)) {
        seen.add(s.student_id);
        get(s.student_id).band = s.band;
      }
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appts, refs, screens]);

  const programs = useMemo(() => [...new Set(rows.map((s) => s.program).filter(Boolean))].sort() as string[], [rows]);
  const years = useMemo(() => [...new Set(rows.map((s) => s.year_level).filter(Boolean))].sort() as string[], [rows]);
  const colleges = useMemo(() => [...new Set(rows.map((s) => s.college).filter(Boolean))].sort() as string[], [rows]);

  const stats = useMemo(() => {
    const withUpcoming = rows.filter((s) => (perStudent.get(s.id)?.upcoming ?? 0) > 0).length;
    const withOpenRefs = rows.filter((s) => (perStudent.get(s.id)?.openRefs ?? 0) > 0).length;
    const highStress = rows.filter((s) => perStudent.get(s.id)?.band === "high").length;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
    return {
      total: rows.length,
      withUpcoming,
      withOpenRefs,
      highStress,
      newMonth: rows.filter((s) => new Date(s.created_at).getTime() >= monthAgo).length,
      programs: programs.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, perStudent, programs]);

  const needsAttention = useMemo(() => {
    const out: { student: Student; reasons: string[]; rank: number }[] = [];
    for (const s of rows) {
      const agg = perStudent.get(s.id);
      if (!agg) continue;
      const reasons: string[] = [];
      let rank = 0;
      if (agg.urgentRefs > 0) {
        reasons.push(`${agg.urgentRefs} urgent referral${agg.urgentRefs === 1 ? "" : "s"}`);
        rank = Math.max(rank, 3);
      }
      if (agg.band === "high" && agg.upcoming === 0) {
        reasons.push("High stress · nothing booked");
        rank = Math.max(rank, 2);
      }
      if (agg.missed >= 2) {
        reasons.push(`${agg.missed} missed sessions`);
        rank = Math.max(rank, 1);
      }
      if (reasons.length) out.push({ student: s, reasons, rank });
    }
    return out.sort((a, b) => b.rank - a.rank).slice(0, 8);
  }, [rows, perStudent]);

  const neverBooked = useMemo(
    () => rows.filter((s) => (perStudent.get(s.id)?.total ?? 0) === 0).slice(0, 6),
    [rows, perStudent]
  );

  const programBars = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of rows) counts.set(s.program ?? "Undeclared", (counts.get(s.program ?? "Undeclared") ?? 0) + 1);
    return [...counts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [rows]);

  const screeningDonut = useMemo(() => {
    const counts = new Map<string, number>([
      ["low", 0],
      ["moderate", 0],
      ["high", 0],
    ]);
    for (const s of rows) {
      const band = perStudent.get(s.id)?.band;
      if (band && counts.has(band)) counts.set(band, (counts.get(band) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: STRESS_META[k].label, value: v, color: STRESS_META[k].color }));
  }, [rows, perStudent]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((s) => (programFilter === "all" ? true : s.program === programFilter))
      .filter((s) => (yearFilter === "all" ? true : s.year_level === yearFilter))
      .filter((s) => (collegeFilter === "all" ? true : s.college === collegeFilter))
      .filter((s) =>
        !q
          ? true
          : `${s.anonymous_alias ?? ""} ${s.student_no} ${s.program ?? ""}`.toLowerCase().includes(q)
      );
  }, [rows, programFilter, yearFilter, collegeFilter, query]);

  if (!loading && (!role || !["counselor", "guidance_head"].includes(role))) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">Students</h1>
        <Card><p className="text-sm text-ink-muted">Only counselors and the guidance head can open the student directory.</p></Card>
      </div>
    );
  }

  const statCards = [
    { label: "Students", value: stats.total },
    { label: "With upcoming session", value: stats.withUpcoming },
    { label: "With open referral", value: stats.withOpenRefs },
    { label: "High stress (latest)", value: stats.highStress },
    { label: "New this month", value: stats.newMonth },
    { label: "Programs", value: stats.programs },
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
            <BreadcrumbPage>Students</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{role === "counselor" ? "My students" : "Students"}</h1>
          <p className="mt-1 max-w-[600px] text-sm leading-relaxed text-ink-muted">
            {role === "counselor"
              ? "Your caseload — students from your sessions, assigned referrals, and chats. Aliases only, with each student's load with you."
              : "Privacy-safe directory — aliases only, with each student's session load, open referrals, and latest screening band."}
          </p>
        </div>
        <div ref={statsRef} className="relative shrink-0" onMouseEnter={openStats} onMouseLeave={scheduleStatsClose}>
          <button
            type="button"
            onClick={toggleStats}
            onFocus={openStats}
            onBlur={scheduleStatsClose}
            aria-haspopup="dialog"
            aria-expanded={statsOpen}
            className="inline-flex h-8 items-center gap-1.5 rounded border border-ink/10 bg-white px-3 text-[13px] font-bold text-ink-soft shadow-card transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            Stats
            <ChevronDown aria-hidden className={cn("h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200", statsOpen && "rotate-180")} />
          </button>
          {statsOpen && (
            <div
              role="dialog"
              aria-label="Student stats"
              className="absolute right-0 top-full z-20 mt-2 w-72 overflow-hidden rounded-lg border border-ink/10 bg-white py-1 shadow-card"
            >
              {loading ? (
                <div className="animate-pulse px-4 py-3" aria-hidden>
                  <div className="h-10 rounded-lg bg-ink/10" />
                  <div className="mt-2 h-10 rounded-lg bg-ink/10" />
                  <div className="mt-2 h-10 rounded-lg bg-ink/10" />
                </div>
              ) : (
                statCards.map((s) => (
                  <div
                    key={s.label}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left"
                  >
                    <span className="text-[13px] font-medium text-ink-muted">{s.label}</span>
                    <span className="font-display text-xl font-bold text-ink">{s.value}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {role === "counselor" && !counselorId && !loading && (
        <div className="rounded-lg border border-accent-200 bg-accent-50 p-5 shadow-card">
          <p className="text-sm font-bold text-accent-700">Counselor record not linked yet</p>
          <p className="mt-1 text-[13px] text-accent-700">
            Your login works, but no counselor row is linked to your account. Ask the guidance head to finish setup.
          </p>
        </div>
      )}

      <RiskSummary
        loading={loading}
        needsAttention={needsAttention}
        programBars={programBars}
        screeningDonut={screeningDonut}
        neverBooked={neverBooked}
      />

      {/* Directory — filters live inside, above the student table */}
      <StudentTable
        visible={visible}
        totalCount={rows.length}
        loading={loading}
        query={query}
        setQuery={setQuery}
        programFilter={programFilter}
        setProgramFilter={setProgramFilter}
        yearFilter={yearFilter}
        setYearFilter={setYearFilter}
        collegeFilter={collegeFilter}
        setCollegeFilter={setCollegeFilter}
        programs={programs}
        years={years}
        colleges={colleges}
        perStudent={perStudent}
      />
    </div>
  );
}
