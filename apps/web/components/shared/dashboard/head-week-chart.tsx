"use client";

import { useId } from "react";
import { useReducedMotion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { useTheme } from "@/components/providers/theme-provider";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

const chartConfig = {
  sessions: { label: "Sessions", color: "#3B82F6" },
} satisfies ChartConfig;

/**
 * Sessions booked per day for the rolling current week (`weekChart`).
 *
 * shadcn/ui Recharts bar chart: every bar reveals the same raised tooltip, and
 * today stays a lighter blue step rather than the old yellow accent so both
 * dashboard charts share one blue palette.
 */
export function HeadWeekChart({
  points,
  className,
}: {
  points: { key: string; day: string; sessions: number }[];
  className?: string;
}) {
  const reduce = useReducedMotion();
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const barId = `head-week-bar-${useId().replace(/:/g, "")}`;
  const todayId = `head-week-today-${useId().replace(/:/g, "")}`;
  const total = points.reduce((sum, p) => sum + p.sessions, 0);

  if (!points.length) {
    return (
      <div
        className={cn(
          "flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center",
          className
        )}
      >
        <p className="text-[13px] font-bold text-white">No session data</p>
        <p className="mt-1 max-w-[240px] text-[12px] leading-relaxed text-blue-100/45">
          This week&apos;s bookings will show up here.
        </p>
      </div>
    );
  }

  const summary = points.map((p) => `${p.day}: ${p.sessions}`).join(", ");

  return (
    <div className={cn("relative", className)}>
      <div role="img" aria-label={`Sessions per day this week. ${summary}`}>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[164px] w-full overflow-visible"
        >
          <BarChart data={points} margin={{ top: 16, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id={barId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={dark ? "#60A5FA" : "#3B82F6"} />
                <stop offset="100%" stopColor={dark ? "#1D4ED8" : "#1E40AF"} />
              </linearGradient>
              <linearGradient id={todayId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={dark ? "#BFDBFE" : "#93C5FD"} />
                <stop offset="100%" stopColor={dark ? "#3B82F6" : "#2563EB"} />
              </linearGradient>
            </defs>

            <CartesianGrid
              vertical={false}
              stroke={dark ? "rgba(255,255,255,0.06)" : "rgba(30,58,95,0.12)"}
              strokeDasharray="3 5"
            />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              interval={0}
              tick={{
                fill: dark ? "#93C5FD" : "#2D5A8E",
                fillOpacity: dark ? 0.45 : 0.7,
                fontSize: 10,
                fontWeight: 700,
              }}
            />
            <YAxis hide domain={[0, "auto"]} allowDecimals={false} />

            <ChartTooltip
              cursor={{ fill: "rgba(59,130,246,0.12)" }}
              wrapperStyle={{ zIndex: 9999, outline: "none" }}
              content={<ChartTooltipContent nameKey="sessions" />}
            />

            <Bar
              dataKey="sessions"
              name="Sessions"
              radius={[8, 8, 0, 0]}
              maxBarSize={46}
              isAnimationActive={!reduce}
              animationDuration={900}
              animationEasing="ease-out"
            >
              {points.map((point, i) => (
                <Cell
                  key={point.key}
                  fill={`url(#${i === points.length - 1 ? todayId : barId})`}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>

      <p className="mt-2 text-[11px] font-medium text-blue-100/40">
        <span className="font-bold text-white">{total.toLocaleString("en-US")}</span> sessions in the
        last 7 days · today in lighter blue
      </p>
    </div>
  );
}
