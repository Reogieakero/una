"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen } from "lucide-react";
import { ChekieMark } from "@/components/Logo";
import { useQueryClient } from "@tanstack/react-query";
import {
  HEAD_DASHBOARD_DEFAULT_RANGE,
  HEAD_DASHBOARD_STALE_MS,
  fetchHeadDashboard,
  headDashboardKey,
} from "@/lib/hooks/use-head-dashboard";
import {
  COUNSELOR_DASHBOARD_DEFAULT_RANGE,
  COUNSELOR_DASHBOARD_STALE_MS,
  counselorDashboardKey,
  fetchCounselorDashboard,
} from "@/lib/hooks/use-counselor-dashboard";
import {
  AVAILABILITY_BOARD_KEY,
  AVAILABILITY_BOARD_STALE_MS,
  fetchAvailabilityBoard,
} from "@/lib/hooks/use-availability-board";
import { CHAT_BOARD_KEY, CHAT_BOARD_STALE_MS, fetchChatBoard } from "@/lib/hooks/use-chat-board";
import { USERS_BOARD_KEY, USERS_BOARD_STALE_MS, fetchUsersBoard } from "@/lib/hooks/use-users-board";
import { STUDENTS_BOARD_KEY, STUDENTS_BOARD_STALE_MS, fetchStudentsBoard } from "@/lib/hooks/use-students-board";
import { REFERRALS_BOARD_KEY, REFERRALS_BOARD_STALE_MS, fetchReferralsBoard } from "@/lib/hooks/use-referrals-board";
import { EMERGENCY_BOARD_KEY, EMERGENCY_BOARD_STALE_MS, fetchEmergencyBoard } from "@/lib/hooks/use-emergency-board";
import {
  ANNOUNCEMENTS_BOARD_KEY,
  ANNOUNCEMENTS_BOARD_STALE_MS,
  fetchAnnouncementsBoard,
} from "@/lib/hooks/use-announcements-board";
import { FEEDBACK_BOARD_KEY, FEEDBACK_BOARD_STALE_MS, fetchFeedbackBoard } from "@/lib/hooks/use-feedback-board";
import { SECURITY_BOARD_KEY, SECURITY_BOARD_STALE_MS, fetchSecurityBoard } from "@/lib/hooks/use-security-board";
import { SETTINGS_BOARD_KEY, SETTINGS_BOARD_STALE_MS, fetchSettingsBoard } from "@/lib/hooks/use-settings-board";
import {
  NOTIFICATIONS_BOARD_KEY,
  NOTIFICATIONS_BOARD_STALE_MS,
  fetchNotificationsBoard,
} from "@/lib/hooks/use-notifications-board";
import { SESSIONS_CALENDAR_KEY, SESSIONS_CALENDAR_STALE_MS, fetchSessionsCalendar } from "@/lib/hooks/use-sessions-calendar";
import {
  APPOINTMENTS_BOARD_KEY,
  APPOINTMENTS_BOARD_STALE_MS,
  fetchAppointmentsBoard,
} from "@/lib/hooks/use-appointments-board";
import { filterNavGroups, useNavCounts, type NavProfile, type StaffNavGroup } from "./staff-nav";
import { useSidebarCounts, type SidebarCounts } from "@/lib/hooks/use-sidebar-counts";
import { BranchedMenu, type BranchedMenuItem } from "./branched-menu";
import { LINK_ICONS } from "./nav-icons";
import { useRoutePending } from "./route-pending";

export type SidebarProfile = NavProfile;

/** Spoken label for the count so it names the queue, not just "3 new". */
const BADGE_LABEL: Record<string, string> = {
  "/appointments": "appointment request",
  "/referrals": "referral to triage",
  "/chat": "unread message",
  "/announcements": "unread announcement",
  "/feedback": "new feedback",
  "/security": "security update",
};

/**
 * Prefer the derived (source-of-truth) counters. While the RPC is still
 * loading/failed, fall back to the notification feed so no badge flickers.
 */
function pickCount(href: string, derived: SidebarCounts | undefined, feed: Map<string, number>): number {
  if (derived) {
    switch (href) {
      case "/appointments":
        return derived.appointment_requests;
      case "/referrals":
        return derived.referrals_to_triage;
      case "/chat":
        return derived.chat_unread;
      case "/announcements":
        return derived.announcements_unread;
      case "/feedback":
        return derived.feedback_unread;
      case "/security":
        return derived.security_unread;
      default:
        return 0;
    }
  }
  return feed.get(href) ?? 0;
}

