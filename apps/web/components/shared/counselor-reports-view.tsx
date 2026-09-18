"use client";

import { Suspense } from "react";
import {
  BarChart3,
  PieChart as PieChartIcon,
  CalendarDays,
  ClipboardList,
  Inbox,
  MessagesSquare,
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
import { ReportsFilters, ReportsFiltersSkeleton } from "@/components/shared/reports-filters";
import { Spinner } from "@/components/ui/spinner";
import { useCounselorReports } from "@/lib/hooks/use-counselor-reports";
import type { CounselorReportsPayload } from "@/lib/hooks/use-counselor-reports";
import {
  buildTrendBuckets,
  rangeDay,
  type ReportRange,
  type ReportSection,
} from "@/lib/reports-scope";
import { timeAgoLong } from "@/lib/format";
import { EmptyState, PanelShell, ListSkeleton } from "@/components/shared/panel-shell";
import {
  APPT_STATUS_META,
  FALLBACK_SLICE,
  MODE_COLORS,
  PRIORITY_META,
  REFERRAL_STATUS_META,
  STRESS_META,
  ratingColor,
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

/* ── Pure section renderers (same math as the old server components) ── */

function KpiSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
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

function KpiGrid({ data }: { data: CounselorReportsPayload }) {
  const total = data.appointments.length;
  const completed = data.appointments.filter((a) => a.status === "completed").length;
  const missed = data.appointments.filter((a) => ["cancelled", "rejected", "no_show"].includes(a.status)).length;
  const ratings = data.feedback.map((f) => f.rating);
  const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "—";
  const refTotal = data.referrals.length;
  const refResolved = data.referrals.filter((r) => r.status === "resolved").length;
  const refOpen = data.referrals.filter((r) => (OPEN_REFERRALS as readonly string[]).includes(r.status)).length;
  const highStress = data.screenings.filter((p) => p.band === "high").length;

  const cards = [
    { label: "My sessions", value: String(total), sub: "Sessions assigned to me" },
    { label: "Completed", value: String(completed), sub: `${pct(completed, total)} completion rate` },
    { label: "Missed", value: String(missed), sub: "Cancelled + rejected + no-show" },
    { label: "Avg. satisfaction", value: ratings.length ? `${avgRating} / 5` : "—", sub: `${ratings.length} ratings on my sessions` },
    { label: "My open referrals", value: String(refOpen), sub: "Assigned to me, waiting" },
    { label: "My resolution rate", value: pct(refResolved, refTotal), sub: `${refResolved} of ${refTotal} resolved` },
    { label: "High-stress screens", value: String(highStress), sub: "From students I've seen" },
    { label: "Feedback coverage", value: pct(ratings.length, completed), sub: "Responses per my completed session" },
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

function SessionsTrend({ data, range }: { data: CounselorReportsPayload; range: ReportRange }) {
  const scoped = range.from !== null && range.to !== null;
  const t = scoped
    ? buildTrendBuckets(range.from as string, range.to as string)
    : (() => {
        const end = startOfTodayUTC();
        const start = new Date(end.getTime() - 13 * 24 * 60 * 60 * 1000);
        return buildTrendBuckets(start.toISOString(), end.toISOString());
      })();
  for (const row of data.appointments) t.place(row.scheduled_at);
  const buckets = t.buckets;
  if (!buckets.some((b) => b.sessions > 0)) {
    return (
      <EmptyState
        icon={CalendarDays}
        title={scoped ? "No sessions in this range" : "No sessions in the last 14 days"}
        hint={scoped ? "Try widening the date range." : "Your booked sessions will chart here."}
      />
    );
  }
  const peak = buckets.reduce((a, b) => (b.sessions > a.sessions ? b : a), buckets[0]);
  return (
    <>
      <p className="mt-2 text-[13px] text-ink-muted">
        Peak: <span className="font-bold text-ink">{peak.label}</span> with{" "}
        <span className="font-bold text-ink">{peak.sessions}</span> session{peak.sessions === 1 ? "" : "s"}.
      </p>
      <ReportTrendChart data={buckets.map((b) => ({ day: b.label, sessions: b.sessions }))} />
    </>
  );
}

function AppointmentStatus({ data }: { data: CounselorReportsPayload }) {
  const counts = new Map<string, number>();
  for (const row of data.appointments) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  const slices = [...counts.entries()]
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: APPT_STATUS_META[k]?.label ?? k, value: v, color: APPT_STATUS_META[k]?.color ?? FALLBACK_SLICE }));
  if (!slices.length) {
    return <EmptyState icon={PieChartIcon} title="No sessions yet" hint="Your session breakdown will appear here." />;
  }
  return <ReportDonut data={slices} />;
}

function SessionMode({ data }: { data: CounselorReportsPayload }) {
  const counts = new Map<string, number>();
  for (const row of data.appointments) counts.set(row.mode, (counts.get(row.mode) ?? 0) + 1);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const rows = [...counts.entries()].map(([k, v]) => ({
    key: k,
    label: k === "in_person" ? "In person" : "Online",
    value: v,
    color: k === "in_person" ? MODE_COLORS.in_person : MODE_COLORS.online,
  }));
  if (!total) {
    return <EmptyState icon={MessagesSquare} title="No mode data yet" hint="Your in-person vs online split will show here." />;
  }
  return (
    <ul className="mt-4 space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-ink">{r.label}</span>
            <span className="font-semibold text-ink-muted">
              {r.value} · {pct(r.value, total)}
            </span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-ink/10">
            <div className="h-full rounded-full" style={{ width: `${total ? (r.value / total) * 100 : 0}%`, background: r.color }} />
          </div>
        </li>
      ))}
      <li className="pt-1 text-[13px] text-ink-muted">
        Use the split to plan your week across room and online slots.
      </li>
    </ul>
  );
}

