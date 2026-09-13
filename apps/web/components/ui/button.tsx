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
        "inline-flex items-center justify-center gap-2 rounded-full font-display font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-50 disabled:pointer-events-none",
        size === "sm" && "px-4 py-1.5 text-sm",
        size === "md" && "px-6 py-2.5 text-sm",
        size === "lg" && "px-8 py-3.5 text-base",
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