/**
 * Grouped navigation links — shadcn blocks sidebar language: uppercase
 * group label, compact 13px links with a 16px icon, active link tinted.
 * Narrow by design (parent controls the 240px rail).
 */
export function SidebarNavGroups({
  groups,
  role,
  onNavigate,
}: {
  groups: StaffNavGroup[];
  role?: string | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const counts = useNavCounts();
  const { data: derivedCounts } = useSidebarCounts();
  // For the Guidance Head, "Manage" lives in the profile dropdown (StaffNav)
  // instead of the rail, keeping the sidebar focused on daily queues.
  const visible = useMemo(() => {
    const filtered = filterNavGroups(groups, role);
    return role === "guidance_head"
      ? filtered.filter((g) => g.label !== "Manage")
      : filtered;
  }, [groups, role]);
  const qc = useQueryClient();

  // Warm the cached dashboards so opening /dashboard feels instant —
  // office-wide for the head, personal queue for counselors.
  const prefetchDashboard = () => {
    if (role === "guidance_head") {
      qc.prefetchQuery({
        queryKey: headDashboardKey(HEAD_DASHBOARD_DEFAULT_RANGE),
        queryFn: () => fetchHeadDashboard(HEAD_DASHBOARD_DEFAULT_RANGE),
        staleTime: HEAD_DASHBOARD_STALE_MS,
      }).catch(() => {});
      return;
    }
    if (role === "counselor") {
      qc.prefetchQuery({
        queryKey: counselorDashboardKey(COUNSELOR_DASHBOARD_DEFAULT_RANGE),
        queryFn: () => fetchCounselorDashboard(COUNSELOR_DASHBOARD_DEFAULT_RANGE),
        staleTime: COUNSELOR_DASHBOARD_STALE_MS,
      }).catch(() => {});
    }
  };

  // Warm the cached availability board so opening /availability feels instant.
  const prefetchAvailability = () => {
    if (role !== "counselor" && role !== "guidance_head") return;
    qc.prefetchQuery({
      queryKey: [...AVAILABILITY_BOARD_KEY],
      queryFn: fetchAvailabilityBoard,
      staleTime: AVAILABILITY_BOARD_STALE_MS,
    }).catch(() => {});
  };

  // Warm the cached chat board so opening /chat feels instant.
  const prefetchChat = () => {
    if (role !== "counselor" && role !== "guidance_head") return;
    qc.prefetchQuery({
      queryKey: [...CHAT_BOARD_KEY],
      queryFn: fetchChatBoard,
      staleTime: CHAT_BOARD_STALE_MS,
    }).catch(() => {});
  };

  // Warm the cached users directory so opening /users feels instant.
  const prefetchUsers = () => {
    if (role !== "guidance_head") return;
    qc.prefetchQuery({
      queryKey: [...USERS_BOARD_KEY],
      queryFn: fetchUsersBoard,
      staleTime: USERS_BOARD_STALE_MS,
    }).catch(() => {});
  };

  // Warm the cached students directory so opening /students feels instant.
  const prefetchStudents = () => {
    if (role !== "counselor" && role !== "guidance_head") return;
    qc.prefetchQuery({
      queryKey: [...STUDENTS_BOARD_KEY],
      queryFn: fetchStudentsBoard,
      staleTime: STUDENTS_BOARD_STALE_MS,
    }).catch(() => {});
  };

  // Warm the cached referrals board (first page, default scope) so opening
  // /referrals feels instant.
  const prefetchReferrals = () => {
    if (role !== "counselor" && role !== "guidance_head" && role !== "faculty") return;
    qc.prefetchQuery({
      queryKey: [...REFERRALS_BOARD_KEY, 1, 25, "all", "all", "all"],
      queryFn: () => fetchReferralsBoard({ page: 1, size: 25, status: "all", priority: "all", assignee: "all" }),
      staleTime: REFERRALS_BOARD_STALE_MS,
    }).catch(() => {});
  };

  // Warm the cached emergency board so opening /emergency feels instant.
  const prefetchEmergency = () => {
    if (role !== "counselor" && role !== "guidance_head") return;
    qc.prefetchQuery({
      queryKey: [...EMERGENCY_BOARD_KEY],
      queryFn: fetchEmergencyBoard,
      staleTime: EMERGENCY_BOARD_STALE_MS,
    }).catch(() => {});
  };

  // Warm the cached announcements board so opening /announcements feels instant.
  const prefetchAnnouncements = () => {
    qc.prefetchQuery({
      queryKey: [...ANNOUNCEMENTS_BOARD_KEY],
      queryFn: fetchAnnouncementsBoard,
      staleTime: ANNOUNCEMENTS_BOARD_STALE_MS,
    }).catch(() => {});
  };

  // Warm the cached feedback board so opening /feedback feels instant.
  const prefetchFeedback = () => {
    if (role !== "counselor" && role !== "guidance_head") return;
    qc.prefetchQuery({
      queryKey: [...FEEDBACK_BOARD_KEY],
      queryFn: fetchFeedbackBoard,
      staleTime: FEEDBACK_BOARD_STALE_MS,
    }).catch(() => {});
  };

  // Warm the cached security board so opening /security feels instant.
  const prefetchSecurity = () => {
    if (role !== "guidance_head") return;
    qc.prefetchQuery({
      queryKey: [...SECURITY_BOARD_KEY],
      queryFn: fetchSecurityBoard,
      staleTime: SECURITY_BOARD_STALE_MS,
    }).catch(() => {});
  };

  // Warm the cached settings board so opening /settings feels instant.
  const prefetchSettings = () => {
    if (role !== "guidance_head" && role !== "counselor" && role !== "faculty" && role !== "admin") return;
    qc.prefetchQuery({
      queryKey: [...SETTINGS_BOARD_KEY],
      queryFn: fetchSettingsBoard,
      staleTime: SETTINGS_BOARD_STALE_MS,
    }).catch(() => {});
  };

  // Warm the cached notifications inbox so opening /notifications feels instant.
  const prefetchNotifications = () => {
    qc.prefetchQuery({
      queryKey: [...NOTIFICATIONS_BOARD_KEY],
      queryFn: fetchNotificationsBoard,
      staleTime: NOTIFICATIONS_BOARD_STALE_MS,
    }).catch(() => {});
  };

  // Warm the cached session calendar so opening /sessions feels instant.
  const prefetchSessions = () => {
    if (role !== "counselor" && role !== "guidance_head") return;
    qc.prefetchQuery({
      queryKey: [...SESSIONS_CALENDAR_KEY],
      queryFn: fetchSessionsCalendar,
      staleTime: SESSIONS_CALENDAR_STALE_MS,
    }).catch(() => {});
  };

  // Warm the cached appointments board (first page, default scope) so
  // opening /appointments feels instant. The board query branches internally
  // (own queue vs office-wide).
  const prefetchAppointments = () => {
    if (role !== "counselor" && role !== "guidance_head") return;
    qc.prefetchQuery({
      queryKey: [...APPOINTMENTS_BOARD_KEY, 1, 10, "all", "all", "all", "appointments"],
      queryFn: () => fetchAppointmentsBoard({ page: 1, size: 10, status: "all", mode: "all", counselor: "all", kind: "appointments" }),
      staleTime: APPOINTMENTS_BOARD_STALE_MS,
    }).catch(() => {});
  };

  // Warm the destination's cached data when the pointer lands on a link.
  // BranchedMenu discards onHover's return value, so this must actually run
  // the prefetch here (returning the function would silently do nothing and
  // leave every navigation on a cold cache).
  const prefetchFor = (href: string) => {
    switch (href) {
      case "/dashboard":
        return prefetchDashboard();
      case "/availability":
        return prefetchAvailability();
      case "/chat":
        return prefetchChat();
      case "/users":
        return prefetchUsers();
      case "/students":
        return prefetchStudents();
      case "/referrals":
        return prefetchReferrals();
      case "/emergency":
        return prefetchEmergency();
      case "/announcements":
        return prefetchAnnouncements();
      case "/feedback":
        return prefetchFeedback();
      case "/security":
        return prefetchSecurity();
      case "/settings":
        return prefetchSettings();
      case "/notifications":
        return prefetchNotifications();
      case "/sessions":
        return prefetchSessions();
      case "/appointments":
        return prefetchAppointments();
      default:
        return undefined;
    }
  };

  // Exact match wins; otherwise the longest parent route (/students/[id] →
  // /students) is highlighted.
  const activeHref = useMemo(() => {
    const hrefs = visible.flatMap((g) => g.links.map((l) => l.href));
    if (hrefs.includes(pathname)) return pathname;
    return (
      hrefs
        .filter((href) => pathname.startsWith(`${href}/`))
        .sort((a, b) => b.length - a.length)[0] ?? ""
    );
  }, [pathname, visible]);

  const items = useMemo<BranchedMenuItem[]>(
    () =>
      visible.map((group) => ({
        label: group.label,
        children: group.links.map((l) => {
          const Icon = LINK_ICONS[l.href] ?? BookOpen;
          const count = pickCount(l.href, derivedCounts, counts);
          const countLabel = BADGE_LABEL[l.href];
          return {
            value: l.href,
            label: l.label,
            icon: <Icon className="h-4 w-4" aria-hidden />,
            badge: count,
            title: l.desc ?? l.label,
            ariaLabel:
              count && countLabel
                ? `${l.label}, ${count} ${countLabel}${count === 1 ? "" : "s"}`
                : undefined,
          };
        }),
      })),
    [visible, derivedCounts, counts]
  );

  const defaultOpen = useMemo(() => visible.map((_, i) => i), [visible]);

  // Navigation itself is handled by the <Link> rendered in BranchedMenu, so
  // the route can be prefetched and the click never waits on a router.push.
  // Report the destination so the top-edge progress bar can confirm the
  // click immediately while the target route loads.
  const { startNavigation } = useRoutePending();
  const handleSelect = useCallback(
    (href: string) => {
      startNavigation(href);
      onNavigate?.();
    },
    [startNavigation, onNavigate]
  );

  return (
    <BranchedMenu
      className="branched-menu--brand"
      ariaLabel="Workspace"
      items={items}
      activeValue={activeHref}
      defaultOpen={defaultOpen}
      width={216}
      rowHeight={34}
      indent={34}
      trunk={12}
      radius={9}
      lineWidth={1.5}
      fontSize={13}
      color="#DBEAFE"
      accentColor="#FCD34D"
      lineColor="rgba(147,197,253,0.22)"
      onSelect={handleSelect}
      onHover={prefetchFor}
    />
  );
}

/**
 * Left navigation rail — shadcn blocks style: brand header + grouped links.
 * User info + logout live in the navbar profile menu, never here. Fixed at
 * 240px (w-60) with compact 13px links so it never feels wide. Desktop
 * only; mobile uses the drawer in StaffShell.
 */
export function StaffSidebar({
  groups,
  role,
}: {
  groups: StaffNavGroup[];
  role?: string | null;
}) {
  return (
    <aside
      aria-label="Workspace navigation"
      data-shell-chrome
      className="hidden w-60 shrink-0 flex-col border-r border-white/10 bg-[#050C16] md:sticky md:top-0 md:flex md:h-screen"
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/10 px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2" aria-label="Chekie — back to home">
          <ChekieMark size={32} label="Chekie panda mascot" />
          <span className="leading-tight">
            <span className="block font-display text-[15px] font-semibold text-white">Chekie</span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-blue-100/40">
              Guidance
            </span>
          </span>
        </Link>
      </div>
      <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <SidebarNavGroups groups={groups} role={role} />
      </div>
    </aside>
  );
}

/** Narrow skeleton matching the 240px rail — shown while it streams in. */
export function StaffSidebarSkeleton() {
  return (
    <aside aria-hidden data-shell-chrome className="hidden w-60 shrink-0 flex-col border-r border-white/10 bg-[#050C16] md:flex">
      <div className="h-14 shrink-0 border-b border-white/10 px-4 py-3">
        <div className="h-8 w-32 animate-pulse rounded-md bg-white/10" />
      </div>
      <div className="flex-1 space-y-4 px-3 py-4">
        {[0, 1, 2].map((g) => (
          <div key={g} className="animate-pulse">
            <div className="h-3 w-20 rounded-full bg-white/10" />
            <div className="mt-2 space-y-1.5">
              <div className="h-8 rounded-md bg-white/10" />
              <div className="h-8 rounded-md bg-white/10" />
              <div className="h-8 rounded-md bg-white/10" />
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
