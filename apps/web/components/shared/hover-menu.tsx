"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// SSR-safe layout effect (pages server-render, effects run on client).
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Viewport-clamped floating panel position.
 * Panels render `position: fixed` (never absolute), so an open menu can never
 * stretch the page and force a horizontal scrollbar. Coordinates come from the
 * anchor's rect, clamped to 8px page margins, and follow scroll/resize while open.
 */
export function useClampedPanel(
  open: boolean,
  anchorRef: { current: HTMLElement | null },
  width: number,
  prefer: "left" | "right" = "left"
) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const w = Math.min(width, window.innerWidth - 16);
      const raw = prefer === "right" ? r.right - w : r.left;
      const left = Math.max(8, Math.min(raw, window.innerWidth - w - 8));
      setPos({ top: r.bottom + 8, left, width: w });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef, width, prefer]);

  return pos;
}

export type HoverMenuOption = { value: string; label: string };

/**
 * Shared hover/click floating filter menu.
 * Opens on hover or click, closes on mouse leave (150ms grace),
 * outside click, Escape, blur, or pick. Identical behavior to the
 * former per-page copies in appointments/referrals/announcements/
 * students/feedback/notifications/users.
 */
export function HoverMenu({
  buttonLabel,
  ariaLabel,
  options,
  value,
  onPick,
  align = "left",
}: {
  buttonLabel: React.ReactNode;
  ariaLabel: string;
  options: HoverMenuOption[];
  value: string;
  onPick: (v: string) => void;
  /** Menu edge — preferred side; the panel is viewport-clamped either way. */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelPos = useClampedPanel(open, ref, 224, align);

  const openMenu = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  };
  const scheduleClose = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 150);
  };
  const toggle = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open]);

  return (
    <div ref={ref} className="shrink-0" onMouseEnter={openMenu} onMouseLeave={scheduleClose}>
      <button
        type="button"
        onClick={toggle}
        onFocus={openMenu}
        onBlur={scheduleClose}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="inline-flex h-8 items-center gap-1.5 rounded border border-ink/10 bg-white px-3 text-[13px] font-bold text-ink-soft shadow-card transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      >
        <span className="max-w-44 truncate">{buttonLabel}</span>
        <ChevronDown
          aria-hidden
          className={cn("h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          style={{ top: panelPos?.top, left: panelPos?.left, width: panelPos?.width ?? 224 }}
          className="no-scrollbar fixed z-50 max-h-60 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border border-ink/10 bg-white py-1 shadow-card"
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <li key={o.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-[13px] transition hover:bg-cream focus-visible:outline-none focus-visible:bg-cream",
                    active ? "font-bold text-primary-700" : "font-medium text-ink-soft hover:text-ink"
                  )}
                >
                  <span className="truncate">{o.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
