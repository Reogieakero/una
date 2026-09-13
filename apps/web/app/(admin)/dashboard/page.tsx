import { Suspense } from "react";
import Link from "next/link";
import { BarChart3, PieChart as PieChartIcon, CalendarDays, ClipboardList, Inbox, Megaphone, MessagesSquare, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ReferralStatusChart, SessionsWeekChart } from "@/components/shared/dashboard-charts";
import { cn } from "@/lib/utils";

const OPEN_REFERRALS = ["pending", "acknowledged", "in_progress", "escalated"] as const;

const STATUS_META: Record<string, { label: string; color: string; tone: string }> = {
  pending: { label: "Pending", color: "#F59E0B", tone: "bg-amber-100 text-amber-800" },
  acknowledged: { label: "Acknowledged", color: "#3B82F6", tone: "bg-blue-100 text-blue-800" },
  in_progress: { label: "In progress", color: "#2563EB", tone: "bg-blue-100 text-blue-800" },
  resolved: { label: "Resolved", color: "#22C55E", tone: "bg-green-100 text-green-800" },
  escalated: { label: "Escalated", color: "#EF4444", tone: "bg-red-100 text-red-800" },
};

const APPT_TONE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  assigned: "bg-indigo-100 text-indigo-800",
  confirmed: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-ink/10 text-ink-muted",
  rejected: "bg-red-100 text-red-800",
  no_show: "bg-red-100 text-red-800",
};

const QUICK_LINKS = [
  { href: "/appointments", label: "Appointments", hint: "See what's booked", icon: CalendarDays, chip: "bg-blue-50 text-primary-700" },
  { href: "/referrals", label: "Referrals", hint: "Check the inbox", icon: Inbox, chip: "bg-amber-50 text-amber-700" },
  { href: "/users", label: "Users", hint: "Manage accounts", icon: Users, chip: "bg-green-50 text-green-800" },
  { href: "/chat", label: "Chat", hint: "Message students", icon: MessagesSquare, chip: "bg-blue-50 text-primary-700" },
  { href: "/announcements", label: "Announcements", hint: "Post an update", icon: Megaphone, chip: "bg-amber-50 text-amber-700" },
  { href: "/reports", label: "Reports", hint: "Review reports", icon: ClipboardList, chip: "bg-green-50 text-green-800" },
] as const;

