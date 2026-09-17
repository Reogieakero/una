"use client";

import { HoverMenu } from "@/components/shared/hover-menu";
import { Badge, Card, Input } from "@/components/ui/primitives";
import { formatWhen } from "@/lib/format";

export type Student = {
  id: string;
  student_no: string;
  program: string | null;
  year_level: string | null;
  college: string | null;
  anonymous_alias: string | null;
  created_at: string;
};

export type StudentAgg = {
  total: number;
  completed: number;
  upcoming: number;
  missed: number;
  nextAt: string | null;
  lastAt: string | null;
  openRefs: number;
  urgentRefs: number;
  band: string | null;
};

export function bandTone(b: string): "success" | "warning" | "danger" {
  if (b === "high") return "danger";
  if (b === "moderate") return "warning";
  return "success";
}

export function bandLabel(b: string): string {
  return b.charAt(0).toUpperCase() + b.slice(1);
}

/**
 * Privacy-safe directory — filters live inside, above the student table.
 * Extracted verbatim from page.tsx (shortDate now reuses shared formatWhen).
 */
export function StudentTable({
  visible,
  totalCount,
  loading,
  query,
  setQuery,
  programFilter,
  setProgramFilter,
  yearFilter,
  setYearFilter,
  collegeFilter,
  setCollegeFilter,
  programs,
  years,
  colleges,
  perStudent,
}: {
  visible: Student[];
  totalCount: number;
  loading: boolean;
  query: string;
  setQuery: (v: string) => void;
  programFilter: string;
  setProgramFilter: (v: string) => void;
  yearFilter: string;
  setYearFilter: (v: string) => void;
  collegeFilter: string;
  setCollegeFilter: (v: string) => void;
  programs: string[];
  years: string[];
  colleges: string[];
  perStudent: Map<string, StudentAgg>;
}) {
  return (
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
        Showing {visible.length} of {totalCount} students.
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
                    <span className="font-semibold text-ink">{formatWhen(agg.nextAt)}</span>
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
  );
}
