import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold tracking-wide transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default: "border-transparent bg-sage-100 text-sage-700",
        lavender: "border-transparent bg-lav-100 text-lav-500",
        sky: "border-transparent bg-skysoft-100 text-skysoft-400",
        peach: "border-transparent bg-peach-100 text-peach-600",
        outline: "border-sage-200 bg-white text-ink-soft",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
