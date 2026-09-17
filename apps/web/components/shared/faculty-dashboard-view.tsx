"use client";

import Link from "next/link";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronRight,
  Inbox,
  Megaphone,
  MessagesSquare,
  RefreshCw,
  ShieldAlert,
  UserPlus,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useFacultyDashboard } from "@/lib/hooks/use-faculty-dashboard";
import { classificationSummary } from "@/components/referrals/status";
import { ReportTrendChart } from "@/components/shared/reports-charts";
import { cn } from "@/lib/utils";
import { timeAgoLong } from "@/lib/format";
import { EmptyState, PanelShell, ListSkeleton } from "@/components/shared/panel-shell";

const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  assigned: "bg-indigo-100 text-indigo-800",
  acknowledged: "bg-blue-100 text-blue-800",
  in_progress: "bg-blue-100 text-blue-800",
  confirmed: "bg-blue-100 text-blue-800",
  resolved: "bg-green-100 text-green-800",
  escalated: "bg-red-100 text-red-800",
  rejected: "bg-ink/10 text-ink-muted",
};

const PRIORITY_TONE: Record<string, string> = {
  low: "bg-ink/10 text-ink-muted",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-amber-100 text-amber-800",
  urgent: "bg-red-100 text-red-800",
};

const FACULTY_QUICK_LINKS = [
  { href: "/refer-student", label: "Refer Student", hint: "Flag a student for counseling", icon: UserPlus, chip: "bg-amber-50 text-amber-700" },
  { href: "/referrals", label: "Referrals", hint: "Track status", icon: Inbox, chip: "bg-amber-50 text-amber-700" },
  { href: "/reports", label: "Reports", hint: "Review my referrals", icon: BarChart3, chip: "bg-green-50 text-green-800" },
  { href: "/chat", label: "Chat", hint: "Message the office", icon: MessagesSquare, chip: "bg-blue-50 text-primary-700" },
  { href: "/announcements", label: "Announcements", hint: "Office news", icon: Megaphone, chip: "bg-amber-50 text-amber-700" },
  { href: "/emergency", label: "Emergency access", hint: "Crisis reveal", icon: ShieldAlert, chip: "bg-red-50 text-red-700" },
  { href: "/notifications", label: "Notifications", hint: "Updates on my referrals", icon: Bell, chip: "bg-blue-50 text-primary-700" },
] as const;

/**
 * Faculty dashboard — KPI cards on top (like the Reports page), then the
 * content + 320px rail grid with list-style quick links.
 * Data is the faculty member's own referrals only (RLS-enforced), cached
 * client-side so going back to /dashboard re-renders instantly (fresh for
 * 60s) and revalidates in the background.
 */
