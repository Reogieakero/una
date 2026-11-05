"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useClampedPanel } from "@/components/shared/hover-menu";
import { cn } from "@/lib/utils";
import { COUNSELOR_LEGEND, HEAD_LEGEND } from "./status";

export type AppointmentStats = {
  total: number;
  pending: number;
  assigned: number;
  confirmed: number;
  completed: number;
  unassigned: number;
};

/**
 * Page header — title, a visible stats card row (each card applies its
 * filter), and the floating actions legend.
 */
export function AppointmentsHeader({
  role,
  canSeeActions,
  loading,
  stats,
  onSelectStatus,
  onSelectCounselor,
}: {
  role: string | null;
  canSeeActions: boolean;
  loading: boolean;
  stats: AppointmentStats;
  onSelectStatus: (s: string) => void;
  onSelectCounselor: (c: string) => void;
}) {
  const [legendOpen, setLegendOpen] = useState(false);
  const legendRef = useRef<HTMLDivElement>(null);
  const legendCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openLegend = () => { if (legendCloseTimer.current) clearTimeout(legendCloseTimer.current); setLegendOpen(true); };
  const scheduleLegendClose = () => { if (legendCloseTimer.current) clearTimeout(legendCloseTimer.current); legendCloseTimer.current = setTimeout(() => setLegendOpen(false), 150); };
  const toggleLegend = () => { if (legendCloseTimer.current) clearTimeout(legendCloseTimer.current); setLegendOpen((v) => !v); };

  useEffect(() => {
    if (!legendOpen) return;
    const onPointerDown = (e: PointerEvent) => { if (legendRef.current && !legendRef.current.contains(e.target as Node)) setLegendOpen(false); };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setLegendOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); if (legendCloseTimer.current) clearTimeout(legendCloseTimer.current); };
  }, [legendOpen]);
  const legendPos = useClampedPanel(legendOpen, legendRef, 320, "right");

  const statCards = [
    { label: role === "counselor" ? "My sessions" : "Total sessions", value: stats.total, pick: () => { onSelectStatus("all"); onSelectCounselor("all"); } },
    { label: "Pending", value: stats.pending, pick: () => onSelectStatus("pending") },
    { label: "Assigned", value: stats.assigned, pick: () => onSelectStatus("assigned") },
    { label: "Confirmed", value: stats.confirmed, pick: () => onSelectStatus("confirmed") },
    { label: "Completed", value: stats.completed, pick: () => onSelectStatus("completed") },
    { label: "Unassigned", value: stats.unassigned, pick: () => onSelectCounselor("unassigned") },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">
          {role === "counselor" ? "My appointments" : "Appointments"}
        </h1>
        {canSeeActions && (
          <div ref={legendRef} onMouseEnter={openLegend} onMouseLeave={scheduleLegendClose}>
            <button type="button" onClick={toggleLegend} onFocus={openLegend} onBlur={scheduleLegendClose} aria-haspopup="dialog" aria-expanded={legendOpen} className="inline-flex h-8 items-center gap-1.5 rounded border border-ink/10 bg-white px-3 text-[13px] font-bold text-ink-soft shadow-card transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
              {role === "guidance_head" ? "Admin actions" : "Counselor actions"}
              <ChevronDown aria-hidden className={cn("h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200", legendOpen && "rotate-180")} />
            </button>
            {legendOpen && (
              <div role="dialog" aria-label={role === "guidance_head" ? "Admin actions legend" : "Counselor actions legend"} style={{ top: legendPos?.top, left: legendPos?.left, width: legendPos?.width ?? 320 }} className="fixed z-50 max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border border-ink/10 bg-white px-4 py-3 shadow-card">
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{role === "guidance_head" ? "Admin actions" : "Counselor actions"}</p>
                <ul className="mt-2 flex flex-col gap-2">
                  {(role === "guidance_head" ? HEAD_LEGEND : COUNSELOR_LEGEND).map((l) => (
                    <li key={l.label} className="flex items-center gap-2 text-[13px]">
                      <span aria-hidden className={l.variant === "accent" ? "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-400 text-ink" : "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink/15 bg-white text-ink"}>
                        <l.icon className="h-3.5 w-3.5" />
                      </span>
                      <span><span className="font-bold text-ink">{l.label}</span><span className="text-ink-muted"> · {l.desc}</span></span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Visible stats cards — click one to filter the table. */}
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
