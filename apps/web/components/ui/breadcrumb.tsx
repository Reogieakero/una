import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * shadcn-style breadcrumb (same API/look as `breadcrumb`: list → item →
 * link/page with chevron separators), dependency-free on ui-tokens.
 */

export function Breadcrumb({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      {children}
    </nav>
  );
}

export function BreadcrumbList({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <ol className={cn("flex flex-wrap items-center gap-1 text-[13px]", className)}>{children}</ol>
  );
}

export function BreadcrumbItem({ className, children }: { className?: string; children: ReactNode }) {
  return <li className={cn("inline-flex items-center gap-1", className)}>{children}</li>;
}

export function BreadcrumbLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md font-semibold text-ink-muted transition-colors hover:text-ink",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
        className
      )}
    >
      {children}
    </Link>
  );
}

export function BreadcrumbPage({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span aria-current="page" className={cn("font-bold text-ink", className)}>
      {children}
    </span>
  );
}

export function BreadcrumbSeparator({ className }: { className?: string }) {
  return (
    <ChevronRight aria-hidden className={cn("h-3.5 w-3.5 text-ink-faint", className)} />
  );
}
