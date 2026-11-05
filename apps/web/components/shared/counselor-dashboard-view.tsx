"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Inbox,
  MessagesSquare,
  RefreshCw,
  Sparkles,
  UserX,
} from "lucide-react";
import { AnimatedSection, Eyebrow, Stagger, StaggerItem } from "@/components/AnimatedSection";
import { useTheme } from "@/components/providers/theme-provider";
import {
  useCounselorDashboard,
  type CounselorDashboardPayload,
  type CounselorDashboardRange,
  type CounselorPeriod,
} from "@/lib/hooks/use-counselor-dashboard";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { statusLabel } from "@/components/referrals/status";
import { formatWhen, timeAgoLong } from "@/lib/format";
import { DarkEmpty, DarkPanel } from "./dashboard/dark-panel";
import { HeadStatCard } from "./dashboard/head-stat-card";
import { HeadTrendChart } from "./dashboard/head-trend-chart";
import { HeadDonut } from "./dashboard/head-donut";
import { HeadBars } from "./dashboard/head-bars";
import { HeadWeekChart } from "./dashboard/head-week-chart";
import { HeadSessionsLineChart } from "./dashboard/head-sessions-line-chart";
import {
  appointmentStatusColor,
  lightAppointmentStatusColor,
  lightModeColor,
  lightPriorityColor,
  modeColor,
  priorityColor,
} from "./dashboard/chart-palette";
import { CounselorDashboardBodySkeleton } from "./skeletons";

