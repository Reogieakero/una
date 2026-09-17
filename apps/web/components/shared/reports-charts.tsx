"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_PRIMARY } from "@/lib/report-palette";

export type TrendPoint = { day: string; sessions: number };
export type DonutSlice = { name: string; value: number; color: string };
export type BarPoint = { label: string; value: number; color?: string };

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid rgba(30,58,95,0.1)",
  fontSize: 12,
} as const;

/** Sessions-per-day bar trend (client — recharts can't render in an RSC). */
export function ReportTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="mt-4 h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,58,95,0.1)" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: "rgba(37,99,235,0.08)" }} contentStyle={{ ...TOOLTIP_STYLE }} />
          <Bar dataKey="sessions" name="Sessions" fill={CHART_PRIMARY} radius={[8, 8, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Generic donut with centered legend (status, mode, stress bands…). */
export function ReportDonut({ data }: { data: DonutSlice[] }) {
  return (
    <div className="mt-4">
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={3}
              strokeWidth={0}
            >
              {data.map((s) => (
                <Cell key={s.name} fill={s.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ ...TOOLTIP_STYLE }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
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
  return (
    <div className="mt-4 h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,58,95,0.1)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: "rgba(37,99,235,0.08)" }} contentStyle={{ ...TOOLTIP_STYLE }} />
          <Bar dataKey="value" name="Count" radius={[8, 8, 0, 0]} maxBarSize={36}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.color ?? barColor} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Generic line trend (posts over time, sessions over time…). */
export function ReportLines({ data, stroke = CHART_PRIMARY }: { data: BarPoint[]; stroke?: string }) {
  return (
    <div className="mt-4 h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,58,95,0.1)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ stroke: "rgba(37,99,235,0.3)" }} contentStyle={{ ...TOOLTIP_STYLE }} />
          <Line
            type="monotone"
            dataKey="value"
            name="Posts"
            stroke={stroke}
            strokeWidth={2.5}
            dot={{ r: 3, fill: stroke, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
