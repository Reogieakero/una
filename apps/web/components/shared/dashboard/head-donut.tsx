"use client";

import { useReducedMotion } from "framer-motion";
import { Cell, Pie, PieChart } from "recharts";
import { CountUp } from "@/components/CountUp";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

/**
 * Referral pipeline share by status.
 *
 * Status is single-select per referral, so a donut is honest here (unlike the
 * multi-select classification field). Built on the shadcn/ui Recharts pie so
 * every slice exposes the shared raised tooltip on hover; the centered total
 * and side legend remain for at-a-glance reading.
 */
export function HeadDonut({
  items,
  colorOf,
  centerLabel,
  emptyTitle = "Nothing in the pipeline",
  emptyHint = "No referrals were created in this window.",
  className,
}: {
  items: { key: string; name: string; value: number }[];
  colorOf: (key: string) => string;
  centerLabel: string;
  emptyTitle?: string;
  emptyHint?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const total = items.reduce((sum, item) => sum + item.value, 0);

  if (!items.length || total === 0) {
    return (
      <div
        className={cn(
          "flex min-h-[190px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center",
          className
        )}
      >
        <p className="text-[13px] font-bold text-white">{emptyTitle}</p>
        <p className="mt-1 max-w-[240px] text-[12px] leading-relaxed text-blue-100/45">
          {emptyHint}
        </p>
      </div>
    );
  }

  const summary = items.map((i) => `${i.name}: ${i.value}`).join(", ");
  const chartConfig = items.reduce<ChartConfig>((config, item) => {
    config[item.key] = { label: item.name, color: colorOf(item.key) };
    return config;
  }, {});
  const data = items.map((item) => ({
    key: item.key,
    name: item.name,
    value: item.value,
    fill: colorOf(item.key),
  }));

  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center", className)}>
      <div
        role="img"
        aria-label={`${centerLabel} split. ${summary}`}
        className="relative mx-auto h-[164px] w-[164px] shrink-0"
      >
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-full w-full overflow-visible"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              wrapperStyle={{ zIndex: 9999, outline: "none" }}
              content={<ChartTooltipContent nameKey="key" hideLabel indicator="dot" />}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="key"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={3}
              strokeWidth={0}
              isAnimationActive={!reduce}
              animationDuration={900}
              animationEasing="ease-out"
            >
              {data.map((item) => (
                <Cell key={item.key} fill={item.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>

        <div className="pointer-events-none absolute inset-[22%] flex flex-col items-center justify-center rounded-full border border-white/10 bg-[#07101D]">
          <span className="font-display text-2xl font-semibold leading-none text-white">
            <CountUp to={total} />
          </span>
          <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-blue-100/40">
            {centerLabel}
          </span>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-2">
        {items.map((item) => {
          const pct = Math.round((item.value / total) * 100);
          return (
            <li key={item.key} className="flex items-center gap-2 text-[12px]">
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: colorOf(item.key) }}
              />
              <span className="min-w-0 flex-1 truncate font-medium text-blue-100/60">
                {item.name}
              </span>
              <span className="shrink-0 font-bold text-white">{item.value}</span>
              <span className="w-9 shrink-0 text-right text-[11px] font-semibold text-blue-100/35">
                {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
