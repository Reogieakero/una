import Image from "next/image";
import { cn } from "@/lib/utils";

const PANDA_SRC = "/images/favicon.png";

/**
 * Chekie's panda mascot mark. Decorative by default (pair it with the
 * "Chekie" wordmark); pass a `label` when it stands alone so screen
 * readers still get a name.
 */
export function ChekieMark({
  size = 40,
  label,
  className,
}: {
  size?: number;
  label?: string;
  className?: string;
}) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ width: size, height: size }}
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-blue-200/70",
        className
      )}
    >
      <Image
        src={PANDA_SRC}
        alt=""
        width={160}
        height={160}
        className="h-full w-full object-cover"
      />
    </span>
  );
}

/** Full Chekie brand lockup: panda mark + wordmark + optional subtitle. */
export function Logo({
  subtitle = "DOrSU Counseling",
  subtitleClassName,
  markSize = 40,
}: {
  subtitle?: string;
  subtitleClassName?: string;
  markSize?: number;
}) {
  return (
    <span className="flex items-center gap-2">
      <ChekieMark size={markSize} />
      <span className="leading-tight">
        <span className="block font-display text-[17px] font-semibold">
          Chekie
        </span>
        {subtitle && (
          <span
            className={cn(
              "block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted",
              subtitleClassName
            )}
          >
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}
