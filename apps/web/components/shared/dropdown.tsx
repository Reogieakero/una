"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type DropdownOption = { value: string; label: string };

/**
 * Custom dropdown (button + floating menu) — the app-wide replacement for
 * native `<select>`. The menu renders in a portal so scroll containers can
 * never clip it; only one menu opens at a time via a page-level openMenuKey.
 */
export function Dropdown({
  menuKey,
  openMenuKey,
  onOpenChange,
  value,
  options,
  onChange,
  ariaLabel,
  buttonClassName,
  disabled,
  openOnHover,
}: {
  menuKey: string;
  openMenuKey: string | null;
  onOpenChange: (k: string | null) => void;
  value: string;
  options: DropdownOption[];
  onChange: (v: string) => void;
  ariaLabel: string;
  buttonClassName?: string;
  disabled?: boolean;
  /** Also open on hover (closes shortly after mouse leave). Click toggle still works. */
  openOnHover?: boolean;
}) {
  const open = openMenuKey === menuKey;
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const openMenu = () => {
    if (openMenuKey === menuKey) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const menuH = Math.min(options.length * 40 + 12, 240);
    const below = r.bottom + 8 + menuH <= window.innerHeight;
    setPos({
      top: below ? r.bottom + 8 : Math.max(8, r.top - 8 - menuH),
      left: Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 190) - 8)),
      width: Math.max(r.width, 190),
    });
    onOpenChange(menuKey);
  };

  // Hover close needs a grace period — the menu lives in a portal, so moving
  // from button to menu briefly leaves both. Re-entering either cancels it.
  const scheduleClose = () => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => onOpenChange(null), 150);
  };

  const toggle = () => {
    if (open) {
      onOpenChange(null);
      return;
    }
    openMenu();
  };

  useEffect(() => () => clearCloseTimer(), []);

  useEffect(() => {
    if (!open) return;
    const close = () => onOpenChange(null);
    // Scrolling the menu's own list must NOT close it — only outside scrolls do.
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && menuRef.current?.contains(e.target)) return;
      onOpenChange(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(null);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  const selected = options.find((o) => o.value === value);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={toggle}
        onMouseEnter={openOnHover ? openMenu : undefined}
        onMouseLeave={openOnHover ? scheduleClose : undefined}
        className={cn(
          "flex h-8 w-full items-center justify-between gap-2 rounded border border-ink/15 bg-white px-3 text-sm font-semibold text-ink focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 disabled:opacity-50",
          buttonClassName
        )}
      >
        <span className="truncate">{selected?.label ?? "Select…"}</span>
        <ChevronDown
          aria-hidden
          className={cn("h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      {open &&
        pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-50" onClick={() => onOpenChange(null)} />
            <ul
              ref={menuRef}
              role="listbox"
              aria-label={ariaLabel}
              style={{ top: pos.top, left: pos.left, width: pos.width }}
              onMouseEnter={openOnHover ? clearCloseTimer : undefined}
              onMouseLeave={openOnHover ? scheduleClose : undefined}
              className="menu-scroll fixed z-50 max-h-60 overflow-y-auto rounded-lg border border-ink/10 bg-white p-1.5 shadow-card"
            >
              {options.map((o) => {
                const active = o.value === value;
                return (
                  <li key={o.value || "none"} role="option" aria-selected={active}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(o.value);
                        onOpenChange(null);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        active ? "bg-blue-50 font-bold text-primary-700" : "font-medium text-ink hover:bg-cream"
                      )}
                    >
                      <span className="truncate">{o.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>,
          document.body
        )}
    </>
  );
}
