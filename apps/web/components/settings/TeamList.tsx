"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/primitives";
import { initials, timeAgo } from "@/lib/format";
import type { SettingsCounselor, SettingsFeedItem } from "@/lib/hooks/use-settings-board";

/**
 * Head-only counseling team section (team tab).
 * Extracted verbatim from app/(staff)/settings/page.tsx (same JSX/classes).
 */
export function TeamSection({
  loading,
  counselors,
}: {
  loading: boolean;
  counselors: SettingsCounselor[];
}) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card" role="tabpanel">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold text-ink">Counseling team</h2>
        <Link href="/users" className="text-[13px] font-bold text-primary-600 hover:underline">
          Manage accounts
        </Link>
      </div>
      {loading ? (
        <div className="animate-pulse space-y-3 pt-3" aria-hidden>
          <div className="h-12 rounded-lg bg-ink/10" />
          <div className="h-12 rounded-lg bg-ink/10" />
        </div>
      ) : counselors.length ? (
        <ul className="mt-3 divide-y divide-ink/10">
          {counselors.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-600 font-display text-sm font-bold text-white">
                {initials(c.name)}
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-sm font-bold text-ink">{c.name}</p>
                <p className="truncate text-xs font-medium text-ink-muted">
                  {c.spec ?? "Counselor"} · {c.sessions} session{c.sessions === 1 ? "" : "s"}
                </p>
              </div>
              <Badge tone={c.available ? "success" : "warning"}>{c.available ? "Available" : "Off"}</Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-lg bg-cream px-4 py-3 text-[13px] text-ink-muted">
          No counselors yet — <Link href="/users/new" className="font-bold text-primary-600 hover:underline">add the first one</Link>.
        </p>
      )}
    </section>
  );
}

/**
 * My activity section (activity tab).
 * Extracted verbatim from app/(staff)/settings/page.tsx (same JSX/classes).
 */
export function ActivitySection({
  loading,
  feed,
}: {
  loading: boolean;
  feed: SettingsFeedItem[];
}) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card" role="tabpanel">
      <h2 className="font-display text-base font-bold text-ink">My activity</h2>
      <p className="mt-0.5 text-[13px] text-ink-muted">Triage moves, posts, and emergency accesses you made.</p>
      {loading ? (
        <div className="animate-pulse space-y-3 pt-3" aria-hidden>
          <div className="h-10 rounded-lg bg-ink/10" />
          <div className="h-10 rounded-lg bg-ink/10" />
        </div>
      ) : feed.length ? (
        <ul className="mt-3 space-y-0">
          {feed.map((f) => (
            <li key={f.id} className="relative flex gap-3 pb-4 last:pb-0">
              <span aria-hidden className="flex flex-col items-center">
                <span className={`mt-1 h-2.5 w-2.5 rounded-full ${f.tone === "success" ? "bg-green-500" : f.tone === "warning" ? "bg-amber-500" : "bg-primary-500"}`} />
                <span aria-hidden className="w-px flex-1 bg-ink/10" />
              </span>
              <div className="min-w-0 flex-1 leading-snug">
                <p className="text-sm font-semibold text-ink">{f.text}</p>
                <p className="text-[11px] font-medium text-ink-faint">{timeAgo(f.at)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-lg bg-cream px-4 py-3 text-[13px] text-ink-muted">
          Nothing yet — triage a referral or publish a post and it shows up here.
        </p>
      )}
    </section>
  );
}
