import { Suspense } from "react";
import Link from "next/link";
import { BarChart3, PieChart as PieChartIcon, CalendarDays, ClipboardList, Inbox, MessagesSquare, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ReportBars, ReportDonut, ReportTrendChart } from "@/components/shared/reports-charts";
import { ExportReportsButton, PrintReportsButton } from "@/components/shared/reports-actions";

/* ── Meta ── */

const OPEN_REFERRALS = ["pending", "acknowledged", "in_progress", "escalated"] as const;

const APPT_META: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "#F59E0B" },
  assigned: { label: "Assigned", color: "#6366F1" },
  confirmed: { label: "Confirmed", color: "#3B82F6" },
  completed: { label: "Completed", color: "#22C55E" },
  cancelled: { label: "Cancelled", color: "#94A3B8" },
  rejected: { label: "Rejected", color: "#EF4444" },
  no_show: { label: "No-show", color: "#F97316" },
};

const REFERRAL_META: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "#F59E0B" },
  acknowledged: { label: "Acknowledged", color: "#3B82F6" },
  in_progress: { label: "In progress", color: "#2563EB" },
  resolved: { label: "Resolved", color: "#22C55E" },
  escalated: { label: "Escalated", color: "#EF4444" },
};

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "#94A3B8" },
  medium: { label: "Medium", color: "#3B82F6" },
  high: { label: "High", color: "#F59E0B" },
  urgent: { label: "Urgent", color: "#EF4444" },
};

const STRESS_META: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "#22C55E" },
  moderate: { label: "Moderate", color: "#F59E0B" },
  high: { label: "High", color: "#EF4444" },
};

/* ── Helpers ── */

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

function pct(part: number, whole: number): string {
  if (!whole) return "—";
  return `${Math.round((part / whole) * 100)}%`;
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

/* ── Shell bits (same geometry as the head dashboard) ── */

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
    <div className="flex min-h-[200px] flex-col items-center justify-center px-6 py-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-primary-600 ring-1 ring-blue-100">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-bold text-ink">{title}</p>
      <p className="mt-1 max-w-[260px] text-[13px] leading-relaxed text-ink-muted">{hint}</p>
    </div>
  );
}

function PanelShell({
  title,
  hint,
  viewAllHref,
  children,
}: {
  title: string;
  hint?: string;
  viewAllHref?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-bold text-ink">{title}</h2>
          {hint && <p className="mt-0.5 text-[13px] text-ink-muted">{hint}</p>}
        </div>
        {viewAllHref && (
          <Link href={viewAllHref} className="shrink-0 text-[13px] font-bold text-primary-600 hover:underline">
            View all
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function KpiSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <div className="h-3.5 w-2/3 rounded-full bg-ink/10" />
          <div className="mt-3 h-8 w-1/3 rounded-lg bg-ink/10" />
          <div className="mt-2 h-3 w-1/2 rounded-full bg-ink/10" />
        </div>
      ))}
    </>
  );
}

