"use client";

import { useEffect, useState } from "react";

/**
 * Deep-link row focus — notification links carry `#focus-<rowId>`; boards
 * call this with their rows so the linked row scrolls into view and flashes
 * a highlight ring. Hash-based (not search params) so no Suspense boundary
 * is needed and same-page toast clicks just retarget.
 *
 * Returns the currently focused row id (auto-cleared after 4s so the ring
 * never sticks), or null.
 */
export function useFocusRow(rowsKey: unknown): string | null {
  const [focusedId, setFocusedId] = useState<string | null>(null);

  useEffect(() => {
    const apply = () => {
      const m = window.location.hash.match(/^#focus-(.+)$/);
      const id = m?.[1] ? decodeURIComponent(m[1]) : null;
      setFocusedId(id);
      if (id) {
        requestAnimationFrame(() => {
          document
            .getElementById(`focus-${CSS.escape(id)}`)
            ?.scrollIntoView({ block: "center", behavior: "smooth" });
        });
      }
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
    // Re-run when rows arrive so the scroll lands after data loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsKey]);

  useEffect(() => {
    if (!focusedId) return;
    const t = setTimeout(() => setFocusedId(null), 4000);
    return () => clearTimeout(t);
  }, [focusedId]);

  return focusedId;
}

/** Ring classes applied to the focused row/card. */
export const FOCUS_RING = "ring-2 ring-primary-500 ring-offset-2 ring-offset-white scroll-mt-24";
