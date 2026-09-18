"use client";

import Link from "next/link";
import { Button, Input } from "@/components/ui/primitives";
import { ExportReportsButton } from "@/components/shared/reports-actions";
import { timeAgo } from "@/lib/format";
import type { SettingsPost } from "@/lib/hooks/use-settings-board";

/**
 * Head-only workspace edit form (overview tab).
 * Extracted verbatim from app/(staff)/settings/page.tsx (same JSX/classes).
 */
export function WorkspaceForm({
  officeName,
  officeLocation,
  officeContact,
  saving,
  onOfficeName,
  onOfficeLocation,
  onOfficeContact,
  onSave,
}: {
  officeName: string;
  officeLocation: string;
  officeContact: string;
  saving: string | null;
  onOfficeName: (v: string) => void;
  onOfficeLocation: (v: string) => void;
  onOfficeContact: (v: string) => void;
  onSave: () => void;
}) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
      <h2 className="font-display text-base font-bold text-ink">Workspace</h2>
      <p className="mt-0.5 text-[13px] text-ink-muted">Shown in the sidebar on every staff page.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-bold text-ink-muted" htmlFor="office-name">Office name</label>
          <Input id="office-name" value={officeName} onChange={(e) => onOfficeName(e.target.value)} placeholder="DOrSU Guidance" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-ink-muted" htmlFor="office-location">Location</label>
          <Input id="office-location" value={officeLocation} onChange={(e) => onOfficeLocation(e.target.value)} placeholder="Mati City" />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-bold text-ink-muted" htmlFor="office-contact">Contact (optional)</label>
          <Input id="office-contact" value={officeContact} onChange={(e) => onOfficeContact(e.target.value)} placeholder="guidance@dorsu.edu.ph" />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button size="sm" disabled={saving === "office"} onClick={onSave}>
          {saving === "office" ? "Saving…" : "Save workspace"}
        </Button>
      </div>
    </section>
  );
}

/**
 * Head-only right column — office at a glance, latest posts, data export.
 * Extracted verbatim from app/(staff)/settings/page.tsx (same JSX/classes).
 */
export function WorkspaceOverview({
  loading,
  counselorsCount,
  sessionsToday,
  openReferrals,
  published,
  posts,
}: {
  loading: boolean;
  counselorsCount: number;
  sessionsToday: number;
  openReferrals: number;
  published: number;
  posts: SettingsPost[];
}) {
  return (
    <div className="min-w-0 space-y-4">
      <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <h2 className="font-display text-base font-bold text-ink">Office at a glance</h2>
        {loading ? (
          <div className="mt-3 grid animate-pulse grid-cols-2 gap-3" aria-hidden>
            <div className="h-16 rounded-lg bg-ink/10" />
            <div className="h-16 rounded-lg bg-ink/10" />
            <div className="h-16 rounded-lg bg-ink/10" />
            <div className="h-16 rounded-lg bg-ink/10" />
          </div>
        ) : (
          <dl className="mt-3 grid grid-cols-2 gap-3">
            {[
              ["Counselors", counselorsCount],
              ["Sessions today", sessionsToday],
              ["Referrals waiting", openReferrals],
              ["Posts live", published],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-lg bg-cream px-3 py-2.5">
                <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">{k}</dt>
                <dd className="font-display text-2xl font-bold text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-bold text-ink">Latest posts</h2>
          <Link href="/announcements" className="text-[13px] font-bold text-primary-600 hover:underline">
            View all
          </Link>
        </div>
        {loading ? (
          <div className="animate-pulse space-y-2 pt-3" aria-hidden>
            <div className="h-10 rounded-lg bg-ink/10" />
            <div className="h-10 rounded-lg bg-ink/10" />
          </div>
        ) : posts.length ? (
          <ul className="mt-3 divide-y divide-ink/10">
            {posts.slice(0, 3).map((p) => (
              <li key={p.id} className="py-2 first:pt-0 last:pb-0">
                <p className="truncate text-sm font-bold text-ink">{p.title}</p>
                <p className="text-[11px] font-medium text-ink-faint">{timeAgo(p.published_at ?? p.created_at)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-lg bg-cream px-4 py-3 text-[13px] text-ink-muted">No posts yet.</p>
        )}
      </section>

      <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <h2 className="font-display text-base font-bold text-ink">Data export</h2>
        <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">
          One styled workbook — cover, summary, sessions, referrals, feedback, wellbeing, team & posts. Print-ready with filters, totals & proper spacing. Aliases only, never student names.
        </p>
        <div className="mt-3 print:hidden">
          <ExportReportsButton />
        </div>
      </section>
    </div>
  );
}
