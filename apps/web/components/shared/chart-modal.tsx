"use client";

import { useEffect, useState } from "react";
import { BarChart3, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ChartView = "sessions" | "referrals";

const VIEW_TITLE: Record<ChartView, string> = {
  sessions: "Sessions — last 7 days",
  referrals: "Referrals by status",
};

/**
 * Chart viewer modal for the admin dashboard. A "View charts" button sits in
 * the page header's top-right; clicking it overlays a dialog where the admin
 * picks which chart to see (sessions or referrals). The overlay never
 * scrolls (content is fixed-height, background page is locked) — only one
 * chart mounts at a time so recharts always measures a visible container.
 */
export function ChartModal({
  sessions,
  referrals,
}: {
  sessions: React.ReactNode;
  referrals: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ChartView>("sessions");

  // Lock background scroll + Escape to dismiss while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open ]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3.5 py-2 text-[13px] font-bold text-ink-soft shadow-card transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      >
        <BarChart3 className="h-4 w-4" aria-hidden />
        View charts
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={VIEW_TITLE[view]}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <button
            type="button"
            aria-label="Close charts"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/40"
          />
          <div className="relative z-10 flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white p-5 shadow-card">
            <div className="flex shrink-0 items-center gap-3">
              <h2 className="min-w-0 flex-1 truncate font-display text-base font-bold text-ink">
                {VIEW_TITLE[view]}
              </h2>
              <div
                role="tablist"
                aria-label="Choose chart"
                className="flex shrink-0 rounded-full bg-cream p-1"
              >
                {(
                  [
                    { key: "sessions", label: "Sessions" },
                    { key: "referrals", label: "Referrals" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={view === t.key}
                    onClick={() => setView(t.key)}
                    className={cn(
                      "rounded-full px-3 py-1 text-[13px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                      view === t.key
                        ? "bg-white text-primary-700 shadow-card"
                        : "text-ink-muted hover:text-ink"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                autoFocus
                onClick={() => setOpen(false)}
                aria-label="Close charts"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft transition hover:bg-cream-dark hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            {/* Fixed-height stage — no scrollbar; one chart mounted at a time. */}
            <div className="mt-2 min-h-[300px]">
              {view === "sessions" ? sessions : referrals}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
