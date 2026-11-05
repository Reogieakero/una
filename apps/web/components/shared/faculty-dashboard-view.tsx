"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock,
  ChevronRight,
  Inbox,
  Megaphone,
  MessagesSquare,
  RefreshCw,
  ShieldAlert,
  UserPlus,
} from "lucide-react";
import { AnimatedSection, Eyebrow, Stagger, StaggerItem } from "@/components/AnimatedSection";
import { useTheme } from "@/components/providers/theme-provider";
import { useFacultyDashboard } from "@/lib/hooks/use-faculty-dashboard";
import { classificationSummary } from "@/components/referrals/status";
import { timeAgoLong } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DarkEmpty, DarkPanel } from "./dashboard/dark-panel";
import { HeadStatCard } from "./dashboard/head-stat-card";
import { HeadTrendChart } from "./dashboard/head-trend-chart";
import { HeadDonut } from "./dashboard/head-donut";
import { HeadBars } from "./dashboard/head-bars";
import {
  classificationColor,
  lightClassificationColor,
  lightPriorityColor,
  lightStatusColor,
  priorityColor,
  statusColor,
} from "./dashboard/chart-palette";
import { FacultyDashboardBodySkeleton } from "./skeletons";

const FACULTY_QUICK_LINKS = [
  { href: "/refer-student", label: "Refer a student", hint: "Flag a student for counseling", icon: UserPlus },
  { href: "/referrals", label: "Referrals", hint: "Track my cases", icon: Inbox },
  { href: "/reports", label: "Reports", hint: "Review my referrals", icon: BarChart3 },
  { href: "/chat", label: "Chat", hint: "Message the office", icon: MessagesSquare },
  { href: "/announcements", label: "Announcements", hint: "Office news", icon: Megaphone },
  { href: "/emergency", label: "Emergency access", hint: "Crisis reveal", icon: ShieldAlert },
  { href: "/notifications", label: "Notifications", hint: "Updates on my referrals", icon: Bell },
] as const;

