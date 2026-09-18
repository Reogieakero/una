"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { listStaffMessages } from "@dorsu/shared-services";

export type ChatThread = {
  id: string;
  student_id: string;
  counselor_id: string | null;
  appointment_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ChatMsg = {
  id: string;
  thread_id: string;
  sender_profile_id: string;
  body: string;
  created_at: string;
};

export type ChatDm = {
  id: string;
  sender_profile_id: string;
  recipient_profile_id: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

export type ChatContact = {
  profileId: string;
  name: string;
  role: string;
  detail: string | null;
};

export type ChatBoardData = {
  role: string | null;
  me: string | null;
  myName: string;
  ownCounselorId: string | null;
  threads: ChatThread[];
  aliases: Map<string, { alias: string; profileId: string }>;
  counselorNames: Map<string, string>;
  counselorProfiles: Map<string, string>;
  previews: Map<string, ChatMsg>;
  dms: ChatDm[];
  staffNames: Map<string, string>;
  /** Office contacts — faculty directory for counselors, office directory for faculty. */
  contacts: ChatContact[];
};

export const CHAT_BOARD_KEY = ["chat", "board"] as const;

/** Fresh window — inside it, going back to /chat renders zero-fetch. */
export const CHAT_BOARD_STALE_MS = 60_000;

const EMPTY_ALIASES = new Map<string, { alias: string; profileId: string }>();
const EMPTY_NAMES = new Map<string, string>();
const EMPTY_PREVIEWS = new Map<string, ChatMsg>();

export async function fetchChatBoard(): Promise<ChatBoardData> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required.");
  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  const r = (profile as { role: string } | null)?.role ?? null;
  const myName = (profile as { full_name: string | null } | null)?.full_name ?? "Staff";
  let cid: string | null = null;
  if (r === "counselor") {
    const { data } = await supabase.from("counselors").select("id").eq("profile_id", user.id).single();
    cid = (data as { id: string } | null)?.id ?? null;
  }
  /** Office directory via /api/chat/contacts (faculty see the office, counselors see faculty). */
  async function fetchContacts(): Promise<ChatContact[]> {
    try {
      const res = await fetch("/api/chat/contacts", { credentials: "same-origin" });
      if (res.ok) return (((await res.json()) as { contacts?: ChatContact[] }).contacts ?? []);
    } catch {
      // Offline — inbox still renders, compose just has nobody to pick.
    }
    return [];
  }

  // Faculty inbox is office DMs only — no student threads (participant-
  // private). Names come from /api/chat/contacts because faculty clients
  // cannot read other profiles (RLS).
  if (r === "faculty") {
    const dms = ((await listStaffMessages(supabase, user.id)) ?? []) as ChatDm[];
    const contacts = await fetchContacts();
    return {
      role: r,
      me: user.id,
      myName,
      ownCounselorId: null,
      threads: [],
      aliases: EMPTY_ALIASES,
      counselorNames: EMPTY_NAMES,
      counselorProfiles: EMPTY_NAMES,
      previews: EMPTY_PREVIEWS,
      dms,
      staffNames: new Map(contacts.map((c) => [c.profileId, c.name])),
      contacts,
    };
  }
  if (!r || !["counselor", "guidance_head"].includes(r)) {
    return {
      role: r,
      me: user.id,
      myName,
      ownCounselorId: cid,
      threads: [],
      aliases: EMPTY_ALIASES,
      counselorNames: EMPTY_NAMES,
      counselorProfiles: EMPTY_NAMES,
      previews: EMPTY_PREVIEWS,
      dms: [],
      staffNames: EMPTY_NAMES,
      contacts: [],
    };
  }

  // Student–counselor threads are participant-only (migration 00037): the
  // head never sees thread content — its inbox is direct staff messages.
  // Skip the thread queries entirely so no thread rows are even requested.
  const isHead = r === "guidance_head";
  let threads: ChatThread[] = [];
  let aliases = EMPTY_ALIASES;
  let previews = EMPTY_PREVIEWS;
  if (!isHead) {
    let q = supabase.from("chat_threads").select("*").order("updated_at", { ascending: false }).limit(100);
    if (r === "counselor" && cid) q = q.eq("counselor_id", cid);
    const { data, error } = await q;
    if (error) throw error;
    threads = ((data ?? []) as ChatThread[]);

    const studentIds = [...new Set(threads.map((t) => t.student_id))];
    if (studentIds.length) {
      const { data: students } = await supabase
        .from("students")
        .select("id, profile_id, anonymous_alias")
        .in("id", studentIds.slice(0, 200));
      aliases = new Map(
        ((students ?? []) as { id: string; profile_id: string; anonymous_alias: string | null }[]).map((s) => [
          s.id,
          { alias: s.anonymous_alias ?? "Student", profileId: s.profile_id },
        ])
      );
    }

    const threadIds = threads.map((t) => t.id).slice(0, 100);
    if (threadIds.length) {
      const { data: recent } = await supabase
        .from("chat_messages")
        .select("id, thread_id, sender_profile_id, body, created_at")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: false })
        .limit(400);
      const latest = new Map<string, ChatMsg>();
      for (const m of ((recent ?? []) as ChatMsg[])) {
        if (!latest.has(m.thread_id)) latest.set(m.thread_id, m);
      }
      previews = latest;
    }
  }

  let counselorNames = EMPTY_NAMES;
  let counselorProfiles = EMPTY_NAMES;
  const { data: counselorRows } = await supabase.from("counselors").select("id, profile_id").limit(100);
  const rows = ((counselorRows ?? []) as { id: string; profile_id: string }[]);
  if (rows.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", rows.map((c) => c.profile_id));
    const names = new Map(
      ((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? "Counselor"])
    );
    counselorNames = new Map(rows.map((c) => [c.id, names.get(c.profile_id) ?? "Counselor"]));
    counselorProfiles = new Map(rows.map((c) => [c.id, c.profile_id]));
  }

  const dms = ((await listStaffMessages(supabase, user.id)) ?? []) as ChatDm[];
  const peers = [...new Set(dms.flatMap((d) => [d.sender_profile_id, d.recipient_profile_id]))].filter(
    (id) => id !== user.id
  );
  let staffNames = EMPTY_NAMES;
  if (peers.length) {
    const { data: staff } = await supabase.from("profiles").select("id, full_name").in("id", peers.slice(0, 100));
    staffNames = new Map(
      ((staff ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? "Staff"])
    );
  }

  return {
    role: r,
    me: user.id,
    myName,
    ownCounselorId: cid,
    threads,
    aliases,
    counselorNames,
    counselorProfiles,
    previews,
    dms,
    staffNames,
    // Counselors message faculty (follow-ups on referrals) — directory comes
    // from the server route; heads compose from the counselor directory above.
    contacts: r === "counselor" ? await fetchContacts() : [],
  };
}

/**
 * Cached chat board — stale-while-revalidate.
 * The QueryClient lives in the root layout and survives in-app navigation,
 * so the second visit to /chat shows cached conversations instantly while a
 * background refetch (only if stale) refreshes them without blocking.
 * Realtime arrivals patch the cache in place (no list flash); the open
 * thread's messages stay live via their own subscription and are never
 * cached. Selection, search, and draft state stay local on purpose.
 */
export function useChatBoard() {
  return useQuery({
    queryKey: [...CHAT_BOARD_KEY],
    queryFn: fetchChatBoard,
    staleTime: CHAT_BOARD_STALE_MS,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}
