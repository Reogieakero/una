"use client";

import { Suspense } from "react";
import {
  BarChart3,
  PieChart as PieChartIcon,
  CalendarDays,
  ClipboardList,
  Inbox,
  RefreshCw,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ReportBars, ReportDonut, ReportTrendChart } from "@/components/shared/reports-charts";
import { CLASSIFICATIONS } from "@/components/referrals/status";
import { ReportsFilters, ReportsFiltersSkeleton } from "@/components/shared/reports-filters";
import { Spinner } from "@/components/ui/spinner";
import { useFacultyReports } from "@/lib/hooks/use-faculty-reports";
import type { FacultyReportsPayload } from "@/lib/hooks/use-faculty-reports";
import {
  buildTrendBuckets,
  rangeDay,
  type ReportRange,
  type ReportSection,
} from "@/lib/reports-scope";
import { timeAgoLong } from "@/lib/format";
import { EmptyState, PanelShell, ListSkeleton } from "@/components/shared/panel-shell";
import {
  CONCERN_META,
  FALLBACK_SLICE,
  PRIORITY_META,
  REFERRAL_STATUS_META,
} from "@/lib/report-palette";

const OPEN_REFERRALS = ["pending", "assigned", "acknowledged", "in_progress", "confirmed", "escalated"] as const;

function startOfTodayUTC(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

function pct(part: number, whole: number): string {
  if (!whole) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

function KpiSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-ink/10 bg-white p-6 shadow-card">
          <div className="h-3.5 w-2/3 rounded-full bg-ink/10" />
          <div className="mt-3 h-8 w-1/3 rounded-lg bg-ink/10" />
          <div className="mt-2 h-3 w-1/2 rounded-full bg-ink/10" />
        </div>
      ))}
    </>
  );
}

function ChartSkeleton() {
  return (
    <div className="animate-pulse pt-4" aria-hidden>
      <div className="h-[240px] rounded-xl bg-ink/10" />
    </div>
  );
}

function KpiGrid({ data }: { data: FacultyReportsPayload }) {
  const total = data.referrals.length;
  const resolved = data.referrals.filter((r) => r.status === "resolved").length;
  const open = data.referrals.filter((r) => (OPEN_REFERRALS as readonly string[]).includes(r.status)).length;
  const urgent = data.referrals.filter((r) => r.priority === "urgent").length;

  const cards = [
    { label: "My referrals", value: String(total), sub: "Cases I flagged" },
    { label: "My resolution rate", value: pct(resolved, total), sub: `${resolved} of ${total} resolved` },
    { label: "Still open", value: String(open), sub: "With the office now" },
    { label: "Urgent flags", value: String(urgent), sub: "Needs fastest triage" },
  ];

  return (
    <>
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border border-ink/10 bg-white p-6 shadow-card">
          <p className="text-[13px] font-medium text-ink-muted">{c.label}</p>
          <p className="mt-1 font-display text-3xl font-bold text-ink">{c.value}</p>
          <p className="mt-1 text-xs font-medium text-ink-faint">{c.sub}</p>
        </div>
      ))}
    </>
  );
}

function ReferralsTrend({ data, range }: { data: FacultyReportsPayload; range: ReportRange }) {
  const scoped = range.from !== null && range.to !== null;
  const t = scoped
    ? buildTrendBuckets(range.from as string, range.to as string)
    : (() => {
        const end = startOfTodayUTC();
        const start = new Date(end.getTime() - 13 * 24 * 60 * 60 * 1000);
        return buildTrendBuckets(start.toISOString(), end.toISOString());
      })();
  for (const row of data.referrals) t.place(row.created_at);
  const buckets = t.buckets;
  if (!buckets.some((b) => b.sessions > 0)) {
    return (
      <EmptyState
        icon={CalendarDays}
        title={scoped ? "No referrals in this range" : "No referrals in the last 14 days"}
        hint={scoped ? "Try widening the date range." : "Cases you flag will chart here."}
      />
    );
  }
  const peak = buckets.reduce((a, b) => (b.sessions > a.sessions ? b : a), buckets[0]);
  return (
    <>
      <p className="mt-2 text-[13px] text-ink-muted">
        Peak: <span className="font-bold text-ink">{peak.label}</span> with{" "}
        <span className="font-bold text-ink">{peak.sessions}</span> referral{peak.sessions === 1 ? "" : "s"}.
      </p>
      <ReportTrendChart data={buckets.map((b) => ({ day: b.label, sessions: b.sessions }))} />
    </>
  );
}

function ReferralStatus({ data }: { data: FacultyReportsPayload }) {
  const counts = new Map<string, number>();
  for (const row of data.referrals) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  const slices = [...counts.entries()]
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: REFERRAL_STATUS_META[k]?.label ?? k, value: v, color: REFERRAL_STATUS_META[k]?.color ?? FALLBACK_SLICE }));
  if (!slices.length) {
    return <EmptyState icon={PieChartIcon} title="No referrals yet" hint="Cases you flag will break down here." />;
  }
  return <ReportDonut data={slices} />;
}

