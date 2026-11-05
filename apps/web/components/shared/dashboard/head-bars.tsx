"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Horizontal bars for the urgency + classification splits.
 *
 * Classification is multi-select on the paper form, so one referral can land in
 * two buckets — bars (not a pie) keep that honest, and `note` spells it out.
 */
export function HeadBars({
  items,
  colorOf,
  emptyTitle,
  emptyHint,
  note,
  className,
}: {
  items: { key: string; name: string; value: number }[];
  colorOf: (key: string) => string;
  emptyTitle: string;
  emptyHint: string;
  note?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...items.map((i) => i.value));

  if (!items.length) {
    return (
      <div
        className={cn(
          "flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center",
          className
        )}
      >
        <p className="text-[13px] font-bold text-white">{emptyTitle}</p>
        <p className="mt-1 max-w-[260px] text-[12px] leading-relaxed text-blue-100/45">{emptyHint}</p>
      </div>
    );
  }

  const summary = items.map((i) => `${i.name}: ${i.value}`).join(", ");

  return (
    <div className={cn("space-y-3", className)}>
      <div role="img" aria-label={summary} className="space-y-3">
        {items.map((item, i) => (
          <div key={item.key}>
            <div className="flex items-baseline justify-between gap-3 text-[12px]">
              <span className="min-w-0 truncate font-semibold text-blue-100/70">{item.name}</span>
              <span className="shrink-0 font-bold text-white">{item.value}</span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/[0.07]">
              <motion.div
                initial={{ width: reduce ? `${(item.value / max) * 100}%` : 0 }}
                whileInView={{ width: `${(item.value / max) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: reduce ? 0 : 0.7, delay: reduce ? 0 : i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                className="h-full rounded-full"
                style={{ backgroundColor: colorOf(item.key) }}
              />
            </div>
          </div>
        ))}
      </div>
      {note && <p className="text-[10px] leading-relaxed text-blue-100/30">{note}</p>}
    </div>
  );
}
