import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold tracking-wide transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default: "border-transparent bg-blue-100 text-blue-700",
        primary: "border-transparent bg-blue-600 text-white",
        yellow: "border-transparent bg-yellow-100 text-yellow-700",
        sky: "border-transparent bg-blue-50 text-blue-700",
        lavender: "border-transparent bg-blue-100 text-blue-700",
        peach: "border-transparent bg-yellow-100 text-yellow-700",
        outline: "border-blue-200 bg-white text-ink-soft",
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
