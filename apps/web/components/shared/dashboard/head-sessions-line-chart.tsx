"use client";

import { useReducedMotion } from "framer-motion";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { useTheme } from "@/components/providers/theme-provider";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

const chartConfig = {
  count: { label: "Sessions booked", color: "#60A5FA" },
} satisfies ChartConfig;

/**
 * Sessions booked per bucket across the selected window (`sessionTrend`),
 * drawn as a blue line so booking momentum reads at a glance. Uses the
 * shadcn/ui chart tooltip and honours reduced-motion preferences.
 */
export function HeadSessionsLineChart({
  points,
  className,
}: {
  points: { key: string; label: string; count: number }[];
  className?: string;
}) {
  const reduce = useReducedMotion();
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const total = points.reduce((sum, p) => sum + p.count, 0);

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
          Appointments booked in this period will show up here.
        </p>
      </div>
    );
  }

  const data = points.map((p) => ({ label: p.label, count: p.count }));
  const summary = points.map((p) => `${p.label}: ${p.count}`).join(", ");

  return (
    <div className={cn("relative", className)}>
      <div role="img" aria-label={`Sessions booked. ${summary}`}>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[164px] w-full overflow-visible"
        >
          <LineChart data={data} margin={{ top: 16, right: 10, left: 10, bottom: 0 }}>
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
            <YAxis hide domain={[0, "auto"]} allowDecimals={false} />

            <ChartTooltip
              cursor={{ stroke: "#3B82F6", strokeOpacity: 0.4, strokeDasharray: "4 4" }}
              wrapperStyle={{ zIndex: 9999, outline: "none" }}
              content={<ChartTooltipContent nameKey="count" />}
            />

            <Line
              type="monotone"
              dataKey="count"
              name="Sessions booked"
              stroke={dark ? "#60A5FA" : "#2563EB"}
              strokeWidth={2.5}
              strokeLinecap="round"
              dot={{
                r: 3,
                fill: dark ? "#93C5FD" : "#3B82F6",
                stroke: dark ? "#071625" : "#ffffff",
                strokeWidth: 1.5,
              }}
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
          </LineChart>
        </ChartContainer>
      </div>

      <p className="mt-2 text-[11px] font-medium text-blue-100/40">
        <span className="font-bold text-white">{total.toLocaleString("en-US")}</span> sessions booked
        in this window
      </p>
    </div>
  );
}