export function FacultyDashboardView({ name }: { name: string | null }) {
  const { data, isLoading, isError, error, refetch } = useFacultyDashboard();
  const loading = isLoading && !data;

  const unlinked = !loading && (data as { unlinked?: boolean } | undefined)?.unlinked === true;

  const kpis = !loading && data
    ? [
        { label: "My referrals", value: data.kpis.totalReferrals, sub: "Cases I flagged", href: "/referrals" },
        { label: "Waiting for triage", value: data.kpis.pending, sub: "Pending with the office", href: "/referrals" },
        { label: "With the office now", value: data.kpis.inProgress, sub: "Assigned → confirmed", href: "/referrals" },
        { label: "Resolved", value: data.kpis.resolved, sub: "Closed by a counselor", href: "/reports" },
        { label: "Unread updates", value: data.kpis.unreadNotifications, sub: "Referral updates for me", href: "/notifications" },
      ]
    : [];

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

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Welcome back{name ? `, ${name.split(" ")[0]}` : ""}</h1>
          <p className="mt-1 max-w-[600px] text-sm leading-relaxed text-ink-muted">
            Your referral overview — what you flagged, where each case sits, and what needs the office next.
          </p>
        </div>
        {!unlinked && (
          <Link
            href="/refer-student"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary-600 px-4 py-2 text-[13px] font-bold text-white shadow-card transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            Flag a student
          </Link>
        )}
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
          <p className="text-sm font-bold text-red-800">Couldn&apos;t load the dashboard</p>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {loading || !data
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-lg border border-ink/10 bg-white p-6 shadow-card">
                    <div className="h-3.5 w-2/3 rounded-full bg-ink/10" />
                    <div className="mt-3 h-8 w-1/3 rounded-lg bg-ink/10" />
                    <div className="mt-2 h-3 w-1/2 rounded-full bg-ink/10" />
                  </div>
                ))
              : kpis.map((c) => (
                  <Link
                    key={c.label}
                    href={c.href}
                    className="rounded-lg border border-ink/10 bg-white p-6 shadow-card transition hover:border-primary-300 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  >
                    <p className="text-[13px] font-medium text-ink-muted">{c.label}</p>
                    <p className="mt-1 font-display text-3xl font-bold text-ink">{c.value ?? "–"}</p>
                    <p className="mt-1 text-xs font-medium text-ink-faint">{c.sub}</p>
                  </Link>
                ))}
          </div>
          <PanelShell
            title="My referrals — last 14 days"
            hint="Cases I flagged by created date."
            viewAllHref="/reports"
          >
            {loading || !data ? (
              <div className="animate-pulse pt-4" aria-hidden>
                <div className="h-[180px] rounded-xl bg-ink/10" />
              </div>
            ) : !data.trend.some((b) => b.referrals > 0) ? (
              <EmptyState
                icon={CalendarDays}
                title="No referrals in the last 14 days"
                hint="Cases you flag will chart here."
              />
            ) : (
              <ReportTrendChart data={data.trend.map((b) => ({ day: b.day, sessions: b.referrals }))} />
            )}
          </PanelShell>
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-4">
            <PanelShell title="Needs the office" hint="Your pending + escalated referrals waiting on triage." viewAllHref="/referrals">
              {loading || !data ? (
                <ListSkeleton />
              ) : !data.attention.length ? (
                <EmptyState icon={Inbox} title="Nothing waiting" hint="Your flagged cases are all moving — new flags will show here while they wait." />
              ) : (
                <ul className="mt-3 divide-y divide-ink/10">
                  {data.attention.map((r) => (
                    <li key={r.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink">
                          {r.studentAlias}
                          <span className="ml-2 text-[11px] font-medium text-ink-faint">{timeAgoLong(r.createdAt)}</span>
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-[13px] text-ink-muted">
                          {classificationSummary(r.classification)} · {r.reason}
                        </p>
                      </div>
                      <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize", STATUS_TONE[r.status] ?? "bg-ink/10 text-ink-muted")}>
                        {r.status.replace(/_/g, " ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </PanelShell>

            <PanelShell title="My recent referrals" hint="Latest cases you flagged." viewAllHref="/referrals">
              {loading || !data ? (
                <ListSkeleton />
              ) : !data.recent.length ? (
                <EmptyState icon={UserPlus} title="No referrals yet" hint="Flag a student from the Referrals page — your cases will show up here." />
              ) : (
                <ul className="mt-3 divide-y divide-ink/10">
                  {data.recent.map((r) => (
                    <li key={r.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink">
                          {r.studentAlias}
                          <span className="ml-2 text-[11px] font-medium text-ink-faint">{timeAgoLong(r.createdAt)}</span>
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-[13px] text-ink-muted">
                          {classificationSummary(r.classification)} · {r.reason}
                        </p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold capitalize", PRIORITY_TONE[r.priority] ?? "bg-ink/10 text-ink-muted")}>
                          {r.priority}
                        </span>
                        <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize", STATUS_TONE[r.status] ?? "bg-ink/10 text-ink-muted")}>
                          {r.status.replace(/_/g, " ")}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </PanelShell>
          </div>

          <div className="min-w-0 space-y-4">
            <PanelShell title="Office news" hint="Latest published announcements." viewAllHref="/announcements">
              {loading || !data ? (
                <ListSkeleton />
              ) : !data.announcements.length ? (
                <EmptyState icon={Megaphone} title="No announcements" hint="News from the guidance office will show up here." />
              ) : (
                <ul className="mt-3 divide-y divide-ink/10">
                  {data.announcements.map((a) => (
                    <li key={a.id} className="py-2.5 first:pt-0 last:pb-0">
                      <p className="truncate text-sm font-bold text-ink">{a.title}</p>
                      {a.publishedAt && (
                        <p className="mt-0.5 text-[11px] font-medium text-ink-faint">{timeAgoLong(a.publishedAt)}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </PanelShell>

            <PanelShell title="Quick links">
              <ul className="mt-1 divide-y divide-ink/10">
                {FACULTY_QUICK_LINKS.map((q) => (
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
