import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  HTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  forwardRef,
} from "react";

export { Button } from "./button";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-ink/10 bg-white p-6 shadow-card", className)}
      {...props}
    />
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-8 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink placeholder:text-ink-faint focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

/** shadcn-style select — same radius/border/focus ring as Input. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-8 w-full appearance-none rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 disabled:opacity-50 [&:invalid]:text-ink-faint",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-semibold text-red-600">{message}</p>;
}

/**
 * Custom checkbox: a native input (keyboard + form semantics) with the
 * browser's default control hidden, plus a lucide check drawn on top.
 */
export const Checkbox = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label?: React.ReactNode }
>(({ className, label, ...props }, ref) => (
  <label className="inline-flex cursor-pointer select-none items-center gap-2">
    <span className="relative inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center">
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          "peer h-[18px] w-[18px] cursor-pointer appearance-none rounded-[5px] border border-ink/25 bg-white transition",
          "checked:border-yellow-500 checked:bg-yellow-400",
          "hover:border-yellow-500/70",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/50 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
      <Check
        className="pointer-events-none absolute h-3 w-3 text-ink opacity-0 transition-opacity peer-checked:opacity-100"
        strokeWidth={3.5}
        aria-hidden
      />
    </span>
    {label ? <span className="text-[13px] font-medium text-ink-soft">{label}</span> : null}
  </label>
));
Checkbox.displayName = "Checkbox";

export function Badge({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "warning" | "danger" | "muted";
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    info: "bg-blue-100 text-blue-800",
    success: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-700",
    danger: "bg-red-100 text-red-700",
    muted: "bg-ink/10 text-ink-muted",
  };
  return (
    <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-bold", tones[tone])}>
      {children}
    </span>
  );
}
