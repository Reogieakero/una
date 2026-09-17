"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, Menu } from "lucide-react";
import { ChekieMark } from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";
import { useRoutePending } from "./route-pending";
import { SignOutButton } from "./sign-out-button";
import { cn } from "@/lib/utils";

export type StaffNavLink = { href: string; label: string; desc?: string; roles?: string[] };
export type StaffNavGroup = { label: string; inline?: boolean; links: StaffNavLink[] };
export type NavProfile = {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
} | null;

const ROLE_LABEL: Record<string, string> = {
  guidance_head: "Guidance Head",
  counselor: "Counselor",
  faculty: "Faculty",
  student: "Student",
};

/**
 * The single staff menu — shared by the admin, counselor, and staff shells.
 * Links render in the left sidebar (shadcn blocks style); this top bar stays
 * slim (menu trigger + brand on mobile, notifications bell on the right).
 * Guards still enforce who may open each page.
 *
 * `roles` allowlist (when set) hides the link from other roles. Only use it
 * for links whose page hard-blocks the excluded role — never show a link
 * that just bounces to "/" (e.g. counselor must not see /users, which lives
 * in the head-only (admin) group). Links without `roles` stay visible to all
 * shell roles; their pages handle roles internally.
 */
export const STAFF_NAV_GROUPS: StaffNavGroup[] = [
  {
    label: "Overview",
    links: [
      { href: "/dashboard", label: "Dashboard", desc: "Office overview", roles: ["counselor", "guidance_head"] },
      { href: "/reports", label: "Reports", desc: "Session and referral reports", roles: ["counselor", "guidance_head"] },
      { href: "/about", label: "About", desc: "How each page works", roles: ["counselor", "guidance_head"] },
    ],
  },
  {
    label: "Sessions",
    links: [
      { href: "/sessions", label: "Session calendar", desc: "Month, week, day schedule", roles: ["counselor", "guidance_head"] },
      { href: "/appointments", label: "Appointments", desc: "Upcoming sessions", roles: ["counselor", "guidance_head"] },
      { href: "/availability", label: "Availability", desc: "Counselor open slots", roles: ["counselor", "guidance_head"] },
      { href: "/chat", label: "Chat", desc: "Message students", roles: ["counselor", "guidance_head", "faculty"] },
    ],
  },
  {
    label: "People",
    links: [
      { href: "/users", label: "Users", desc: "Manage accounts", roles: ["guidance_head"] },
      { href: "/students", label: "Students", desc: "Student directory", roles: ["counselor", "guidance_head", "faculty"] },
      { href: "/referrals", label: "Referrals", desc: "Student referrals inbox", roles: ["counselor", "guidance_head", "faculty"] },
    ],
  },
  {
    label: "Manage",
    links: [
      { href: "/emergency", label: "Emergency access", desc: "Reveal identity in a crisis", roles: ["counselor", "guidance_head", "faculty"] },
      { href: "/users/new", label: "Add staff", desc: "Create counselor or faculty accounts", roles: ["guidance_head"] },
      { href: "/announcements", label: "Announcements", desc: "News and updates", roles: ["counselor", "guidance_head", "faculty"] },
      { href: "/feedback", label: "Feedback", desc: "Student feedback", roles: ["counselor", "guidance_head"] },
      { href: "/security", label: "Security", desc: "Access and safety logs", roles: ["guidance_head"] },
      { href: "/settings", label: "Settings", desc: "Profile and preferences", roles: ["counselor", "guidance_head", "admin"] },
    ],
  },
];

/**
 * Role filter shared by the sidebar — links with a `roles` allowlist are
 * hidden from other roles so nobody is shown a page their guard would
 * bounce. Empty groups drop out. De-dupes repeated hrefs (first wins) so a
 * link never appears twice in the sidebar.
 */
export function filterNavGroups(groups: StaffNavGroup[], role?: string | null): StaffNavGroup[] {
  const seen = new Set<string>();
  return groups
    .map((g) => ({
      ...g,
      links: g.links.filter((l) => {
        if (l.roles && (role == null || !l.roles.includes(role))) return false;
        if (seen.has(l.href)) return false;
        seen.add(l.href);
        return true;
      }),
    }))
    .filter((g) => g.links.length > 0);
}

/**
 * Per-link unread counts from the notifications inbox, grouped by the
 * notification `link` (every transaction fan-out already carries one:
 * /appointments, /referrals, /chat, /announcements, /security, /feedback).
 * Same realtime pipe as the bell and chat messages — inserts AND read
 * receipts stream in, so badges rise and clear live.
 */
