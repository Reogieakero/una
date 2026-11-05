"use client";

import { useId } from "react";
import { useReducedMotion } from "framer-motion";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useTheme } from "@/components/providers/theme-provider";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

const chartConfig = {
  count: { label: "Referrals", color: "#60A5FA" },
} satisfies ChartConfig;

/**
 * Referral volume over the selected window.
 *
 * Uses the shadcn/ui Recharts area chart so hovering exposes a raised tooltip
 * for every bucket. The palette stays inside the brand blues; the gradient and
 * smooth draw-in match the rest of the dashboard's motion language.
 */
export function HeadTrendChart({
  points,
  className,
}: {
  points: { key: string; label: string; count: number }[];
  className?: string;
}) {
  const reduce = useReducedMotion();
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const gradientId = `head-trend-fill-${useId().replace(/:/g, "")}`;
  const total = points.reduce((sum, p) => sum + p.count, 0);

  if (!points.length || total === 0) {
    return (
      <div
        className={cn(
          "flex min-h-[190px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center",
          className
        )}
      >
        <p className="text-[13px] font-bold text-white">No referrals in this period</p>
        <p className="mt-1 max-w-[280px] text-[12px] leading-relaxed text-blue-100/45">
          Pick a wider period, or wait for faculty to file the next case.
        </p>
      </div>
    );
  }

  const data = points.map((p) => ({ label: p.label, count: p.count }));
  const summary = points.map((p) => `${p.label}: ${p.count}`).join(", ");

  return (
    <div className={cn("relative", className)}>
      <div role="img" aria-label={`Referrals over time. ${summary}`}>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[190px] w-full overflow-visible"
        >
          <AreaChart data={data} margin={{ top: 14, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={dark ? "#60A5FA" : "#3B82F6"} stopOpacity={0.42} />
                <stop offset="60%" stopColor={dark ? "#3B82F6" : "#2563EB"} stopOpacity={0.14} />
                <stop offset="100%" stopColor={dark ? "#3B82F6" : "#2563EB"} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              vertical={false}
              stroke={dark ? "rgba(255,255,255,0.06)" : "rgba(30,58,95,0.12)"}
              strokeDasharray="3 5"
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              interval="preserveStartEnd"
              minTickGap={18}
              tick={{
                fill: dark ? "#93C5FD" : "#2D5A8E",
                fillOpacity: dark ? 0.45 : 0.7,
                fontSize: 10,
                fontWeight: 700,
              }}
            />
            <YAxis hide domain={[0, "auto"]} />

            <ChartTooltip
              cursor={{ stroke: "#3B82F6", strokeOpacity: 0.4, strokeDasharray: "4 4" }}
              wrapperStyle={{ zIndex: 9999, outline: "none" }}
              content={<ChartTooltipContent nameKey="count" />}
            />

            <Area
              type="monotone"
              dataKey="count"
              name="Referrals"
              stroke={dark ? "#60A5FA" : "#2563EB"}
              strokeWidth={2.5}
              strokeLinecap="round"
              fill={`url(#${gradientId})`}
              dot={{ r: 2.5, fill: dark ? "#93C5FD" : "#3B82F6", strokeWidth: 0 }}
              activeDot={{
                r: 5,
                fill: dark ? "#BFDBFE" : "#1D4ED8",
                stroke: dark ? "#071625" : "#ffffff",
                strokeWidth: 2,
              }}
              isAnimationActive={!reduce}
              animationDuration={950}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ChartContainer>
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium text-blue-100/40">
        <span>
          <span className="font-bold text-white">{total.toLocaleString("en-US")}</span> referrals in
          this window
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-blue-400" />
          Hover a point for details
        </span>
      </div>
    </div>
  );
}