function ReferralStatus({ data }: { data: CounselorReportsPayload }) {
  const counts = new Map<string, number>();
  for (const row of data.referrals) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  const slices = [...counts.entries()]
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: REFERRAL_STATUS_META[k]?.label ?? k, value: v, color: REFERRAL_STATUS_META[k]?.color ?? FALLBACK_SLICE }));
  if (!slices.length) {
    return <EmptyState icon={Inbox} title="No referrals assigned" hint="Referrals assigned to you will break down here." />;
  }
  return <ReportDonut data={slices} />;
}

function ReferralPriority({ data }: { data: CounselorReportsPayload }) {
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
        <span className="font-bold text-ink">{counts.get("high") ?? 0} high</span> — triage these first.
      </p>
      <ReportBars
        data={order.map((k) => ({ label: PRIORITY_META[k].label, value: counts.get(k) ?? 0, color: PRIORITY_META[k].color }))}
      />
    </>
  );
}

function Satisfaction({ data }: { data: CounselorReportsPayload }) {
  const rows = data.feedback;
  if (!rows.length) {
    return <EmptyState icon={ClipboardList} title="No ratings yet" hint="Ratings on your sessions will appear here." />;
  }
  const counts = [1, 2, 3, 4, 5].map((s) => ({
    label: `${s}★`,
    value: rows.filter((f) => f.rating === s).length,
    color: ratingColor(s),
  }));
  const avg = (rows.reduce((a, f) => a + f.rating, 0) / rows.length).toFixed(1);
  return (
    <>
      <p className="mt-2 text-[13px] text-ink-muted">
        Average <span className="font-bold text-ink">{avg} / 5</span> from{" "}
        <span className="font-bold text-ink">{rows.length}</span> responses on your sessions.
      </p>
      <ReportBars data={counts} />
    </>
  );
}

function RecentFeedback({ data }: { data: CounselorReportsPayload }) {
  const rows = [...data.feedback]
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, 5);
  if (!rows.length) {
    return <EmptyState icon={MessagesSquare} title="No feedback yet" hint="Comments on your sessions will show up here." />;
  }
  return (
    <ul className="mt-3 divide-y divide-ink/10">
      {rows.map((f, i) => (
        <li key={`${f.created_at}-${i}`} className="py-2.5 first:pt-0 last:pb-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-accent-500" aria-label={`${f.rating} out of 5 stars`}>
              {"★".repeat(f.rating)}
              <span className="text-ink/20">{"★".repeat(Math.max(0, 5 - f.rating))}</span>
            </p>
            <p className="text-[11px] font-medium text-ink-faint">{timeAgoLong(f.created_at)}</p>
          </div>
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-soft">
            {f.comment?.trim() || "No written comment."}
          </p>
        </li>
      ))}
    </ul>
  );
}

