"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useFeedbackBoard } from "@/lib/hooks/use-feedback-board";
import { cn } from "@/lib/utils";
import { Badge, Card, Input } from "@/components/ui/primitives";
import { ReportBars, ReportDonut, ReportLines } from "@/components/shared/reports-charts";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type Feedback = {
  id: string;
  appointment_id: string;
  student_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

const EMPTY_ROWS: Feedback[] = [];
const EMPTY_MAP = new Map<string, string>();
const EMPTY_CONTEXTS = new Map<string, { concern: string; counselor: string; when: string }>();

const STOPWORDS = new Set(
  "a,an,and,are,as,at,be,been,being,but,by,can,could,did,do,does,each,few,for,from,had,has,have,here,how,i,if,in,into,is,it,its,just,like,me,more,most,my,no,not,now,of,off,on,once,only,or,other,our,out,over,own,same,she,should,so,some,such,than,that,the,their,them,then,there,these,they,this,those,through,to,too,under,until,up,very,was,we,were,what,when,where,which,while,who,whom,will,with,you,your,session,sessions,counselor,counselors,really,very,much,lot,things,thing,feel,felt,also,after,before,again,always,never,ever,got,getting,going,went,come,came,today,yesterday,time,times,first,last,one,two,three,well,still,even,back,made,make,though,although,since,without,within,along,among,between,because,while,despite,toward,towards,upon,via,per".split(",")
);

function sentimentOf(avg: number | null): { label: string; tone: "success" | "warning" | "danger" | "info"; hint: string } {
  if (avg === null) return { label: "No data yet", tone: "info", hint: "Ratings will appear once students respond." };
  if (avg >= 4.5) return { label: "Excellent", tone: "success", hint: "Students love the service — protect what's working." };
  if (avg >= 4.0) return { label: "Good", tone: "success", hint: "Solid overall. Mine the 3★ comments for quick wins." };
  if (avg >= 3.0) return { label: "Fair", tone: "warning", hint: "Mixed signals — review neutral and low comments below." };
  return { label: "Needs attention", tone: "danger", hint: "Satisfaction is low. Work the follow-up list first." };
}

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

/** Admin feedback analytics — KPIs, trends, counselor comparison, and system analysis. */
export default function FeedbackAdminPage() {
  const { data: board, isLoading, isError } = useFeedbackBoard();
  const rows = board?.rows ?? EMPTY_ROWS;
  const aliases = board?.aliases ?? EMPTY_MAP;
  const contexts = board?.contexts ?? EMPTY_CONTEXTS;
  const completedTotal = board?.completedTotal ?? 0;
  const role = board?.role ?? null;
  const counselorId = board?.counselorId ?? null;
  const loading = isLoading && !board;
  const [sentimentFilter, setSentimentFilter] = useState("all");
  const [query, setQuery] = useState("");

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
    if (isError) toast.error("Couldn't load feedback right now.");
  }, [isError]);

  const analysis = useMemo(() => {
    const n = rows.length;
    const avg = n ? rows.reduce((a, f) => a + f.rating, 0) / n : null;
    const dist = [1, 2, 3, 4, 5].map((s) => ({
      label: `${s}★`,
      value: rows.filter((f) => f.rating === s).length,
      color: s >= 4 ? "#22C55E" : s === 3 ? "#F59E0B" : "#EF4444",
    }));
    const fiveShare = n ? Math.round((rows.filter((f) => f.rating === 5).length / n) * 100) : 0;
    const withComments = rows.filter((f) => f.comment?.trim()).length;
    const low = rows.filter((f) => f.rating <= 2);

    // Trend: average per day for days with responses, last 14 days.
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startMs = start.getTime() - 13 * 24 * 60 * 60 * 1000;
    const byDay = new Map<string, { sum: number; n: number; label: string }>();
    for (const f of rows) {
      const d = new Date(f.created_at);
      if (d.getTime() < startMs) continue;
      const key = d.toDateString();
      const e = byDay.get(key) ?? { sum: 0, n: 0, label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) };
      e.sum += f.rating;
      e.n += 1;
      byDay.set(key, e);
    }
    const trend = [...byDay.entries()]
      .sort((a, b) => +new Date(a[0]) - +new Date(b[0]))
      .map(([, e]) => ({ label: e.label, value: Math.round((e.sum / e.n) * 10) / 10 }));

    // Counselor comparison via appointment context.
    const byCounselor = new Map<string, { sum: number; n: number }>();
    for (const f of rows) {
      const c = contexts.get(f.appointment_id)?.counselor;
      if (!c || c === "Unassigned") continue;
      const e = byCounselor.get(c) ?? { sum: 0, n: 0 };
      e.sum += f.rating;
      e.n += 1;
      byCounselor.set(c, e);
    }
    const leaderboard = [...byCounselor.entries()]
      .map(([name, e]) => ({ name, avg: Math.round((e.sum / e.n) * 10) / 10, n: e.n }))
      .sort((a, b) => b.avg - a.avg || b.n - a.n)
      .slice(0, 6);

    // Theme keywords from comments.
    const freq = new Map<string, number>();
    for (const f of rows) {
      if (!f.comment) continue;
      for (const w of f.comment.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)) {
        if (w.length < 4 || STOPWORDS.has(w) || /^\d+$/.test(w)) continue;
        freq.set(w, (freq.get(w) ?? 0) + 1);
      }
    }
    const themes = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));

    // Sentiment donut: positive 4–5, neutral 3, negative 1–2.
    const pos = rows.filter((f) => f.rating >= 4).length;
    const neu = rows.filter((f) => f.rating === 3).length;
    const neg = rows.filter((f) => f.rating <= 2).length;
    const donut = [
      { name: "Positive", value: pos, color: "#22C55E" },
      { name: "Neutral", value: neu, color: "#F59E0B" },
      { name: "Negative", value: neg, color: "#EF4444" },
    ].filter((s) => s.value > 0);

    return { n, avg, dist, fiveShare, withComments, low, trend, leaderboard, themes, donut };
  }, [rows, contexts]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((f) => {
        if (sentimentFilter === "all") return true;
        if (sentimentFilter === "positive") return f.rating >= 4;
        if (sentimentFilter === "neutral") return f.rating === 3;
        return f.rating <= 2;
      })
      .filter((f) => {
        if (!q) return true;
        const alias = aliases.get(f.student_id) ?? "";
        const ctx = contexts.get(f.appointment_id);
        return `${alias} ${f.comment ?? ""} ${ctx?.concern ?? ""} ${ctx?.counselor ?? ""}`.toLowerCase().includes(q);
      })
      .slice(0, 20);
  }, [rows, sentimentFilter, query, aliases, contexts]);

  const sentiment = sentimentOf(analysis.avg);
  const isCounselor = role === "counselor";
  const statCards: { label: string; value: string; sub?: string; pick: (() => void) | null }[] = [
    { label: "Responses", value: analysis.n ? String(analysis.n) : "0", pick: () => setSentimentFilter("all") },
    { label: "Avg. rating", value: analysis.avg === null ? "—" : `${analysis.avg.toFixed(1)} / 5`, pick: null },
    { label: "5-star share", value: analysis.n ? `${analysis.fiveShare}%` : "—", pick: null },
    { label: "Response rate", value: completedTotal ? `${Math.round((analysis.n / completedTotal) * 100)}%` : "—", sub: `${analysis.n}/${completedTotal} completed`, pick: null },
    { label: "With comments", value: String(analysis.withComments), pick: null },
    { label: "Low ratings (≤2★)", value: String(analysis.low.length), pick: () => setSentimentFilter("negative") },
  ];

  const stars = (r: number) => (
    <span className="text-sm font-bold tracking-tight" aria-label={`${r} out of 5 stars`}>
      <span className="text-amber-500">{"★".repeat(r)}</span>
      <span className="text-ink/20">{"★".repeat(Math.max(0, 5 - r))}</span>
    </span>
  );

  if (!loading && role === "faculty") {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">Feedback</h1>
        <Card><p className="text-sm text-ink-muted">Your role can&apos;t open feedback. Counselors and the guidance head work from here.</p></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Feedback</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{isCounselor ? "My feedback" : "Feedback"}</h1>
          <p className="mt-1 max-w-[600px] text-sm leading-relaxed text-ink-muted">
            {isCounselor
              ? "What your students think after your sessions — your ratings, trends, and who needs a follow-up."
              : "What students think after sessions — ratings, trends, themes, and who needs a follow-up."}
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
              aria-label="Feedback stats"
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
                      <span className="text-[13px] font-medium text-ink-muted">
                        {s.label}
                        {s.sub && <span className="block text-[11px] font-medium text-ink-faint">{s.sub}</span>}
                      </span>
                      <span className="font-display text-xl font-bold text-ink">{s.value}</span>
                    </button>
                  ) : (
                    <div
                      key={s.label}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left"
                    >
                      <span className="text-[13px] font-medium text-ink-muted">
                        {s.label}
                        {s.sub && <span className="block text-[11px] font-medium text-ink-faint">{s.sub}</span>}
                      </span>
                      <span className="font-display text-xl font-bold text-ink">{s.value}</span>
                    </div>
                  )
                )
              )}
            </div>
          )}
        </div>
      </div>

      {isCounselor && !counselorId && !loading && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-card">
          <p className="text-sm font-bold text-amber-800">Counselor record not linked yet</p>
          <p className="mt-1 text-[13px] text-amber-700">
            Your login works, but no counselor row is linked to your account. Ask the guidance head to finish setup.
          </p>
        </div>
      )}

      {/* System analysis verdict */}
      <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        {loading ? (
          <div className="animate-pulse space-y-2" aria-hidden>
            <div className="h-5 w-40 rounded-full bg-ink/10" />
            <div className="h-4 w-full rounded-full bg-ink/10" />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={sentiment.tone}>{sentiment.label}</Badge>
            <p className="text-sm leading-relaxed text-ink-muted">
              {analysis.avg === null ? (
                sentiment.hint
              ) : (
                <>
                  Average <span className="font-bold text-ink">{analysis.avg.toFixed(1)} / 5</span> across{" "}
                  <span className="font-bold text-ink">{analysis.n}</span> responses · {sentiment.hint}
                </>
              )}
            </p>
          </div>
        )}
      </section>

      {/* Distribution + trend */}
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <h2 className="font-display text-base font-bold text-ink">Rating distribution</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">How the stars stack up.</p>
          {loading ? (
            <div className="animate-pulse pt-4" aria-hidden><div className="h-[240px] rounded-xl bg-ink/10" /></div>
          ) : analysis.n ? (
            <ReportBars data={analysis.dist} />
          ) : (
            <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[13px] text-ink-muted">No ratings yet.</p>
          )}
        </section>
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <h2 className="font-display text-base font-bold text-ink">Satisfaction trend</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">Daily average, last 14 days with responses.</p>
          {loading ? (
            <div className="animate-pulse pt-4" aria-hidden><div className="h-[240px] rounded-xl bg-ink/10" /></div>
          ) : analysis.trend.length ? (
            <ReportLines data={analysis.trend} stroke="#F59E0B" />
          ) : (
            <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[13px] text-ink-muted">Not enough responses for a trend yet.</p>
          )}
        </section>
      </div>

      {/* Sentiment + leaderboard */}
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <h2 className="font-display text-base font-bold text-ink">Sentiment split</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">Positive 4–5★ · neutral 3★ · negative 1–2★.</p>
          {loading ? (
            <div className="animate-pulse pt-4" aria-hidden><div className="h-[200px] rounded-xl bg-ink/10" /></div>
          ) : analysis.donut.length ? (
            <ReportDonut data={analysis.donut} />
          ) : (
            <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[13px] text-ink-muted">No ratings yet.</p>
          )}
        </section>
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <h2 className="font-display text-base font-bold text-ink">{isCounselor ? "My coverage" : "Counselor comparison"}</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">{isCounselor ? "How many of my completed sessions got rated." : "Average rating per counselor, by their sessions."}</p>
          {loading ? (
            <div className="animate-pulse space-y-3 pt-3" aria-hidden>
              <div className="h-10 rounded-xl bg-ink/10" />
              <div className="h-10 rounded-xl bg-ink/10" />
            </div>
          ) : isCounselor ? (
            <ul className="mt-3 space-y-3">
              {[
                { label: "My sessions rated", value: `${analysis.n} responses` },
                { label: "My completed sessions", value: String(completedTotal) },
                { label: "Coverage", value: completedTotal ? `${Math.round((analysis.n / completedTotal) * 100)}%` : "—" },
              ].map((r) => (
                <li key={r.label} className="flex items-center justify-between gap-3 rounded-xl bg-cream px-4 py-3">
                  <span className="text-sm font-semibold text-ink-soft">{r.label}</span>
                  <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-[13px] font-bold text-amber-800">{r.value}</span>
                </li>
              ))}
            </ul>
          ) : analysis.leaderboard.length ? (
            <ul className="mt-3 divide-y divide-ink/10">
              {analysis.leaderboard.map((c, i) => (
                <li key={c.name} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <p className="truncate text-sm font-bold text-ink">
                    <span className="mr-2 text-xs font-bold text-ink-faint">#{i + 1}</span>
                    {c.name}
                    <span className="ml-2 text-[11px] font-medium text-ink-faint">{c.n} rated</span>
                  </p>
                  <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-[13px] font-bold text-amber-800">
                    {c.avg.toFixed(1)} ★
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[13px] text-ink-muted">No rated sessions yet.</p>
          )}
        </section>
      </div>

      {/* Themes + follow-ups */}
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <h2 className="font-display text-base font-bold text-ink">Comment themes</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">Most-used words across written feedback.</p>
          {loading ? (
            <div className="animate-pulse pt-3" aria-hidden><div className="h-20 rounded-xl bg-ink/10" /></div>
          ) : analysis.themes.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {analysis.themes.map((t) => (
                <li
                  key={t.word}
                  className="rounded-full bg-blue-50 px-3 py-1.5 text-[13px] font-bold text-primary-700 ring-1 ring-blue-100"
                >
                  {t.word} <span className="font-semibold text-primary-500">· {t.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[13px] text-ink-muted">No written comments yet.</p>
          )}
        </section>
        <section className="rounded-lg border border-red-200 bg-red-50/50 p-5 shadow-card">
          <h2 className="font-display text-base font-bold text-ink">Needs follow-up</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">1–2★ ratings — reach out while it&apos;s fresh.</p>
          {loading ? (
            <div className="animate-pulse space-y-3 pt-3" aria-hidden>
              <div className="h-10 rounded-xl bg-ink/10" />
              <div className="h-10 rounded-xl bg-ink/10" />
            </div>
          ) : analysis.low.length ? (
            <ul className="mt-3 max-h-[260px] divide-y divide-red-100 overflow-y-auto">
              {analysis.low.slice(0, 8).map((f) => {
                const ctx = contexts.get(f.appointment_id);
                return (
                  <li key={f.id} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      {stars(f.rating)}
                      <span className="text-[11px] font-medium text-ink-faint">{timeAgo(f.created_at)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-soft">
                      {f.comment?.trim() || "No written comment."}
                    </p>
                    <p className="mt-1 text-xs font-medium text-ink-muted">
                      {aliases.get(f.student_id) ?? "Student"}
                      {ctx ? (isCounselor ? ` · ${ctx.concern.slice(0, 48)}` : ` · ${ctx.counselor} · ${ctx.concern.slice(0, 48)}`) : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[13px] text-ink-muted">
              {analysis.n ? "No low ratings — nothing to chase." : "No ratings yet."}
            </p>
          )}
        </section>
      </div>

      {/* Recent feedback — filters live inside, above the list */}
      <Card className="p-0">
        <h2 className="px-4 pt-4 font-display text-base font-bold text-ink sm:px-5">Recent feedback</h2>
        <div className="flex flex-wrap items-center gap-3 p-4 sm:px-5">
          <Input
            placeholder={isCounselor ? "Search comments, students…" : "Search comments, students, counselors…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full sm:w-56"
          />
          <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
            <HoverMenu
              ariaLabel="Filter by sentiment"
              align="right"
              buttonLabel={
                <>
                  Sentiment:{" "}
                  {sentimentFilter === "all"
                    ? "All"
                    : sentimentFilter === "positive"
                      ? "Positive"
                      : sentimentFilter === "neutral"
                        ? "Neutral"
                        : "Negative"}
                </>
              }
              options={[
                { value: "all", label: "All" },
                { value: "positive", label: "Positive 4–5★" },
                { value: "neutral", label: "Neutral 3★" },
                { value: "negative", label: "Negative 1–2★" },
              ]}
              value={sentimentFilter}
              onPick={setSentimentFilter}
            />
          </div>
        </div>
        <div className="px-4 pb-4 sm:px-5">
        {loading ? (
          <div className="animate-pulse space-y-3 pt-4" aria-hidden>
            <div className="h-16 rounded-xl bg-ink/10" />
            <div className="h-16 rounded-xl bg-ink/10" />
          </div>
        ) : visible.length ? (
          <ul className="mt-3 divide-y divide-ink/10">
            {visible.map((f) => {
              const ctx = contexts.get(f.appointment_id);
              return (
                <li key={f.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    {stars(f.rating)}
                    <span className="text-[11px] font-medium text-ink-faint">
                      {aliases.get(f.student_id) ?? "Student"} · {timeAgo(f.created_at)}
                    </span>
                  </div>
                  {f.comment?.trim() && (
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">{f.comment}</p>
                  )}
                  {ctx && (
                    <p className="mt-1 truncate text-xs font-medium text-ink-muted">
                      {isCounselor ? ctx.concern : `${ctx.counselor} · ${ctx.concern}`}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-center text-[13px] text-ink-muted">
            {rows.length ? "No feedback matches these filters." : "No feedback yet — ratings appear here after completed sessions."}
          </p>
        )}
        </div>
      </Card>
    </div>
  );
}
