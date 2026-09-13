"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

type RoutePendingValue = {
  /** href currently being navigated to, or null when idle. */
  pendingHref: string | null;
  /** Mark a navigation as started — shows link spinners + page overlay instantly. */
  startNavigation: (href: string) => void;
  /** True while the given href is the pending destination. */
  isPending: (href: string) => boolean;
};

const RoutePendingContext = createContext<RoutePendingValue>({
  pendingHref: null,
  startNavigation: () => {},
  isPending: () => false,
});

export function useRoutePending() {
  return useContext(RoutePendingContext);
}

/**
 * Global navigation-pending state (Next 14 has no useLinkStatus).
 * Mounted ONCE in the root layout so it survives (admin)/(staff)/
 * (counselor) group changes — nav links call startNavigation(href) on
 * click for instant feedback, and the overlay covers the page body while
 * the destination server components fetch. Clears when pathname lands,
 * with a 10s safety timeout in case navigation fails.
 */
export function RoutePendingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Navigation landed (or same-page click) → clear pending + overlay.
  useEffect(() => {
    setPendingHref(null);
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, [pathname]);

  // Safety: never trap the user under the overlay if navigation errors.
  useEffect(() => {
    if (!pendingHref) return;
    timer.current = setTimeout(() => setPendingHref(null), 10_000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [pendingHref]);

  const startNavigation = useCallback(
    (href: string) => {
      if (href === pathname) return;
      setPendingHref(href);
    },
    [pathname]
  );

  const isPending = useCallback(
    (href: string) => pendingHref !== null && pendingHref === href && pathname !== href,
    [pendingHref, pathname]
  );

  return (
    <RoutePendingContext.Provider value={{ pendingHref, startNavigation, isPending }}>
      {children}
      <RoutePendingOverlay />
    </RoutePendingContext.Provider>
  );
}

/**
 * Page-content loading overlay — shadcn Spinner centered over a soft backdrop.
 * Rendered once by the root-layout provider. z-30 sits BELOW the sticky
 * navbar (z-40) and its dropdowns (z-50), so the header is never dimmed,
 * blocked, or visually "moved" — only the page body is covered.
 * Delayed 150ms so fast (<150ms) transitions never flash.
 */
function RoutePendingOverlay() {
  const { pendingHref } = useContext(RoutePendingContext);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!pendingHref) {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(t);
  }, [pendingHref]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading page"
      className="fixed inset-0 z-30 flex items-center justify-center bg-white/60 backdrop-blur-[2px]"
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-ink/10 bg-white px-8 py-6 shadow-card">
        <Spinner size="lg" label="Loading page" />
        <p className="text-sm font-bold text-ink-soft">Loading page…</p>
      </div>
    </div>
  );
}