function ReferralPriority({ data }: { data: FacultyReportsPayload }) {
  const order = ["low", "medium", "high", "urgent"];
  const counts = new Map<string, number>(order.map((k) => [k, 0]));
  for (const row of data.referrals) counts.set(row.priority, (counts.get(row.priority) ?? 0) + 1);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (!total) {
    return <EmptyState icon={BarChart3} title="No priorities yet" hint="Your urgent vs routine mix will show here." />;
  }
  return (
    <>
      <p className="mt-2 text-[13px] text-ink-muted">
        <span className="font-bold text-ink">{counts.get("urgent") ?? 0} urgent</span> ·{" "}
        <span className="font-bold text-ink">{counts.get("high") ?? 0} high</span> — the office triages these first.
      </p>
      <ReportBars
        data={order.map((k) => ({ label: PRIORITY_META[k].label, value: counts.get(k) ?? 0, color: PRIORITY_META[k].color }))}
      />
    </>
  );
}

function ConcernBreakdown({ data }: { data: FacultyReportsPayload }) {
  const counts = new Map<string, number>(CLASSIFICATIONS.map((k) => [k, 0]));
  for (const row of data.referrals) {
    for (const c of row.classification ?? []) {
      if (counts.has(c)) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (!total) {
    return <EmptyState icon={ClipboardList} title="No classifications yet" hint="The case kinds you flag will break down here." />;
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return (
    <>
      <p className="mt-2 text-[13px] text-ink-muted">
        What you flag most — <span className="font-bold text-ink">{top[0]}</span> leads
        this window.
      </p>
      <ReportBars
        data={CLASSIFICATIONS.map((k) => ({ label: CONCERN_META[k].label, value: counts.get(k) ?? 0, color: CONCERN_META[k].color }))}
      />
    </>
  );
}

function PipelineWatch({ data }: { data: FacultyReportsPayload }) {  const open = data.referrals.filter((r) => (OPEN_REFERRALS as readonly string[]).includes(r.status));
  const escalated = open.filter((r) => r.status === "escalated").length;
  const oldest = open.length ? open.map((r) => r.created_at).sort()[0] : null;
  const resolved = data.referrals.filter((r) => r.status === "resolved").length;
  const rows = [
    { label: "My open referrals", value: String(open.length), tone: "bg-blue-100 text-blue-800" },
    { label: "Escalated", value: String(escalated), tone: "bg-amber-100 text-amber-800" },
    { label: "Resolved", value: `${resolved} · ${pct(resolved, data.referrals.length)}`, tone: "bg-green-100 text-green-800" },
    { label: "Longest wait", value: oldest ? timeAgoLong(oldest) : "—", tone: "bg-red-100 text-red-800" },
  ];
  return (
    <ul className="mt-4 space-y-3">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center justify-between gap-3 rounded-xl bg-cream px-4 py-3">
          <span className="text-sm font-semibold text-ink-soft">{r.label}</span>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[13px] font-bold ${r.tone}`}>{r.value}</span>
        </li>
      ))}
      <li className="pt-1 text-[13px] text-ink-muted">
        Pending means the office hasn&apos;t assigned a counselor yet — resolved means the counselor closed the case.
      </li>
    </ul>
  );
}

function FacultyGuide() {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-card">
      <h2 className="font-display text-base font-bold text-ink">How to read my reports</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-[13px] leading-relaxed text-ink-muted">
        <li>
          <span className="font-bold text-ink">My resolution rate</span> = my resolved ÷ my flagged. Pending
          rows wait on the office to assign a counselor; resolved rows were closed by a counselor.
        </li>
        <li>
          <span className="font-bold text-ink">Still open</span> = my referrals the office is still working
          (pending, assigned, confirmed, escalated). Follow up in Chat if one waits too long.
        </li>
        <li>
          <span className="font-bold text-ink">Priority</span> is what you set when flagging — urgent + high
          are triaged first by the office.
        </li>
      </ul>
      <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
        Privacy: this page shows your aggregates only. Session details stay with the counseling team —
        you&apos;ll be notified when your referrals move.
      </p>
    </section>
  );
}

/**
 * Faculty reports — same layout as the counselor/head views, scoped to the
 * caller's own referrals. First visit fetches /api/reports/faculty once per
 * filter; going back (or re-picking a recent filter) re-renders the TanStack
 * Query cache instantly (fresh for 60s) and revalidates in the background.
 */
export function FacultyReportsView({
  firstName,
  section,
  range,
}: {
  firstName: string;
  section: ReportSection;
  range: ReportRange;
}) {
  const scope = {
    section,
    preset: range.preset,
    fromDay: rangeDay(range.from),
    toDay: rangeDay(range.to),
  };
  const { data, isPending, isError, error, isFetching, refetch } = useFacultyReports(scope);
  // The API echoes the section it fetched for. With keepPreviousData, a filter
  // switch keeps the previous payload while the new one loads — rendering that
  // stale payload as if it were the new filter flashes wrong numbers or false
  // "No X yet" empty states. Treat uncovered cached data as loading so panels
  // show skeletons until the new filter's payload arrives.
  const coversSection = !!data && (data.section === "all" || data.section === section);
  const loading = isPending || (isFetching && !coversSection);
  const showAll = section === "all";
  const showReferrals = showAll || section === "referrals";
  const showOperations = showAll || section === "operations";
  const scoped = range.from !== null && range.to !== null;
  const unlinked = !loading && (data as { unlinked?: boolean } | undefined)?.unlinked === true;

  return (
    <div className="space-y-6" aria-busy={isFetching}>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Reports</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">My reports{firstName ? ` — ${firstName}` : ""}</h1>
          <p className="mt-1 max-w-[560px] text-sm leading-relaxed text-ink-muted">
            Your referral outcomes — what you flagged, how fast the office moves, and what&apos;s still open.
            Aggregated and privacy-safe: counts and averages only, no student names.
          </p>
          {data && !loading && isFetching && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-ink-faint" aria-live="polite">
              <Spinner size="xs" label="Updating reports…" />
              Updating…
            </p>
          )}
        </div>
        <Suspense fallback={<ReportsFiltersSkeleton />}>
          <ReportsFilters
            section={section}
            preset={range.preset}
            fromDay={rangeDay(range.from)}
            toDay={rangeDay(range.to)}
            rangeLabel={range.label}
            fetching={isFetching}
          />
        </Suspense>
      </div>

      {unlinked ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-card">
          <p className="text-sm font-bold text-amber-800">Faculty record not linked yet</p>
          <p className="mt-1 text-[13px] text-amber-700">
            Your login works, but no faculty row is linked to your account. Ask the guidance head to finish setup.
          </p>
        </div>
      ) : isError && !data ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 shadow-card" role="alert">
          <p className="text-sm font-bold text-red-800">Couldn&apos;t load the reports</p>
          <p className="mt-1 text-[13px] text-red-700">
            {(error as Error)?.message ?? "Something went wrong fetching the overview."}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Try again
          </button>
        </div>
      ) : (
        <>
          {showAll && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {loading || !data ? <KpiSkeleton /> : <KpiGrid data={data} />}
            </div>
          )}

          {showReferrals && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <PanelShell
                  title={scoped ? `My referrals — ${range.label}` : "My referrals — last 14 days"}
                  hint={scoped ? `Cases I flagged by created date · ${range.label}.` : "Cases I flagged by created date."}
                >
                  {loading || !data ? <ChartSkeleton /> : <ReferralsTrend data={data} range={range} />}
                </PanelShell>
              </div>
              <PanelShell title="My referrals by status" hint="Where my flagged cases currently sit." viewAllHref="/referrals">
                {loading || !data ? <ChartSkeleton /> : <ReferralStatus data={data} />}
              </PanelShell>
              <PanelShell title="My referrals by priority" hint="My urgency mix — urgent + high first." viewAllHref="/referrals">
                {loading || !data ? <ChartSkeleton /> : <ReferralPriority data={data} />}
              </PanelShell>
              <div className="sm:col-span-2">
                <PanelShell title="My referrals by classification" hint="Case kinds from the official form — what you flag most.">
                  {loading || !data ? <ChartSkeleton /> : <ConcernBreakdown data={data} />}
                </PanelShell>
              </div>
            </div>
          )}

          {showOperations && (
            <div className="grid gap-4 sm:grid-cols-2">
              <PanelShell title="My pipeline watch" hint="What needs attention right now." viewAllHref="/referrals">
                {loading || !data ? <ListSkeleton /> : <PipelineWatch data={data} />}
              </PanelShell>
              <PanelShell title="What happens next" hint="Where each status goes.">
                <ul className="mt-4 space-y-3">
                  {[
                    { label: "Pending → assigned", desc: "The head picks a counselor for your flag." },
                    { label: "Assigned → confirmed", desc: "The counselor sets the session time." },
                    { label: "Confirmed → resolved", desc: "The counselor closes the case after the session." },
                  ].map((r) => (
                    <li key={r.label} className="rounded-xl bg-cream px-4 py-3">
                      <p className="text-sm font-bold text-ink">{r.label}</p>
                      <p className="mt-0.5 text-[13px] text-ink-muted">{r.desc}</p>
                    </li>
                  ))}
                  <li className="pt-1 text-[13px] text-ink-muted">
                    You&apos;ll be notified at each step — check Notifications for updates.
                  </li>
                </ul>
              </PanelShell>
            </div>
          )}

          {!showReferrals && !showOperations && (
            <PanelShell title="Faculty scope" hint="Sessions, satisfaction, and wellbeing stay with the counseling team.">
              <EmptyState
                icon={ClipboardList}
                title="Referrals only for faculty"
                hint="Your reports cover the cases you flagged. Switch the section to All, Referrals, or Operations to see them."
              />
            </PanelShell>
          )}

          {(showAll || showReferrals) && !loading && data && !data.referrals.length && (
            <PanelShell title="Get started" hint="Flag your first student.">
              <EmptyState
                icon={Inbox}
                title="No referrals in this window"
                hint="Flag a student from the Referrals page — your outcomes will chart here."
              />
            </PanelShell>
          )}

          {showAll && <FacultyGuide />}
        </>
      )}
    </div>
  );
}
