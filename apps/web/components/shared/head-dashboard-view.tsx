"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  Clock,
  Inbox,
  Megaphone,
  Menu,
  MessagesSquare,
  UserRound,
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

/** Referral statuses are their own lifecycle — don't reuse appointment tones. */
const REFERRAL_STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  assigned: "bg-indigo-100 text-indigo-800",
  acknowledged: "bg-blue-100 text-blue-800",
  in_progress: "bg-blue-100 text-blue-800",
  confirmed: "bg-blue-100 text-blue-800",
  resolved: "bg-green-100 text-green-800",
  escalated: "bg-red-100 text-red-800",
  rejected: "bg-ink/10 text-ink-muted",
};

const PRIORITY_META: Record<string, { label: string; pill: string; dot: string; avatar: string }> = {
  urgent: { label: "Urgent", pill: "bg-red-100 text-red-800", dot: "bg-red-500", avatar: "bg-red-100 text-red-700" },
  high: { label: "High", pill: "bg-amber-100 text-amber-800", dot: "bg-amber-500", avatar: "bg-amber-100 text-amber-800" },
  medium: { label: "Medium", pill: "bg-blue-100 text-blue-800", dot: "bg-blue-500", avatar: "bg-blue-50 text-primary-700" },
  low: { label: "Low", pill: "bg-green-100 text-green-800", dot: "bg-green-500", avatar: "bg-green-50 text-green-800" },
};

/** Small meta line (scheduled moment, booked time) — icons instead of dot separators. */
function MetaItem({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Icon aria-hidden className="h-3 w-3 shrink-0" />
      {children}
    </span>
  );
}

const HEAD_QUICK_LINKS = [
  { href: "/appointments", label: "Appointments", hint: "See what's booked", icon: CalendarDays, chip: "bg-blue-50 text-primary-700" },
  { href: "/referrals", label: "Referrals", hint: "Check the inbox", icon: Inbox, chip: "bg-amber-50 text-amber-700" },
  { href: "/users", label: "Users", hint: "Manage accounts", icon: Users, chip: "bg-green-50 text-green-800" },
  { href: "/chat", label: "Chat", hint: "Message students", icon: MessagesSquare, chip: "bg-blue-50 text-primary-700" },
  { href: "/announcements", label: "Announcements", hint: "Post an update", icon: Megaphone, chip: "bg-amber-50 text-amber-700" },
  { href: "/reports", label: "Reports", hint: "Review reports", icon: BarChart3, chip: "bg-green-50 text-green-800" },
] as const;

/** Latest bookings — newest appointment requests, each linking to the row. */
function LatestBookingsSection({
  items,
  loading,
}: {
  items: HeadDashboardPayload["latestBookings"] | undefined;
  loading: boolean;
}) {
  return (
    <PanelShell title="Latest bookings" hint="Newest appointment requests from students." viewAllHref="/appointments">
      {loading ? (
        <ListSkeleton />
      ) : !items?.length ? (
        <EmptyState
          icon={CalendarDays}
          title="No bookings yet"
          hint="New appointment requests will show up here as students book."
        />
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((a) => (
            <Link
              key={a.id}
              href={`/appointments#focus-${a.id}`}
              className="group flex min-w-0 flex-col gap-2.5 rounded-lg border border-ink/10 bg-cream/40 p-4 transition hover:border-primary-300 hover:bg-white hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <div className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 font-display text-[13px] font-bold text-primary-700"
                >
                  {a.studentAlias.trim().charAt(0).toUpperCase() || "S"}
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-sm font-bold text-ink group-hover:text-primary-700">
                    {a.studentAlias}
                    {a.isAnonymous ? (
                      <span className="ml-2 rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-bold text-ink-muted">
                        Anonymous
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-ink-faint">Booked {timeAgoLong(a.createdAt)}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize",
                    APPT_TONE[a.status] ?? "bg-ink/10 text-ink-muted"
                  )}
                >
                  {a.status.replace(/_/g, " ")}
                </span>
              </div>
              <p className="line-clamp-2 text-[13px] leading-relaxed text-ink-muted">{a.concern}</p>
              <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-ink/10 pt-2.5 text-[11px] font-medium text-ink-faint">
                <MetaItem icon={CalendarDays}>{formatWhen(a.scheduledAt)}</MetaItem>
              </div>
            </Link>
          ))}
        </div>
      )}
    </PanelShell>
  );
}

/** Referrals by faculty — newest cases flagged, with who filed them. */
function FacultyReferralsSection({
  items,
  loading,
}: {
  items: HeadDashboardPayload["facultyReferrals"] | undefined;
  loading: boolean;
}) {
  return (
    <PanelShell title="Referrals by faculty" hint="Latest cases faculty flagged for the office." viewAllHref="/referrals">
      {loading ? (
        <ListSkeleton />
      ) : !items?.length ? (
        <EmptyState icon={Inbox} title="No referrals yet" hint="Cases flagged by faculty will show up here." />
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((r) => {
            const meta = PRIORITY_META[r.priority] ?? PRIORITY_META["medium"];
            return (
              <Link
                key={r.id}
                href={`/referrals#focus-${r.id}`}
                className="group flex min-w-0 flex-col gap-2.5 rounded-lg border border-ink/10 bg-cream/40 p-4 transition hover:border-primary-300 hover:bg-white hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <div className="flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-[13px] font-bold",
                      meta.avatar
                    )}
                  >
                    {r.studentAlias.trim().charAt(0).toUpperCase() || "S"}
                  </span>
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-sm font-bold text-ink group-hover:text-primary-700">{r.studentAlias}</p>
                    <p className="mt-1 text-[11px] font-medium text-ink-faint">{timeAgoLong(r.createdAt)}</p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
                      meta.pill
                    )}
                  >
                    <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                    {meta.label}
                  </span>
                </div>
                <p className="line-clamp-2 text-[13px] leading-relaxed text-ink-muted">{r.reason}</p>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-ink/10 pt-2.5">
                  <MetaItem icon={UserRound}>Referred by {r.facultyName}</MetaItem>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize",
                      REFERRAL_STATUS_TONE[r.status] ?? "bg-ink/10 text-ink-muted"
                    )}
                  >
                    {r.status.replace(/_/g, " ")}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PanelShell>
  );
}