function StressBands({ data }: { data: CounselorReportsPayload }) {
  const rows = data.screenings;
  if (!rows.length) {
    return <EmptyState icon={BarChart3} title="No screenings yet" hint="Stress mix of students you've seen will appear here." />;
  }
  const order = ["low", "moderate", "high"];
  const counts = new Map(order.map((k) => [k, 0]));
  for (const r of rows) counts.set(r.band, (counts.get(r.band) ?? 0) + 1);
  const avg = (rows.reduce((a, r) => a + r.total_score, 0) / rows.length).toFixed(1);
  return (
    <>
      <p className="mt-2 text-[13px] text-ink-muted">
        Average PSS-10 <span className="font-bold text-ink">{avg} / 40</span> across{" "}
        <span className="font-bold text-ink">{rows.length}</span> screenings from your students.
      </p>
      <ReportDonut
        data={order.map((k) => ({ name: STRESS_META[k].label, value: counts.get(k) ?? 0, color: STRESS_META[k].color }))}
      />
    </>
  );
}

function ScreeningSummary({ data }: { data: CounselorReportsPayload }) {
  const rows = data.screenings;
  if (!rows.length) {
    return <EmptyState icon={ClipboardList} title="No screenings yet" hint="A quick summary will appear here." />;
  }
  const high = rows.filter((r) => r.band === "high").length;
  const moderate = rows.filter((r) => r.band === "moderate").length;
  const avg = (rows.reduce((a, r) => a + r.total_score, 0) / rows.length).toFixed(1);
  const summary = [
    { label: "Screenings", value: String(rows.length), tone: "bg-blue-100 text-blue-800" },
    { label: "Average score", value: `${avg} / 40`, tone: "bg-blue-100 text-blue-800" },
    { label: "High band", value: `${high} · ${pct(high, rows.length)}`, tone: "bg-red-100 text-red-800" },
    { label: "Moderate band", value: `${moderate} · ${pct(moderate, rows.length)}`, tone: "bg-amber-100 text-amber-800" },
  ];
  return (
    <ul className="mt-4 space-y-3">
      {summary.map((r) => (
        <li key={r.label} className="flex items-center justify-between gap-3 rounded-xl bg-cream px-4 py-3">
          <span className="text-sm font-semibold text-ink-soft">{r.label}</span>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[13px] font-bold ${r.tone}`}>{r.value}</span>
        </li>
      ))}
      <li className="pt-1 text-[13px] text-ink-muted">
        Follow up high-band students first — bands are signals, not diagnoses.
      </li>
    </ul>
  );
}

function PipelineWatch({ data }: { data: CounselorReportsPayload }) {
  const open = data.referrals.filter((r) => (OPEN_REFERRALS as readonly string[]).includes(r.status));
  const escalated = open.filter((r) => r.status === "escalated").length;
  const oldest = open.length
    ? open.map((r) => r.created_at).sort()[0]
    : null;
  const rows = [
    { label: "My open referrals", value: String(open.length), tone: "bg-blue-100 text-blue-800" },
    { label: "Escalated", value: String(escalated), tone: "bg-amber-100 text-amber-800" },
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
        Triage urgent + high first — acknowledge new referrals the same day.
      </li>
    </ul>
  );
}

function WorkloadSummary({ data }: { data: CounselorReportsPayload }) {
  const today = startOfTodayUTC();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const inToday = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= today.getTime() && t < tomorrow.getTime();
  };
  const completed = data.appointments.filter((a) => a.status === "completed").length;
  const open = data.appointments.filter((a) => ["assigned", "confirmed"].includes(a.status)).length;
  const todayCount = data.appointments.filter(
    (a) => ["assigned", "confirmed"].includes(a.status) && inToday(a.scheduled_at)
  ).length;
  const summary = [
    { label: "Total sessions", value: String(data.appointments.length), tone: "bg-blue-100 text-blue-800" },
    { label: "Completed", value: `${completed} · ${pct(completed, data.appointments.length)}`, tone: "bg-green-100 text-green-800" },
    { label: "Open right now", value: String(open), tone: "bg-amber-100 text-amber-800" },
    { label: "Sessions today", value: String(todayCount), tone: "bg-blue-100 text-blue-800" },
  ];
  return (
    <ul className="mt-4 space-y-3">
      {summary.map((r) => (
        <li key={r.label} className="flex items-center justify-between gap-3 rounded-xl bg-cream px-4 py-3">
          <span className="text-sm font-semibold text-ink-soft">{r.label}</span>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[13px] font-bold ${r.tone}`}>{r.value}</span>
        </li>
      ))}
      <li className="pt-1 text-[13px] text-ink-muted">
        Your personal load only — the office-wide ranking stays with the guidance head.
      </li>
    </ul>
  );
}

