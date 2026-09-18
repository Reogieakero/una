"use client";

import { ReportBars, ReportDonut } from "@/components/shared/reports-charts";
import type { Student } from "./StudentTable";

export type AttentionItem = { student: Student; reasons: string[]; rank: number };
export type ProgramBar = { label: string; value: number };
export type ScreeningSlice = { name: string; value: number; color: string };

/**
 * Risk overview — needs-attention list, program bars, screening donut,
 * never-booked list. Extracted verbatim from page.tsx.
 * Page owns all memos; this is pure presentation.
 */
export function RiskSummary({
  loading,
  needsAttention,
  programBars,
  screeningDonut,
  neverBooked,
}: {
  loading: boolean;
  needsAttention: AttentionItem[];
  programBars: ProgramBar[];
  screeningDonut: ScreeningSlice[];
  neverBooked: Student[];
}) {
  return (
    <>
      {/* Needs attention + program mix */}
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <h2 className="font-display text-base font-bold text-ink">Needs attention</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">Urgent referrals, unsupported high stress, and repeated misses.</p>
          {loading ? (
            <div className="animate-pulse space-y-3 pt-3" aria-hidden>
              <div className="h-10 rounded-lg bg-ink/10" />
              <div className="h-10 rounded-lg bg-ink/10" />
              <div className="h-10 rounded-lg bg-ink/10" />
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
                      <span key={r} className="rounded-full bg-accent-100 px-2.5 py-0.5 text-[11px] font-bold text-accent-700">
                        {r}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-lg bg-cream px-4 py-3 text-[13px] text-ink-muted">
              Nothing urgent — no unsupported high-stress screens, urgent referrals, or repeat misses.
            </p>
          )}
        </section>
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <h2 className="font-display text-base font-bold text-ink">Students per program</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">Where to focus outreach and group sessions.</p>
          {loading ? (
            <div className="animate-pulse pt-4" aria-hidden>
              <div className="h-[240px] rounded-lg bg-ink/10" />
            </div>
          ) : programBars.length ? (
            <ReportBars data={programBars} />
          ) : (
            <p className="mt-3 rounded-lg bg-cream px-4 py-3 text-[13px] text-ink-muted">No program data yet.</p>
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
              <div className="h-[200px] rounded-lg bg-ink/10" />
            </div>
          ) : screeningDonut.length ? (
            <ReportDonut data={screeningDonut} />
          ) : (
            <p className="mt-3 rounded-lg bg-cream px-4 py-3 text-[13px] text-ink-muted">No screenings yet.</p>
          )}
        </section>
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <h2 className="font-display text-base font-bold text-ink">Never booked</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">Registered but no session yet — candidates for a nudge.</p>
          {loading ? (
            <div className="animate-pulse space-y-3 pt-3" aria-hidden>
              <div className="h-10 rounded-lg bg-ink/10" />
              <div className="h-10 rounded-lg bg-ink/10" />
              <div className="h-10 rounded-lg bg-ink/10" />
            </div>
          ) : neverBooked.length ? (
            <ul className="mt-3 max-h-[300px] divide-y divide-ink/10 overflow-y-auto">
              {neverBooked.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">{s.anonymous_alias ?? "Student"}</p>
                    <p className="mt-0.5 truncate text-xs font-medium text-ink-muted">{s.program ?? "Undeclared"}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary-100 px-2.5 py-0.5 text-[11px] font-bold text-primary-800">
                    Joined {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-lg bg-cream px-4 py-3 text-[13px] text-ink-muted">
              Everyone has booked at least once. Nice coverage.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