function ChartSkeleton() {
  return (
    <div className="animate-pulse pt-4" aria-hidden>
      <div className="h-[240px] rounded-xl bg-ink/10" />
    </div>
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

/* ── Streaming sections (each suspends on its own → own skeleton) ── */

async function KpiCards() {
  const supabase = await createClient();
  const [totalRes, completedRes, missedRes, feedbackRes, refTotalRes, refResolvedRes, refOpenRes, pss10Res] =
    await Promise.all([
      supabase.from("appointments").select("id", { count: "exact", head: true }),
      supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "completed"),
      supabase.from("appointments").select("id", { count: "exact", head: true }).in("status", ["cancelled", "rejected", "no_show"]),
      supabase.from("feedback").select("rating").limit(500),
      supabase.from("referrals").select("id", { count: "exact", head: true }),
      supabase.from("referrals").select("id", { count: "exact", head: true }).eq("status", "resolved"),
      supabase.from("referrals").select("id", { count: "exact", head: true }).in("status", [...OPEN_REFERRALS]),
      supabase.from("pss10_assessments").select("band").limit(1000),
    ]);

  const total = totalRes.error ? 0 : (totalRes.count ?? 0);
  const completed = completedRes.error ? 0 : (completedRes.count ?? 0);
  const missed = missedRes.error ? 0 : (missedRes.count ?? 0);
  const feedback = feedbackRes.data ?? [];
  const avgRating = feedback.length
    ? (feedback.reduce((a, f) => a + f.rating, 0) / feedback.length).toFixed(1)
    : "—";
  const refTotal = refTotalRes.error ? 0 : (refTotalRes.count ?? 0);
  const refResolved = refResolvedRes.error ? 0 : (refResolvedRes.count ?? 0);
  const refOpen = refOpenRes.error ? 0 : (refOpenRes.count ?? 0);
  const highStress = (pss10Res.data ?? []).filter((p) => p.band === "high").length;

  const cards = [
    { label: "Total sessions", value: String(total), sub: "All appointments booked" },
    { label: "Completed", value: String(completed), sub: `${pct(completed, total)} completion rate` },
    { label: "Missed", value: String(missed), sub: "Cancelled + rejected + no-show" },
    { label: "Avg. satisfaction", value: feedback.length ? `${avgRating} / 5` : "—", sub: `${feedback.length} feedback responses` },
    { label: "Open referrals", value: String(refOpen), sub: "Waiting for action" },
    { label: "Referrals resolved", value: pct(refResolved, refTotal), sub: `${refResolved} of ${refTotal} resolved` },
    { label: "High-stress screens", value: String(highStress), sub: "PSS-10 band = high" },
    { label: "Feedback coverage", value: pct(feedback.length, completed), sub: "Responses per completed session" },
  ];

  return (
    <>
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <p className="text-[13px] font-medium text-ink-muted">{c.label}</p>
          <p className="mt-1 font-display text-3xl font-bold text-ink">{c.value}</p>
          <p className="mt-1 text-xs font-medium text-ink-faint">{c.sub}</p>
        </div>
      ))}
    </>
  );
}

async function SessionsTrend() {
  const supabase = await createClient();
  const today = startOfTodayUTC();
  const start = new Date(today.getTime() - 13 * 24 * 60 * 60 * 1000);
  const buckets = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    return { key: dayKey(d), day: dayLabel(d), sessions: 0 };
  });
  const { data, error } = await supabase
    .from("appointments")
    .select("scheduled_at")
    .gte("scheduled_at", start.toISOString())
    .limit(2000);
  if (error) return <p className="mt-3 text-sm text-ink-muted">Couldn&apos;t load trend right now.</p>;
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const row of data ?? []) {
    const b = byKey.get(dayKey(new Date(row.scheduled_at)));
    if (b) b.sessions += 1;
  }
  if (!buckets.some((b) => b.sessions > 0)) {
    return <EmptyState icon={CalendarDays} title="No sessions in the last 14 days" hint="Bars will appear here once sessions get booked." />;
  }
  const peak = buckets.reduce((a, b) => (b.sessions > a.sessions ? b : a), buckets[0]);
  return (
    <>
      <p className="mt-2 text-[13px] text-ink-muted">
        Peak day: <span className="font-bold text-ink">{peak.day}</span> with{" "}
        <span className="font-bold text-ink">{peak.sessions}</span> session{peak.sessions === 1 ? "" : "s"}.
      </p>
      <ReportTrendChart data={buckets} />
    </>
  );
}

async function AppointmentStatus() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("appointments").select("status").limit(2000);
  if (error) return <p className="mt-3 text-sm text-ink-muted">Couldn&apos;t load status data right now.</p>;
  const counts = new Map<string, number>();
  for (const row of data ?? []) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  const slices = [...counts.entries()]
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: APPT_META[k]?.label ?? k, value: v, color: APPT_META[k]?.color ?? "#94A3B8" }));
  if (!slices.length) {
    return <EmptyState icon={PieChartIcon} title="No sessions yet" hint="The status breakdown will appear here once appointments are booked." />;
  }
  return <ReportDonut data={slices} />;
}

