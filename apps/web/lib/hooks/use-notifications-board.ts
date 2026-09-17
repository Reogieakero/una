"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { listNotifications } from "@dorsu/shared-services";

export type NotificationsRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

export type NotificationsBoardData = {
  me: string | null;
  rows: NotificationsRow[];
};

export const NOTIFICATIONS_BOARD_KEY = ["notifications", "board"] as const;

/** Fresh window — inside it, going back to /notifications renders zero-fetch. */
export const NOTIFICATIONS_BOARD_STALE_MS = 60_000;

const EMPTY_ROWS: NotificationsRow[] = [];

export async function fetchNotificationsBoard(): Promise<NotificationsBoardData> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { me: null, rows: EMPTY_ROWS };
  return { me: user.id, rows: (((await listNotifications(supabase, user.id)) ?? []) as NotificationsRow[]) };
}

/**
 * Cached notifications inbox — stale-while-revalidate.
 * The QueryClient lives in the root layout and survives in-app navigation,
 * so the second visit to /notifications shows cached rows instantly while a
 * background refetch (only if stale) refreshes them without blocking.
 * Realtime arrivals and read receipts patch the cache in place.
 * Filters and search stay local on purpose.
 */
export function useNotificationsBoard() {
  return useQuery({
    queryKey: [...NOTIFICATIONS_BOARD_KEY],
    queryFn: fetchNotificationsBoard,
    staleTime: NOTIFICATIONS_BOARD_STALE_MS,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}
