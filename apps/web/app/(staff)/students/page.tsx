"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BarChart3, Check, ChevronDown } from "lucide-react";
import { useStudentsBoard } from "@/lib/hooks/use-students-board";
import { cn } from "@/lib/utils";
import { Badge, Card, Input } from "@/components/ui/primitives";
import { ReportBars, ReportDonut } from "@/components/shared/reports-charts";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type Student = {
  id: string;
  student_no: string;
  program: string | null;
  year_level: string | null;
  college: string | null;
  anonymous_alias: string | null;
  created_at: string;
};

type ApptLite = { student_id: string; scheduled_at: string; status: string };
type RefLite = { student_id: string; status: string; priority: string };
type ScreenLite = { student_id: string; band: string; created_at: string };

const EMPTY_ROWS: Student[] = [];
const EMPTY_APPTS: ApptLite[] = [];
const EMPTY_REFS: RefLite[] = [];
const EMPTY_SCREENS: ScreenLite[] = [];

const OPEN_REFERRALS = ["pending", "assigned", "acknowledged", "in_progress", "confirmed", "escalated"];
const URGENT_PRIORITIES = ["urgent", "high"];

const STRESS_META: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "#22C55E" },
  moderate: { label: "Moderate", color: "#F59E0B" },
  high: { label: "High", color: "#EF4444" },
};

function bandTone(b: string): "success" | "warning" | "danger" {
  if (b === "high") return "danger";
  if (b === "moderate") return "warning";
  return "success";
}

