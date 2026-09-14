"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * shadcn-style navigation menu (same API/look as `navigation-menu`:
 * bar → trigger → dropdown content), implemented dependency-free on the
 * ui-tokens palette so it matches the rest of the portal.
 */

const MenuContext = createContext<{ open: string | null; setOpen: (v: string | null) => void }>({
  open: null,
  setOpen: () => {},
});
const ItemContext = createContext<string>("");

export function NavigationMenu({ className, children }: { className?: string; children: ReactNode }) {
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  return (
    <MenuContext.Provider value={{ open, setOpen }}>
      <nav ref={ref} aria-label="Section" className={cn("relative", className)}>
        {children}
      </nav>
    </MenuContext.Provider>
  );
}

export function NavigationMenuList({ className, children }: { className?: string; children: ReactNode }) {
  return <ul className={cn("flex items-center gap-1", className)}>{children}</ul>;
}

export function NavigationMenuItem({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <ItemContext.Provider value={value}>
      <li className={cn("relative shrink-0", className)}>{children}</li>
    </ItemContext.Provider>
  );
}

export function NavigationMenuTrigger({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const { open, setOpen } = useContext(MenuContext);
  const value = useContext(ItemContext);
  const isOpen = open === value;
  return (
    <button
      type="button"
      aria-expanded={isOpen}
      onClick={() => setOpen(isOpen ? null : value)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
        isOpen ? "bg-blue-50 text-primary-700" : "text-ink-soft hover:bg-cream-dark hover:text-ink",
        className
      )}
    >
      {children}
      <ChevronDown
        aria-hidden
        className={cn("h-3.5 w-3.5 text-ink-muted transition-transform", isOpen && "rotate-180")}
      />
    </button>
  );
}

export function NavigationMenuContent({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const { open } = useContext(MenuContext);
  const value = useContext(ItemContext);
  if (open !== value) return null;
  return (
    <div
      className={cn(
        "absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border border-ink/10 bg-white p-2 shadow-card",
        className
      )}
    >
      {children}
    </div>
  );
}

export function NavigationMenuLink({
  href,
  active,
  className,
  children,
  onNavigate,
  ariaLabel,
}: {
  href: string;
  active?: boolean;
  className?: string;
  children: ReactNode;
  onNavigate?: () => void;
  ariaLabel?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={ariaLabel}
      onClick={onNavigate}
      className={cn(
        "inline-flex items-center rounded-full px-4 py-2 text-sm font-bold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
        active
          ? "bg-primary-600 text-white shadow-soft"
          : "text-ink-soft hover:bg-cream-dark hover:text-ink",
        className
      )}
    >
      {children}
    </Link>
  );
}

/** Dropdown rows inside NavigationMenuContent: title + plain-language hint. */
export function NavigationMenuDropdownLink({
  href,
  active,
  title,
  desc,
  badge,
  onNavigate,
}: {
  href: string;
  active?: boolean;
  title: string;
  desc?: string;
  badge?: ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "block rounded-xl px-3.5 py-2.5 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
        active ? "bg-blue-50" : "hover:bg-cream"
      )}
    >
      <span className={cn("flex items-center gap-2 text-sm font-bold", active ? "text-primary-700" : "text-ink")}>
        <span className="min-w-0 flex-1">{title}</span>
        {badge}
      </span>
      {desc && <span className="mt-0.5 block text-xs font-medium text-ink-muted">{desc}</span>}
    </Link>
  );
}
