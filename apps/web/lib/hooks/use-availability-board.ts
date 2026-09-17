"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type AvailabilityCounselor = {
  id: string;
  name: string;
  spec: string | null;
  available: boolean;
};

export type AvailabilitySlot = {
  id: string;
  counselor_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  is_recurring: boolean;
};

export type AvailabilityAppt = {
  counselor_id: string | null;
  scheduled_at: string;
  status: string;
};

export type AvailabilityBoardData = {
  role: string | null;
  ownId: string | null;
  counselors: AvailabilityCounselor[];
  slots: AvailabilitySlot[];
  appts: AvailabilityAppt[];
};

export const AVAILABILITY_BOARD_KEY = ["availability", "board"] as const;

/** Fresh window — inside it, going back to /availability renders zero-fetch. */
export const AVAILABILITY_BOARD_STALE_MS = 60_000;

export async function fetchAvailabilityBoard(): Promise<AvailabilityBoardData> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required.");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const r = (profile as { role: string } | null)?.role ?? null;
  let oid: string | null = null;
  if (r === "counselor") {
    const { data } = await supabase.from("counselors").select("id").eq("profile_id", user.id).single();
    oid = (data as { id: string } | null)?.id ?? null;
  }
  if (!r || !["counselor", "guidance_head"].includes(r)) {
    return { role: r, ownId: oid, counselors: [], slots: [], appts: [] };
  }

  const [{ data: counselorRows }, { data: slotRows }, { data: apptRows }] = await Promise.all([
    supabase.from("counselors").select("id, profile_id, specialization, is_available").limit(100),
    supabase.from("counselor_availability").select("*").order("weekday").limit(500),
    supabase.from("appointments").select("counselor_id, scheduled_at, status").limit(500),
  ]);
  const list = ((counselorRows ?? []) as {
    id: string;
    profile_id: string;
    specialization: string | null;
    is_available: boolean;
  }[]);
  const profileIds = list.map((c) => c.profile_id);
  let names = new Map<string, string>();
  if (profileIds.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", profileIds);
    names = new Map(
      ((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? "Counselor"])
    );
  }
  const counselors = list.map((c) => ({
    id: c.id,
    name: names.get(c.profile_id) ?? "Counselor",
    spec: c.specialization,
    available: c.is_available,
  }));
  return {
    role: r,
    ownId: oid,
    counselors,
    slots: ((slotRows ?? []) as AvailabilitySlot[]),
    appts: ((apptRows ?? []) as AvailabilityAppt[]),
  };
}

/**
 * Cached availability board — stale-while-revalidate.
 * The QueryClient lives in the root layout and survives in-app navigation,
 * so the second visit to /availability shows cached rows instantly while a
 * background refetch (only if stale) refreshes them without blocking.
 * Mutations refetch explicitly, so actions never serve stale rows.
 * Selection state (managed counselor) stays local on purpose.
 */
export function useAvailabilityBoard() {
  return useQuery({
    queryKey: [...AVAILABILITY_BOARD_KEY],
    queryFn: fetchAvailabilityBoard,
    staleTime: AVAILABILITY_BOARD_STALE_MS,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}
