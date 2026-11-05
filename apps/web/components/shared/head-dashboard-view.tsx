"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Inbox,
  MessagesSquare,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";
import { AnimatedSection, Eyebrow, Stagger, StaggerItem } from "@/components/AnimatedSection";
import { useTheme } from "@/components/providers/theme-provider";
import { useHeadDashboard, type HeadDashboardRange, type HeadPeriod } from "@/lib/hooks/use-head-dashboard";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { DarkPanel } from "./dashboard/dark-panel";
import { HeadDashboardBodySkeleton } from "./skeletons";
import { DashboardBackdrop } from "./dashboard/dashboard-backdrop";
import { HeadStatCard } from "./dashboard/head-stat-card";
import { HeadTrendChart } from "./dashboard/head-trend-chart";
import { HeadDonut } from "./dashboard/head-donut";
import { HeadBars } from "./dashboard/head-bars";
import { HeadWeekChart } from "./dashboard/head-week-chart";
import { HeadSessionsLineChart } from "./dashboard/head-sessions-line-chart";
import {
  lightPriorityColor,
  lightStatusColor,
  priorityColor,
  statusColor,
} from "./dashboard/chart-palette";

function isoDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Label for the applied range, independent of the (possibly stale) payload. */
function rangeLabelOf(range: HeadDashboardRange): string {
  if (range.period === "today") return "Today";
  if (range.period === "month") return "Last 30 days";
  if (range.period === "custom") {
    if (range.from && range.to) return `${isoDayLabel(range.from)} – ${isoDayLabel(range.to)}`;
    return "Custom range";
  }
  return "Last 7 days";
}

/** Comparison window wording for the trend chips' caption. */
function comparisonLabelOf(range: HeadDashboardRange): string {
  if (range.period === "today") return "yesterday";
  if (range.period === "month") return "previous 30 days";
  if (range.period === "custom") return "previous period";
  return "previous 7 days";
}

const HEAD_PERIODS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "custom", label: "Custom" },
];

