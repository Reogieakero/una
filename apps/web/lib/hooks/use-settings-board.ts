"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type SettingsCounselor = {
  id: string;
  name: string;
  spec: string | null;
  available: boolean;
  sessions: number;
};

export type SettingsFeedItem = {
  id: string;
  at: string;
  text: string;
  tone: "info" | "success" | "warning" | "danger";
};

export type SettingsPost = { id: string; title: string; created_at: string; published_at: string | null };

export type SettingsBoardData = {
  me: string | null;
  role: string | null;
  email: string;
  fullName: string;
  joined: string;
  authEmail: string | null;
  office: { name: string; location: string; contact: string };
  counselors: SettingsCounselor[];
  posts: SettingsPost[];
  glance: { sessionsToday: number; openReferrals: number; published: number };
  feed: SettingsFeedItem[];
};

export const SETTINGS_BOARD_KEY = ["settings", "board"] as const;

/** Fresh window — inside it, going back to /settings renders zero-fetch. */
export const SETTINGS_BOARD_STALE_MS = 60_000;

const EMPTY_COUNSELORS: SettingsCounselor[] = [];
const EMPTY_POSTS: SettingsPost[] = [];
const EMPTY_FEED: SettingsFeedItem[] = [];

export async function fetchSettingsBoard(): Promise<SettingsBoardData> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required.");

  const [{ data: profile }, { data: office }] = await Promise.all([
    supabase.from("profiles").select("email, full_name, created_at, role").eq("id", user.id).single(),
    supabase.from("workspace_settings").select("value").eq("key", "office").maybeSingle(),
  ]);
  const p = profile as { email: string; full_name: string | null; created_at: string; role: string | null } | null;
  const v = (office as { value: { name?: string; location?: string; contact?: string } } | null)?.value;

  const [
    { data: counselorRows },
    { data: appts },
    { count: openRefCount },
    { data: postsRows },
    { data: myActions },
    { data: myPosts },
    { data: myGlass },
  ] = await Promise.all([
    supabase.from("counselors").select("id, profile_id, specialization, is_available").limit(50),
    supabase.from("appointments").select("id, counselor_id, scheduled_at, status").limit(500),
    supabase.from("referrals").select("id", { count: "exact", head: true }).in("status", ["pending", "assigned", "acknowledged", "in_progress", "confirmed", "escalated"]),
    supabase.from("announcements").select("id, title, created_at, published_at, author_profile_id").order("created_at", { ascending: false }).limit(5),
    supabase.from("referral_actions").select("id, action, created_at").eq("actor_profile_id", user.id).order("created_at", { ascending: false }).limit(8),
    supabase.from("announcements").select("id, title, created_at").eq("author_profile_id", user.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("break_glass_logs").select("id, accessed_at").eq("accessor_profile_id", user.id).order("accessed_at", { ascending: false }).limit(5),
  ]);

  const crows = ((counselorRows ?? []) as { id: string; profile_id: string; specialization: string | null; is_available: boolean }[]);
  const { data: cprofiles } = crows.length
    ? await supabase.from("profiles").select("id, full_name").in("id", crows.map((c) => c.profile_id))
    : { data: [] };
  const names = new Map(
    ((cprofiles ?? []) as { id: string; full_name: string | null }[]).map((p2) => [p2.id, p2.full_name ?? "Counselor"])
  );
  const sessionsBy = new Map<string, number>();
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  let todayCount = 0;
  for (const a of ((appts ?? []) as { counselor_id: string | null; scheduled_at: string }[])) {
    if (a.counselor_id) sessionsBy.set(a.counselor_id, (sessionsBy.get(a.counselor_id) ?? 0) + 1);
    const t = new Date(a.scheduled_at).getTime();
    if (t >= start.getTime() && t < end.getTime()) todayCount += 1;
  }
  const posts = ((postsRows ?? []) as SettingsPost[]);
  const feed: SettingsFeedItem[] = [
    ...((myActions ?? []) as { id: string; action: string; created_at: string }[]).map((a) => ({
      id: `a-${a.id}`,
      at: a.created_at,
      text: `Triaged a referral → ${a.action.replace(/_/g, " ")}`,
      tone: "info" as const,
    })),
    ...((myPosts ?? []) as { id: string; title: string; created_at: string }[]).map((a) => ({
      id: `p-${a.id}`,
      at: a.created_at,
      text: `Posted “${a.title.length > 48 ? `${a.title.slice(0, 48)}…` : a.title}”`,
      tone: "success" as const,
    })),
    ...((myGlass ?? []) as { id: string; accessed_at: string }[]).map((g) => ({
      id: `g-${g.id}`,
      at: g.accessed_at,
      text: "Logged an emergency access",
      tone: "warning" as const,
    })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 10);

  return {
    me: user.id,
    role: p?.role ?? null,
    email: p?.email ?? "",
    fullName: p?.full_name ?? "",
    joined: p?.created_at ?? "",
    authEmail: user.email ?? null,
    office: { name: v?.name ?? "", location: v?.location ?? "", contact: v?.contact ?? "" },
    counselors: crows.map((c) => ({
      id: c.id,
      name: names.get(c.profile_id) ?? "Counselor",
      spec: c.specialization,
      available: c.is_available,
      sessions: sessionsBy.get(c.id) ?? 0,
    })),
    posts,
    glance: {
      sessionsToday: todayCount,
      openReferrals: openRefCount ?? 0,
      published: posts.filter((a) => a.published_at && new Date(a.published_at).getTime() <= Date.now()).length,
    },
    feed,
  };
}

/**
 * Cached settings board — stale-while-revalidate.
 * The QueryClient lives in the root layout and survives in-app navigation,
 * so the second visit to /settings shows cached data instantly while a
 * background refetch (only if stale) refreshes it without blocking.
 * READ-ONLY: the email-heal write and all form mutations stay in the page —
 * prefetching must never write. Profile/office saves invalidate the cache.
 * Form and tab state stay local on purpose.
 */
export function useSettingsBoard() {
  return useQuery({
    queryKey: [...SETTINGS_BOARD_KEY],
    queryFn: fetchSettingsBoard,
    staleTime: SETTINGS_BOARD_STALE_MS,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}
