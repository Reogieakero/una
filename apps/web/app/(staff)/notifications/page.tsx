"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ClipboardList,
  Inbox,
  Megaphone,
  MessagesSquare,
  Star,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  NOTIFICATIONS_BOARD_KEY,
  useNotificationsBoard,
  type NotificationsBoardData,
  type NotificationsRow,
} from "@/lib/hooks/use-notifications-board";
import { markNotificationRead } from "@dorsu/shared-services";
import { cn } from "@/lib/utils";
import { Badge, Button, Card, Input } from "@/components/ui/primitives";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type Notice = NotificationsRow;

const EMPTY_ROWS: Notice[] = [];

/** Patch the cached inbox in place — realtime arrivals never flash the list. */
function patchBoard(qc: QueryClient, patch: (prev: NotificationsBoardData) => NotificationsBoardData) {
  qc.setQueryData<NotificationsBoardData>([...NOTIFICATIONS_BOARD_KEY], (prev) => (prev ? patch(prev) : prev));
}

const TYPE_META: Record<string, { label: string; icon: typeof Bell; tone: "info" | "success" | "warning" | "danger" }> = {
  appointment: { label: "Session", icon: CalendarDays, tone: "info" },
  referral: { label: "Referral", icon: Inbox, tone: "warning" },
  announcement: { label: "News", icon: Megaphone, tone: "info" },
  chat: { label: "Chat", icon: MessagesSquare, tone: "success" },
  assessment: { label: "Check-in", icon: ClipboardList, tone: "success" },
  system: { label: "System", icon: Bell, tone: "danger" },
};

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

/**
 * Hover/click floating filter menu — the same behavior as the Stats menu
 * on /appointments: opens on hover or click, closes on mouse leave (short
 * grace), outside click, Escape, or pick.
 */