const COUNSELOR_PERIODS = [
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

function isoDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Label for the applied range, independent of the (possibly stale) payload. */
function rangeLabelOf(range: CounselorDashboardRange): string {
  if (range.period === "today") return "Today";
  if (range.period === "month") return "Last 30 days";
  if (range.period === "custom") {
    if (range.from && range.to) return `${isoDayLabel(range.from)} – ${isoDayLabel(range.to)}`;
    return "Custom range";
  }
  return "Last 7 days";
}

/** Comparison window wording for the trend chips' caption. */
function comparisonLabelOf(range: CounselorDashboardRange): string {
  if (range.period === "today") return "yesterday";
  if (range.period === "month") return "previous 30 days";
  if (range.period === "custom") return "previous period";
  return "previous 7 days";
}

const COUNSELOR_QUICK_LINKS = [
  { href: "/appointments", label: "My appointments", hint: "Confirm & complete", icon: CalendarCheck },
  { href: "/referrals", label: "Referrals inbox", hint: "Triage your queue", icon: Inbox },
  { href: "/chat", label: "Chat", hint: "Message students", icon: MessagesSquare },
  { href: "/availability", label: "Availability", hint: "Manage open slots", icon: Clock },
  { href: "/sessions", label: "Sessions calendar", hint: "Month, week, day", icon: CalendarDays },
  { href: "/reports", label: "Reports", hint: "Review my work", icon: BarChart3 },
] as const;

/** Dark-canvas list row for the counselor-only queue panels. */
function SessionRows({
  items,
  actionHint,
}: {
  items: CounselorDashboardPayload["today"];
  actionHint?: boolean;
}) {
  if (!items.length) return null;
  return (
    <ul className="mt-3 divide-y divide-white/10">
      {items.map((a) => (
        <li key={a.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">
              {formatWhen(a.scheduledAt)} · {a.studentAlias}
            </p>
            <p className="mt-0.5 line-clamp-1 text-[13px] text-blue-100/50">
              {actionHint
                ? a.status === "assigned"
                  ? "Needs confirmation"
                  : "Confirmed — mark complete after the session"
                : a.concern}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 text-[11px] font-bold capitalize text-blue-100/70">
            {a.status.replace(/_/g, " ")}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Counselor dashboard — same visual language as the guidance-head view:
 * dark canvas, period filter, filtered stat cards, fixed snapshot, and the
 * chart stack. Every number is scoped to the logged-in counselor's own
 * sessions, referrals, and queue.
 */
export function CounselorDashboardView({ name }: { name: string | null }) {
  const [range, setRange] = useState<CounselorDashboardRange>({ period: "week" });
  const { data, isLoading, isFetching, isError, error, refetch } = useCounselorDashboard(range);
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
  const unlinked = !loading && data?.unlinked === true;
  const filtered = data?.stats.filtered;
  const snapshot = data?.stats.snapshot;

  // Assigned-only action queue — appointments + referrals waiting for
  // confirmation. Filtered client-side too so stale caches never leak a
  // confirmed/resolved record into the queue.
  const actionAppts = (data?.actionQueue ?? []).filter((a) => a.status === "assigned");
  const actionRefs = (data?.actionReferrals ?? []).filter((r) => r.status === "assigned");
  const queueEmpty = !actionAppts.length && !actionRefs.length;

  return (
    <div
      className="-m-4 min-h-[calc(100vh-3.5rem)]"
      // Opts into the shared light-canvas text/border remaps in globals.css,
      // so this view reads correctly in both themes like the head dashboard.
      data-head-dashboard
    >
      <div className="relative overflow-hidden">
        <div className="relative z-10 space-y-5 px-4 pb-6 pt-4 sm:px-6 sm:pb-8 lg:px-8">
          {/* ── Hero ─────────────────────────────────────────────────────── */}
          <AnimatedSection>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Eyebrow compact>Guidance Office · My counseling overview</Eyebrow>

              <DateRangeFilter
                presets={COUNSELOR_PERIODS}
                preset={range.period}
                from={range.from ?? ""}
                to={range.to ?? ""}
                rangeLabel={rangeLabel}
                pending={pending}
                tone="dark"
                dialogLabel="Dashboard filters"
                customDefaults={{ from: isoDay(-29), to: isoDay() }}
                disableFuture
                footer="Your stats and charts follow the selected period. The at-a-glance cards stay live."
                onApply={(selection) => {
                  if (selection.preset === "custom") {
                    setRange({ period: "custom", from: selection.from, to: selection.to });
                    return;
                  }
                  setRange({ period: selection.preset as CounselorPeriod });
                }}
              />
            </div>

            <div className="mt-4 min-w-0">
              <h1 className="max-w-[720px] text-balance font-display text-[1.5rem] font-semibold leading-[1.15] tracking-[-0.025em] text-white sm:text-[1.85rem]">
                {greeting}
                {firstName ? `, ${firstName}` : ""}.{" "}
                <span className="font-serif font-normal italic text-yellow-300">
                  Here&apos;s your day.
                </span>
              </h1>
              <p className="mt-2 max-w-[620px] text-[13px] leading-relaxed text-blue-100/50">
                Your sessions, referrals, and confirmation queue — only your own caseload.
              </p>
            </div>
          </AnimatedSection>

          {/* ── Error / content ──────────────────────────────────────────── */}
          {isError && !data ? (
            <div role="alert" className="rounded-2xl border border-red-400/20 bg-red-500/[0.08] p-5 backdrop-blur-xl">
              <p className="text-sm font-bold text-red-200">Couldn&apos;t load the dashboard</p>
              <p className="mt-1 text-[13px] text-red-200/70">
                {(error as Error)?.message ?? "Something went wrong fetching your overview."}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-red-400 px-4 text-[12px] font-bold text-[#1E3A5F] transition hover:bg-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
              >
                <RefreshCw aria-hidden className="h-3.5 w-3.5" />
                Try again
              </button>
            </div>
          ) : loading ? (
            <CounselorDashboardBodySkeleton />
          ) : unlinked ? (
            <div className="rounded-2xl border border-yellow-300/20 bg-yellow-400/[0.08] p-5 backdrop-blur-xl">
              <p className="text-sm font-bold text-yellow-200">Counselor record not linked yet</p>
              <p className="mt-1 text-[13px] leading-relaxed text-yellow-200/70">
                Your login works, but no counselor row is linked to your account. Ask the guidance head
                to finish setup.
              </p>
            </div>
          ) : (
            <>
              {/* ── Filtered session cards ─────────────────────────────── */}
              <section aria-labelledby="filtered-stats-heading" className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2
                    id="filtered-stats-heading"
                    className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-100/40"
                  >
                    My sessions · {rangeLabel}
                  </h2>
                  <span className="text-[10px] font-medium text-blue-100/30">
                    Compared with the {comparisonLabelOf(range)}
                  </span>
                </div>

                <Stagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StaggerItem>
                    <HeadStatCard
                      label="Total sessions"
                      value={filtered?.total}
                      icon={CalendarDays}
                      hint={rangeLabel}
                      trend={filtered?.trends.total}
                    />
                  </StaggerItem>
                  <StaggerItem>
                    <HeadStatCard
                      label="Completed"
                      value={filtered?.completed}
                      icon={CheckCircle2}
                      hint="Marked complete"
                      trend={filtered?.trends.completed}
                    />
                  </StaggerItem>
                  <StaggerItem>
                    <HeadStatCard
                      label="Confirmed"
                      value={filtered?.confirmed}
                      icon={CalendarCheck}
                      hint="Booked and confirmed"
                      trend={filtered?.trends.confirmed}
                      accent="yellow"
                    />
                  </StaggerItem>
                  <StaggerItem>
                    <HeadStatCard
                      label="No-shows"
                      value={filtered?.noShow}
                      icon={UserX}
                      hint="Missed sessions"
                      trend={filtered?.trends.noShow}
                      accent="yellow"
                    />
                  </StaggerItem>
                </Stagger>
              </section>

              {/* ── Fixed at-a-glance snapshot ──────────────────────────── */}
              <section aria-labelledby="snapshot-heading" className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2
                    id="snapshot-heading"
                    className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-100/40"
                  >
                    At a glance
                  </h2>
                  <span className="text-[10px] font-medium text-blue-100/30">
                    Live — does not follow the period filter
                  </span>
                </div>

                <Stagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StaggerItem>
                    <HeadStatCard
                      label="Sessions today"
                      value={snapshot?.sessionsToday}
                      icon={Clock}
                      hint="On your calendar"
                      href="/appointments"
                    />
                  </StaggerItem>
                  <StaggerItem>
                    <HeadStatCard
                      label="Awaiting your confirmation"
                      value={snapshot?.awaitingConfirmation}
                      icon={CalendarClock}
                      hint="Sessions + referrals"
                      href="/appointments"
                      accent="yellow"
                    />
                  </StaggerItem>
                  <StaggerItem>
                    <HeadStatCard
                      label="Open referrals"
                      value={snapshot?.openReferrals}
                      icon={Inbox}
                      hint="Assigned to you"
                      href="/referrals"
                    />
                  </StaggerItem>
                  <StaggerItem>
                    <HeadStatCard
                      label="Open chats"
                      value={snapshot?.openChats}
                      icon={MessagesSquare}
                      hint="Student threads"
                      href="/chat"
                    />
                  </StaggerItem>
                </Stagger>
              </section>

              {/* ── Charts ───────────────────────────────────────────────── */}
              <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
                <DarkPanel
                  title="Sessions booked"
                  hint={`Appointments on your calendar · ${rangeLabel.toLowerCase()}`}
                >
                  <div className="mt-3">
                    <HeadSessionsLineChart points={data?.sessionTrend ?? []} />
                  </div>
                </DarkPanel>

                <DarkPanel title="Session status" hint="Every session in this window.">
                  <div className="mt-3">
                    <HeadDonut
                      items={data?.byStatus ?? []}
                      colorOf={darkCanvas ? appointmentStatusColor : lightAppointmentStatusColor}
                      centerLabel="sessions"
                      emptyTitle="No sessions in this window"
                      emptyHint="Sessions scheduled in the selected period will appear here."
                    />
                  </div>
                </DarkPanel>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <DarkPanel title="Session mode" hint="Online vs in-person sessions.">
                  <div className="mt-3">
                    <HeadBars
                      items={data?.byMode ?? []}
                      colorOf={darkCanvas ? modeColor : lightModeColor}
                      emptyTitle="No sessions to split"
                      emptyHint="Sessions in this window have no mode recorded."
                    />
                  </div>
                </DarkPanel>

                <DarkPanel title="Referral priority" hint="How quickly your referrals need attention.">
                  <div className="mt-3">
                    <HeadBars
                      items={data?.byReferralPriority ?? []}
                      colorOf={darkCanvas ? priorityColor : lightPriorityColor}
                      emptyTitle="No referral priority data"
                      emptyHint="Referrals assigned to you in this window have no priority recorded."
                    />
                  </div>
                </DarkPanel>
              </div>

              <DarkPanel
                title="Referrals over time"
                hint={`Referrals assigned to you · ${rangeLabel.toLowerCase()}`}
              >
                <div className="mt-3">
                  <HeadTrendChart points={data?.referralTrend ?? []} />
                </div>
              </DarkPanel>

              <DarkPanel title="Sessions this week" hint="Your appointments per day, rolling 7 days.">
                <div className="mt-3">
                  <HeadWeekChart points={data?.weekChart ?? []} />
                </div>
              </DarkPanel>

              {/* ── Counselor-only queue ─────────────────────────────────── */}
              <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <div className="min-w-0 space-y-4">
                  <DarkPanel
                    title="Needs your action"
                    hint="Assigned appointments and referrals waiting for your confirmation."
                  >
                    {queueEmpty ? (
                      <DarkEmpty
                        icon={CalendarCheck}
                        title="All confirmed"
                        hint="No assigned appointments or referrals waiting for confirmation."
                      />
                    ) : (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {actionAppts.map((a) => (
                          <Link
                            key={`appt-${a.id}`}
                            href={`/appointments#confirm-${a.id}`}
                            className="group flex min-w-0 flex-col gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/70"
                          >
                            <span className="flex items-center gap-2.5">
                              <span
                                aria-hidden
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-400/20 font-display text-[13px] font-bold text-yellow-200"
                              >
                                {a.studentAlias.trim().charAt(0).toUpperCase() || "S"}
                              </span>
                              <span className="min-w-0 flex-1 leading-tight">
                                <span className="block truncate text-sm font-bold text-white group-hover:text-yellow-200">
                                  {a.studentAlias}
                                </span>
                                <span className="mt-0.5 block text-[11px] font-medium text-blue-100/40">
                                  {formatWhen(a.scheduledAt)}
                                </span>
                              </span>
                              <span className="shrink-0 rounded-full border border-yellow-300/20 bg-yellow-400/15 px-2 py-0.5 text-[11px] font-bold capitalize text-yellow-200">
                                Assigned
                              </span>
                            </span>
                            <span className="line-clamp-2 text-[13px] leading-relaxed text-blue-100/50">
                              {a.concern}
                            </span>
                            <span className="mt-auto inline-flex items-center gap-1 pt-0.5 text-[12px] font-bold text-yellow-300/90 group-hover:underline">
                              Needs confirmation — tap to review &amp; confirm
                              <ChevronRight aria-hidden className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                            </span>
                          </Link>
                        ))}
                        {actionRefs.map((r) => (
                          <Link
                            key={`ref-${r.id}`}
                            href={`/referrals#triage-${r.id}`}
                            className="group flex min-w-0 flex-col gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/70"
                          >
                            <span className="flex items-center gap-2.5">
                              <span
                                aria-hidden
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/20 font-display text-[13px] font-bold text-blue-200"
                              >
                                {r.studentAlias.trim().charAt(0).toUpperCase() || "S"}
                              </span>
                              <span className="min-w-0 flex-1 leading-tight">
                                <span className="block truncate text-sm font-bold text-white group-hover:text-yellow-200">
                                  {r.studentAlias}
                                </span>
                                <span className="mt-0.5 block text-[11px] font-medium text-blue-100/40">
                                  Referred {timeAgoLong(r.createdAt)}
                                </span>
                              </span>
                              <span className="flex shrink-0 flex-col items-end gap-1">
                                <span className="rounded-full border border-yellow-300/20 bg-yellow-400/15 px-2 py-0.5 text-[11px] font-bold capitalize text-yellow-200">
                                  Assigned
                                </span>
                                <span className="rounded-full border border-blue-400/20 bg-blue-500/15 px-2 py-0.5 text-[11px] font-bold capitalize text-blue-200">
                                  {statusLabel(r.priority)}
                                </span>
                              </span>
                            </span>
                            <span className="line-clamp-2 text-[13px] leading-relaxed text-blue-100/50">
                              {r.reason}
                            </span>
                            <span className="mt-auto inline-flex items-center gap-1 pt-0.5 text-[12px] font-bold text-yellow-300/90 group-hover:underline">
                              Needs confirmation — tap to triage &amp; confirm
                              <ChevronRight aria-hidden className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </DarkPanel>

                  <DarkPanel title="Today's sessions" hint="Your calendar for today." viewAllHref="/appointments">
                    {!data?.today.length ? (
                      <DarkEmpty
                        icon={CalendarDays}
                        title="Nothing today"
                        hint="No sessions on your calendar today — check your upcoming appointments."
                      />
                    ) : (
                      <SessionRows items={data.today} />
                    )}
                  </DarkPanel>
                </div>

                <div className="min-w-0 space-y-4">
                  <DarkPanel
                    title="My referrals"
                    hint="Referrals currently assigned to you."
                    viewAllHref="/referrals"
                  >
                    {!data?.myReferrals.length ? (
                      <DarkEmpty
                        icon={Inbox}
                        title="No referrals assigned"
                        hint="Referrals assigned to you will show up here."
                      />
                    ) : (
                      <ul className="mt-3 divide-y divide-white/10">
                        {data.myReferrals.map((r) => (
                          <li key={r.id}>
                            <Link
                              href={`/referrals#focus-${r.id}`}
                              className="group flex items-start justify-between gap-3 rounded-md py-2.5 first:pt-0 last:pb-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/70"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-white group-hover:text-yellow-200">
                                  {r.studentAlias}
                                  <span className="ml-2 text-[11px] font-medium text-blue-100/35">
                                    {timeAgoLong(r.createdAt)}
                                  </span>
                                </p>
                                <p className="mt-0.5 line-clamp-1 text-[13px] text-blue-100/50">{r.reason}</p>
                              </div>
                              <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 text-[11px] font-bold capitalize text-blue-100/70">
                                {r.status.replace(/_/g, " ")}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </DarkPanel>

                  <DarkPanel title="Quick links" hint="Jump back into your workspace.">
                    <ul className="mt-1 divide-y divide-white/10">
                      {COUNSELOR_QUICK_LINKS.map((q) => (
                        <li key={q.href}>
                          <Link
                            href={q.href}
                            className="group flex items-center gap-3 rounded-md py-2.5 first:pt-1.5 last:pb-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/70"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-blue-200">
                              <q.icon className="h-4 w-4" aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1 leading-tight">
                              <span className="block truncate text-[13px] font-bold text-white group-hover:text-yellow-200">
                                {q.label}
                              </span>
                              <span className="block truncate text-xs font-medium text-blue-100/40">
                                {q.hint}
                              </span>
                            </span>
                            <ChevronRight
                              aria-hidden
                              className="h-4 w-4 shrink-0 text-blue-100/30 transition-transform group-hover:translate-x-0.5 group-hover:text-yellow-300"
                            />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </DarkPanel>

                  <DarkPanel title="Your caseload" hint={`Referrals assigned to you · ${rangeLabel.toLowerCase()}`}>
                    <dl className="mt-3 grid grid-cols-3 gap-3">
                      {[
                        { label: "Referrals", value: data?.stats.referrals.total, icon: Sparkles },
                        { label: "Resolved", value: data?.stats.referrals.resolved, icon: CheckCircle2 },
                        { label: "Escalated", value: data?.stats.referrals.escalated, icon: Inbox },
                      ].map((s) => (
                        <div key={s.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                          <s.icon className="h-4 w-4 text-blue-200" aria-hidden />
                          <dt className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-blue-100/40">
                            {s.label}
                          </dt>
                          <dd className="font-display text-xl font-semibold text-white">{s.value ?? "–"}</dd>
                        </div>
                      ))}
                    </dl>
                  </DarkPanel>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
