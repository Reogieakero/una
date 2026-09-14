"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Bell,
  CalendarDays,
  CheckCheck,
  ClipboardList,
  Inbox,
  Megaphone,
  MessagesSquare,
  Star,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { listNotifications, markNotificationRead } from "@dorsu/shared-services";
import { Badge, Button, Card, Input } from "@/components/ui/primitives";
import { Dropdown } from "@/components/shared/dropdown";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type Notice = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

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

/** Shared /notifications — owner-scoped inbox with filters and mark-all-read. */
export default function NotificationsPage() {
  const [me, setMe] = useState<string | null>(null);
  const [rows, setRows] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [readFilter, setReadFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setMe(user.id);
        setRows(((await listNotifications(supabase, user.id)) ?? []) as Notice[]);
      } catch {
        toast.error("Couldn't load notifications right now.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // New arrivals stream in live.
  useEffect(() => {
    if (!me) return;
    const ch = createClient()
      .channel(`notif-${me}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `profile_id=eq.${me}` },
        (p) => {
          const row = p.new as Notice;
          setRows((prev) => (prev.some((x) => x.id === row.id) ? prev : [row, ...prev]));
          toast.message(row.title);
        }
      )
      .subscribe();
    return () => {
      createClient().removeChannel(ch);
    };
  }, [me]);

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
    setRows((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
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
    setRows((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await Promise.all(ids.map((id) => markNotificationRead(createClient(), id)));
      toast.success("Inbox cleared — everything is read.");
    } catch {
      toast.error("Some items couldn't be marked read.");
    } finally {
      setBusyAll(false);
    }
  };

  const typeOptions = [
    { value: "all", label: `All types · ${stats.total}` },
    ...stats.types.map((t) => ({ value: t.type, label: `${t.label} · ${t.count}` })),
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
        <Button variant="outline" size="sm" disabled={busyAll || !stats.unread} onClick={markAllRead}>
          <CheckCheck className="h-4 w-4" aria-hidden />
          {busyAll ? "Clearing…" : `Mark all read (${stats.unread})`}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg border border-ink/10 bg-white p-5 shadow-card">
                <div className="h-3.5 w-2/3 rounded-full bg-ink/10" />
                <div className="mt-3 h-8 w-1/3 rounded-lg bg-ink/10" />
              </div>
            ))
          : [
              { label: "Total", value: stats.total },
              { label: "Unread", value: stats.unread },
              { label: "Today", value: stats.today },
              { label: "Types active", value: stats.types.length },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
                <p className="text-[13px] font-medium text-ink-muted">{s.label}</p>
                <p className="mt-1 font-display text-3xl font-bold text-ink">{s.value}</p>
              </div>
            ))}
      </div>

      {/* Filters */}
      <Card className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex flex-wrap gap-2">
            {[
              { v: "all", label: "All" },
              { v: "unread", label: `Unread · ${stats.unread}` },
              { v: "read", label: "Read" },
            ].map((s) => (
              <Button
                key={s.v}
                size="sm"
                variant={readFilter === s.v ? "primary" : "outline"}
                onClick={() => setReadFilter(s.v)}
              >
                {s.label}
              </Button>
            ))}
          </div>
          <Dropdown
            menuKey="notif-type"
            openMenuKey={openMenuKey}
            onOpenChange={setOpenMenuKey}
            value={typeFilter}
            onChange={setTypeFilter}
            ariaLabel="Filter by type"
            options={typeOptions}
          />
          <Input
            placeholder="Search title or message…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <p className="text-xs font-medium text-ink-faint">
          Showing {visible.length} of {rows.length} notifications · unread first.
        </p>
      </Card>

      {/* Inbox */}
      <Card className="p-2">
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
      </Card>
    </div>
  );
}
