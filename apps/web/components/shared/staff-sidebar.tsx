"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LifeBuoy, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SignOutButton } from "./sign-out-button";

type Profile = {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
} | null;

type Glance = { sessions: number | null; referrals: number | null; alerts: number | null };
type LatestChat = {
  who: string;
  sender: string;
  body: string | null;
  at: string;
  status: string;
} | null;

type SidebarData = { glance: Glance; latestChat: LatestChat; office: { name: string; location: string } };

const DEFAULT_OFFICE = { name: "DOrSU Guidance", location: "Mati City" };

/**
 * Module-level cache — layouts remount when navigating ACROSS route groups
 * (e.g. /dashboard in (admin) -> /reports in (staff) are different layouts,
 * so StaffSidebar unmounts/remounts and useState resets). Without a cache
 * every cross-group navigation would flash the skeleton even though the
 * data hasn't changed. Cache keeps the last result per user for 30s so a
 * remount renders instantly and only revalidates in the background.
 */
const sidebarCache = new Map<string, { data: SidebarData; at: number }>();
const SIDEBAR_TTL_MS = 30_000;

function getCachedSidebar(userId: string): SidebarData | null {
  const hit = sidebarCache.get(userId);
  if (!hit) return null;
  if (Date.now() - hit.at > SIDEBAR_TTL_MS) return null;
  return hit.data;
}

const ROLE_LABEL: Record<string, string> = {
  guidance_head: "Guidance Head",
  counselor: "Counselor",
  faculty: "Faculty",
  student: "Student",
};

/** Plain-language relative time ("just now", "5 min ago", …). */
function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

