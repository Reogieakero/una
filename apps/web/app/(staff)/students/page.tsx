"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Badge, Card, Input } from "@/components/ui/primitives";
import { Dropdown } from "@/components/shared/dropdown";
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
 * Shared /students — one URL, role-aware UI (same pattern as /appointments).
 * Privacy-safe directory: aliases only, plus per-student workload aggregates
 * (sessions, open referrals, latest screening band).
 */
export default function StudentsPage() {
  const [role, setRole] = useState<string | null>(null);
  const [counselorId, setCounselorId] = useState<string | null>(null);
  const [rows, setRows] = useState<Student[]>([]);
  const [appts, setAppts] = useState<ApptLite[]>([]);
  const [refs, setRefs] = useState<RefLite[]>([]);
  const [screens, setScreens] = useState<ScreenLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [programFilter, setProgramFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [collegeFilter, setCollegeFilter] = useState("all");
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        const r = (profile as { role: string } | null)?.role ?? null;
        setRole(r);
        if (!r || !["counselor", "guidance_head"].includes(r)) return;
        if (r === "counselor") {
          // Counselor scope — only students on my caseload: my sessions,
          // referrals assigned to me, and my chat threads.
          const { data: c } = await supabase.from("counselors").select("id").eq("profile_id", user.id).single();
          const cid = (c as { id: string } | null)?.id ?? null;
          setCounselorId(cid);
          if (!cid) {
            setRows([]);
            return;
          }
          const [{ data: apptRows }, { data: refRows }, { data: threadRows }] = await Promise.all([
            supabase.from("appointments").select("student_id, scheduled_at, status").eq("counselor_id", cid).limit(1000),
            supabase.from("referrals").select("student_id, status, priority").eq("assigned_counselor_id", cid).limit(1000),
            supabase.from("chat_threads").select("student_id").eq("counselor_id", cid).limit(500),
          ]);
          const myIds = [
            ...new Set([
              ...(((apptRows ?? []) as { student_id: string }[]).map((a) => a.student_id)),
              ...(((refRows ?? []) as { student_id: string }[]).map((x) => x.student_id)),
              ...(((threadRows ?? []) as { student_id: string }[]).map((t) => t.student_id)),
            ]),
          ];
          const studentList: Student[] = [];
          for (let i = 0; i < myIds.length; i += 200) {
            const chunk = myIds.slice(i, i + 200);
            if (!chunk.length) break;
            const { data } = await supabase
              .from("students")
              .select("id, student_no, program, year_level, college, anonymous_alias, created_at")
              .in("id", chunk);
            studentList.push(...((data ?? []) as Student[]));
          }
          studentList.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
          const screenList: ScreenLite[] = [];
          for (let i = 0; i < myIds.length; i += 200) {
            const chunk = myIds.slice(i, i + 200);
            if (!chunk.length) break;
            const { data } = await supabase
              .from("pss10_assessments")
              .select("student_id, band, created_at")
              .in("student_id", chunk)
              .order("created_at", { ascending: false })
              .limit(1000);
            screenList.push(...((data ?? []) as ScreenLite[]));
          }
          setRows(studentList.slice(0, 300));
          setAppts(((apptRows ?? []) as ApptLite[]));
          setRefs(((refRows ?? []) as RefLite[]));
          setScreens(screenList);
          return;
        }
        const [{ data: studentRows }, { data: apptRows }, { data: refRows }, { data: screenRows }] = await Promise.all([
          supabase
            .from("students")
            .select("id, student_no, program, year_level, college, anonymous_alias, created_at")
            .order("created_at", { ascending: false })
            .limit(300),
          supabase.from("appointments").select("student_id, scheduled_at, status").limit(1000),
          supabase.from("referrals").select("student_id, status, priority").limit(1000),
          supabase.from("pss10_assessments").select("student_id, band, created_at").order("created_at", { ascending: false }).limit(1000),
        ]);
        setRows(((studentRows ?? []) as Student[]));
        setAppts(((apptRows ?? []) as ApptLite[]));
        setRefs(((refRows ?? []) as RefLite[]));
        setScreens(((screenRows ?? []) as ScreenLite[]));
      } catch {
        toast.error("Couldn't load students right now.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      <div>
        <h1 className="font-display text-2xl font-bold">{role === "counselor" ? "My students" : "Students"}</h1>
        <p className="mt-1 max-w-[600px] text-sm leading-relaxed text-ink-muted">
          {role === "counselor"
            ? "Your caseload — students from your sessions, assigned referrals, and chats. Aliases only, with each student's load with you."
            : "Privacy-safe directory — aliases only, with each student's session load, open referrals, and latest screening band."}
        </p>
      </div>

      {role === "counselor" && !counselorId && !loading && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-card">
          <p className="text-sm font-bold text-amber-800">Counselor record not linked yet</p>
          <p className="mt-1 text-[13px] text-amber-700">
            Your login works, but no counselor row is linked to your account. Ask the guidance head to finish setup.
          </p>
        </div>
      )}

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

      {/* Filters */}
      <Card className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Dropdown
            menuKey="program"
            openMenuKey={openMenuKey}
            onOpenChange={setOpenMenuKey}
            value={programFilter}
            onChange={setProgramFilter}
            ariaLabel="Filter by program"
            options={[{ value: "all", label: "All programs" }, ...programs.map((p) => ({ value: p, label: p }))]}
          />
          <Dropdown
            menuKey="year"
            openMenuKey={openMenuKey}
            onOpenChange={setOpenMenuKey}
            value={yearFilter}
            onChange={setYearFilter}
            ariaLabel="Filter by year level"
            options={[{ value: "all", label: "All year levels" }, ...years.map((y) => ({ value: y, label: y }))]}
          />
          <Dropdown
            menuKey="college"
            openMenuKey={openMenuKey}
            onOpenChange={setOpenMenuKey}
            value={collegeFilter}
            onChange={setCollegeFilter}
            ariaLabel="Filter by college"
            options={[{ value: "all", label: "All colleges" }, ...colleges.map((c) => ({ value: c, label: c }))]}
          />
          <Input
            placeholder="Search alias, no., or program…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <p className="text-xs font-medium text-ink-faint">
          Showing {visible.length} of {rows.length} students.
        </p>
      </Card>

      {/* Directory */}
      <Card className="overflow-x-auto p-0">
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
      </Card>
    </div>
  );
}