function startOfTodayUTC(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

function dayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date}, ${time}`;
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/** Centered placeholder used whenever a card has no records yet. */
function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: typeof BarChart3;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center px-6 py-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-primary-600 ring-1 ring-blue-100">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-bold text-ink">{title}</p>
      <p className="mt-1 max-w-[260px] text-[13px] leading-relaxed text-ink-muted">{hint}</p>
    </div>
  );
}

/** Privacy-safe student names for a list of referrals. */
async function aliasMap(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("students").select("id, anonymous_alias").in("id", unique);
  return new Map((data ?? []).map((s) => [s.id, s.anonymous_alias ?? "Student"]));
}

/* ── Streaming sections (each suspends on its own → own skeleton) ── */

async function KpiCards() {
  const supabase = await createClient();
  const today = startOfTodayUTC();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const [todayRes, referralsRes, chatsRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .gte("scheduled_at", today.toISOString())
      .lt("scheduled_at", tomorrow.toISOString()),
    supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .in("status", [...OPEN_REFERRALS]),
    supabase.from("chat_threads").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  const stats = [
    { label: "Sessions today", value: todayRes.error ? null : (todayRes.count ?? 0) },
    { label: "Referrals waiting", value: referralsRes.error ? null : (referralsRes.count ?? 0) },
    { label: "Open chats", value: chatsRes.error ? null : (chatsRes.count ?? 0) },
  ];
  return (
    <>
      {stats.map((s) => (
        <div key={s.label} className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <p className="text-[13px] font-medium text-ink-muted">{s.label}</p>
          <p className="mt-1 font-display text-3xl font-bold text-ink">{s.value ?? "–"}</p>
        </div>
      ))}
    </>
  );
}

async function ReferralsPanel() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("referrals")
    .select("id, reason, priority, status, student_id, created_at")
    .in("status", [...OPEN_REFERRALS])
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) return <p className="mt-3 text-sm text-ink-muted">Couldn&apos;t load referrals right now.</p>;
  const recent = data ?? [];
  if (!recent.length) {
    return (
      <EmptyState icon={BarChart3} title="All clear" hint="No referrals are waiting — new ones will show up here." />
    );
  }
  const aliases = await aliasMap(recent.map((r) => r.student_id));
  return (
    <ul className="mt-3 divide-y divide-ink/10">
      {recent.map((r) => (
        <li key={r.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">
              {aliases.get(r.student_id) ?? "Student"}
              <span className="ml-2 text-[11px] font-medium text-ink-faint">{timeAgo(r.created_at)}</span>
            </p>
            <p className="mt-0.5 line-clamp-1 text-[13px] text-ink-muted">{r.reason}</p>
          </div>
          <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold capitalize text-blue-800">
            {r.priority}
          </span>
        </li>
      ))}
    </ul>
  );
}

async function SessionsPanel() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, scheduled_at, status, concern")
    .gte("scheduled_at", new Date().toISOString())
    .in("status", ["pending", "assigned", "confirmed"])
    .order("scheduled_at", { ascending: true })
    .limit(5);
  if (error) return <p className="mt-3 text-sm text-ink-muted">Couldn&apos;t load sessions right now.</p>;
  const upcoming = data ?? [];
  if (!upcoming.length) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Nothing booked ahead"
        hint="New sessions will show up here once students start booking."
      />
    );
  }
  return (
    <ul className="mt-3 divide-y divide-ink/10">
      {upcoming.map((a) => (
        <li key={a.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink">{formatWhen(a.scheduled_at)}</p>
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
  );
}

async function UnassignedPanel() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("referrals")
    .select("id, reason, priority, student_id, created_at")
    .in("status", [...OPEN_REFERRALS])
    .is("assigned_counselor_id", null)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) return <p className="mt-3 text-sm text-ink-muted">Couldn&apos;t load referrals right now.</p>;
  const rows = data ?? [];
  if (!rows.length) {
    return (
      <EmptyState icon={Inbox} title="Everyone's assigned" hint="Every waiting referral already has a counselor." />
    );
  }
  const aliases = await aliasMap(rows.map((r) => r.student_id));
  return (
    <ul className="mt-3 divide-y divide-ink/10">
      {rows.map((r) => (
        <li key={r.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">
              {aliases.get(r.student_id) ?? "Student"}
              <span className="ml-2 text-[11px] font-medium text-ink-faint">{timeAgo(r.created_at)}</span>
            </p>
            <p className="mt-0.5 line-clamp-1 text-[13px] text-ink-muted">{r.reason}</p>
          </div>
          <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold capitalize text-red-800">
            {r.priority}
          </span>
        </li>
      ))}
    </ul>
  );
}

async function AnnouncementsPanel() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, published_at")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(3);
  if (error) return <p className="mt-3 text-sm text-ink-muted">Couldn&apos;t load announcements right now.</p>;
  const rows = data ?? [];
  if (!rows.length) {
    return (
      <EmptyState icon={Megaphone} title="No announcements yet" hint="News and updates you post will show up here." />
    );
  }
  return (
    <ul className="mt-3 divide-y divide-ink/10">
      {rows.map((a) => (
        <li key={a.id} className="py-2.5 first:pt-0 last:pb-0">
          <p className="truncate text-sm font-bold text-ink">{a.title}</p>
          <p className="mt-0.5 text-xs font-medium text-ink-muted">
            {a.published_at ? formatWhen(a.published_at) : "Not published yet"}
          </p>
        </li>
      ))}
    </ul>
  );
}

async function WeekChart() {
  const supabase = await createClient();
  const today = startOfTodayUTC();
  const weekAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
  const buckets = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekAgo.getTime() + i * 24 * 60 * 60 * 1000);
    return { key: dayKey(d), day: dayLabel(d), sessions: 0 };
  });
  const { data, error } = await supabase
    .from("appointments")
    .select("scheduled_at")
    .gte("scheduled_at", weekAgo.toISOString())
    .limit(500);
  if (error) return <p className="mt-3 text-sm text-ink-muted">Couldn&apos;t load chart data right now.</p>;
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const row of data ?? []) {
    const b = byKey.get(dayKey(new Date(row.scheduled_at)));
    if (b) b.sessions += 1;
  }
  if (!buckets.some((b) => b.sessions > 0)) {
    return (
      <EmptyState icon={BarChart3} title="No sessions yet" hint="Bars will appear here once sessions get booked." />
    );
  }
  return <SessionsWeekChart data={buckets} />;
}

async function StatusChart() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("referrals").select("status").limit(1000);
  if (error) return <p className="mt-3 text-sm text-ink-muted">Couldn&apos;t load chart data right now.</p>;
  const counts = new Map<string, number>();
  for (const row of data ?? []) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  const slices = [...counts.entries()]
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: STATUS_META[k]?.label ?? k, value: v, color: STATUS_META[k]?.color ?? "#94A3B8" }));
  if (!slices.length) {
    return (
      <EmptyState
        icon={PieChartIcon}
        title="No referrals yet"
        hint="The breakdown will appear here once referrals come in."
      />
    );
  }
  return <ReferralStatusChart data={slices} />;
}

/* ── Skeletons (exact card geometry, shown per-section while streaming) ── */

function KpiSkeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} className="animate-pulse rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <div className="h-3.5 w-2/3 rounded-full bg-ink/10" />
          <div className="mt-3 h-8 w-1/3 rounded-lg bg-ink/10" />
        </div>
      ))}
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden>
      <div className="space-y-3 pt-3">
        <div className="h-10 rounded-xl bg-ink/10" />
        <div className="h-10 rounded-xl bg-ink/10" />
        <div className="h-10 rounded-xl bg-ink/10" />
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="animate-pulse pt-4" aria-hidden>
      <div className="h-[240px] rounded-xl bg-ink/10" />
    </div>
  );
}

function PanelShell({
  title,
  viewAllHref,
  children,
}: {
  title: string;
  viewAllHref?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold text-ink">{title}</h2>
        {viewAllHref && (
          <Link href={viewAllHref} className="text-[13px] font-bold text-primary-600 hover:underline">
            View all
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** Head dashboard — shell renders instantly, every block streams with its skeleton. */
export default function DashboardPage() {
  return (
    <div className="space-y-4">
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

      <h1 className="sr-only">Dashboard</h1>

      {/* KPI cards — 1 column on phones, 3 across on desktop */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Suspense fallback={<KpiSkeleton />}>
          <KpiCards />
        </Suspense>
      </div>

      {/* Quick links (static — renders immediately) */}
      <section aria-label="Quick links">
        <h2 className="font-display text-base font-bold text-ink">Quick links</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-3">
          {QUICK_LINKS.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className="group flex items-center gap-3 rounded-lg border border-ink/10 bg-white p-4 shadow-card transition hover:border-primary-300 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", q.chip)}>
                <q.icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-bold text-ink group-hover:text-primary-700">
                  {q.label}
                </span>
                <span className="block truncate text-xs font-medium text-ink-muted">{q.hint}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Latest lists */}
      <div className="grid gap-4 xl:grid-cols-2">
        <PanelShell title="Referrals waiting" viewAllHref="/referrals">
          <Suspense fallback={<ListSkeleton />}>
            <ReferralsPanel />
          </Suspense>
        </PanelShell>
        <PanelShell title="Upcoming sessions" viewAllHref="/appointments">
          <Suspense fallback={<ListSkeleton />}>
            <SessionsPanel />
          </Suspense>
        </PanelShell>
      </div>

      {/* Needs attention + announcements */}
      <div className="grid gap-4 xl:grid-cols-2">
        <PanelShell title="Needs a counselor" viewAllHref="/referrals">
          <Suspense fallback={<ListSkeleton />}>
            <UnassignedPanel />
          </Suspense>
        </PanelShell>
        <PanelShell title="Latest announcements" viewAllHref="/announcements">
          <Suspense fallback={<ListSkeleton />}>
            <AnnouncementsPanel />
          </Suspense>
        </PanelShell>
      </div>

      {/* Charts */}
      <div className="grid gap-4 xl:grid-cols-2">
        <PanelShell title="Sessions — last 7 days">
          <Suspense fallback={<ChartSkeleton />}>
            <WeekChart />
          </Suspense>
        </PanelShell>
        <PanelShell title="Referrals by status">
          <Suspense fallback={<ChartSkeleton />}>
            <StatusChart />
          </Suspense>
        </PanelShell>
      </div>
    </div>
  );
}
