import type { HTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** shadcn-style loading spinner (Loader2, ui-tokens palette). */
export interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  label?: string;
}

const SIZE_CLASS: Record<NonNullable<SpinnerProps["size"]>, string> = {
  xs: "h-3.5 w-3.5",
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
};

export function Spinner({ size = "md", label = "Loading…", className, ...props }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn("inline-flex items-center justify-center", className)}
      {...props}
    >
      <Loader2 className={cn("animate-spin text-primary-600", SIZE_CLASS[size])} aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  );
}
