"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";

/**
 * Keeby-style pinned horizontal scroll.
 *
 * The section wrapper is given extra vertical height (e.g. 300vh) while its
 * inner viewport stays `position: sticky`. As the user scrolls DOWN, the
 * wide track translates LEFT by exactly its overflow in pixels — measured
 * from the real DOM (track.scrollWidth - viewport width), then smoothed
 * with a spring. The last card always lands flush; no overshoot gaps,
 * no cut-off cards, at any screen size.
 *
 * Pass `enabled=false` (or rely on prefers-reduced-motion) to render a
 * calm static layout instead — no scroll-jacking.
 */
export function usePinnedX(
  enabled: boolean,
  targetRef: RefObject<HTMLDivElement | null>
) {
  const trackRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const active = enabled && !reduce;
  const [range, setRange] = useState(0);

  useEffect(() => {
    if (!active) return;
    const el = trackRef.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setRange(Math.max(0, el.scrollWidth - window.innerWidth));
      });
    };
    measure();
    // Re-measure once webfonts / images settle and on viewport changes,
    // so the glide always ends pixel-exact.
    const t1 = window.setTimeout(measure, 400);
    const t2 = window.setTimeout(measure, 1200);
    window.addEventListener("resize", measure);
    window.addEventListener("load", measure);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", measure);
      window.removeEventListener("load", measure);
      ro?.disconnect();
    };
  }, [active]);

  // "start start" → pin engages exactly when the wrapper reaches the top.
  // "end end" → glide finishes exactly when the pin releases.
  const { scrollYProgress } = useScroll({
    target: active ? targetRef : undefined,
    offset: ["start start", "end end"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 110,
    damping: 30,
    mass: 0.5,
  });
  const x = useTransform(progress, [0, 1], [0, -range]);

  return { trackRef, x, progress, active };
}
