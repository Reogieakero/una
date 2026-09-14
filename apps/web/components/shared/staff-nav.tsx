"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { ChekieMark } from "@/components/Logo";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuDropdownLink,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";
import { useRoutePending } from "./route-pending";
import { cn } from "@/lib/utils";

export type StaffNavLink = { href: string; label: string; desc?: string; roles?: string[] };
export type StaffNavGroup = { label: string; inline?: boolean; links: StaffNavLink[] };

/**
 * The single staff menu — shared by the admin, counselor, and staff shells
 * so the navigation never changes when moving between pages. Guards still
 * enforce who may open each page.
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
      { href: "/chat", label: "Chat", desc: "Message students" },
    ],
  },
  {
    label: "People",
    links: [
      { href: "/users", label: "Users", desc: "Manage accounts", roles: ["guidance_head"] },
      { href: "/students", label: "Students", desc: "Student directory" },
      { href: "/referrals", label: "Referrals", desc: "Student referrals inbox" },
    ],
  },
  {
    label: "Manage",
    links: [
      { href: "/emergency", label: "Emergency access", desc: "Reveal identity in a crisis" },
      { href: "/users", label: "Users", desc: "Manage accounts", roles: ["guidance_head"] },
      { href: "/users/new", label: "Add staff", desc: "Create counselor or faculty accounts", roles: ["guidance_head"] },
      { href: "/announcements", label: "Announcements", desc: "News and updates" },
      { href: "/feedback", label: "Feedback", desc: "Student feedback", roles: ["counselor", "guidance_head"] },
      { href: "/security", label: "Security", desc: "Access and safety logs", roles: ["guidance_head"] },
      { href: "/settings", label: "Settings", desc: "Workspace preferences", roles: ["guidance_head"] },
    ],
  },
];

/**
 * Link pending state comes from RoutePendingProvider (global) so the inline
 * link spinner and the full-page overlay stay in sync. Clears when pathname
 * lands — see route-pending.tsx.
 */
function useNavPending(href: string) {
  const { isPending, startNavigation } = useRoutePending();
  return {
    pending: isPending(href),
    start: () => startNavigation(href),
  };
}

function PendingSpinner() {
  return <Spinner size="xs" />;
}

/** Unread count badge — same red pill language as the notification bell. */
function CountBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span
      aria-hidden
      className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white"
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

/**
 * Per-link unread counts from the notifications inbox, grouped by the
 * notification `link` (every transaction fan-out already carries one:
 * /appointments, /referrals, /chat, /announcements, /security, /feedback).
 * Same realtime pipe as the bell and chat messages — inserts AND read
 * receipts stream in, so badges rise and clear live.
 */
function useNavCounts() {
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

/** Top navigation-menu bar shared by the staff shells (16px side gutters). */
export function StaffNav({ title, groups, role }: { title: string; groups: StaffNavGroup[]; role?: string | null }) {
  const pathname = usePathname();
  // Role filter — links with a `roles` allowlist are hidden from other roles
  // so nobody is shown a page their guard would bounce. Empty groups drop out.
  const visible = groups
    .map((g) => ({
      ...g,
      links: g.links.filter((l) => !l.roles || (role != null && l.roles.includes(role))),
    }))
    .filter((g) => g.links.length > 0);
  const flat = visible.flatMap((g) => g.links);
  const counts = useNavCounts();
  const groupCount = (hrefs: string[]) => hrefs.reduce((n, h) => n + (counts.get(h) ?? 0), 0);
  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-white/90 backdrop-blur">
      <div className="w-full px-4">
        <div className="flex items-center gap-3 py-3">
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Chekie — back to home">
            <ChekieMark size={36} label="Chekie panda mascot" />
            <span className="leading-tight">
              <span className="block font-display text-[15px] font-semibold">Chekie</span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
                {title}
              </span>
            </span>
          </Link>

          {/* Desktop: dropdown navigation menu, centered in the bar */}
          <div className="hidden min-w-0 flex-1 justify-center md:flex">
          <NavigationMenu>
            <NavigationMenuList>
              {visible.map((g) =>
                g.inline || g.links.length === 1 ? (
                  g.links.map((l) => (
                    <NavigationMenuItem key={l.href} value={l.href}>
                      <DesktopNavLink href={l.href} label={l.label} active={pathname === l.href} count={counts.get(l.href) ?? 0} />
                    </NavigationMenuItem>
                  ))
                ) : (
                  <NavigationMenuItem key={g.label} value={g.label}>
                    <NavigationMenuTrigger>
                      {g.label}
                      <CountBadge count={groupCount(g.links.map((l) => l.href))} />
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <ul className="space-y-0.5">
                        {g.links.map((l) => (
                          <li key={l.href}>
                            <DropdownNavLink
                              href={l.href}
                              title={l.label}
                              desc={l.desc}
                              active={pathname === l.href}
                              count={counts.get(l.href) ?? 0}
                            />
                          </li>
                        ))}
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                )
              )}
            </NavigationMenuList>
          </NavigationMenu>
          </div>

          {/* Notifications bell — right side, live unread badge + hover dropdown */}
          <div className="ml-auto shrink-0 md:ml-0">
            <NotifBell />
          </div>
        </div>

        {/* Mobile: scrollable flat links (dropdowns stay desktop-only) */}
        <nav aria-label="Section" className="no-scrollbar flex gap-1 overflow-x-auto pb-3 md:hidden">
          {flat.map((l) => (
            <MobileNavLink key={l.href} href={l.href} label={l.label} active={pathname === l.href} count={counts.get(l.href) ?? 0} />
          ))}
        </nav>
      </div>
    </header>
  );
}

function DesktopNavLink({ href, label, active, count }: { href: string; label: string; active: boolean; count: number }) {
  const { pending, start } = useNavPending(href);
  return (
    <NavigationMenuLink
      href={href}
      active={active}
      onNavigate={start}
      ariaLabel={count ? `${label}, ${count} new` : undefined}
    >
      <span className={cn("inline-flex items-center gap-1.5", pending && "opacity-70")}>
        {/* Fixed-size slot: the spinner must never widen the link mid-transition. */}
        <span aria-hidden className="inline-flex h-3.5 w-3.5 items-center justify-center">
          {pending && <PendingSpinner />}
        </span>
        {label}
        <CountBadge count={count} />
      </span>
    </NavigationMenuLink>
  );
}

function DropdownNavLink({
  href,
  title,
  desc,
  active,
  count,
}: {
  href: string;
  title: string;
  desc?: string;
  active?: boolean;
  count: number;
}) {
  const { pending, start } = useNavPending(href);
  return (
    <NavigationMenuDropdownLink
      href={href}
      title={title}
      desc={pending ? "Loading…" : desc}
      active={active}
      onNavigate={start}
      badge={<CountBadge count={count} />}
    />
  );
}

function MobileNavLink({ href, label, active, count }: { href: string; label: string; active: boolean; count: number }) {
  const { pending, start } = useNavPending(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-disabled={pending || undefined}
      aria-label={count ? `${label}, ${count} new` : undefined}
      onClick={start}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold",
        active
          ? "bg-primary-600 text-white shadow-soft"
          : "bg-cream text-ink-soft",
        pending && "opacity-70"
      )}
    >
      {/* Fixed-size slot: the spinner must never widen the pill mid-transition. */}
      <span aria-hidden className="inline-flex h-3.5 w-3.5 items-center justify-center">
        {pending && <PendingSpinner />}
      </span>
      {label}
      <CountBadge count={count} />
    </Link>
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
  const { start } = useNavPending("/notifications");
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
