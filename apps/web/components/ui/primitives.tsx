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
      className={cn("rounded-3xl border border-ink/10 bg-white p-6 shadow-card", className)}
      {...props}
    />
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-2xl border border-ink/15 bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200",
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
        "w-full appearance-none rounded-2xl border border-ink/15 bg-white px-4 py-2.5 text-sm text-ink focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 disabled:opacity-50 [&:invalid]:text-ink-faint",
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
        "w-full rounded-2xl border border-ink/15 bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200",
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
