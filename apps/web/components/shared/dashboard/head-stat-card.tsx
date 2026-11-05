"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { cn } from "@/lib/utils";

type Accent = "blue" | "yellow";

const ACCENT_CHIP: Record<Accent, string> = {
  blue: "border-blue-400/20 bg-blue-500/15 text-blue-200",
  yellow: "border-yellow-300/20 bg-yellow-400/15 text-yellow-300",
};

const ACCENT_TREND: Record<Accent, string> = {
  blue: "bg-blue-400/10 text-blue-200",
  yellow: "bg-yellow-400/10 text-yellow-300",
};

export function HeadStatCard({
  label,
  value,
  icon: Icon,
  hint,
  href,
  trend,
  accent = "blue",
}: {
  label: string;
  value: number | null | undefined;
  icon: LucideIcon;
  hint?: string;
  href?: string;
  /** Percentage change vs the comparison window, or null when there is no baseline. */
  trend?: number | null;
  accent?: Accent;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-bold uppercase leading-tight tracking-[0.14em] text-blue-100/45">
          {label}
        </p>
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border backdrop-blur",
            ACCENT_CHIP[accent]
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>

      <p className="mt-3 font-display text-[2rem] font-semibold leading-none tracking-[-0.03em] text-white">
        {value === null || value === undefined ? (
          <span className="text-blue-100/40">–</span>
        ) : (
          <CountUp to={value} />
        )}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
        {hint && <span className="text-[11px] font-medium text-blue-100/40">{hint}</span>}
        {typeof trend === "number" && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
              ACCENT_TREND[accent]
            )}
          >
            {trend === 0 ? (
              <Minus className="h-3 w-3" aria-hidden />
            ) : trend > 0 ? (
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            ) : (
              <ArrowDownRight className="h-3 w-3" aria-hidden />
            )}
            {Math.abs(trend)}% vs previous
          </span>
        )}
      </div>
    </>
  );

  const className =
    "group flex min-h-[142px] flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_8px_24px_-24px_rgba(0,0,0,0.45)] backdrop-blur-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/70";
  const hover =
    "hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]";

  if (!href) return <div className={className}>{inner}</div>;

  return (
    <Link href={href} className={cn(className, hover)}>
      {inner}
    </Link>
  );
}