export function useNavCounts() {
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const pathname = usePathname();

  useEffect(() => {
    let alive = true;
    const supabase = createClient();
    let ch: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !alive) return;
      const refresh = async () => {
        const { data } = await supabase
          .from("notifications")
          .select("link")
          .eq("profile_id", user.id)
          .eq("is_read", false)
          .limit(200);
        if (!alive) return;
        const m = new Map<string, number>();
        for (const n of ((data ?? []) as { link: string | null }[])) {
          if (!n.link) continue;
          const key = n.link.split("?")[0];
          m.set(key, (m.get(key) ?? 0) + 1);
        }
        setCounts(m);
      };
      await refresh();
      ch = supabase
        .channel(`nav-counts-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `profile_id=eq.${user.id}` },
          () => {
            refresh().catch(() => {});
          }
        )
        .subscribe();
    })().catch(() => {});
    return () => {
      alive = false;
      if (ch) supabase.removeChannel(ch);
    };
    // Re-runs on navigation too — same staleness guard as the bell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return counts;
}

/**
 * Slim top bar for the staff shells — navigation links live in the left
 * sidebar, never here. Mobile shows the drawer trigger + brand; the right
 * side carries the notifications bell and the profile menu (user info +
 * logout in a dropdown).
 */
export function StaffNav({ title, profile, onMenuClick }: { title: string; profile?: NavProfile; onMenuClick?: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-white/90 backdrop-blur">
      <div className="flex h-14 w-full items-center gap-2 px-4">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open navigation menu"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition hover:bg-cream-dark hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 md:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
        )}
        {/* Mobile brand — desktop brand lives at the top of the sidebar. */}
        <Link href="/" className="flex min-w-0 items-center gap-2 md:hidden" aria-label="Chekie — back to home">
          <ChekieMark size={32} label="Chekie panda mascot" />
          <span className="leading-tight">
            <span className="block font-display text-[15px] font-semibold">Chekie</span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
              {title}
            </span>
          </span>
        </Link>

        {/* Notifications bell + profile menu — right side */}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <NotifBell />
          <ProfileMenu profile={profile ?? null} />
        </div>
      </div>
    </header>
  );
}

/**
 * Profile menu — avatar button in the navbar that drops down the signed-in
 * user's info (name, email, role) plus the logout button.
 */
function ProfileMenu({ profile }: { profile: NavProfile }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close the menu on navigation so it never lingers over the next page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Click-outside + Escape to dismiss.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open ]);

  const initial = (profile?.full_name ?? profile?.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={open ? "Close account menu" : "Open account menu"}
        className="flex h-10 items-center gap-0.5 rounded-full py-1 pl-1 pr-1.5 transition hover:bg-cream-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      >
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 font-display text-sm font-bold text-white"
        >
          {initial}
        </span>
        <ChevronDown aria-hidden className={cn("h-4 w-4 text-ink-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-card"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-600 font-display text-base font-bold text-white"
            >
              {initial}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[13px] font-bold text-ink">
                {profile?.full_name ?? "Staff member"}
              </p>
              <p className="truncate text-[11px] font-medium text-ink-muted">{profile?.email}</p>
              {profile?.role && (
                <p className="mt-1 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 ring-1 ring-blue-100">
                  {ROLE_LABEL[profile.role] ?? profile.role}
                </p>
              )}
            </div>
          </div>
          <div className="border-t border-ink/10 px-3 py-3">
            <SignOutButton />
          </div>
        </div>
      )}
    </div>
  );
}

type BellItem = { id: string; title: string; created_at: string };

function timeShort(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/**
 * Notifications bell — right side of the bar. Live unread badge plus a
 * hover/focus dropdown with the latest unread items. Clicking through lands
 * on the full /notifications inbox.
 */
function NotifBell() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<BellItem[]>([]);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { startNavigation } = useRoutePending();
  const start = () => startNavigation("/notifications");
  const pathname = usePathname();

  useEffect(() => {
    let alive = true;
    const supabase = createClient();
    let ch: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !alive) return;
      const refresh = async () => {
        const { data, count: c } = await supabase
          .from("notifications")
          .select("id, title, created_at", { count: "exact" })
          .eq("profile_id", user.id)
          .eq("is_read", false)
          .order("created_at", { ascending: false })
          .limit(5);
        if (!alive) return;
        setCount(c ?? 0);
        setItems(((data ?? []) as BellItem[]));
      };
      await refresh();
      ch = supabase
        .channel(`nav-notif-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `profile_id=eq.${user.id}` },
          () => {
            refresh().catch(() => {});
          }
        )
        .subscribe();
    })().catch(() => {});
    return () => {
      alive = false;
      if (ch) supabase.removeChannel(ch);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
    // Re-runs on navigation too — the shell outlives page changes, so this
    // keeps a stale badge from surviving when realtime misses a beat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const peek = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hide = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <div className="relative" onMouseEnter={peek} onMouseLeave={hide}>
      <Link
        href="/notifications"
        onClick={start}
        onFocus={peek}
        onBlur={hide}
        aria-label={count ? `Notifications, ${count} unread` : "Notifications"}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition hover:bg-cream-dark hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {count > 0 && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white"
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Link>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-card">
          <p className="border-b border-ink/10 px-4 py-2.5 font-display text-sm font-bold text-ink">
            Notifications {count > 0 && <span className="text-ink-muted">· {count} unread</span>}
          </p>
          {items.length ? (
            <ul className="max-h-72 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href="/notifications"
                    onClick={() => {
                      setOpen(false);
                      start();
                    }}
                    className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-cream"
                  >
                    <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-primary-600" />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{n.title}</span>
                    <span className="shrink-0 text-[11px] font-medium text-ink-faint">{timeShort(n.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-[13px] text-ink-muted">All caught up — nothing unread.</p>
          )}
          <Link
            href="/notifications"
            onClick={() => {
              setOpen(false);
              start();
            }}
            className="block border-t border-ink/10 bg-cream px-4 py-2.5 text-center text-[13px] font-bold text-primary-700 hover:underline"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
