"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

type RoutePendingValue = {
  /** href currently being navigated to, or null when idle. */
  pendingHref: string | null;
  /** Mark a navigation as started — lets nav links dim until the route lands. */
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
 * (counselor) group changes — nav links call startNavigation(href) on click
 * for instant feedback. Destination routes render their own `loading.tsx`
 * skeletons, so there is deliberately no global spinner overlay.
 * Clears when pathname lands, with a 10s safety timeout.
 */
export function RoutePendingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Navigation landed (or same-page click) → clear pending state.
  useEffect(() => {
    setPendingHref(null);
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, [pathname]);

  // Safety: never leave a nav link dimmed if navigation errors.
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
    </RoutePendingContext.Provider>
  );
}