async function SessionMode() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("appointments").select("mode").limit(2000);
  if (error) return <p className="mt-3 text-sm text-ink-muted">Couldn&apos;t load mode data right now.</p>;
  const counts = new Map<string, number>();
  for (const row of data ?? []) counts.set(row.mode, (counts.get(row.mode) ?? 0) + 1);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const rows = [...counts.entries()].map(([k, v]) => ({
    key: k,
    label: k === "in_person" ? "In person" : "Online",
    value: v,
    color: k === "in_person" ? "#2563EB" : "#22C55E",
  }));
  if (!total) {
    return <EmptyState icon={MessagesSquare} title="No mode data yet" hint="In-person vs online split will show here." />;
  }
  return (
    <ul className="mt-4 space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-ink">{r.label}</span>
            <span className="font-semibold text-ink-muted">
              {r.value} · {pct(r.value, total)}
            </span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-ink/10">
            <div className="h-full rounded-full" style={{ width: `${total ? (r.value / total) * 100 : 0}%`, background: r.color }} />
          </div>
        </li>
      ))}
      <li className="pt-1 text-[13px] text-ink-muted">
        Use the split to balance room scheduling against online capacity.
      </li>
    </ul>
  );
}

async function ReferralStatus() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("referrals").select("status").limit(2000);
  if (error) return <p className="mt-3 text-sm text-ink-muted">Couldn&apos;t load referral data right now.</p>;
  const counts = new Map<string, number>();
  for (const row of data ?? []) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  const slices = [...counts.entries()]
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: REFERRAL_META[k]?.label ?? k, value: v, color: REFERRAL_META[k]?.color ?? "#94A3B8" }));
  if (!slices.length) {
    return <EmptyState icon={Inbox} title="No referrals yet" hint="The pipeline breakdown will appear here once referrals come in." />;
  }
  return <ReportDonut data={slices} />;
}

async function ReferralPriority() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("referrals").select("priority").limit(2000);
  if (error) return <p className="mt-3 text-sm text-ink-muted">Couldn&apos;t load priority data right now.</p>;
  const order = ["low", "medium", "high", "urgent"];
  const counts = new Map<string, number>(order.map((k) => [k, 0]));
  for (const row of data ?? []) counts.set(row.priority, (counts.get(row.priority) ?? 0) + 1);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (!total) {
    return <EmptyState icon={BarChart3} title="No priorities yet" hint="Urgent vs routine mix will show here." />;
  }
  return (
    <>
      <p className="mt-2 text-[13px] text-ink-muted">
        <span className="font-bold text-ink">{counts.get("urgent") ?? 0} urgent</span> ·{" "}
        <span className="font-bold text-ink">{counts.get("high") ?? 0} high</span> — triage these first.
      </p>
      <ReportBars
        data={order.map((k) => ({ label: PRIORITY_META[k].label, value: counts.get(k) ?? 0, color: PRIORITY_META[k].color }))}
      />
    </>
  );
}

async function Satisfaction() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("feedback").select("rating").limit(1000);
  if (error) return <p className="mt-3 text-sm text-ink-muted">Couldn&apos;t load satisfaction right now.</p>;
  const rows = data ?? [];
  if (!rows.length) {
    return <EmptyState icon={ClipboardList} title="No ratings yet" hint="The 1–5 star distribution will appear once students leave feedback." />;
  }
  const counts = [1, 2, 3, 4, 5].map((s) => ({
    label: `${s}★`,
    value: rows.filter((f) => f.rating === s).length,
    color: s >= 4 ? "#22C55E" : s === 3 ? "#F59E0B" : "#EF4444",
  }));
  const avg = (rows.reduce((a, f) => a + f.rating, 0) / rows.length).toFixed(1);
  return (
    <>
      <p className="mt-2 text-[13px] text-ink-muted">
        Average <span className="font-bold text-ink">{avg} / 5</span> from{" "}
        <span className="font-bold text-ink">{rows.length}</span> responses.
      </p>
      <ReportBars data={counts} />
    </>
  );
}