/** Seed for the custom calendar when no explicit window is applied. */
function isoDay(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Guidance-head (admin) dashboard — cached client view.
 *
 * One immersive dark canvas inside the light staff shell. The period menu
 * drives every filtered card + referral chart; TanStack Query keys each range
 * separately and keeps the previous payload on screen, so switching periods
 * never blanks the page.
 */
export function HeadDashboardView({ name }: { name?: string | null }) {
  const [range, setRange] = useState<HeadDashboardRange>({ period: "week" });
  const { data, isLoading, isFetching, isError, error, refetch } = useHeadDashboard(range);
  const { resolvedTheme } = useTheme();
  const darkCanvas = resolvedTheme === "dark";

  const loading = isLoading && !data;
  const pending = isFetching && !isLoading;
  const rangeLabel = rangeLabelOf(range);

  // Client-only so server and client agree on hydration (the clock differs).
  const [greeting, setGreeting] = useState("Hello");
  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();
    setGreeting(hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
  }, []);

  const firstName = name?.trim().split(/\s+/)[0];
  const filtered = data?.stats.filtered;
  const snapshot = data?.stats.snapshot;

  return (
    <div className="-m-4 min-h-[calc(100vh-3.5rem)]" data-head-dashboard>
      <div className="relative overflow-hidden">
        <DashboardBackdrop />

        <div className="relative z-10 space-y-5 px-4 pb-6 pt-4 sm:px-6 sm:pb-8 lg:px-8">
          {/* ── Hero ─────────────────────────────────────────────────────── */}
          <AnimatedSection>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Eyebrow compact>Guidance Office · Office-wide overview</Eyebrow>

              <DateRangeFilter
                presets={HEAD_PERIODS}
                preset={range.period}
                from={range.from ?? ""}
                to={range.to ?? ""}
                rangeLabel={rangeLabel}
                pending={pending}
                tone="dark"
                dialogLabel="Dashboard filters"
                customDefaults={{ from: isoDay(-29), to: isoDay() }}
                disableFuture
                footer="Stats and referral charts follow the selected period. The office snapshot cards stay all-time / this week."
                onApply={(selection) => {
                  if (selection.preset === "custom") {
                    setRange({
                      period: "custom",
                      from: selection.from,
                      to: selection.to,
                    });
                    return;
                  }
                  setRange({ period: selection.preset as HeadPeriod });
                }}
              />
            </div>

            <div className="mt-4 min-w-0">
              <h1 className="max-w-[720px] text-balance font-display text-[1.5rem] font-semibold leading-[1.15] tracking-[-0.025em] text-white sm:text-[1.85rem]">
                {greeting}
                {firstName ? `, ${firstName}` : ""}.{" "}
                <span className="font-serif font-normal italic text-yellow-300">
                  Here&apos;s the office today.
                </span>
              </h1>
            </div>
          </AnimatedSection>

          {/* ── Error / content ──────────────────────────────────────────── */}
          {isError && !data ? (
            <div
              role="alert"
              className="rounded-2xl border border-red-400/20 bg-red-500/[0.08] p-5 backdrop-blur-xl"
            >
              <p className="text-sm font-bold text-red-200">Couldn&apos;t load the dashboard</p>
              <p className="mt-1 text-[13px] text-red-200/70">
                {(error as Error)?.message ?? "Something went wrong fetching the overview."}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-red-400 px-4 text-[12px] font-bold text-[#1E3A5F] transition hover:bg-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:opacity-60"
              >
                <RefreshCw aria-hidden className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                {isFetching ? "Retrying…" : "Try again"}
              </button>
            </div>
          ) : loading ? (
            <HeadDashboardBodySkeleton />
          ) : (
            <>
              {/* ── Filtered referral cards ─────────────────────────────── */}
              <section aria-labelledby="filtered-stats-heading" className="space-y-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2
                      id="filtered-stats-heading"
                      className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-100/40"
                    >
                      Referrals · {rangeLabel}
                    </h2>
                    <span className="text-[10px] font-medium text-blue-100/30">
                      Compared with the {comparisonLabelOf(range)}
                    </span>
                  </div>

                  <Stagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <StaggerItem>
                      <HeadStatCard
                        label="Total referrals"
                        value={filtered?.total}
                        icon={Inbox}
                        hint={rangeLabel}
                        trend={filtered?.trends.total}
                      />
                    </StaggerItem>
                    <StaggerItem>
                      <HeadStatCard
                        label="Pending"
                        value={filtered?.pending}
                        icon={BarChart3}
                        hint="Waiting for triage"
                        trend={filtered?.trends.pending}
                        accent="yellow"
                      />
                    </StaggerItem>
                    <StaggerItem>
                      <HeadStatCard
                        label="Assigned / In progress"
                        value={filtered?.assigned}
                        icon={Users}
                        hint="With a counselor"
                        trend={filtered?.trends.assigned}
                      />
                    </StaggerItem>
                    <StaggerItem>
                      <HeadStatCard
                        label="Resolved"
                        value={filtered?.resolved}
                        icon={Sparkles}
                        hint="Closed in this window"
                        trend={filtered?.trends.resolved}
                        accent="yellow"
                      />
                    </StaggerItem>
                  </Stagger>
                </section>

              {/* ── Fixed office snapshot ───────────────────────────────── */}
              <section aria-labelledby="snapshot-heading" className="space-y-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2
                      id="snapshot-heading"
                      className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-100/40"
                    >
                      Office snapshot
                    </h2>
                    <span className="text-[10px] font-medium text-blue-100/30">
                      Fixed — does not follow the period filter
                    </span>
                  </div>

                  <Stagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <StaggerItem>
                      <HeadStatCard
                        label="Upcoming sessions"
                        value={snapshot?.upcomingSessionsThisWeek}
                        icon={CalendarDays}
                        hint="Next 7 days"
                        href="/appointments"
                      />
                    </StaggerItem>
                    <StaggerItem>
                      <HeadStatCard
                        label="Active students"
                        value={snapshot?.activeStudents}
                        icon={Users}
                        hint="All time"
                        href="/users"
                      />
                    </StaggerItem>
                    <StaggerItem>
                      <HeadStatCard
                        label="Active counselors"
                        value={snapshot?.activeCounselors}
                        icon={MessagesSquare}
                        hint="All time"
                        href="/users"
                        accent="yellow"
                      />
                    </StaggerItem>
                  </Stagger>
                </section>

              {/* ── Charts ───────────────────────────────────────────────── */}
              <>
                  <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
                    <DarkPanel
                      title="Sessions booked"
                      hint={`Appointments booked · ${rangeLabel.toLowerCase()}`}
                    >
                      <div className="mt-3">
                        <HeadSessionsLineChart points={data?.sessionTrend ?? []} />
                      </div>
                    </DarkPanel>

                    <DarkPanel title="Pipeline by status" hint="Every status in this window.">
                      <div className="mt-3">
                        <HeadDonut
                          items={data?.byStatus ?? []}
                          colorOf={darkCanvas ? statusColor : lightStatusColor}
                          centerLabel="referrals"
                        />
                      </div>
                    </DarkPanel>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <DarkPanel title="Urgency" hint="How quickly a case needs attention.">
                      <div className="mt-3">
                        <HeadBars
                          items={data?.byUrgency ?? []}
                          colorOf={darkCanvas ? priorityColor : lightPriorityColor}
                          emptyTitle="No urgency data"
                          emptyHint="Referrals in this window have no priority recorded."
                        />
                      </div>
                    </DarkPanel>

                    <DarkPanel
                      title="Referrals over time"
                      hint={`Cases created · ${rangeLabel.toLowerCase()}`}
                    >
                      <div className="mt-3">
                        <HeadTrendChart points={data?.referralTrend ?? []} />
                      </div>
                    </DarkPanel>
                  </div>
                </>

              <DarkPanel
                title="Sessions this week"
                  hint="Appointments booked per day, rolling 7 days."
                >
                  <div className="mt-3">
                    <HeadWeekChart points={data?.weekChart ?? []} />
                  </div>
                </DarkPanel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
