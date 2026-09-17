"use client";

import { useEffect, useState } from "react";
import { Timer, Video } from "lucide-react";
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
        <Timer className="h-4 w-4" aria-hidden />
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
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-bold text-primary-700 transition hover:bg-primary-50"
        >
          <Video className="h-4 w-4" aria-hidden />
          Join Meet
        </a>
      )}
    </button>
  );
}
