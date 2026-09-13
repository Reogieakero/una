"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useMotionValueEvent } from "framer-motion";
import { usePinnedX } from "@/lib/use-pinned-x";
import { HeroPanel } from "./panels/HeroPanel";
import { ProblemPanel } from "./panels/ProblemPanel";
import { SolutionPanel } from "./panels/SolutionPanel";
import { FeaturesPanel } from "./panels/FeaturesPanel";
import { StepsPanel } from "./panels/StepsPanel";
import { RolesPanel } from "./panels/RolesPanel";
import { AnalyticsPanel } from "./panels/AnalyticsPanel";
import { SafetyPanel } from "./panels/SafetyPanel";
import { CtaPanel } from "./panels/CtaPanel";
import { cn } from "@/lib/utils";

const PANELS = [
  { id: "j-top", label: "Intro" },
  { id: "j-problem", label: "Problem" },
  { id: "j-solution", label: "Solution" },
  { id: "j-features", label: "Features" },
  { id: "j-steps", label: "Steps" },
  { id: "j-roles", label: "Roles" },
  { id: "j-analytics", label: "Data" },
  { id: "j-safety", label: "Safety" },
  { id: "j-cta", label: "Start" },
] as const;

/** Vertical-page anchors → journey panels (navbar, footer, CTA buttons). */
const HREF_TO_PANEL: Record<string, string> = {
  "#top": "j-top",
  "#main": "j-top",
  "#problem": "j-problem",
  "#solution": "j-solution",
  "#features": "j-features",
  "#how-it-works": "j-steps",
  "#roles": "j-roles",
  "#analytics": "j-analytics",
  "#safety": "j-safety",
  "#cta": "j-cta",
};

function journeyVisible() {
  return window.matchMedia(
    "(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)"
  ).matches;
}

/**
 * Full-page Keeby-style journey: the page scrolls vertically, while a
 * pinned viewport glides through every section horizontally — each one
 * sliding in from the right. Desktop only (see .journey-only in CSS).
 */
export function Journey() {
  const targetRef = useRef<HTMLDivElement>(null);
  const { trackRef, x, progress } = usePinnedX(true, targetRef);
  const [current, setCurrent] = useState(0);

  useMotionValueEvent(progress, "change", (v) => {
    const i = Math.min(
      PANELS.length - 1,
      Math.max(0, Math.round(v * (PANELS.length - 1)))
    );
    setCurrent((prev) => (prev === i ? prev : i));
  });

  const goTo = useCallback(
    (panelId: string) => {
      const wrap = targetRef.current;
      const track = trackRef.current;
      const panel = document.getElementById(panelId);
      if (!wrap || !track || !panel) return;
      const range = track.scrollWidth - window.innerWidth;
      // Land with the panel centered in the viewport.
      const center =
        panel.offsetLeft + panel.offsetWidth / 2 - window.innerWidth / 2;
      const frac = range > 0 ? Math.min(1, Math.max(0, center / range)) : 0;
      const wrapTop = wrap.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: wrapTop + frac * (wrap.offsetHeight - window.innerHeight),
        behavior: "smooth",
      });
      panel.focus({ preventScroll: true });
    },
    [trackRef]
  );

  // Route every in-page anchor (navbar, footer, CTAs) to its journey panel.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!journeyVisible()) return;
      const anchor = (e.target as HTMLElement).closest?.(
        'a[href^="#"]'
      ) as HTMLAnchorElement | null;
      if (!anchor) return;
      const panelId = HREF_TO_PANEL[anchor.getAttribute("href") ?? ""];
      if (!panelId || !document.getElementById(panelId)) return;
      e.preventDefault();
      goTo(panelId);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [goTo]);

  return (
    <main id="j-main" aria-label="DOrSU counseling platform — horizontal tour">
      <div ref={targetRef} className="relative h-[800vh]">
        <div className="sticky top-0 h-dvh overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#EFF6FF_0%,#DBEAFE_45%,#BFDBFE_80%,#EFF6FF_100%)]"
          />
          <motion.div
            ref={trackRef}
            id="journey-track"
            style={{ x }}
            className="relative flex h-full w-max items-stretch gap-[4vw] px-[4vw] will-change-transform"
          >
            <HeroPanel />
            <ProblemPanel />
            <SolutionPanel />
            <FeaturesPanel />
            <StepsPanel />
            <RolesPanel />
            <AnalyticsPanel />
            <SafetyPanel />
            <CtaPanel />
          </motion.div>

          {/* Journey rail: progress + section dots */}
          <nav
            aria-label="Journey sections"
            className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2"
          >
            <div className="flex items-center gap-3 rounded-full border border-white/70 bg-white/85 py-2 pl-4 pr-3 shadow-card backdrop-blur-xl">
              <span
                className="font-display text-xs font-bold tabular-nums text-ink-soft"
                aria-live="polite"
              >
                {String(current + 1).padStart(2, "0")} /{" "}
                {String(PANELS.length).padStart(2, "0")}
              </span>
              <span className="relative h-1 w-24 overflow-hidden rounded-full bg-blue-100 sm:w-32">
                <motion.span
                  style={{ scaleX: progress }}
                  className="absolute inset-0 origin-left rounded-full bg-blue-500"
                />
              </span>
              <div className="flex items-center gap-1.5">
                {PANELS.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => goTo(p.id)}
                    aria-label={`Go to ${p.label}`}
                    aria-current={i === current ? "true" : undefined}
                    className="rounded-full p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "block h-2 rounded-full transition-all duration-300",
                        i === current
                          ? "w-6 bg-blue-600"
                          : "w-2 bg-blue-200 hover:bg-blue-400"
                      )}
                    />
                  </button>
                ))}
              </div>
              <span className="hidden w-16 text-xs font-bold text-blue-700 sm:block">
                {PANELS[current].label}
              </span>
            </div>
          </nav>
        </div>
      </div>
    </main>
  );
}
