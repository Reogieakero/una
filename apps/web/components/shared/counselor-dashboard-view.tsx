"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock,
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
import { useCounselorDashboard } from "@/lib/hooks/use-counselor-dashboard";
import type { CounselorDashboardPayload } from "@/lib/hooks/use-counselor-dashboard";
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

const COUNSELOR_QUICK_LINKS = [
  { href: "/appointments", label: "My appointments", hint: "Confirm & complete", icon: CalendarCheck, chip: "bg-blue-50 text-primary-700" },
  { href: "/referrals", label: "Referrals inbox", hint: "Triage your queue", icon: Inbox, chip: "bg-amber-50 text-amber-700" },
  { href: "/chat", label: "Chat", hint: "Message students", icon: MessagesSquare, chip: "bg-blue-50 text-primary-700" },
  { href: "/availability", label: "Availability", hint: "Manage open slots", icon: Clock, chip: "bg-green-50 text-green-800" },
  { href: "/sessions", label: "Today's sessions", hint: "Month, week, day calendar", icon: CalendarDays, chip: "bg-blue-50 text-primary-700" },
  { href: "/reports", label: "Reports", hint: "Review my work", icon: BarChart3, chip: "bg-green-50 text-green-800" },
] as const;

function SessionRows({
  items,
  actionHint,
}: {
  items: CounselorDashboardPayload["today"];
  actionHint?: boolean;
}) {
  if (!items.length) return null;
  return (
    <ul className="mt-3 divide-y divide-ink/10">
      {items.map((a) => (
        <li key={a.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink">
              {formatWhen(a.scheduledAt)} · {a.studentAlias}
            </p>
            <p className="mt-0.5 line-clamp-1 text-[13px] text-ink-muted">
              {actionHint
                ? a.status === "assigned"
                  ? "Needs confirmation"
                  : "Confirmed — mark complete after the session"
                : a.concern}
            </p>
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
  );
}

/**
 * Counselor dashboard — same layout as the admin (guidance_head) view:
 * header with Stats dropdown, content + 320px rail grid, list-style quick
 * links. Data is personal-queue only and cached client-side, so going back
 * to /dashboard re-renders the TanStack Query cache instantly (fresh for
 * 60s) and revalidates in the background.
 */
export function CounselorDashboardView({ name }: { name: string | null }) {
  const { data, isLoading, isError, error, refetch } = useCounselorDashboard();
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

  const unlinked = !loading && (data as { unlinked?: boolean } | undefined)?.unlinked === true;

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
          <h1 className="font-display text-2xl font-bold">Welcome back{name ? `, ${name.split(" ")[0]}` : ""}</h1>
          <p className="mt-1 max-w-[600px] text-sm leading-relaxed text-ink-muted">
            Your day at a glance — today&apos;s sessions, what needs confirmation, and referrals assigned to you.
          </p>
        </div>
        {!unlinked && (
          <div ref={statsRef} className="relative shrink-0" onMouseEnter={openStats} onMouseLeave={scheduleStatsClose}>
            <button
              type="button"
              onClick={toggleStats}
              onFocus={openStats}
              onBlur={scheduleStatsClose}
              aria-haspopup="dialog"
              aria-expanded={statsOpen}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3.5 py-2 text-[13px] font-bold text-ink-soft shadow-card transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <BarChart3 className="h-4 w-4" aria-hidden />
              Stats
              <ChevronDown
                aria-hidden
                className={cn("h-4 w-4 transition-transform", statsOpen && "rotate-180")}
              />
            </button>
            {statsOpen && (
              <div
                role="dialog"
                aria-label="Key numbers"
                className="absolute right-0 top-full z-20 mt-2 w-72 overflow-hidden rounded-xl border border-ink/10 bg-white py-1 shadow-card"
              >
                {loading || !data ? (
                  <div className="animate-pulse px-4 py-3" aria-hidden>
                    <div className="h-10 rounded-lg bg-ink/10" />
                    <div className="mt-2 h-10 rounded-lg bg-ink/10" />
                    <div className="mt-2 h-10 rounded-lg bg-ink/10" />
                  </div>
                ) : (
                  [
                    { label: "My sessions today", value: data.kpis.sessionsToday, href: "/appointments" },
                    { label: "Awaiting confirmation", value: data.kpis.awaitingConfirmation, href: "/appointments" },
                    { label: "My open referrals", value: data.kpis.openReferrals, href: "/referrals" },
                    { label: "My open chats", value: data.kpis.openChats, href: "/chat" },
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
        )}
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
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-4">
              <PanelShell title="Needs your action" viewAllHref="/appointments">
                {loading || !data ? (
                  <ListSkeleton />
                ) : !data.actionQueue.length ? (
                  <EmptyState icon={CalendarCheck} title="Queue clear" hint="Nothing needs confirm / complete right now." />
                ) : (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {data.actionQueue.map((a) => (
                      <Link
                        key={a.id}
                        href="/appointments"
                        className="group flex min-w-0 flex-col gap-2.5 rounded-lg border border-ink/10 bg-white p-4 shadow-card transition hover:border-primary-300 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                      >
                        <span className="flex items-center gap-2.5">
                          <span
                            aria-hidden
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-[13px] font-bold text-white",
                              a.status === "assigned" ? "bg-indigo-500" : "bg-blue-600"
                            )}
                          >
                            {a.studentAlias.trim().charAt(0).toUpperCase() || "S"}
                          </span>
                          <span className="min-w-0 flex-1 leading-tight">
                            <span className="block truncate text-sm font-bold text-ink group-hover:text-primary-700">
                              {a.studentAlias}
                            </span>
                            <span className="mt-0.5 block text-[11px] font-medium text-ink-faint">
                              {formatWhen(a.scheduledAt)}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold capitalize",
                              APPT_TONE[a.status] ?? "bg-ink/10 text-ink-muted"
                            )}
                          >
                            {a.status}
                          </span>
                        </span>
                        <span className="line-clamp-2 text-[13px] leading-relaxed text-ink-muted">{a.concern}</span>
                        <span className="mt-auto inline-flex items-center gap-1 pt-0.5 text-[12px] font-bold text-primary-600 group-hover:underline">
                          {a.status === "assigned" ? "Needs confirmation" : "Confirmed — mark complete after the session"}
                          <ChevronRight aria-hidden className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </PanelShell>

              <PanelShell title="My referrals" viewAllHref="/referrals">
                {loading || !data ? (
                  <ListSkeleton />
                ) : !data.myReferrals.length ? (
                  <EmptyState icon={Inbox} title="No referrals assigned" hint="Referrals assigned to you will show up here." />
                ) : (
                  <ul className="mt-3 divide-y divide-ink/10">
                    {data.myReferrals.map((r) => (
                      <li key={r.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-ink">
                            {r.studentAlias}
                            <span className="ml-2 text-[11px] font-medium text-ink-faint">{timeAgoLong(r.createdAt)}</span>
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-[13px] text-ink-muted">{r.reason}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold capitalize text-blue-800">
                          {r.status.replace(/_/g, " ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </PanelShell>
            </div>

            <div className="min-w-0 space-y-4">
              <PanelShell title="Today's sessions" viewAllHref="/appointments">
                {loading || !data ? (
                  <ListSkeleton />
                ) : !data.today.length ? (
                  <EmptyState icon={CalendarDays} title="Nothing today" hint="No sessions on your calendar today — check upcoming below." />
                ) : (
                  <SessionRows items={data.today} />
                )}
              </PanelShell>

              <PanelShell title="Quick links">
                <ul className="mt-1 divide-y divide-ink/10">
                  {COUNSELOR_QUICK_LINKS.map((q) => (
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
