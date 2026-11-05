"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useClampedPanel } from "@/components/shared/hover-menu";
import { cn } from "@/lib/utils";
import type { ReferralStats } from "./ReferralStats";
import { COUNSELOR_LEGEND, HEAD_LEGEND } from "./status";

/**
 * Page header — title, role guidance, a visible stats card row (each card
 * applies its filter), and the floating actions legend. Same pattern as the
 * appointments header; the head's office-wide description was removed.
 */
export function ReferralsHeader({
  role,
  canSeeActions,
  loading,
  stats,
  onPickStatus,
  onPickUnassigned,
  onReset,
}: {
  role: string | null;
  canSeeActions: boolean;
  loading: boolean;
  stats: ReferralStats;
  onPickStatus: (s: string) => void;
  onPickUnassigned: () => void;
  onReset: () => void;
}) {
  const isCounselor = role === "counselor";
  const [legendOpen, setLegendOpen] = useState(false);
  const legendRef = useRef<HTMLDivElement>(null);
  const legendCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openLegend = () => {
    if (legendCloseTimer.current) clearTimeout(legendCloseTimer.current);
    setLegendOpen(true);
  };
  const scheduleLegendClose = () => {
    if (legendCloseTimer.current) clearTimeout(legendCloseTimer.current);
    legendCloseTimer.current = setTimeout(() => setLegendOpen(false), 150);
  };
  const toggleLegend = () => {
    if (legendCloseTimer.current) clearTimeout(legendCloseTimer.current);
    setLegendOpen((v) => !v);
  };

  useEffect(() => {
    if (!legendOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (legendRef.current && !legendRef.current.contains(e.target as Node)) setLegendOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLegendOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      if (legendCloseTimer.current) clearTimeout(legendCloseTimer.current);
    };
  }, [legendOpen]);

  const legendPos = useClampedPanel(legendOpen, legendRef, 320, "right");

  const description =
    role === "faculty"
      ? "Flag a student for counseling follow-up — pick the kind of concern (academic, behavioral, relational), describe what you observed, set urgency, and the office triages from here."
      : isCounselor
        ? "Your assigned queue — confirm assigned referrals: setting the schedule creates the session itself (student notified), then resolve once the session time passes. Reschedule its session from Appointments when plans move; cancels come from the student."
        : null;

  const statCards = [
    { label: isCounselor ? "My referrals" : "Total referrals", value: stats.total, pick: onReset },
    { label: "Pending", value: stats.pending, pick: () => onPickStatus("pending") },
    { label: "Assigned", value: stats.assigned, pick: () => onPickStatus("assigned") },
    { label: "Confirmed", value: stats.confirmed, pick: () => onPickStatus("confirmed") },
    { label: "Resolved", value: stats.resolved, pick: () => onPickStatus("resolved") },
    { label: "Unassigned", value: stats.unassigned, pick: onPickUnassigned },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {loading ? (
            <div aria-hidden>
              <div className="h-8 w-48 animate-pulse rounded-lg bg-ink/10" />
              <div className="mt-2 h-4 w-full max-w-[600px] animate-pulse rounded bg-ink/10" />
              <div className="mt-1.5 h-4 w-2/3 max-w-[400px] animate-pulse rounded bg-ink/10" />
            </div>
          ) : (
            <>
              <h1 className="font-display text-2xl font-bold">{isCounselor ? "My referrals" : "Referrals"}</h1>
              {description && (
                <p className="mt-1 max-w-[600px] text-sm leading-relaxed text-ink-muted">{description}</p>
              )}
            </>
          )}
        </div>
        {canSeeActions && !loading && (
          <div ref={legendRef} onMouseEnter={openLegend} onMouseLeave={scheduleLegendClose}>
            <button
              type="button"
              onClick={toggleLegend}
              onFocus={openLegend}
              onBlur={scheduleLegendClose}
              aria-haspopup="dialog"
              aria-expanded={legendOpen}
              className="inline-flex h-8 items-center gap-1.5 rounded border border-ink/10 bg-white px-3 text-[13px] font-bold text-ink-soft shadow-card transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              {role === "guidance_head" ? "Admin actions" : "Counselor actions"}
              <ChevronDown aria-hidden className={cn("h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200", legendOpen && "rotate-180")} />
            </button>
            {legendOpen && (
              <div
                role="dialog"
                aria-label={role === "guidance_head" ? "Admin actions legend" : "Counselor actions legend"}
                style={{ top: legendPos?.top, left: legendPos?.left, width: legendPos?.width ?? 320 }}
                className="fixed z-50 max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border border-ink/10 bg-white px-4 py-3 shadow-card"
              >
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                  {role === "guidance_head" ? "Admin actions" : "Counselor actions"}
                </p>
                <ul className="mt-2 flex flex-col gap-2">
                  {(role === "guidance_head" ? HEAD_LEGEND : COUNSELOR_LEGEND).map((l) => (
                    <li key={l.label} className="flex items-center gap-2 text-[13px]">
                      <span
                        aria-hidden
                        className={
                          l.variant === "accent"
                            ? "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-400 text-ink dark:text-[#050C16]"
                            : "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink/15 bg-white text-ink"
                        }
                      >
                        <l.icon className="h-3.5 w-3.5" />
                      </span>
                      <span>
                        <span className="font-bold text-ink">{l.label}</span>
                        <span className="text-ink-muted"> · {l.desc}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Visible stats cards — click one to filter the board. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {statCards.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={s.pick}
            title={`Filter by ${s.label}`}
            className="rounded-lg border border-ink/10 bg-white p-4 text-left shadow-card transition hover:border-primary-300 hover:bg-cream/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <span className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted">{s.label}</span>
            {loading ? (
              <span className="mt-2 block h-8 w-12 animate-pulse rounded bg-ink/10" aria-hidden />
            ) : (
              <span className="mt-1 block font-display text-2xl font-bold text-ink">{s.value}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
