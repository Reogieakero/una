import { cn } from "@/lib/utils";
import type { FlowStep } from "@/lib/about-content";

/** Pipeline strip — status pills in flow order with → separators. */
export function FlowStrip({ steps }: { steps: readonly FlowStep[] }) {
  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {steps.map((s, i) => (
        <span key={s.status} className="flex items-stretch gap-2">
          <span className="rounded-lg bg-cream px-3 py-2 text-left">
            <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-bold", s.tone)}>{s.status}</span>
            <span className="mt-1 block max-w-[180px] text-[11px] font-medium leading-snug text-ink-muted">{s.who}</span>
          </span>
          {i < steps.length - 1 && (
            <span aria-hidden className="self-center font-bold text-ink-faint">→</span>
          )}
        </span>
      ))}
    </div>
  );
}
