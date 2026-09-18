"use client";

import { useEffect, useState } from "react";
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
 * Next-session countdown banner — the nearest upcoming confirmed session
 * with a live per-second timer, student, mode, and Join button for online
 * sessions. Hidden when nothing is upcoming.
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
  const units = [
    { v: pad(d), label: "days" },
    { v: pad(h), label: "hrs" },
    { v: pad(m), label: "min" },
    { v: pad(s), label: "sec" },
  ];

  return (
    <button
      type="button"
      onClick={() => onSelect?.(session)}
      title="View session details"
      className="flex w-full flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border border-primary-200 bg-gradient-to-r from-primary-600 to-primary-500 px-5 py-4 text-left text-white shadow-card transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
    >
      <span className="inline-flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-white/85">
        Next session
      </span>
      <span
        className="inline-flex items-center gap-1.5 font-display text-2xl font-bold tabular-nums"
        role="timer"
        aria-label={`Starts in ${d} days ${h} hours ${m} minutes ${s} seconds`}
      >
        {units.map((u, i) => (
          <span key={u.label} className="inline-flex items-baseline gap-1">
            {i > 0 && <span aria-hidden className="text-white/60">:</span>}
            <span>{u.v}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/70">{u.label}</span>
          </span>
        ))}
      </span>
      <span className="min-w-0 flex-1 text-sm">
        <span className="block truncate font-bold">{alias}</span>
        <span className="block text-[13px] text-white/85">
          {formatLong(session.scheduled_at)} · {session.mode === "online" ? "Online" : "In person"}
        </span>
      </span>
      {session.mode === "online" && session.meeting_url && (
        <a
          href={session.meeting_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-8 items-center gap-1.5 rounded bg-white px-4 text-[13px] font-bold text-primary-700 transition hover:bg-primary-50"
        >
          Join Meet
        </a>
      )}
    </button>
  );
}

/**
 * Live-session banner — rendered INSTEAD of the countdown once the session
 * start time passes and the end hasn't (see isSessionLive). Pulsing accent
 * marker, student + schedule line, Join button for online sessions.
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
      className="flex w-full flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border border-accent-600 bg-gradient-to-r from-accent-600 to-accent-500 px-5 py-4 text-left text-white shadow-card transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
    >
      <span className="inline-flex items-center gap-2 rounded bg-white/20 px-2.5 py-1 font-display text-sm font-bold uppercase tracking-wider">
        <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-white" />
        Live now
      </span>
      <span className="min-w-0 flex-1 text-sm">
        <span className="block truncate font-bold">{alias}</span>
        <span className="block text-[13px] text-white/85">
          Started {formatLong(session.scheduled_at)} · {session.mode === "online" ? "Online" : "In person"}
        </span>
      </span>
      {session.mode === "online" && session.meeting_url && (
        <a
          href={session.meeting_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-8 items-center gap-1.5 rounded bg-white px-4 text-[13px] font-bold text-accent-700 transition hover:bg-accent-50"
        >
          Join Meet
        </a>
      )}
    </button>
  );
}
