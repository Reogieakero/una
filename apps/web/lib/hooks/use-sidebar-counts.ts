"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * Per-user sidebar counters. These are derived from the domain tables (not
 * from notification rows), so:
 *   - one appointment counts once, not once per status change,
 *   - an assignment/confirm/reject removes the item for every user who shares
 *     the queue, without anyone opening the page,
 *   - opening a page can never clear action-required work.
 *
 * The RPC is `security invoker`, so RLS scopes every number: counselors see
 * their own queue, heads see the office, students see their own rows.
 */
export type SidebarCounts = {
  appointment_requests: number;
  unassigned_requests: number;
  referrals_to_triage: number;
  chat_unread: number;
  announcements_unread: number;
  feedback_unread: number;
  security_unread: number;
  informational_unread: number;
};

export const SIDEBAR_COUNTS_KEY = ["sidebar", "counts"] as const;

const EMPTY: SidebarCounts = {
  appointment_requests: 0,
  unassigned_requests: 0,
  referrals_to_triage: 0,
  chat_unread: 0,
  announcements_unread: 0,
  feedback_unread: 0,
  security_unread: 0,
  informational_unread: 0,
};

export async function fetchSidebarCounts(): Promise<SidebarCounts> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("sidebar_counts");
  if (error) throw error;
  return { ...EMPTY, ...((data ?? {}) as Partial<SidebarCounts>) };
}

export function useSidebarCounts() {
  return useQuery({
    queryKey: [...SIDEBAR_COUNTS_KEY],
    queryFn: fetchSidebarCounts,
    staleTime: 30_000,
    retry: 1,
  });
}
