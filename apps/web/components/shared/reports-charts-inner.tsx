"use client";

import { useId } from "react";
import { useReducedMotion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { CHART_PRIMARY } from "@/lib/report-palette";

export type TrendPoint = { day: string; sessions: number };
export type DonutSlice = { name: string; value: number; color: string };
export type BarPoint = { label: string; value: number; color?: string };

/**
 * Report charts share the dashboard's shadcn/ui Recharts primitives, so the
 * hover tooltip is the same raised, high-z card used on the overview page
 * (instead of recharts' default tooltip box).
 */

const trendConfig: ChartConfig = {
  sessions: { label: "Sessions", color: CHART_PRIMARY },
};

/** Sessions-per-day bar trend (client — recharts can't render in an RSC). */
export function ReportTrendChart({ data }: { data: TrendPoint[] }) {
  const reduce = useReducedMotion();

  return (
    <ChartContainer config={trendConfig} className="mt-4 aspect-auto h-[240px] w-full overflow-visible">
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,58,95,0.1)" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <ChartTooltip
          cursor={{ fill: "rgba(37,99,235,0.08)" }}
          wrapperStyle={{ zIndex: 9999, outline: "none" }}
          content={<ChartTooltipContent nameKey="sessions" />}
        />
        <Bar
          dataKey="sessions"
          name="Sessions"
          fill={CHART_PRIMARY}
          radius={[8, 8, 0, 0]}
          maxBarSize={28}
          isAnimationActive={!reduce}
          animationDuration={900}
          animationEasing="ease-out"
        />
      </BarChart>
    </ChartContainer>
  );
}

/** Sessions-per-day line + area trend for the headline sessions panel. */
export function ReportAreaChart({ data }: { data: TrendPoint[] }) {
  const reduce = useReducedMotion();
  // useId keeps the gradient unique when several area charts share a page.
  const gradientId = `trend-area-${useId().replace(/:/g, "")}`;

  return (
    <ChartContainer config={trendConfig} className="mt-4 aspect-auto h-[240px] w-full overflow-visible">
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_PRIMARY} stopOpacity={0.32} />
            <stop offset="100%" stopColor={CHART_PRIMARY} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,58,95,0.1)" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <ChartTooltip
          cursor={{ stroke: "rgba(37,99,235,0.3)" }}
          wrapperStyle={{ zIndex: 9999, outline: "none" }}
          content={<ChartTooltipContent nameKey="sessions" />}
        />
        <Area
          type="monotone"
          dataKey="sessions"
          name="Sessions"
          stroke={CHART_PRIMARY}
          strokeWidth={2.5}
          fill={`url(#${gradientId})`}
          dot={{ r: 3, fill: CHART_PRIMARY, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          isAnimationActive={!reduce}
          animationDuration={900}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ChartContainer>
  );
}

/** Generic donut with centered legend (status, mode, stress bands…). */
export function ReportDonut({ data }: { data: DonutSlice[] }) {
  const reduce = useReducedMotion();
  const config = data.reduce<ChartConfig>((acc, slice) => {
    acc[slice.name] = { label: slice.name, color: slice.color };
    return acc;
  }, {});

  return (
    <div className="mt-4">
      <ChartContainer config={config} className="aspect-auto h-[200px] w-full overflow-visible">
        <PieChart>
          <ChartTooltip
            cursor={false}
            wrapperStyle={{ zIndex: 9999, outline: "none" }}
            content={<ChartTooltipContent nameKey="name" hideLabel indicator="dot" />}
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="88%"
            paddingAngle={3}
            strokeWidth={0}
            isAnimationActive={!reduce}
            animationDuration={900}
            animationEasing="ease-out"
          >
            {data.map((s) => (
              <Cell key={s.name} fill={s.color} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {data.map((s) => (
          <li key={s.name} className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            {s.name} · {s.value}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Generic vertical bars (rating distribution, referrals by priority…). */
export function ReportBars({ data, barColor = CHART_PRIMARY }: { data: BarPoint[]; barColor?: string }) {
  const reduce = useReducedMotion();
  // Per-label config keeps the tooltip swatch in sync with each bar's colour.
  const config = data.reduce<ChartConfig>((acc, point) => {
    acc[point.label] = { label: point.label, color: point.color ?? barColor };
    return acc;
  }, {});

  return (
    <ChartContainer config={config} className="mt-4 aspect-auto h-[240px] w-full overflow-visible">
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,58,95,0.1)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <ChartTooltip
          cursor={{ fill: "rgba(37,99,235,0.08)" }}
          wrapperStyle={{ zIndex: 9999, outline: "none" }}
          content={<ChartTooltipContent nameKey="label" />}
        />
        <Bar
          dataKey="value"
          name="Count"
          radius={[8, 8, 0, 0]}
          maxBarSize={36}
          isAnimationActive={!reduce}
          animationDuration={900}
          animationEasing="ease-out"
        >
          {data.map((d) => (
            <Cell key={d.label} fill={d.color ?? barColor} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** Generic line trend (posts over time, sessions over time…). */
export function ReportLines({ data, stroke = CHART_PRIMARY }: { data: BarPoint[]; stroke?: string }) {
  const reduce = useReducedMotion();
  const config: ChartConfig = {
    value: { label: "Count", color: stroke },
  };

  return (
    <ChartContainer config={config} className="mt-4 aspect-auto h-[240px] w-full overflow-visible">
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,58,95,0.1)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <ChartTooltip
          cursor={{ stroke: "rgba(37,99,235,0.3)" }}
          wrapperStyle={{ zIndex: 9999, outline: "none" }}
          content={<ChartTooltipContent nameKey="value" />}
        />
        <Line
          type="monotone"
          dataKey="value"
          name="Count"
          stroke={stroke}
          strokeWidth={2.5}
          dot={{ r: 3, fill: stroke, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          isAnimationActive={!reduce}
          animationDuration={900}
          animationEasing="ease-out"
        />
      </LineChart>
    </ChartContainer>
  );
}
