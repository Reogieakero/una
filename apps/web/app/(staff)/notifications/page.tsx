"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Bell, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  NOTIFICATIONS_BOARD_KEY,
  useNotificationsBoard,
  type NotificationsBoardData,
  type NotificationsRow,
} from "@/lib/hooks/use-notifications-board";
import { markNotificationRead, markNotificationsRead } from "@dorsu/shared-services";
import { patchBoard } from "@/lib/patch-board";
import { HoverMenu } from "@/components/shared/hover-menu";
import { Button, Card, Input } from "@/components/ui/primitives";
import { NotificationRow, TYPE_META } from "@/components/notifications/NotificationRow";
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

/** Shared /notifications — owner-scoped inbox with filters and mark-all-read. */
export default function NotificationsPage() {
  const qc = useQueryClient();
  const { data: board, isLoading, isError } = useNotificationsBoard();
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

  // New arrivals stream in live via RealtimeProvider (root layout) — it
  // patches this board's cache and fires the toast, so this page owns no
  // subscription of its own.

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

  const snapshot = () => qc.getQueryData<NotificationsBoardData>([...NOTIFICATIONS_BOARD_KEY]);
  const restore = (prev: NotificationsBoardData | undefined) => {
    if (prev) qc.setQueryData([...NOTIFICATIONS_BOARD_KEY], prev);
  };

  const markRead = async (id: string) => {
    const prev = snapshot();
    patchBoard<NotificationsBoardData>(qc, [...NOTIFICATIONS_BOARD_KEY], (prev) => ({ ...prev, rows: prev.rows.map((n) => (n.id === id ? { ...n, is_read: true } : n)) }));
    try {
      await markNotificationRead(createClient(), id);
    } catch {
      restore(prev);
      toast.error("Couldn't mark that read — please try again.");
    }
  };

  const markAllRead = async () => {
    const ids = rows.filter((n) => !n.is_read).map((n) => n.id);
    if (!ids.length) return;
    setBusyAll(true);
    const prev = snapshot();
    patchBoard<NotificationsBoardData>(qc, [...NOTIFICATIONS_BOARD_KEY], (prev) => ({ ...prev, rows: prev.rows.map((n) => ({ ...n, is_read: true })) }));
    try {
      // Single query — never one round-trip per row.
      await markNotificationsRead(createClient(), ids);
      toast.success("Inbox cleared — everything is read.");
    } catch {
      restore(prev);
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
              className="inline-flex h-8 items-center gap-1.5 rounded border border-ink/10 bg-white px-3 text-[13px] font-bold text-ink-soft shadow-card transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              Stats
              <ChevronDown aria-hidden className={cn("h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200", statsOpen && "rotate-180")} />
            </button>
            {statsOpen && (
              <div
                role="dialog"
                aria-label="Notification stats"
                className="absolute right-0 top-full z-20 mt-2 w-72 overflow-hidden rounded-lg border border-ink/10 bg-white py-1 shadow-card"
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
            <div className="h-16 rounded-lg bg-ink/10" />
            <div className="h-16 rounded-lg bg-ink/10" />
            <div className="h-16 rounded-lg bg-ink/10" />
          </div>
        )}
        {!loading && !visible.length && (
          <p className="px-4 py-10 text-center text-sm text-ink-muted">
            {rows.length ? "Nothing matches these filters." : "All caught up — new alerts will land here with a toast."}
          </p>
        )}
        <ul className="divide-y divide-ink/10">
          {visible.map((n) => (
            <NotificationRow key={n.id} notice={n} onMarkRead={markRead} />
          ))}
        </ul>
        </div>
      </Card>
    </div>
  );
}