async function fetchSidebarData(userId: string): Promise<SidebarData> {
  const supabase = createClient();
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const [sessions, referrals, alerts, threadRes, dmRes, officeRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .gte("scheduled_at", start.toISOString())
      .lt("scheduled_at", end.toISOString()),
    supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "assigned", "acknowledged", "in_progress", "confirmed", "escalated"]),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", userId)
      .eq("is_read", false),
    supabase
      .from("chat_threads")
      .select("id, status, updated_at, student_id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Staff DMs live outside threads (head ↔ counselor) — the latest
    // conversation is whichever of the two arrived last.
    supabase
      .from("staff_messages")
      .select("body, created_at, sender_profile_id, recipient_profile_id")
      .or(`sender_profile_id.eq.${userId},recipient_profile_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("workspace_settings").select("value").eq("key", "office").maybeSingle(),
  ]);

  let latestChat: LatestChat = null;
  const thread = threadRes.error ? null : threadRes.data;
  const dm = dmRes.error ? null : dmRes.data;
  if (thread) {
    const [{ data: student }, { data: lastMessage }] = await Promise.all([
      supabase.from("students").select("profile_id, anonymous_alias").eq("id", thread.student_id).maybeSingle(),
      supabase
        .from("chat_messages")
        .select("body, created_at, sender_profile_id")
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const who = student?.anonymous_alias ?? "Student";
    latestChat = {
      who,
      sender: lastMessage && student && lastMessage.sender_profile_id === student.profile_id ? who : "Counselor",
      body: lastMessage?.body ?? null,
      at: lastMessage?.created_at ?? thread.updated_at,
      status: thread.status,
    };
  }
  if (dm) {
    const dmAt = (dm as { created_at: string }).created_at;
    if (!latestChat || dmAt > latestChat.at) {
      const d = dm as { body: string; sender_profile_id: string; recipient_profile_id: string };
      const peerId = d.sender_profile_id === userId ? d.recipient_profile_id : d.sender_profile_id;
      const { data: peer } = await supabase.from("profiles").select("full_name").eq("id", peerId).maybeSingle();
      const peerName = (peer as { full_name: string | null } | null)?.full_name ?? "Staff";
      latestChat = {
        who: peerName,
        sender: d.sender_profile_id === userId ? "You" : peerName,
        body: d.body,
        at: dmAt,
        status: "",
      };
    }
  }

  return {
    glance: {
      sessions: sessions.error ? null : (sessions.count ?? 0),
      referrals: referrals.error ? null : (referrals.count ?? 0),
      alerts: alerts.error ? null : (alerts.count ?? 0),
    },
    latestChat,
    office: {
      name: (officeRes.data as { value?: { name?: string } } | null)?.value?.name || DEFAULT_OFFICE.name,
      location: (officeRes.data as { value?: { location?: string } } | null)?.value?.location || DEFAULT_OFFICE.location,
    },
  };
}

/**
 * Complementary sidebar — profile, today's snapshot, latest chat, help.
 * Profile + help render instantly from the `profile` prop (no fetch).
 * Glance/chat counts use a 30s module cache + stale-while-revalidate, so
 * navigating between pages (even across route groups that remount this
 * component) never flashes the full skeleton — old data stays visible
 * while fresh data loads in the background.
 * Navigation links live in the top menu, never here.
 */
export function StaffSidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const userId = profile?.id ?? null;
  const [data, setData] = useState<SidebarData | null>(() =>
    userId ? getCachedSidebar(userId) : null
  );

  useEffect(() => {
    if (!userId) return;
    // Remount (e.g. (admin) -> (staff)) with fresh cache: render instantly, skip fetch.
    const cached = getCachedSidebar(userId);
    if (cached) {
      setData((prev) => prev ?? cached);
      return;
    }
    // Stale/missing: keep showing old data (don't clear) while revalidating.
    let alive = true;
    fetchSidebarData(userId)
      .then((d) => {
        if (!alive) return;
        sidebarCache.set(userId, { data: d, at: Date.now() });
        setData(d);
      })
      .catch(() => {
        if (!alive) return;
        setData((prev) =>
          prev ?? {
            glance: { sessions: null, referrals: null, alerts: null },
            latestChat: null,
            office: DEFAULT_OFFICE,
          }
        );
      });
    return () => {
      alive = false;
    };
    // pathname re-triggers the freshness check: fast nav (<30s) is a no-op,
    // slower nav revalidates in the background without clearing the UI.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, userId]);

  const glance = data?.glance ?? { sessions: null, referrals: null, alerts: null };
  const latestChat = data?.latestChat ?? null;
  const office = data?.office ?? DEFAULT_OFFICE;
  const loadingDynamic = data === null;
  const initial = (profile?.full_name ?? profile?.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <aside className="hidden w-[280px] shrink-0 space-y-4 lg:sticky lg:top-20 lg:block lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto" aria-label="Workspace info">
      {/* Signed-in profile — avatar, name, email, role, office, logout */}
      <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-600 font-display text-xl font-bold text-white"
          >
            {initial}
          </span>
          <div className="min-w-0 flex-1 leading-snug">
            <p className="truncate text-[15px] font-bold text-ink">
              {profile?.full_name ?? "Staff member"}
            </p>
            <p className="truncate text-xs font-medium text-ink-muted">{profile?.email}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          {profile?.role ? (
            <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-700 ring-1 ring-blue-100">
              {ROLE_LABEL[profile.role] ?? profile.role}
            </span>
          ) : (
            <span />
          )}
        </div>
        <p className="mt-3 flex items-center gap-1.5 border-t border-ink/10 pt-3 text-xs font-medium text-ink-muted">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-primary-600" aria-hidden />
          {office.location ? `${office.name} · ${office.location}` : office.name}
        </p>
        <div className="mt-3">
          <SignOutButton />
        </div>
      </section>

      {/* Today at a glance — live counts, not navigation */}
      <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <h2 className="font-display text-sm font-bold text-ink">Today at a glance</h2>
        <dl className={`mt-3 space-y-2.5 ${loadingDynamic ? "animate-pulse" : ""}`}>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-[13px] font-medium text-ink-muted">Sessions today</dt>
            <dd className="font-display text-xl font-bold text-ink">{glance.sessions ?? "–"}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-[13px] font-medium text-ink-muted">Referrals waiting</dt>
            <dd className="font-display text-xl font-bold text-ink">{glance.referrals ?? "–"}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-[13px] font-medium text-ink-muted">Your unread alerts</dt>
            <dd className="font-display text-xl font-bold text-ink">{glance.alerts ?? "–"}</dd>
          </div>
        </dl>
      </section>

      {/* Latest chat — only the single most recent conversation */}
      <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-bold text-ink">Latest chat</h2>
          {latestChat?.status && (
            <span
              className={
                latestChat.status === "open"
                  ? "rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-bold text-green-800"
                  : "rounded-full bg-ink/10 px-2.5 py-0.5 text-[11px] font-bold text-ink-muted"
              }
            >
              {latestChat.status === "open" ? "Open" : "Closed"}
            </span>
          )}
        </div>
        {loadingDynamic ? (
          <div className="mt-3 animate-pulse space-y-2" aria-hidden>
            <div className="h-4 w-2/3 rounded-lg bg-ink/10" />
            <div className="h-14 rounded-xl bg-ink/10" />
          </div>
        ) : latestChat ? (
          <div className="mt-3">
            <p className="text-[13px] font-bold text-ink">
              Chat with {latestChat.who}
              <span className="ml-2 text-[11px] font-medium text-ink-faint">{timeAgo(latestChat.at)}</span>
            </p>
            {latestChat.body ? (
              <p className="mt-1.5 line-clamp-2 rounded-xl bg-cream px-3 py-2 text-[13px] leading-snug text-ink-soft">
                <span className="font-bold">{latestChat.sender}: </span>
                {latestChat.body}
              </p>
            ) : (
              <p className="mt-1.5 text-[13px] text-ink-muted">No messages yet.</p>
            )}
            <Link href="/chat" className="mt-3 inline-block text-[13px] font-bold text-primary-600 hover:underline">
              Open chat
            </Link>
          </div>
        ) : (
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
            No chats yet — new conversations will show up here.
          </p>
        )}
      </section>

      {/* Help */}
      <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-display text-sm font-bold text-ink">
          <LifeBuoy className="h-4 w-4 text-primary-600" aria-hidden />
          Need a hand?
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
          Read our{" "}
          <Link href="/#safety" className="font-bold text-primary-600 hover:underline">
            privacy and safety rules
          </Link>{" "}
          or go{" "}
          <Link href="/" className="font-bold text-primary-600 hover:underline">
            back to home
          </Link>
          .
        </p>
      </section>
    </aside>
  );
}

/**
 * Exact-position skeleton for the sidebar — shown while it streams in,
 * so the layout never jumps when navigating between pages.
 */
export function StaffSidebarSkeleton() {
  return (
    <aside aria-hidden className="hidden w-[280px] shrink-0 space-y-4 lg:block">
      <div className="animate-pulse rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 rounded-full bg-ink/10" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-3/4 rounded-full bg-ink/10" />
            <div className="h-3 w-full rounded-full bg-ink/10" />
          </div>
        </div>
        <div className="mt-3 h-6 w-24 rounded-full bg-ink/10" />
        <div className="mt-3 h-px bg-ink/10" />
        <div className="mt-3 h-9 rounded-full bg-ink/10" />
      </div>
      <div className="animate-pulse rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <div className="h-4 w-32 rounded-full bg-ink/10" />
        <div className="mt-4 space-y-3">
          <div className="h-5 rounded-lg bg-ink/10" />
          <div className="h-5 rounded-lg bg-ink/10" />
          <div className="h-5 rounded-lg bg-ink/10" />
        </div>
      </div>
      <div className="animate-pulse rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <div className="h-4 w-28 rounded-full bg-ink/10" />
        <div className="mt-3 h-4 w-full rounded-lg bg-ink/10" />
        <div className="mt-2 h-14 rounded-xl bg-ink/10" />
      </div>
    </aside>
  );
}
