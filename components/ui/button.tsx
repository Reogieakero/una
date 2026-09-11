import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-[15px] font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-peach-400 text-white shadow-[0_10px_28px_-8px_rgba(238,107,78,0.55)] hover:bg-peach-500 hover:shadow-[0_14px_32px_-8px_rgba(238,107,78,0.6)] hover:-translate-y-0.5",
        secondary:
          "bg-white text-ink border border-sage-200 shadow-card hover:border-sage-300 hover:-translate-y-0.5 hover:shadow-soft",
        sage: "bg-sage-600 text-white shadow-soft hover:bg-sage-700 hover:-translate-y-0.5",
        ghost: "text-sage-700 hover:bg-sage-50",
      },
      size: {
        default: "h-12 px-7",
        sm: "h-10 px-5 text-sm",
        lg: "h-[52px] px-8 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