function TopConcerns({ data }: { data: CounselorReportsPayload }) {
  const rows = data.appointments.map((r) => r.concern?.trim()).filter(Boolean) as string[];
  if (!rows.length) {
    return <EmptyState icon={ClipboardList} title="No concerns logged yet" hint="Reasons your students book will rank here." />;
  }
  const counts = new Map<string, { label: string; count: number }>();
  for (const c of rows) {
    const key = c.toLowerCase();
    const e = counts.get(key) ?? { label: c, count: 0 };
    e.count += 1;
    counts.set(key, e);
  }
  const top = [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  return (
    <ul className="mt-4 space-y-3">
      {top.map((t) => (
        <li key={t.label}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-bold text-ink">{t.label}</span>
            <span className="shrink-0 font-semibold text-ink-muted">
              {t.count} · {pct(t.count, rows.length)}
            </span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-ink/10">
            <div
              className="h-full rounded-full bg-primary-500"
              style={{ width: `${(t.count / rows.length) * 100}%` }}
            />
          </div>
        </li>
      ))}
      <li className="pt-1 text-[13px] text-ink-muted">
        Use this ranking to prepare topics for your upcoming sessions.
      </li>
    </ul>
  );
}

function CounselorGuide() {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-card">
      <h2 className="font-display text-base font-bold text-ink">How to read my reports</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-[13px] leading-relaxed text-ink-muted">
        <li>
          <span className="font-bold text-ink">My completion rate</span> = my completed ÷ my booked. A falling
          rate with rising misses usually means reminders or slots need work.
        </li>
        <li>
          <span className="font-bold text-ink">My pipeline</span> = referrals assigned to me: assigned →
          confirmed → resolved. Escalated flags need urgent attention.
        </li>
        <li>
          <span className="font-bold text-ink">My satisfaction</span> only covers students who rated my sessions —
          compare the average against my feedback coverage before acting on a dip.
        </li>
        <li>
          <span className="font-bold text-ink">PSS-10 bands</span> come from screenings of students I&apos;ve seen,
          not diagnoses. A rising high-stress share is a signal to adjust capacity, not to label students.
        </li>
      </ul>
      <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
        Privacy: this page shows my aggregates only. Export Excel downloads my cases only — office-wide
        figures stay with the guidance head.
      </p>
    </section>
  );
}

/**
 * Counselor reports — same layout as the admin (guidance_head) view, scoped
 * to the caller's own cases. First visit fetches /api/reports/counselor once
 * per filter; going back (or re-picking a recent filter) re-renders the
 * TanStack Query cache instantly (fresh for 60s) and revalidates in the
 * background, so the page never blocks on the query waterfall again.
 */