/** Dark-canvas list row used by the faculty referral panels. */
function ReferralRows({
  items,
  showPriority = false,
}: {
  items: {
    id: string;
    studentAlias: string;
    reason: string;
    status: string;
    priority: string;
    createdAt: string;
    classification: string[];
  }[];
  showPriority?: boolean;
}) {
  return (
    <ul className="mt-3 divide-y divide-white/10">
      {items.map((r) => (
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
              <p className="mt-0.5 line-clamp-1 text-[13px] text-blue-100/50">
                {classificationSummary(r.classification)} · {r.reason}
              </p>
            </div>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 text-[11px] font-bold capitalize text-blue-100/70">
                {r.status.replace(/_/g, " ")}
              </span>
              {showPriority && (
                <span className="rounded-full border border-yellow-300/20 bg-yellow-400/10 px-2 py-0.5 text-[10px] font-bold capitalize text-yellow-200">
                  {r.priority}
                </span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Faculty dashboard — the same dark-canvas visual language as the counselor
 * and guidance-head dashboards, scoped to the faculty member's own referrals.
 * RLS enforces the scope; the cached query keeps repeat visits instant.
 */
export function FacultyDashboardView({ name }: { name: string | null }) {
  const { data, isLoading, isFetching, isError, error, refetch } = useFacultyDashboard();
  const { resolvedTheme } = useTheme();
  const darkCanvas = resolvedTheme === "dark";

  const loading = isLoading && !data;
  const unlinked = !loading && (data as { unlinked?: boolean } | undefined)?.unlinked === true;

  // Client-only so server and client agree on hydration (the clock differs).
  const [greeting, setGreeting] = useState("Hello");
  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();
    setGreeting(hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
  }, []);

  const firstName = name?.trim().split(/\s+/)[0];
  const kpis = data?.kpis;
  const trend = data?.trend ?? [];
  const byStatus = data?.byStatus ?? [];
  const byPriority = data?.byPriority ?? [];
  const byClassification = data?.byClassification ?? [];
  const attention = data?.attention ?? [];
  const recent = data?.recent ?? [];
  const announcements = data?.announcements ?? [];
  const hasTrend = trend.some((b) => b.referrals > 0);

  return (
    <div
      className="-m-4 min-h-[calc(100vh-3.5rem)]"
      // Opts into the shared light-canvas text/border remaps in globals.css so
      // this view reads correctly in both themes, like the counselor dashboard.
      data-head-dashboard
    >
      <div className="relative overflow-hidden">
        <div className="relative z-10 space-y-5 px-4 pb-6 pt-4 sm:px-6 sm:pb-8 lg:px-8">
          {/* ── Hero ─────────────────────────────────────────────────────── */}
          <AnimatedSection>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Eyebrow compact>Guidance Office · My referral overview</Eyebrow>
              {!unlinked && (
                <Link
                  href="/refer-student"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-[12px] font-bold text-white backdrop-blur transition hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/70"
                >
                  <UserPlus className="h-4 w-4" aria-hidden />
                  Refer a student
                </Link>
              )}
            </div>

            <div className="mt-4 min-w-0">
              <h1 className="max-w-[720px] text-balance font-display text-[1.5rem] font-semibold leading-[1.15] tracking-[-0.025em] text-white sm:text-[1.85rem]">
                {greeting}
                {firstName ? `, ${firstName}` : ""}.{" "}
                <span className="font-serif font-normal italic text-yellow-300">
                  Here&apos;s your referral desk.
                </span>
              </h1>
              <p className="mt-2 max-w-[620px] text-[13px] leading-relaxed text-blue-100/50">
                Every case you flagged, where it sits now, and what the Guidance Office needs next.
              </p>
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
                {(error as Error)?.message ?? "Something went wrong fetching your overview."}
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
            <FacultyDashboardBodySkeleton />
          ) : unlinked ? (
            <div className="rounded-2xl border border-yellow-300/20 bg-yellow-400/[0.08] p-5 backdrop-blur-xl">
              <p className="text-sm font-bold text-yellow-200">Faculty record not linked yet</p>
              <p className="mt-1 text-[13px] leading-relaxed text-yellow-200/70">
                Your login works, but no faculty row is linked to your account. Ask the guidance head
                to finish setup.
              </p>
            </div>
          ) : (
            <>
              {/* ── Referral stat cards ────────────────────────────────── */}
              <section aria-labelledby="faculty-stats-heading" className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2
                    id="faculty-stats-heading"
                    className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-100/40"
                  >
                    My referrals · all time
                  </h2>
                  <span className="text-[10px] font-medium text-blue-100/30">
                    Live counts — tap a card to open that view
                  </span>
                </div>

                <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  <StaggerItem>
                    <HeadStatCard
                      label="My referrals"
                      value={kpis?.totalReferrals}
                      icon={Inbox}
                      hint="Cases I flagged"
                      href="/referrals"
                    />
                  </StaggerItem>
                  <StaggerItem>
                    <HeadStatCard
                      label="Pending triage"
                      value={kpis?.pending}
                      icon={Clock}
                      hint="Waiting for the office"
                      href="/referrals"
                      accent="yellow"
                    />
                  </StaggerItem>
                  <StaggerItem>
                    <HeadStatCard
                      label="With the office"
                      value={kpis?.inProgress}
                      icon={CalendarDays}
                      hint="Assigned → confirmed"
                      href="/referrals"
                    />
                  </StaggerItem>
                  <StaggerItem>
                    <HeadStatCard
                      label="Resolved"
                      value={kpis?.resolved}
                      icon={CheckCircle2}
                      hint="Closed by a counselor"
                      href="/reports"
                    />
                  </StaggerItem>
                  <StaggerItem>
                    <HeadStatCard
                      label="Unread updates"
                      value={kpis?.unreadNotifications}
                      icon={Bell}
                      hint="Referral updates for me"
                      href="/notifications"
                      accent="yellow"
                    />
                  </StaggerItem>
                </Stagger>
              </section>

              {/* ── Charts ───────────────────────────────────────────────── */}
              <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
                <DarkPanel title="Referrals over time" hint="Cases I flagged · rolling 14 days.">
                  <div className="mt-3">
                    {hasTrend ? (
                      <HeadTrendChart
                        points={trend.map((b, i) => ({
                          key: `${b.day}-${i}`,
                          label: b.day,
                          count: b.referrals,
                        }))}
                      />
                    ) : (
                      <DarkEmpty
                        icon={CalendarDays}
                        title="No referrals in the last 14 days"
                        hint="Cases you flag will chart here."
                      />
                    )}
                  </div>
                </DarkPanel>

                <DarkPanel title="Where my cases sit" hint="All-time status split.">
                  <div className="mt-3">
                    {byStatus.length ? (
                      <HeadDonut
                        items={byStatus}
                        colorOf={darkCanvas ? statusColor : lightStatusColor}
                        centerLabel="referrals"
                        emptyTitle="No referrals yet"
                        emptyHint="Cases you flag will break down here."
                      />
                    ) : (
                      <DarkEmpty
                        icon={Inbox}
                        title="No referrals yet"
                        hint="Cases you flag will break down here."
                      />
                    )}
                  </div>
                </DarkPanel>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <DarkPanel title="My urgency mix" hint="Urgent and high cases are triaged first.">
                  <div className="mt-3">
                    {byPriority.length ? (
                      <HeadBars
                        items={byPriority}
                        colorOf={darkCanvas ? priorityColor : lightPriorityColor}
                        emptyTitle="No priority data"
                        emptyHint="Your urgent vs routine mix will show here."
                      />
                    ) : (
                      <DarkEmpty
                        icon={BarChart3}
                        title="No priority data"
                        hint="Your urgent vs routine mix will show here."
                      />
                    )}
                  </div>
                </DarkPanel>

                <DarkPanel title="What I flag most" hint="Case kinds from the official referral form.">
                  <div className="mt-3">
                    {byClassification.length ? (
                      <HeadBars
                        items={byClassification}
                        colorOf={darkCanvas ? classificationColor : lightClassificationColor}
                        emptyTitle="No classifications yet"
                        emptyHint="The case kinds you flag will break down here."
                        note="Classification is multi-select on the paper form, so one referral can appear in more than one bar."
                      />
                    ) : (
                      <DarkEmpty
                        icon={BarChart3}
                        title="No classifications yet"
                        hint="The case kinds you flag will break down here."
                      />
                    )}
                  </div>
                </DarkPanel>
              </div>

              {/* ── Queues ───────────────────────────────────────────────── */}
              <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <div className="min-w-0 space-y-4">
                  <DarkPanel
                    title="Needs the office"
                    hint="Your pending + escalated referrals waiting on triage."
                    viewAllHref="/referrals"
                  >
                    {!attention.length ? (
                      <DarkEmpty
                        icon={Inbox}
                        title="Nothing waiting"
                        hint="Your flagged cases are all moving — new flags will show here while they wait."
                      />
                    ) : (
                      <ReferralRows items={attention} />
                    )}
                  </DarkPanel>

                  <DarkPanel
                    title="My recent referrals"
                    hint="Latest cases I flagged."
                    viewAllHref="/referrals"
                  >
                    {!recent.length ? (
                      <DarkEmpty
                        icon={UserPlus}
                        title="No referrals yet"
                        hint="Flag a student from the Refer a student page — your cases will show up here."
                      />
                    ) : (
                      <ReferralRows items={recent} showPriority />
                    )}
                  </DarkPanel>
                </div>

                <div className="min-w-0 space-y-4">
                  <DarkPanel
                    title="Office news"
                    hint="Latest published announcements."
                    viewAllHref="/announcements"
                  >
                    {!announcements.length ? (
                      <DarkEmpty
                        icon={Megaphone}
                        title="No announcements"
                        hint="News from the guidance office will show up here."
                      />
                    ) : (
                      <ul className="mt-3 divide-y divide-white/10">
                        {announcements.map((a) => (
                          <li key={a.id} className="py-2.5 first:pt-0 last:pb-0">
                            <Link
                              href="/announcements"
                              className="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/70"
                            >
                              <p className="truncate text-sm font-bold text-white group-hover:text-yellow-200">
                                {a.title}
                              </p>
                              {a.publishedAt && (
                                <p className="mt-0.5 text-[11px] font-medium text-blue-100/35">
                                  {timeAgoLong(a.publishedAt)}
                                </p>
                              )}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </DarkPanel>

                  <DarkPanel title="Quick links" hint="Jump back into your workspace.">
                    <ul className="mt-1 divide-y divide-white/10">
                      {FACULTY_QUICK_LINKS.map((q) => (
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
                              className={cn(
                                "h-4 w-4 shrink-0 text-blue-100/30 transition-transform group-hover:translate-x-0.5 group-hover:text-yellow-300"
                              )}
                            />
                          </Link>
                        </li>
                      ))}
                    </ul>
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
