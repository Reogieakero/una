"use client";

import { useMemo } from "react";
import type { AvailabilityCounselor, AvailabilitySlot } from "@/lib/hooks/use-availability-board";
import { DAYS, MON_FIRST, hhmm } from "@/lib/availability";

/** Weekly coverage board — who holds open slots each day. */
export function CoverageGrid({
  slots,
  counselors,
  loading,
}: {
  slots: AvailabilitySlot[];
  counselors: AvailabilityCounselor[];
  loading: boolean;
}) {
  const coverage = useMemo(
    () =>
      MON_FIRST.map((d) => ({
        day: d,
        label: DAYS[d],
        items: slots
          .filter((s) => s.weekday === d)
          .map((s) => ({
            id: s.id,
            name: counselors.find((c) => c.id === s.counselor_id)?.name ?? "Counselor",
            range: `${hhmm(s.start_time)}–${hhmm(s.end_time)}`,
          }))
          .sort((a, b) => a.range.localeCompare(b.range)),
      })),
    [slots, counselors]
  );

  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
      <h2 className="font-display text-base font-bold text-ink">Weekly coverage</h2>
      <p className="mt-0.5 text-[13px] text-ink-muted">Who holds open slots each day. Empty days can&apos;t take bookings.</p>
      {loading ? (
        <div className="mt-4 grid animate-pulse grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7" aria-hidden>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-ink/10" />
          ))}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          {coverage.map((d) => (
            <div
              key={d.day}
              className={
                d.items.length
                  ? "rounded-xl border border-ink/10 bg-cream px-3 py-2.5"
                  : "rounded-xl border-2 border-dashed border-red-300 bg-red-50 px-3 py-2.5"
              }
            >
              <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">{d.label}</p>
              {d.items.length ? (
                <ul className="mt-1.5 space-y-1.5">
                  {d.items.map((it) => (
                    <li key={it.id} className="text-[13px] leading-snug">
                      <span className="block truncate font-bold text-ink">{it.name}</span>
                      <span className="font-medium text-ink-muted">{it.range}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-[13px] font-bold text-red-600">No coverage</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