export function CounselorReportsView({
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
  const { data, isPending, isError, error, isFetching, refetch } = useCounselorReports(scope);
  // The API only reads the tables the requested section needs and echoes the
  // section it fetched for. With keepPreviousData, a section switch keeps the
  // previous payload while the new one loads — that stale payload holds [] for
  // the newly-visible section, which would flash false "No X yet" empty
  // states. Treat uncovered cached data as loading so panels show skeletons
  // until the new section's payload arrives.
  const coversSection = !!data && (data.section === "all" || data.section === section);
  const loading = isPending || (isFetching && !coversSection);
  const showAll = section === "all";
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
            Your personal outcomes — your sessions, your referrals, your satisfaction. Aggregated and
            privacy-safe: counts and averages only, no student names.
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
          <p className="text-sm font-bold text-amber-800">Counselor record not linked yet</p>
          <p className="mt-1 text-[13px] text-amber-700">
            Your login works, but no counselor row is linked to your account. Ask the guidance head to finish setup.
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

          {(showAll || section === "sessions") && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <PanelShell
                  title={scoped ? `My sessions — ${range.label}` : "My sessions — last 14 days"}
                  hint={scoped ? `My bookings by scheduled date · ${range.label}.` : "My bookings by scheduled date, including upcoming."}
                >
                  {loading || !data ? <ChartSkeleton /> : <SessionsTrend data={data} range={range} />}
                </PanelShell>
              </div>
              <PanelShell title="My sessions by status" hint="Where my booked sessions currently sit." viewAllHref="/appointments">
                {loading || !data ? <ChartSkeleton /> : <AppointmentStatus data={data} />}
              </PanelShell>
              <PanelShell title="My session format" hint="My in-person load vs online capacity.">
                {loading || !data ? <ListSkeleton /> : <SessionMode data={data} />}
              </PanelShell>
            </div>
          )}

          {(showAll || section === "referrals") && (
            <div className="grid gap-4 sm:grid-cols-2">
              <PanelShell title="My referrals by status" hint="My assigned pipeline at a glance." viewAllHref="/referrals">
                {loading || !data ? <ChartSkeleton /> : <ReferralStatus data={data} />}
              </PanelShell>
              <PanelShell title="My referrals by priority" hint="My urgency mix — urgent + high first." viewAllHref="/referrals">
                {loading || !data ? <ChartSkeleton /> : <ReferralPriority data={data} />}
              </PanelShell>
              <div className="sm:col-span-2">
                <PanelShell title="My pipeline watch" hint="What needs my attention right now." viewAllHref="/referrals">
                  {loading || !data ? <ListSkeleton /> : <PipelineWatch data={data} />}
                </PanelShell>
              </div>
            </div>
          )}

          {(showAll || section === "satisfaction") && (
            <div className="grid gap-4 sm:grid-cols-2">
              <PanelShell title="My satisfaction" hint="Ratings on my sessions, 1–5 stars.">
                {loading || !data ? <ChartSkeleton /> : <Satisfaction data={data} />}
              </PanelShell>
              <PanelShell title="Latest feedback on my sessions" hint="Most recent comments from my students.">
                {loading || !data ? <ListSkeleton /> : <RecentFeedback data={data} />}
              </PanelShell>
            </div>
          )}

          {(showAll || section === "wellbeing") && (
            <div className="grid gap-4 sm:grid-cols-2">
              <PanelShell title="My students' stress (PSS-10)" hint="Screenings from students I've seen.">
                {loading || !data ? <ChartSkeleton /> : <StressBands data={data} />}
              </PanelShell>
              <PanelShell title="Screening summary" hint="What the numbers mean at a glance.">
                {loading || !data ? <ListSkeleton /> : <ScreeningSummary data={data} />}
              </PanelShell>
            </div>
          )}

          {(showAll || section === "operations") && (
            <div className="grid gap-4 sm:grid-cols-2">
              <PanelShell title="My workload" hint="My personal load this period." viewAllHref="/appointments">
                {loading || !data ? <ListSkeleton /> : <WorkloadSummary data={data} />}
              </PanelShell>
              <PanelShell title="My top concerns" hint="Most common reasons my students book.">
                {loading || !data ? <ListSkeleton /> : <TopConcerns data={data} />}
              </PanelShell>
            </div>
          )}

          {showAll && <CounselorGuide />}
        </>
      )}
    </div>
  );
}