/** Unassigned appointments — still waiting for the head to pick a counselor. */
function UnassignedAppointmentsPanel({
  items,
  loading,
}: {
  items: HeadDashboardPayload["unassignedAppointments"] | undefined;
  loading: boolean;
}) {
  return (
    <PanelShell title="Unassigned appointments" hint="Latest bookings with no counselor yet." viewAllHref="/appointments">
      {loading ? (
        <ListSkeleton />
      ) : !items?.length ? (
        <EmptyState icon={Inbox} title="Everyone's assigned" hint="Every active booking already has a counselor." />
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((a) => (
            <Link
              key={a.id}
              href={`/appointments#focus-${a.id}`}
              className="group flex min-w-0 flex-col gap-2.5 rounded-lg border border-ink/10 bg-cream/40 p-4 transition hover:border-primary-300 hover:bg-white hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <div className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 font-display text-[13px] font-bold text-amber-700"
                >
                  {a.studentAlias.trim().charAt(0).toUpperCase() || "S"}
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-sm font-bold text-ink group-hover:text-primary-700">{a.studentAlias}</p>
                  <p className="mt-1 text-[11px] font-medium text-ink-faint">Booked {timeAgoLong(a.createdAt)}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize",
                    APPT_TONE[a.status] ?? "bg-ink/10 text-ink-muted"
                  )}
                >
                  {a.status.replace(/_/g, " ")}
                </span>
              </div>
              <p className="line-clamp-2 text-[13px] leading-relaxed text-ink-muted">{a.concern}</p>
              <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-ink/10 pt-2.5 text-[11px] font-medium text-ink-faint">
                <MetaItem icon={CalendarDays}>{formatWhen(a.scheduledAt)}</MetaItem>
              </div>
            </Link>
          ))}
        </div>
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

  // Quick links are click-only: they stay hidden until the menu button opens
  // them, so the dashboard body is all signal.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const openStats = () => {
    setMenuOpen(false);
    if (statsCloseTimer.current) clearTimeout(statsCloseTimer.current);
    setStatsOpen(true);
  };
  const scheduleStatsClose = () => {
    if (statsCloseTimer.current) clearTimeout(statsCloseTimer.current);
    statsCloseTimer.current = setTimeout(() => setStatsOpen(false), 150);
  };
  const toggleStats = () => {
    if (statsCloseTimer.current) clearTimeout(statsCloseTimer.current);
    setMenuOpen(false);
    setStatsOpen((v) => !v);
  };
  const toggleMenu = () => {
    setStatsOpen(false);
    setMenuOpen((v) => !v);
  };

  useEffect(() => {
    if (!statsOpen && !menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (statsOpen && statsRef.current && !statsRef.current.contains(e.target as Node)) setStatsOpen(false);
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setStatsOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      if (statsCloseTimer.current) clearTimeout(statsCloseTimer.current);
    };
  }, [statsOpen, menuOpen]);

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
          <h1 className="font-display text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 max-w-[600px] text-sm leading-relaxed text-ink-muted">
            Office-wide overview — latest bookings, faculty referrals, and appointments waiting for a counselor.
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={toggleMenu}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="inline-flex h-8 items-center gap-1.5 rounded border border-ink/10 bg-white px-3 text-[13px] font-bold text-ink-soft shadow-card transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <Menu aria-hidden className="h-4 w-4 shrink-0 text-ink-faint" />
              Quick links
              <ChevronDown aria-hidden className={cn("h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200", menuOpen && "rotate-180")} />
            </button>
            {menuOpen && (
              <div
                role="menu"
                aria-label="Quick links"
                className="absolute right-0 top-full z-20 mt-2 w-64 overflow-hidden rounded-lg border border-ink/10 bg-white p-1 shadow-card"
              >
                {HEAD_QUICK_LINKS.map((q) => (
                  <Link
                    key={q.href}
                    href={q.href}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="group flex items-center gap-3 rounded-md px-3 py-2 transition hover:bg-cream focus-visible:outline-none focus-visible:bg-cream"
                  >
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", q.chip)}>
                      <q.icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-[13px] font-bold text-ink group-hover:text-primary-700">
                        {q.label}
                      </span>
                      <span className="block truncate text-[11px] font-medium text-ink-muted">{q.hint}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div ref={statsRef} className="relative" onMouseEnter={openStats} onMouseLeave={scheduleStatsClose}>
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
        <div className="space-y-4">
          <LatestBookingsSection items={data?.latestBookings} loading={loading || !data} />

          <FacultyReferralsSection items={data?.facultyReferrals} loading={loading || !data} />

          <UnassignedAppointmentsPanel items={data?.unassignedAppointments} loading={loading || !data} />
        </div>
      )}
    </div>
  );
}
