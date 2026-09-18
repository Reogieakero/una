"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Inbox,
  Megaphone,
  MessagesSquare,
  Users,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useHeadDashboard } from "@/lib/hooks/use-head-dashboard";
import type { HeadDashboardPayload } from "@/lib/hooks/use-head-dashboard";
import { cn } from "@/lib/utils";
import { formatWhen, timeAgoLong } from "@/lib/format";
import { EmptyState, PanelShell, ListSkeleton } from "@/components/shared/panel-shell";

const APPT_TONE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  assigned: "bg-indigo-100 text-indigo-800",
  confirmed: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-ink/10 text-ink-muted",
  rejected: "bg-red-100 text-red-800",
  no_show: "bg-red-100 text-red-800",
};

const PRIORITY_META: Record<string, { label: string; pill: string; dot: string; avatar: string }> = {
  urgent: { label: "Urgent", pill: "bg-red-100 text-red-800", dot: "bg-red-500", avatar: "bg-red-100 text-red-700" },
  high: { label: "High", pill: "bg-amber-100 text-amber-800", dot: "bg-amber-500", avatar: "bg-amber-100 text-amber-800" },
  medium: { label: "Medium", pill: "bg-blue-100 text-blue-800", dot: "bg-blue-500", avatar: "bg-blue-50 text-primary-700" },
  low: { label: "Low", pill: "bg-green-100 text-green-800", dot: "bg-green-500", avatar: "bg-green-50 text-green-800" },
};

const HEAD_QUICK_LINKS = [
  { href: "/appointments", label: "Appointments", hint: "See what's booked", icon: CalendarDays, chip: "bg-blue-50 text-primary-700" },
  { href: "/referrals", label: "Referrals", hint: "Check the inbox", icon: Inbox, chip: "bg-amber-50 text-amber-700" },
  { href: "/users", label: "Users", hint: "Manage accounts", icon: Users, chip: "bg-green-50 text-green-800" },
  { href: "/chat", label: "Chat", hint: "Message students", icon: MessagesSquare, chip: "bg-blue-50 text-primary-700" },
  { href: "/announcements", label: "Announcements", hint: "Post an update", icon: Megaphone, chip: "bg-amber-50 text-amber-700" },
  { href: "/reports", label: "Reports", hint: "Review reports", icon: BarChart3, chip: "bg-green-50 text-green-800" },
] as const;

