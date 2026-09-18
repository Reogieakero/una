import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

/** shadcn-style button primitive, styled via ui-tokens palette. */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "accent" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex h-8 items-center justify-center whitespace-nowrap rounded px-4 font-display text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-50 disabled:pointer-events-none",
        // Single 32px height spec — sm/md/lg aliases kept for API compat.
        size === "sm" && "h-8 px-4 text-sm",
        size === "md" && "h-8 px-4 text-sm",
        size === "lg" && "h-8 px-4 text-sm",
        variant === "primary" && "bg-primary-600 text-white shadow-soft hover:bg-primary-700",
        variant === "secondary" && "bg-white text-ink shadow-card hover:bg-cream-dark",
        variant === "accent" && "bg-accent-400 text-ink hover:bg-accent-300",
        variant === "outline" && "border-2 border-ink/15 bg-white text-ink hover:border-primary-400",
        variant === "ghost" && "text-ink-soft hover:bg-cream-dark",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