function HoverMenu({
  buttonLabel,
  ariaLabel,
  options,
  value,
  onPick,
  align = "left",
}: {
  buttonLabel: React.ReactNode;
  ariaLabel: string;
  options: { value: string; label: string }[];
  value: string;
  onPick: (v: string) => void;
  /** Menu edge — "right" keeps right-side menus inside the page width. */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openMenu = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  };
  const scheduleClose = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 150);
  };
  const toggle = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open ]);

  return (
    <div ref={ref} className="relative shrink-0" onMouseEnter={openMenu} onMouseLeave={scheduleClose}>
      <button
        type="button"
        onClick={toggle}
        onFocus={openMenu}
        onBlur={scheduleClose}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3.5 py-1.5 text-[13px] font-bold text-ink-soft shadow-card transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      >
        <span className="max-w-44 truncate">{buttonLabel}</span>
        <ChevronDown aria-hidden className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className={cn(
            "menu-scroll absolute top-full z-20 mt-2 max-h-60 w-56 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-ink/10 bg-white py-1 shadow-card",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <li key={o.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-[13px] transition hover:bg-cream focus-visible:outline-none focus-visible:bg-cream",
                    active ? "font-bold text-primary-700" : "font-medium text-ink-soft hover:text-ink"
                  )}
                >
                  <span className="truncate">{o.label}</span>
                  {active && <Check aria-hidden className="h-4 w-4 shrink-0 text-primary-600" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Shared /notifications — owner-scoped inbox with filters and mark-all-read. */
export default function NotificationsPage() {
  const qc = useQueryClient();
  const { data: board, isLoading, isError } = useNotificationsBoard();
  const me = board?.me ?? null;
  const rows = board?.rows ?? EMPTY_ROWS;
  const loading = isLoading && !board;
  const [readFilter, setReadFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [busyAll, setBusyAll] = useState(false);

  // Stats live in a floating panel — same hover/click behavior as the
  // /appointments Stats menu. Closes on mouse leave, outside click, or Escape.
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

  useEffect(() => {
    if (isError) toast.error("Couldn't load notifications right now.");
  }, [isError]);

  // New arrivals stream in live, patched into the cache.
  useEffect(() => {
    if (!me) return;
    const ch = createClient()
      .channel(`notif-${me}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `profile_id=eq.${me}` },
        (p) => {
          const row = p.new as Notice;
          patchBoard(qc, (prev) =>
            prev.rows.some((x) => x.id === row.id) ? prev : { ...prev, rows: [row, ...prev.rows] }
          );
          toast.message(row.title);
        }
      )
      .subscribe();
    return () => {
      createClient().removeChannel(ch);
    };
  }, [me, qc]);

  const stats = useMemo(() => {
    const unread = rows.filter((n) => !n.is_read);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const byType = new Map<string, number>();
    for (const n of rows) byType.set(n.type, (byType.get(n.type) ?? 0) + 1);
    return {
      total: rows.length,
      unread: unread.length,
      today: rows.filter((n) => new Date(n.created_at).getTime() >= todayStart.getTime()).length,
      types: [...byType.entries()]
        .map(([type, count]) => ({ type, count, ...(TYPE_META[type] ?? { label: type, icon: Bell, tone: "info" as const }) }))
        .sort((a, b) => b.count - a.count),
    };
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((n) => {
        if (readFilter === "unread") return !n.is_read;
        if (readFilter === "read") return n.is_read;
        return true;
      })
      .filter((n) => (typeFilter === "all" ? true : n.type === typeFilter))
      .filter((n) => (!q ? true : `${n.title} ${n.body ?? ""}`.toLowerCase().includes(q)))
      .sort((a, b) => Number(a.is_read) - Number(b.is_read) || +new Date(b.created_at) - +new Date(a.created_at));
  }, [rows, readFilter, typeFilter, query]);

  const markRead = async (id: string) => {
    patchBoard(qc, (prev) => ({ ...prev, rows: prev.rows.map((n) => (n.id === id ? { ...n, is_read: true } : n)) }));
    try {
      await markNotificationRead(createClient(), id);
    } catch {
      toast.error("Couldn't mark that read — please try again.");
    }
  };

  const markAllRead = async () => {
    const ids = rows.filter((n) => !n.is_read).map((n) => n.id);
    if (!ids.length) return;
    setBusyAll(true);
    patchBoard(qc, (prev) => ({ ...prev, rows: prev.rows.map((n) => ({ ...n, is_read: true })) }));
    try {
      await Promise.all(ids.map((id) => markNotificationRead(createClient(), id)));
      toast.success("Inbox cleared — everything is read.");
    } catch {
      toast.error("Some items couldn't be marked read.");
    } finally {
      setBusyAll(false);
    }
  };

  const resetFilters = () => {
    setReadFilter("all");
    setTypeFilter("all");
    setQuery("");
  };

  const statCards: { label: string; value: number; pick: (() => void) | null }[] = [
    { label: "Total", value: stats.total, pick: resetFilters },
    { label: "Unread", value: stats.unread, pick: () => setReadFilter("unread") },
    { label: "Today", value: stats.today, pick: null },
    { label: "Types active", value: stats.types.length, pick: null },
  ];

  return (
    <div className="space-y-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Notifications</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Notifications</h1>
          <p className="mt-1 max-w-[560px] text-sm leading-relaxed text-ink-muted">
            Your inbox — escalations, session changes, and office news land here first.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div ref={statsRef} className="relative" onMouseEnter={openStats} onMouseLeave={scheduleStatsClose}>
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
                aria-label="Notification stats"
                className="absolute right-0 top-full z-20 mt-2 w-72 overflow-hidden rounded-xl border border-ink/10 bg-white py-1 shadow-card"
              >
                {loading ? (
                  <div className="animate-pulse px-4 py-3" aria-hidden>
                    <div className="h-10 rounded-lg bg-ink/10" />
                    <div className="mt-2 h-10 rounded-lg bg-ink/10" />
                    <div className="mt-2 h-10 rounded-lg bg-ink/10" />
                  </div>
                ) : (
                  statCards.map((s) =>
                    s.pick ? (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => {
                          s.pick?.();
                          setStatsOpen(false);
                        }}
                        title={`Filter by ${s.label}`}
                        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-cream focus-visible:outline-none focus-visible:bg-cream"
                      >
                        <span className="text-[13px] font-medium text-ink-muted">{s.label}</span>
                        <span className="font-display text-xl font-bold text-ink">{s.value}</span>
                      </button>
                    ) : (
                      <div
                        key={s.label}
                        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left"
                      >
                        <span className="text-[13px] font-medium text-ink-muted">{s.label}</span>
                        <span className="font-display text-xl font-bold text-ink">{s.value}</span>
                      </div>
                    )
                  )
                )}
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" disabled={busyAll || !stats.unread} onClick={markAllRead}>
            <CheckCheck className="h-4 w-4" aria-hidden />
            {busyAll ? "Clearing…" : `Mark all read (${stats.unread})`}
          </Button>
        </div>
      </div>

      {/* Inbox — filters live inside, above the list */}
      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 p-4 sm:px-5">
          <Input
            placeholder="Search title or message…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full sm:w-56"
          />
          <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
            <HoverMenu
              ariaLabel="Filter by status"
              buttonLabel={
                <>Status: {readFilter === "all" ? "All" : readFilter === "unread" ? "Unread" : "Read"}</>
              }
              options={[
                { value: "all", label: "All" },
                { value: "unread", label: `Unread · ${stats.unread}` },
                { value: "read", label: "Read" },
              ]}
              value={readFilter}
              onPick={setReadFilter}
            />
            <HoverMenu
              ariaLabel="Filter by type"
              align="right"
              buttonLabel={
                <>Type: {typeFilter === "all" ? "All" : (TYPE_META[typeFilter]?.label ?? typeFilter)}</>
              }
              options={[
                { value: "all", label: `All types · ${stats.total}` },
                ...stats.types.map((t) => ({ value: t.type, label: `${t.label} · ${t.count}` })),
              ]}
              value={typeFilter}
              onPick={setTypeFilter}
            />
          </div>
        </div>
        <p className="px-4 text-xs font-medium text-ink-faint sm:px-5">
          Showing {visible.length} of {rows.length} notifications · unread first.
        </p>
        <div className="mt-3 px-2 pb-2">
        {loading && (
          <div className="animate-pulse space-y-2 p-2" aria-hidden>
            <div className="h-16 rounded-xl bg-ink/10" />
            <div className="h-16 rounded-xl bg-ink/10" />
            <div className="h-16 rounded-xl bg-ink/10" />
          </div>
        )}
        {!loading && !visible.length && (
          <p className="px-4 py-10 text-center text-sm text-ink-muted">
            {rows.length ? "Nothing matches these filters." : "All caught up — new alerts will land here with a toast."}
          </p>
        )}
        <ul className="divide-y divide-ink/10">
          {visible.map((n) => {
            // Feedback arrives as type "system" (the enum has no feedback
            // value) — present it neutrally, never with the red System badge.
            const meta =
              n.link === "/feedback"
                ? { label: "Feedback", icon: Star, tone: "info" as const }
                : (TYPE_META[n.type] ?? { label: n.type, icon: Bell, tone: "info" as const });
            const Icon = meta.icon;
            return (
              <li
                key={n.id}
                className={`flex items-start gap-3 rounded-xl px-3 py-3 transition-colors ${n.is_read ? "" : "bg-blue-50/60"}`}
              >
                <span
                  aria-hidden
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    n.is_read ? "bg-ink/10 text-ink-muted" : "bg-primary-600 text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1 leading-snug">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className={`truncate text-sm ${n.is_read ? "font-semibold text-ink-soft" : "font-bold text-ink"}`}>
                      {n.title}
                    </span>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </p>
                  {n.body && <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-ink-muted">{n.body}</p>}
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-medium text-ink-faint">
                    <span>{timeAgo(n.created_at)}</span>
                    {n.link && (
                      <Link href={n.link} className="font-bold text-primary-600 hover:underline">
                        Open
                      </Link>
                    )}
                    {!n.is_read && (
                      <button
                        type="button"
                        onClick={() => void markRead(n.id)}
                        className="font-bold text-primary-600 hover:underline"
                      >
                        Mark read
                      </button>
                    )}
                  </p>
                </div>
                {!n.is_read && (
                  <span aria-label="Unread" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary-600" />
                )}
              </li>
            );
          })}
        </ul>
        </div>
      </Card>
    </div>
  );
}