/** Referrals waiting — grid of compact cards, each linking to triage. */
function ReferralsWaitingSection({
  items,
  total,
  loading,
}: {
  items: HeadDashboardPayload["referralsWaiting"] | undefined;
  total: number;
  loading: boolean;
}) {
  const shown = (items ?? []).slice(0, 6);
  return (
    <section aria-label="Referrals waiting">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-base font-bold text-ink">Referrals waiting</h2>
        {!loading && shown.length > 0 ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
            {total > shown.length ? `${shown.length} of ${total} waiting` : `${shown.length} waiting`}
          </span>
        ) : null}
        <Link href="/referrals" className="ml-auto text-[13px] font-bold text-primary-600 hover:underline">
          View all
        </Link>
      </div>
      <p className="mt-0.5 text-[13px] text-ink-muted">
        Newest first — open a card to assign a counselor.
      </p>
      {loading ? (
        <ListSkeleton />
      ) : !shown.length ? (
        <div className="flex items-center gap-3 py-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700 ring-1 ring-green-100">
            <Inbox className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink">All clear — nothing waiting</p>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              New referrals will show up here.{" "}
              <Link href="/referrals" className="font-bold text-primary-600 hover:underline">
                Open the inbox
              </Link>
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((r) => {
            const meta = PRIORITY_META[r.priority] ?? PRIORITY_META["medium"];
            return (
              <Link
                key={r.id}
                href={`/referrals#focus-${r.id}`}
                className="group flex min-w-0 flex-col gap-2.5 rounded-lg border border-ink/10 bg-white p-4 shadow-card transition hover:border-primary-300 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <span className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-[13px] font-bold",
                      meta.avatar
                    )}
                  >
                    {r.studentAlias.trim().charAt(0).toUpperCase() || "S"}
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-sm font-bold text-ink group-hover:text-primary-700">
                      {r.studentAlias}
                    </span>
                    <span className="mt-0.5 block text-[11px] font-medium text-ink-faint">
                      Referred {timeAgoLong(r.createdAt)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
                      meta.pill
                    )}
                  >
                    <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                    {meta.label}
                  </span>
                </span>
                <span className="line-clamp-2 text-[13px] leading-relaxed text-ink-muted">{r.reason}</span>
                <span className="mt-auto inline-flex items-center gap-1 pt-0.5 text-[12px] font-bold text-primary-600 group-hover:underline">
                  Review referral
                  <ChevronRight aria-hidden className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function UpcomingSessionsPanel({
  items,
  loading,
}: {
  items: HeadDashboardPayload["upcomingSessions"] | undefined;
  loading: boolean;
}) {
  const nearest = (items ?? []).slice(0, 1);
  return (
    <PanelShell title="Upcoming sessions" viewAllHref="/appointments">
      {loading ? (
        <ListSkeleton />
      ) : !nearest.length ? (
        <EmptyState
          icon={BarChart3}
          title="Nothing booked ahead"
          hint="New sessions will show up here once students start booking."
        />
      ) : (
        <ul className="mt-3 divide-y divide-ink/10">
          {nearest.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">{formatWhen(a.scheduledAt)}</p>
                <p className="mt-0.5 line-clamp-1 text-[13px] text-ink-muted">{a.concern}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize",
                  APPT_TONE[a.status] ?? "bg-ink/10 text-ink-muted"
                )}
              >
                {a.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

function NeedsCounselorPanel({
  items,
  loading,
}: {
  items: HeadDashboardPayload["unassigned"] | undefined;
  loading: boolean;
}) {
  return (
    <PanelShell title="Needs a counselor" viewAllHref="/referrals">
      {loading ? (
        <ListSkeleton />
      ) : !items?.length ? (
        <EmptyState icon={Inbox} title="Everyone's assigned" hint="Every waiting referral already has a counselor." />
      ) : (
        <ul className="mt-3 divide-y divide-ink/10">
          {items.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink">
                  {r.studentAlias}
                  <span className="ml-2 text-[11px] font-medium text-ink-faint">{timeAgoLong(r.createdAt)}</span>
                </p>
                <p className="mt-0.5 line-clamp-1 text-[13px] text-ink-muted">{r.reason}</p>
              </div>
              <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold capitalize text-red-800">
                {r.priority}
              </span>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

/**
 * Guidance-head (admin) dashboard — cached client view.
 * First visit fetches /api/dashboard/head once; going back re-renders the
 * TanStack Query cache instantly (fresh for 60s) and revalidates in the
 * background, so the page never blocks on the query waterfall again.
 */
export function HeadDashboardView() {
  const { data, isLoading, isError, error, refetch } = useHeadDashboard();
  const loading = isLoading && !data;

  // KPI stats live in a floating panel — hidden until the Stats button is
  // clicked or hovered. Closes on outside click / Escape / mouse leave,
  // like the notifications bell.
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

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Dashboard</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 max-w-[600px] text-sm leading-relaxed text-ink-muted">
            Office-wide overview — referrals waiting, upcoming sessions, and counselor needs.
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
              aria-label="Key numbers"
              className="absolute right-0 top-full z-20 mt-2 w-72 overflow-hidden rounded-lg border border-ink/10 bg-white py-1 shadow-card"
            >
              {loading || !data ? (
                <div className="animate-pulse px-4 py-3" aria-hidden>
                  <div className="h-10 rounded-lg bg-ink/10" />
                  <div className="mt-2 h-10 rounded-lg bg-ink/10" />
                  <div className="mt-2 h-10 rounded-lg bg-ink/10" />
                </div>
              ) : (
                [
                  { label: "Sessions today", value: data.kpis.sessionsToday, href: "/appointments" },
                  { label: "Referrals waiting", value: data.kpis.referralsWaiting, href: "/referrals" },
                  { label: "Unread messages", value: data.kpis.openChats, href: "/chat" },
                ].map((s) => (
                  <Link
                    key={s.label}
                    href={s.href}
                    onClick={() => setStatsOpen(false)}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 transition hover:bg-cream focus-visible:outline-none focus-visible:bg-cream"
                  >
                    <span className="text-[13px] font-medium text-ink-muted">{s.label}</span>
                    <span className="font-display text-xl font-bold text-ink">{s.value ?? "–"}</span>
                  </Link>
                ))
              )}
            </div>
          )}
          </div>
      </div>

      {isError && !data ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 shadow-card" role="alert">
          <p className="text-sm font-bold text-red-800">Couldn&apos;t load the dashboard</p>
          <p className="mt-1 text-[13px] text-red-700">
            {(error as Error)?.message ?? "Something went wrong fetching the overview."}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 inline-flex h-8 items-center gap-1.5 rounded bg-red-600 px-4 text-[13px] font-bold text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-4">
              <ReferralsWaitingSection items={data?.referralsWaiting} total={data?.kpis.referralsWaiting ?? 0} loading={loading || !data} />

              <NeedsCounselorPanel items={data?.unassigned} loading={loading || !data} />
            </div>

            <div className="min-w-0 space-y-4">
              <UpcomingSessionsPanel items={data?.upcomingSessions} loading={loading || !data} />

              <PanelShell title="Quick links">
                <ul className="mt-1 divide-y divide-ink/10">
                  {HEAD_QUICK_LINKS.map((q) => (
                    <li key={q.href}>
                      <Link
                        href={q.href}
                        className="group flex items-center gap-3 rounded-md py-2.5 first:pt-1.5 last:pb-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                      >
                        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", q.chip)}>
                          <q.icon className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1 leading-tight">
                          <span className="block truncate text-[13px] font-bold text-ink group-hover:text-primary-700">
                            {q.label}
                          </span>
                          <span className="block truncate text-xs font-medium text-ink-muted">{q.hint}</span>
                        </span>
                        <ChevronRight
                          aria-hidden
                          className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-primary-600"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </PanelShell>

            </div>
          </div>
        </>
      )}
    </div>
  );
}
