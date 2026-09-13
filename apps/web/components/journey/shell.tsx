import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One full-height slide of the horizontal journey.
 * `width` is in vw units (e.g. "w-[130vw]") — the journey measures the
 * real track width at runtime, so panels can be any width.
 */
export function JourneyPanel({
  id,
  width,
  children,
  className,
}: {
  id: string;
  width: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-label={id.replace(/^j-/, "").replace(/-/g, " ")}
      tabIndex={-1}
      className={cn(
        "relative flex h-dvh shrink-0 items-center overflow-hidden focus:outline-none",
        width,
        className
      )}
    >
      {/* top clearance for the fixed navbar, bottom clearance for the journey rail */}
      <div className="mx-auto w-full px-[2vw] pb-20 pt-20">{children}</div>
    </section>
  );
}

export function JourneyHeading({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  copy?: ReactNode;
}) {
  return (
    <div>
      {eyebrow}
      <h2 className="mt-3 text-balance font-display text-3xl font-semibold leading-tight xl:text-4xl">
        {title}
      </h2>
      {copy && (
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-muted">
          {copy}
        </p>
      )}
    </div>
  );
}
