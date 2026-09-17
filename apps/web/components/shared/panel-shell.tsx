"use client";

import Link from "next/link";
import { BarChart3 } from "lucide-react";

/**
 * Shared dashboard/report primitives.
 * Consolidates the 4 identical copies of EmptyState / PanelShell /
 * ListSkeleton in counselor/head-dashboard-view and counselor/head-reports-view.
 * Visual output is identical to the originals.
 */

export function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon?: typeof BarChart3;
  title: string;
  hint: string;
}) {
  const Glyph = Icon ?? BarChart3;
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center px-6 py-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-primary-600 ring-1 ring-blue-100">
        <Glyph className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-bold text-ink">{title}</p>
      <p className="mt-1 max-w-[260px] text-[13px] leading-relaxed text-ink-muted">{hint}</p>
    </div>
  );
}

export function PanelShell({
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

export function ListSkeleton() {
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