async function StressBands() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("pss10_assessments").select("band,total_score").limit(1000);
  if (error) return <p className="mt-3 text-sm text-ink-muted">Couldn&apos;t load wellbeing data right now.</p>;
  const rows = data ?? [];
  if (!rows.length) {
    return <EmptyState icon={BarChart3} title="No screenings yet" hint="Low / moderate / high stress mix will appear once PSS-10 screenings are submitted." />;
  }
  const order = ["low", "moderate", "high"];
  const counts = new Map(order.map((k) => [k, 0]));
  for (const r of rows) counts.set(r.band, (counts.get(r.band) ?? 0) + 1);
  const avg = (rows.reduce((a, r) => a + r.total_score, 0) / rows.length).toFixed(1);
  return (
    <>
      <p className="mt-2 text-[13px] text-ink-muted">
        Average PSS-10 <span className="font-bold text-ink">{avg} / 40</span> across{" "}
        <span className="font-bold text-ink">{rows.length}</span> screenings.
      </p>
      <ReportDonut
        data={order.map((k) => ({ name: STRESS_META[k].label, value: counts.get(k) ?? 0, color: STRESS_META[k].color }))}
      />
    </>
  );
}

async function ReferralPipeline() {
  const supabase = await createClient();
  const [unassignedRes, escalatedRes, oldestRes] = await Promise.all([
    supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .in("status", [...OPEN_REFERRALS])
      .is("assigned_counselor_id", null),
    supabase.from("referrals").select("id", { count: "exact", head: true }).eq("status", "escalated"),
    supabase
      .from("referrals")
      .select("created_at")
      .in("status", [...OPEN_REFERRALS])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  if (unassignedRes.error && escalatedRes.error) {
    return <p className="mt-3 text-sm text-ink-muted">Couldn&apos;t load pipeline right now.</p>;
  }
  const unassigned = unassignedRes.error ? 0 : (unassignedRes.count ?? 0);
  const escalated = escalatedRes.error ? 0 : (escalatedRes.count ?? 0);
  const oldest = oldestRes.data?.created_at ? timeAgo(oldestRes.data.created_at) : "—";
  const rows = [
    { label: "Waiting without a counselor", value: String(unassigned), tone: "bg-red-100 text-red-800" },
    { label: "Escalated", value: String(escalated), tone: "bg-amber-100 text-amber-800" },
    { label: "Longest wait", value: oldest, tone: "bg-blue-100 text-blue-800" },
  ];
  return (
    <ul className="mt-4 space-y-3">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center justify-between gap-3 rounded-xl bg-cream px-4 py-3">
          <span className="text-sm font-semibold text-ink-soft">{r.label}</span>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[13px] font-bold ${r.tone}`}>{r.value}</span>
        </li>
      ))}
      <li className="pt-1 text-[13px] text-ink-muted">
        Keep unassigned at zero — assign every waiting referral so no student falls through.
      </li>
    </ul>
  );
}

async function CounselorWorkload() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("appointments").select("counselor_id,status").limit(2000);
  if (error) return <p className="mt-3 text-sm text-ink-muted">Couldn&apos;t load workload right now.</p>;
  const rows = data ?? [];
  const byCounselor = new Map<string, { total: number; completed: number }>();
  let unassigned = 0;
  for (const r of rows) {
    if (!r.counselor_id) {
      unassigned += 1;
      continue;
    }
    const e = byCounselor.get(r.counselor_id) ?? { total: 0, completed: 0 };
    e.total += 1;
    if (r.status === "completed") e.completed += 1;
    byCounselor.set(r.counselor_id, e);
  }
  const ids = [...byCounselor.keys()];
  let names = new Map<string, string>();
  let specs = new Map<string, string>();
  if (ids.length) {
    const { data: counselors } = await supabase.from("counselors").select("id,profile_id,specialization").in("id", ids);
    const profileIds = (counselors ?? []).map((c) => c.profile_id).filter(Boolean);
    if (profileIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("id,full_name").in("id", profileIds);
      const byProfile = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Counselor"]));
      for (const c of counselors ?? []) {
        names.set(c.id, byProfile.get(c.profile_id) ?? "Counselor");
        if (c.specialization) specs.set(c.id, c.specialization);
      }
    }
  }
  const ranked = [...byCounselor.entries()]
    .map(([id, v]) => ({ id, ...v, name: names.get(id) ?? "Counselor", spec: specs.get(id) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
  if (!ranked.length) {
    return <EmptyState icon={Users} title="No assignments yet" hint="Per-counselor load will appear once sessions are assigned." />;
  }
  return (
    <ul className="mt-3 divide-y divide-ink/10">
      {ranked.map((c, i) => (
        <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">
              <span className="mr-2 text-xs font-bold text-ink-faint">#{i + 1}</span>
              {c.name}
            </p>
            <p className="mt-0.5 truncate text-xs font-medium text-ink-muted">
              {c.spec ?? "Counselor"} · {c.completed}/{c.total} completed
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
            {c.total} sessions
          </span>
        </li>
      ))}
      {unassigned > 0 && (
        <li className="flex items-center justify-between gap-3 py-2.5">
          <p className="text-sm font-semibold text-ink-muted">Unassigned sessions</p>
          <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
            {unassigned}
          </span>
        </li>
      )}
    </ul>
  );
}

async function TopConcerns() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("appointments").select("concern").limit(1000);
  if (error) return <p className="mt-3 text-sm text-ink-muted">Couldn&apos;t load concerns right now.</p>;
  const rows = (data ?? []).map((r) => r.concern?.trim()).filter(Boolean) as string[];
  if (!rows.length) {
    return <EmptyState icon={ClipboardList} title="No concerns logged yet" hint="Common presenting concerns will be ranked here." />;
  }
  const counts = new Map<string, { label: string; count: number }>();
  for (const c of rows) {
    const key = c.toLowerCase();
    const e = counts.get(key) ?? { label: c, count: 0 };
    e.count += 1;
    counts.set(key, e);
  }
  const top = [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  return (
    <ul className="mt-4 space-y-3">
      {top.map((t) => (
        <li key={t.label}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-bold text-ink">{t.label}</span>
            <span className="shrink-0 font-semibold text-ink-muted">
              {t.count} · {pct(t.count, rows.length)}
            </span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-ink/10">
            <div
              className="h-full rounded-full bg-primary-500"
              style={{ width: `${(t.count / rows.length) * 100}%` }}
            />
          </div>
        </li>
      ))}
      <li className="pt-1 text-[13px] text-ink-muted">
        Use this ranking to plan group sessions, workshops, and announcements.
      </li>
    </ul>
  );
}

async function RecentFeedback() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feedback")
    .select("rating,comment,created_at")
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) return <p className="mt-3 text-sm text-ink-muted">Couldn&apos;t load feedback right now.</p>;
  const rows = data ?? [];
  if (!rows.length) {
    return <EmptyState icon={MessagesSquare} title="No feedback yet" hint="Student comments will show up here once sessions are rated." />;
  }
  return (
    <ul className="mt-3 divide-y divide-ink/10">
      {rows.map((f, i) => (
        <li key={`${f.created_at}-${i}`} className="py-2.5 first:pt-0 last:pb-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-amber-500" aria-label={`${f.rating} out of 5 stars`}>
              {"★".repeat(f.rating)}
              <span className="text-ink/20">{"★".repeat(Math.max(0, 5 - f.rating))}</span>
            </p>
            <p className="text-[11px] font-medium text-ink-faint">{timeAgo(f.created_at)}</p>
          </div>
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-soft">
            {f.comment?.trim() || "No written comment."}
          </p>
        </li>
      ))}
    </ul>
  );
}

/**
 * Shared /reports — shell (title + actions) renders instantly so navigation
 * feels immediate; every metric block streams in via Suspense instead of
 * blocking the route transition.
 */
export default function ReportsPage() {
  return (
    <div className="space-y-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Reports</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Reports</h1>
          <p className="mt-1 max-w-[560px] text-sm leading-relaxed text-ink-muted">
            Office-level outcomes — sessions, referrals, satisfaction, and wellbeing. Aggregated and
            privacy-safe: counts and averages only, no student names.
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <ExportReportsButton />
          <PrintReportsButton />
        </div>
      </div>

      {/* KPI cards — 2 across on tablets, 4 across on desktop */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Suspense fallback={<KpiSkeleton />}>
          <KpiCards />
        </Suspense>
      </div>

      {/* Demand + session mix */}
      <div className="grid gap-4 xl:grid-cols-2">
        <PanelShell title="Sessions — last 14 days" hint="Bookings by scheduled date, including upcoming sessions.">
          <Suspense fallback={<ChartSkeleton />}>
            <SessionsTrend />
          </Suspense>
        </PanelShell>
        <PanelShell title="Sessions by status" hint="Where every booked session currently sits." viewAllHref="/appointments">
          <Suspense fallback={<ChartSkeleton />}>
            <AppointmentStatus />
          </Suspense>
        </PanelShell>
      </div>

      {/* Referral pipeline */}
      <div className="grid gap-4 xl:grid-cols-2">
        <PanelShell title="Referrals by status" hint="Pipeline health at a glance." viewAllHref="/referrals">
          <Suspense fallback={<ChartSkeleton />}>
            <ReferralStatus />
          </Suspense>
        </PanelShell>
        <PanelShell title="Referrals by priority" hint="Urgency mix — urgent + high need triage first." viewAllHref="/referrals">
          <Suspense fallback={<ChartSkeleton />}>
            <ReferralPriority />
          </Suspense>
        </PanelShell>
      </div>

      {/* Outcomes: satisfaction + wellbeing */}
      <div className="grid gap-4 xl:grid-cols-2">
        <PanelShell title="Student satisfaction" hint="Post-session ratings, 1–5 stars." viewAllHref="/feedback">
          <Suspense fallback={<ChartSkeleton />}>
            <Satisfaction />
          </Suspense>
        </PanelShell>
        <PanelShell title="Stress levels (PSS-10)" hint="Screening bands from pre-booking assessments.">
          <Suspense fallback={<ChartSkeleton />}>
            <StressBands />
          </Suspense>
        </PanelShell>
      </div>

      {/* Operations */}
      <div className="grid gap-4 xl:grid-cols-2">
        <PanelShell title="Session format" hint="In-person load vs online capacity.">
          <Suspense fallback={<ListSkeleton />}>
            <SessionMode />
          </Suspense>
        </PanelShell>
        <PanelShell title="Referral pipeline watch" hint="What needs attention right now." viewAllHref="/referrals">
          <Suspense fallback={<ListSkeleton />}>
            <ReferralPipeline />
          </Suspense>
        </PanelShell>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PanelShell title="Counselor workload" hint="Sessions per counselor — rebalance when one lane overloads." viewAllHref="/users">
          <Suspense fallback={<ListSkeleton />}>
            <CounselorWorkload />
          </Suspense>
        </PanelShell>
        <PanelShell title="Top presenting concerns" hint="Most common reasons students book.">
          <Suspense fallback={<ListSkeleton />}>
            <TopConcerns />
          </Suspense>
        </PanelShell>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PanelShell title="Latest feedback" hint="Most recent student comments." viewAllHref="/feedback">
          <Suspense fallback={<ListSkeleton />}>
            <RecentFeedback />
          </Suspense>
        </PanelShell>
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <h2 className="font-display text-base font-bold text-ink">How to read these reports</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[13px] leading-relaxed text-ink-muted">
            <li>
              <span className="font-bold text-ink">Completion rate</span> = completed ÷ total booked. A falling
              rate with rising misses (cancelled + rejected + no-show) usually means reminders or slots need work.
            </li>
            <li>
              <span className="font-bold text-ink">Pipeline</span> = pending (awaiting assignment) → assigned (admin set a counselor)
              → confirmed (counselor accepted) → completed. Rejected ends the request at the admin step.
            </li>
            <li>
              <span className="font-bold text-ink">Referral resolution</span> = resolved ÷ total referrals.
              Keep unassigned at zero and escalated moving toward acknowledged within the day.
            </li>
            <li>
              <span className="font-bold text-ink">Satisfaction</span> only covers students who left feedback —
              compare the average against feedback coverage before acting on a dip.
            </li>
            <li>
              <span className="font-bold text-ink">PSS-10 bands</span> come from pre-booking screenings, not
              diagnoses. A rising high-stress share is a signal to add capacity, not to label students.
            </li>
          </ul>
          <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
            Privacy: this page shows aggregates only. Individual student records stay behind their own
            pages and role guards; use Export Excel for meetings and Print for sign-off copies.
          </p>
        </section>
      </div>
    </div>
  );
}
