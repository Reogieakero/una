"use client";

import dynamic from "next/dynamic";

/**
 * P18: recharts code-split boundary. Importers keep importing from this
 * path with identical names/props — but recharts itself only loads inside
 * `reports-charts-inner` (ssr:false async chunk), so chart pages hydrate
 * and paint before the chart lib arrives. Skeletons hold the layout.
 */

export type TrendPoint = { day: string; sessions: number };
export type DonutSlice = { name: string; value: number; color: string };
export type BarPoint = { label: string; value: number; color?: string };

function ChartFallback() {
  return <div className="mt-4 h-[240px] animate-pulse rounded-xl bg-ink/5" aria-hidden />;
}

function DonutFallback() {
  return <div className="mt-4 h-[200px] animate-pulse rounded-xl bg-ink/5" aria-hidden />;
}

const opts = { ssr: false as const };

/** Sessions-per-day bar trend (client — recharts can't render in an RSC). */
export const ReportTrendChart = dynamic<{ data: TrendPoint[] }>(
  () => import("./reports-charts-inner").then((m) => m.ReportTrendChart),
  { ...opts, loading: ChartFallback }
);

/** Generic donut with centered legend (status, mode, stress bands…). */
export const ReportDonut = dynamic<{ data: DonutSlice[] }>(
  () => import("./reports-charts-inner").then((m) => m.ReportDonut),
  { ...opts, loading: DonutFallback }
);

/** Generic vertical bars (rating distribution, referrals by priority…). */
export const ReportBars = dynamic<{ data: BarPoint[]; barColor?: string }>(
  () => import("./reports-charts-inner").then((m) => m.ReportBars),
  { ...opts, loading: ChartFallback }
);

/** Generic line trend (posts over time, sessions over time…). */
export const ReportLines = dynamic<{ data: BarPoint[]; stroke?: string }>(
  () => import("./reports-charts-inner").then((m) => m.ReportLines),
  { ...opts, loading: ChartFallback }
);
