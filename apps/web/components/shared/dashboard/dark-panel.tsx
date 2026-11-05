"use client";

import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Dark-glass panel primitives for the Guidance Head dashboard. Kept separate
 * from `panel-shell.tsx` so the light counselor/faculty dashboards are not
 * affected by the landing-style reskin.
 */

export function DarkPanel({
  title,
  hint,
  viewAllHref,
  children,
  className,
  action,
}: {
  title: string;
  hint?: string;
  viewAllHref?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_8px_24px_-24px_rgba(0,0,0,0.45)] backdrop-blur-xl",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-semibold tracking-[-0.01em] text-white">{title}</h2>
          {hint && <p className="mt-0.5 text-[12px] leading-relaxed text-blue-100/50">{hint}</p>}
        </div>
        {action}
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="shrink-0 rounded text-[12px] font-bold text-yellow-300/90 transition hover:text-yellow-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/60"
          >
            View all
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function DarkEmpty({
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
    <div className="flex min-h-[180px] flex-col items-center justify-center px-6 py-8 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-blue-200">
        <Glyph className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-bold text-white">{title}</p>
      <p className="mt-1 max-w-[260px] text-[12px] leading-relaxed text-blue-100/50">{hint}</p>
    </div>
  );
}

export function DarkSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-2.5 pt-3" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-11 rounded-xl bg-white/[0.06]" />
      ))}
    </div>
  );
}

export function DarkChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse", className)} aria-hidden>
      <div className="mt-4 h-40 rounded-xl bg-white/[0.06]" />
    </div>
  );
}
