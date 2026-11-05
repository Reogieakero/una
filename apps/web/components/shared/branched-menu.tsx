"use client";

import {
  isValidElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";
import "./branched-menu.css";

export type BranchedMenuLeaf = {
  value: string;
  label: string;
  icon?: unknown;
  badge?: number;
  title?: string;
  ariaLabel?: string;
  pending?: boolean;
};

export type BranchedMenuSection = {
  label: string;
  children?: BranchedMenuLeaf[];
  value?: string;
  icon?: unknown;
  badge?: number;
  title?: string;
  pending?: boolean;
};

export type BranchedMenuItem = BranchedMenuSection;

export type BranchedMenuProps = {
  items?: BranchedMenuItem[];
  defaultOpen?: number | number[];
  defaultActive?: string;
  /** Controlled selection — updates the active row without a remount. */
  activeValue?: string;
  onSelect?: (value: string, item: BranchedMenuLeaf | BranchedMenuItem) => void;
  onHover?: (value: string, item: BranchedMenuLeaf) => void;
  onToggle?: (index: number, open: boolean) => void;
  ariaLabel?: string;
  color?: string;
  accentColor?: string;
  lineColor?: string;
  width?: number;
  rowHeight?: number;
  indent?: number;
  trunk?: number;
  radius?: number;
  lineWidth?: number;
  fontSize?: number;
  drawDuration?: number;
  foldDuration?: number;
  className?: string;
};

const PAD = 6;
const MARK = 16;

const renderIcon = (icon: unknown) =>
  isValidElement(icon) ? (
    icon
  ) : (
    <HugeiconsIcon icon={icon as never} size={16} strokeWidth={1.8} />
  );

const toSet = (open: number | number[]) =>
  new Set(Array.isArray(open) ? open : open >= 0 ? [open] : []);

export function BranchedMenu({
  items = [],
  defaultOpen = 0,
  defaultActive = "",
  activeValue,
  onSelect,
  onHover,
  onToggle,
  ariaLabel = "Workspace",
  color = "#f5f5f5",
  accentColor = "#f5f5f5",
  lineColor = "#3f3f46",
  width = 240,
  rowHeight = 36,
  indent = 40,
  trunk = 14,
  radius = 10,
  lineWidth = 1.5,
  fontSize = 14,
  drawDuration = 400,
  foldDuration = 300,
  className = "",
}: BranchedMenuProps) {
  const [open, setOpen] = useState(() => toSet(defaultOpen));
  const [active, setActive] = useState(() => {
    if (defaultActive) return defaultActive;
    const first = items.find((it, i) => it.children && toSet(defaultOpen).has(i));
    return first?.children?.[0]?.value ?? "";
  });
  const navRef = useRef<HTMLElement>(null);
  const heads = useRef<(HTMLButtonElement | null)[]>([]);
  const markerRef = useRef<HTMLSpanElement>(null);
  const latest = useRef({ onSelect, onHover, onToggle });
  latest.current = { onSelect, onHover, onToggle };
  // Last route value we synced from. Only a real route change may override
  // the optimistic selection made on click — otherwise the effect below
  // would immediately snap the highlight back to the old page while the
  // next route is still loading.
  const syncedRoute = useRef<string | undefined>(undefined);

  // Keep the selection in sync with the current route, and reveal the
  // section containing it when navigating from elsewhere.
  useEffect(() => {
    if (activeValue === undefined) return;
    if (syncedRoute.current === activeValue) return;
    syncedRoute.current = activeValue;
    if (activeValue === active) return;
    setActive(activeValue);
    const section = items.findIndex((it) =>
      it.children?.some((kid) => kid.value === activeValue)
    );
    if (section >= 0) {
      setOpen((prev) => {
        if (prev.has(section)) return prev;
        const next = new Set(prev);
        next.add(section);
        return next;
      });
    }
  }, [activeValue, active, items]);

  const activeSection = items.findIndex((it) =>
    it.children?.some((kid) => kid.value === active)
  );
  const markerShown = activeSection >= 0 && open.has(activeSection);

  useLayoutEffect(() => {
    const place = (glide: boolean) => {
      const m = markerRef.current;
      const el = heads.current[activeSection];
      if (!m) return;
      const on = markerShown && el;
      if (!glide) m.style.transition = "none";
      if (on) m.style.top = `${el.offsetTop + (el.offsetHeight - MARK) / 2}px`;
      m.toggleAttribute("data-on", Boolean(on));
      if (!glide) {
        void m.offsetHeight;
        m.style.transition = "";
      }
    };
    place(true);
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      place(false);
    });
    if (navRef.current) ro.observe(navRef.current);
    return () => ro.disconnect();
  }, [activeSection, markerShown, items, fontSize, rowHeight]);

  const select = (value: string, item: BranchedMenuLeaf | BranchedMenuItem) => {
    setActive(value);
    latest.current.onSelect?.(value, item);
  };
  const hover = (value: string, item: BranchedMenuLeaf) => {
    latest.current.onHover?.(value, item);
  };
  const toggle = (i: number) => {
    setOpen((prev) => {
      const next = new Set(prev);
      const isOpen = !next.has(i);
      if (isOpen) next.add(i);
      else next.delete(i);
      latest.current.onToggle?.(i, isOpen);
      return next;
    });
  };

  const r = Math.min(radius, rowHeight / 2 - 2);
  const endX = indent - 8;
  const rowY = (k: number) => PAD + k * rowHeight + rowHeight / 2;
  const branch = (k: number) =>
    `M ${trunk} ${rowY(k) - r} A ${r} ${r} 0 0 0 ${trunk + r} ${rowY(k)} H ${endX}`;
  const reach = (k: number) =>
    `M ${trunk} 0 V ${rowY(k) - r} A ${r} ${r} 0 0 0 ${trunk + r} ${rowY(k)} H ${endX}`;
  const length = (k: number) =>
    rowY(k) - r + (Math.PI * r) / 2 + (endX - trunk - r);

  return (
    <nav
      ref={navRef}
      aria-label={ariaLabel}
      className={cn("branched-menu", className)}
      style={
        {
          "--bm-w": `${width}px`,
          "--bm-ink": color,
          "--bm-accent": accentColor,
          "--bm-line": lineColor,
          "--bm-font": `${fontSize}px`,
          "--bm-row": `${rowHeight}px`,
          "--bm-indent": `${indent}px`,
          "--bm-line-w": lineWidth,
          "--bm-draw": `${drawDuration}ms`,
          "--bm-fold": `${foldDuration}ms`,
        } as React.CSSProperties
      }
    >
      <span ref={markerRef} className="branched-menu__marker" aria-hidden="true" />
      {items.map((item, i) => {
        const kids = item.children;
        const isOpen = kids ? open.has(i) : false;
        const leafValue = item.value ?? item.label;
        const leafActive = !kids && leafValue === active;
        const bodyH = kids ? PAD * 2 + kids.length * rowHeight : 0;
        return (
          <div
            key={item.value ?? item.label}
            className="branched-menu__section"
            data-open={isOpen ? "" : undefined}
          >
            <button
              ref={(el) => {
                heads.current[i] = el;
              }}
              type="button"
              className="branched-menu__head"
              aria-expanded={kids ? isOpen : undefined}
              aria-current={leafActive ? "true" : undefined}
              data-active={leafActive ? "" : undefined}
              onClick={() => (kids ? toggle(i) : select(leafValue, item))}
            >
              <span className="branched-menu__label">{item.label}</span>
              {item.badge ? (
                <span className="branched-menu__badge" aria-hidden>
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              ) : null}
            </button>
            {kids ? (
              <div className="branched-menu__body">
                <div className="branched-menu__fold">
                  <div className="branched-menu__tree" style={{ height: bodyH }}>
                    <svg
                      className="branched-menu__lines"
                      width={indent}
                      height={bodyH}
                      aria-hidden="true"
                    >
                      <path
                        className="branched-menu__base"
                        d={`M ${trunk} 0 V ${rowY(kids.length - 1) - r}`}
                      />
                      {kids.map((kid, k) => (
                        <path
                          key={kid.value}
                          className="branched-menu__base"
                          d={branch(k)}
                        />
                      ))}
                      {kids.map((kid, k) => (
                        <path
                          key={kid.value}
                          className="branched-menu__reach"
                          d={reach(k)}
                          style={{
                            strokeDasharray: length(k),
                            strokeDashoffset:
                              kid.value === active ? 0 : length(k),
                          }}
                        />
                      ))}
                    </svg>
                    {kids.map((kid) => {
                      const isActive = kid.value === active;
                      return (
                        <Link
                          key={kid.value}
                          href={kid.value}
                          className="branched-menu__item"
                          aria-label={kid.ariaLabel}
                          aria-current={isActive ? "page" : undefined}
                          data-active={isActive ? "" : undefined}
                          aria-disabled={kid.pending ? true : undefined}
                          tabIndex={isOpen ? 0 : -1}
                          onClick={(e) => {
                            // Modified clicks open a new tab/window — don't
                            // swap this page to a pending skeleton for them.
                            if (
                              e.defaultPrevented ||
                              e.button !== 0 ||
                              e.metaKey ||
                              e.ctrlKey ||
                              e.shiftKey ||
                              e.altKey
                            ) {
                              return;
                            }
                            select(kid.value, kid);
                          }}
                          onMouseEnter={() => hover(kid.value, kid)}
                          onFocus={() => hover(kid.value, kid)}
                        >
                          {kid.icon ? (
                            <span className="branched-menu__icon" aria-hidden="true">
                              {renderIcon(kid.icon)}
                            </span>
                          ) : null}
                          <span className="branched-menu__text">{kid.label}</span>
                          {kid.badge ? (
                            <span className="branched-menu__badge" aria-hidden>
                              {kid.badge > 99 ? "99+" : kid.badge}
                            </span>
                          ) : null}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