function bandLabel(b: string): string {
  return b.charAt(0).toUpperCase() + b.slice(1);
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

/**
 * Hover/click floating filter menu — the same behavior as the Stats menu
 * on /appointments: opens on hover or click, closes on mouse leave (short
 * grace), outside click, Escape, or pick.
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
  /** Menu edge — "right" keeps right-side menus inside the page width. */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    <div ref={ref} className="relative shrink-0" onMouseEnter={openMenu} onMouseLeave={scheduleClose}>
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
          className={cn(
            "menu-scroll absolute top-full z-20 mt-2 max-h-60 w-56 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-ink/10 bg-white py-1 shadow-card",
            align === "right" ? "right-0" : "left-0"
          )}
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
              aria-label="Student stats"
              className="absolute right-0 top-full z-20 mt-2 w-72 overflow-hidden rounded-xl border border-ink/10 bg-white py-1 shadow-card"
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
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-card">
          <p className="text-sm font-bold text-amber-800">Counselor record not linked yet</p>
          <p className="mt-1 text-[13px] text-amber-700">
            Your login works, but no counselor row is linked to your account. Ask the guidance head to finish setup.
          </p>
        </div>
      )}

      {/* Needs attention + program mix */}
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <h2 className="font-display text-base font-bold text-ink">Needs attention</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">Urgent referrals, unsupported high stress, and repeated misses.</p>
          {loading ? (
            <div className="animate-pulse space-y-3 pt-3" aria-hidden>
              <div className="h-10 rounded-xl bg-ink/10" />
              <div className="h-10 rounded-xl bg-ink/10" />
              <div className="h-10 rounded-xl bg-ink/10" />
            </div>
          ) : needsAttention.length ? (
            <ul className="mt-3 max-h-[300px] divide-y divide-ink/10 overflow-y-auto">
              {needsAttention.map(({ student: s, reasons }) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">{s.anonymous_alias ?? "Student"}</p>
                    <p className="mt-0.5 truncate text-xs font-medium text-ink-muted">{s.program ?? "Undeclared"}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    {reasons.map((r) => (
                      <span key={r} className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-800">
                        {r}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[13px] text-ink-muted">
              Nothing urgent — no unsupported high-stress screens, urgent referrals, or repeat misses.
            </p>
          )}
        </section>
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <h2 className="font-display text-base font-bold text-ink">Students per program</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">Where to focus outreach and group sessions.</p>
          {loading ? (
            <div className="animate-pulse pt-4" aria-hidden>
              <div className="h-[240px] rounded-xl bg-ink/10" />
            </div>
          ) : programBars.length ? (
            <ReportBars data={programBars} />
          ) : (
            <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[13px] text-ink-muted">No program data yet.</p>
          )}
        </section>
      </div>

      {/* Screening mix + never booked */}
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <h2 className="font-display text-base font-bold text-ink">Latest screening mix</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">Each student counted once, by most recent PSS-10 band.</p>
          {loading ? (
            <div className="animate-pulse pt-4" aria-hidden>
              <div className="h-[200px] rounded-xl bg-ink/10" />
            </div>
          ) : screeningDonut.length ? (
            <ReportDonut data={screeningDonut} />
          ) : (
            <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[13px] text-ink-muted">No screenings yet.</p>
          )}
        </section>
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <h2 className="font-display text-base font-bold text-ink">Never booked</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">Registered but no session yet — candidates for a nudge.</p>
          {loading ? (
            <div className="animate-pulse space-y-3 pt-3" aria-hidden>
              <div className="h-10 rounded-xl bg-ink/10" />
              <div className="h-10 rounded-xl bg-ink/10" />
              <div className="h-10 rounded-xl bg-ink/10" />
            </div>
          ) : neverBooked.length ? (
            <ul className="mt-3 max-h-[300px] divide-y divide-ink/10 overflow-y-auto">
              {neverBooked.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">{s.anonymous_alias ?? "Student"}</p>
                    <p className="mt-0.5 truncate text-xs font-medium text-ink-muted">{s.program ?? "Undeclared"}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
                    Joined {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[13px] text-ink-muted">
              Everyone has booked at least once. Nice coverage.
            </p>
          )}
        </section>
      </div>

      {/* Directory — filters live inside, above the student table */}
      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 p-4 sm:px-5">
          <Input
            placeholder="Search alias, no., or program…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full sm:w-56"
          />
          <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
            <HoverMenu
              ariaLabel="Filter by program"
              buttonLabel={<>Program: {programFilter === "all" ? "All" : programFilter}</>}
              options={[{ value: "all", label: "All programs" }, ...programs.map((p) => ({ value: p, label: p }))]}
              value={programFilter}
              onPick={setProgramFilter}
            />
            <HoverMenu
              ariaLabel="Filter by year level"
              buttonLabel={<>Year: {yearFilter === "all" ? "All" : yearFilter}</>}
              options={[{ value: "all", label: "All year levels" }, ...years.map((y) => ({ value: y, label: y }))]}
              value={yearFilter}
              onPick={setYearFilter}
            />
            <HoverMenu
              ariaLabel="Filter by college"
              align="right"
              buttonLabel={<>College: {collegeFilter === "all" ? "All" : collegeFilter}</>}
              options={[{ value: "all", label: "All colleges" }, ...colleges.map((c) => ({ value: c, label: c }))]}
              value={collegeFilter}
              onPick={setCollegeFilter}
            />
          </div>
        </div>
        <p className="px-4 text-xs font-medium text-ink-faint sm:px-5">
          Showing {visible.length} of {rows.length} students.
        </p>
        <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-xs uppercase text-ink-muted">
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Program</th>
              <th className="px-4 py-3 text-center">Sessions</th>
              <th className="px-4 py-3">Upcoming</th>
              <th className="px-4 py-3 text-center">Open referrals</th>
              <th className="px-4 py-3 text-center">Latest screening</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => {
              const agg = perStudent.get(s.id);
              return (
                <tr key={s.id} className="border-b border-ink/5 align-top last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-bold text-ink">{s.anonymous_alias ?? "Student"}</p>
                    <p className="text-xs font-medium text-ink-muted">{s.student_no}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink">{s.program ?? "—"}</p>
                    <p className="text-xs font-medium text-ink-muted">
                      {[s.year_level, s.college].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-center">
                    {agg ? `${agg.completed}/${agg.total}` : "0/0"}
                    <span className="block text-[11px] font-medium text-ink-faint">done/booked</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {agg?.nextAt ? (
                      <span className="font-semibold text-ink">{shortDate(agg.nextAt)}</span>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                    {agg && agg.upcoming > 1 && (
                      <span className="block text-[11px] font-medium text-ink-faint">+{agg.upcoming - 1} more</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {agg && agg.openRefs > 0 ? (
                      <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                        {agg.openRefs} open
                      </span>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {agg?.band ? (
                      <Badge tone={bandTone(agg.band)}>{bandLabel(agg.band)}</Badge>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && !visible.length && (
          <p className="px-4 py-8 text-center text-sm text-ink-muted">
            No students match these filters. Try clearing the search or choosing another program.
          </p>
        )}
        {loading && (
          <div className="animate-pulse space-y-3 p-4" aria-hidden>
            <div className="h-10 rounded-xl bg-ink/10" />
            <div className="h-10 rounded-xl bg-ink/10" />
            <div className="h-10 rounded-xl bg-ink/10" />
          </div>
        )}
        </div>
      </Card>
    </div>
  );
}
