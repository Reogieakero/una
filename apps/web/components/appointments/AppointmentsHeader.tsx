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
 * Page header — title + Stats / actions-legend floating panels.
 * Extracted verbatim from page.tsx (same hover/click/clamp behavior).
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
  const [statsOpen, setStatsOpen] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  const statsCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const legendRef = useRef<HTMLDivElement>(null);
  const legendCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openStats = () => { if (statsCloseTimer.current) clearTimeout(statsCloseTimer.current); setStatsOpen(true); };
  const scheduleStatsClose = () => { if (statsCloseTimer.current) clearTimeout(statsCloseTimer.current); statsCloseTimer.current = setTimeout(() => setStatsOpen(false), 150); };
  const toggleStats = () => { if (statsCloseTimer.current) clearTimeout(statsCloseTimer.current); setStatsOpen((v) => !v); };
  const openLegend = () => { if (legendCloseTimer.current) clearTimeout(legendCloseTimer.current); setLegendOpen(true); };
  const scheduleLegendClose = () => { if (legendCloseTimer.current) clearTimeout(legendCloseTimer.current); legendCloseTimer.current = setTimeout(() => setLegendOpen(false), 150); };
  const toggleLegend = () => { if (legendCloseTimer.current) clearTimeout(legendCloseTimer.current); setLegendOpen((v) => !v); };

  useEffect(() => {
    if (!statsOpen) return;
    const onPointerDown = (e: PointerEvent) => { if (statsRef.current && !statsRef.current.contains(e.target as Node)) setStatsOpen(false); };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setStatsOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); if (statsCloseTimer.current) clearTimeout(statsCloseTimer.current); };
  }, [statsOpen]);
  const statsPos = useClampedPanel(statsOpen, statsRef, 288, "right");

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
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold">{role === "counselor" ? "My appointments" : "Appointments"}</h1>
        <p className="mt-1 max-w-[600px] text-sm leading-relaxed text-ink-muted">
          {role === "counselor"
            ? "Your assigned queue — confirm assigned bookings and set the session schedule inside your availability slots (student notified), reschedule assigned or upcoming confirmed sessions the same way, then mark confirmed ones complete or no-show. Cancels also come from the student."
            : "Office-wide session board — assign a counselor (pending → assigned) or reject pending requests (unassign assigned ones first). Confirm / reschedule / complete / no-show belong to the counselor; cancel belongs to the student."}
        </p>
      </div>
      <div className="flex shrink-0 items-start gap-2">
      <div ref={statsRef} onMouseEnter={openStats} onMouseLeave={scheduleStatsClose}>
        <button type="button" onClick={toggleStats} onFocus={openStats} onBlur={scheduleStatsClose} aria-haspopup="dialog" aria-expanded={statsOpen} className="inline-flex h-8 items-center gap-1.5 rounded border border-ink/10 bg-white px-3 text-[13px] font-bold text-ink-soft shadow-card transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
          Stats
          <ChevronDown aria-hidden className={cn("h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200", statsOpen && "rotate-180")} />
        </button>
        {statsOpen && (
          <div role="dialog" aria-label="Appointment stats" style={{ top: statsPos?.top, left: statsPos?.left, width: statsPos?.width ?? 288 }} className="fixed z-50 max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border border-ink/10 bg-white py-1 shadow-card">
            {loading ? (
              <div className="animate-pulse px-4 py-3" aria-hidden><div className="h-10 rounded-lg bg-ink/10" /><div className="mt-2 h-10 rounded-lg bg-ink/10" /><div className="mt-2 h-10 rounded-lg bg-ink/10" /></div>
            ) : (
              statCards.map((s) => (
                <button key={s.label} type="button" onClick={() => { s.pick(); setStatsOpen(false); }} title={`Filter by ${s.label}`} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-cream focus-visible:outline-none focus-visible:bg-cream">
                  <span className="text-[13px] font-medium text-ink-muted">{s.label}</span>
                  <span className="font-display text-xl font-bold text-ink">{s.value}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
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
    </div>
  );
}
