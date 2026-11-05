"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { formatLong } from "@/components/appointments/status";
import type { CalendarSession } from "@/lib/hooks/use-sessions-calendar";

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Compact next-session card — designed to sit in the calendar header's
 * top-right corner. Red so the upcoming session stands out, with a live
 * per-second countdown, student alias, schedule, and a clear affordance to
 * open the day overlay. Hidden when nothing is upcoming.
 */
export function NextSessionTimer({
  session,
  alias,
  onSelect,
}: {
  session: CalendarSession | null;
  alias: string;
  onSelect?: (s: CalendarSession) => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!session) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, [session?.id]);

  if (!session) return null;
  const ms = new Date(session.scheduled_at).getTime() - now;
  if (ms <= 0) return null;
  const { d, h, m, s } = parts(ms);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(session)}
      title="View session details"
      className="group relative flex w-full flex-col gap-2 overflow-hidden rounded-xl border border-red-500/40 bg-gradient-to-br from-red-600 to-red-500 px-4 py-3 text-left text-white shadow-card transition hover:from-red-500 hover:to-red-400 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full bg-white/10 blur-2xl"
      />

      <span className="relative flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/85">
          <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          Next session
        </span>
        <span
          role="timer"
          aria-label={`Starts in ${d} days ${h} hours ${m} minutes ${s} seconds`}
          className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 font-display text-[11px] font-bold tabular-nums text-white"
        >
          {d > 0 ? `${d}d ` : ""}
          {pad(h)}:{pad(m)}:{pad(s)}
        </span>
      </span>

      <span className="relative min-w-0">
        <span className="block truncate font-display text-sm font-bold">{alias}</span>
        <span className="mt-0.5 block truncate text-[12px] text-white/80">
          {formatLong(session.scheduled_at)} · {session.mode === "online" ? "Online" : "In person"}
        </span>
      </span>

      <span className="relative flex items-center justify-between gap-2 text-[11px] font-medium text-white/75">
        <span>
          Starts in {d > 0 ? `${d} day${d === 1 ? "" : "s"}` : `${h}h ${m}m`}
        </span>
        <span className="inline-flex items-center gap-0.5 font-bold text-white">
          View details
          <ChevronRight
            aria-hidden
            className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </span>
    </button>
  );
}

/**
 * Compact live-session card for the same header slot — takes over from the
 * countdown once the start time passes and the session has not ended.
 */
export function LiveSessionBanner({
  session,
  alias,
  onSelect,
}: {
  session: CalendarSession;
  alias: string;
  onSelect?: (s: CalendarSession) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(session)}
      title="View live session details"
      className="group relative flex w-full flex-col gap-2 overflow-hidden rounded-xl border border-accent-600 bg-gradient-to-br from-accent-600 to-accent-500 px-4 py-3 text-left text-white shadow-card transition hover:from-accent-500 hover:to-accent-400 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full bg-white/10 blur-2xl"
      />

      <span className="relative flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em]">
          <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          Live now
        </span>
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] text-white/75">
          In progress
        </span>
      </span>

      <span className="relative min-w-0">
        <span className="block truncate font-display text-sm font-bold">{alias}</span>
        <span className="mt-0.5 block truncate text-[12px] text-white/85">
          Started {formatLong(session.scheduled_at)} · {session.mode === "online" ? "Online" : "In person"}
        </span>
      </span>

      <span className="relative flex items-center justify-between gap-2 text-[11px] font-medium text-white/80">
        <span>Join before the session ends</span>
        <span className="inline-flex items-center gap-0.5 font-bold text-white">
          View details
          <ChevronRight
            aria-hidden
            className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </span>
    </button>
  );
}
