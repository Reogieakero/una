"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { markNotificationsRead } from "@dorsu/shared-services";
import { patchBoard } from "@/lib/patch-board";
import {
  NOTIFICATIONS_BOARD_KEY,
  type NotificationsBoardData,
} from "@/lib/hooks/use-notifications-board";

/** Does a notification link belong to a sidebar section (exact, #focus-, ?query, or sub-path). */
function linkInSection(link: string | null, prefix: string): boolean {
  if (!link) return false;
  return (
    link === prefix ||
    link.startsWith(`${prefix}#`) ||
    link.startsWith(`${prefix}?`) ||
    link.startsWith(`${prefix}/`)
  );
}

/**
 * Clears a sidebar section badge on view — same fix as chat, generalized.
 * Sidebar badges count unread *notification* rows, so visiting a section
 * marks that section's unread rows read; the DB UPDATE fans out through the
 * realtime channel and drops the badge, bell, and counts on every open tab.
 * The inbox keeps the full history (rows still exist, just read).
 *
 * Fires once per prefix per mount, only when `enabled` (wire it to the
 * page's loaded-board condition so loading states never clear early).
 */
export function useClearSectionBadge(prefix: string | null, enabled = true) {
  const qc = useQueryClient();
  const clearedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!prefix || !enabled || clearedRef.current.has(prefix)) return;
    clearedRef.current.add(prefix);
    void (async () => {
      try {
        const db = createClient();
        const {
          data: { user },
        } = await db.auth.getUser();
        if (!user) return;
        const { data } = await db
          .from("notifications")
          .select("id, link")
          .eq("profile_id", user.id)
          .eq("is_read", false)
          .limit(200);
        const ids = ((data ?? []) as { id: string; link: string | null }[])
          .filter((n) => linkInSection(n.link, prefix))
          .map((n) => n.id);
        if (!ids.length) return;
        await markNotificationsRead(db, ids);
        patchBoard<NotificationsBoardData>(qc, [...NOTIFICATIONS_BOARD_KEY], (prev) => ({
          ...prev,
          rows: prev.rows.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n)),
        }));
      } catch {
        // Badge converges via the realtime resync + inbox fallback.
      }
    })();
  }, [prefix, enabled, qc]);
}
