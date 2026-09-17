"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  Clock,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  Megaphone,
  Settings,
  ShieldCheck,
  Siren,
  Star,
  UserPlus,
  Users,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";
import { ChekieMark } from "@/components/Logo";
import { Spinner } from "@/components/ui/spinner";
import { useQueryClient } from "@tanstack/react-query";
import { HEAD_DASHBOARD_KEY, HEAD_DASHBOARD_STALE_MS, fetchHeadDashboard } from "@/lib/hooks/use-head-dashboard";
import {
  COUNSELOR_DASHBOARD_KEY,
  COUNSELOR_DASHBOARD_STALE_MS,
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
import { useRoutePending } from "./route-pending";
import { cn } from "@/lib/utils";

export type SidebarProfile = NavProfile;

const LINK_ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/reports": BarChart3,
  "/about": BookOpen,
  "/sessions": CalendarDays,
  "/appointments": CalendarCheck,
  "/availability": Clock,
  "/chat": MessagesSquare,
  "/users": Users,
  "/users/new": UserPlus,
  "/students": GraduationCap,
  "/referrals": Inbox,
  "/emergency": Siren,
  "/announcements": Megaphone,
  "/feedback": Star,
  "/security": ShieldCheck,
  "/settings": Settings,
};

/** Small unread pill — same red language as the notification bell. */
function CountBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span
      aria-hidden
      className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white"
    >
      {count > 9 ? "9+" : count}
    </span>
  );
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
  const { isPending, startNavigation } = useRoutePending();
  const counts = useNavCounts();
  const visible = filterNavGroups(groups, role);
  const qc = useQueryClient();

  // Warm the cached dashboards so opening /dashboard feels instant —
  // office-wide for the head, personal queue for counselors.
  const prefetchDashboard = () => {
    if (role === "guidance_head") {
      qc.prefetchQuery({
        queryKey: [...HEAD_DASHBOARD_KEY],
        queryFn: fetchHeadDashboard,
        staleTime: HEAD_DASHBOARD_STALE_MS,
      }).catch(() => {});
      return;
    }
    if (role === "counselor") {
      qc.prefetchQuery({
        queryKey: [...COUNSELOR_DASHBOARD_KEY],
        queryFn: fetchCounselorDashboard,
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

  // Warm the cached referrals board so opening /referrals feels instant.
  const prefetchReferrals = () => {
    if (role !== "counselor" && role !== "guidance_head" && role !== "faculty") return;
    qc.prefetchQuery({
      queryKey: [...REFERRALS_BOARD_KEY],
      queryFn: fetchReferralsBoard,
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
    if (role !== "guidance_head" && role !== "counselor" && role !== "admin") return;
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

  // Warm the cached appointments board so opening /appointments feels instant.
  // The board query branches internally (own queue vs office-wide).
  const prefetchAppointments = () => {
    if (role !== "counselor" && role !== "guidance_head") return;
    qc.prefetchQuery({
      queryKey: [...APPOINTMENTS_BOARD_KEY],
      queryFn: fetchAppointmentsBoard,
      staleTime: APPOINTMENTS_BOARD_STALE_MS,
    }).catch(() => {});
  };

  const prefetchFor = (href: string) => {
    if (href === "/dashboard") return prefetchDashboard;
    if (href === "/availability") return prefetchAvailability;
    if (href === "/chat") return prefetchChat;
    if (href === "/users") return prefetchUsers;
    if (href === "/students") return prefetchStudents;
    if (href === "/referrals") return prefetchReferrals;
    if (href === "/emergency") return prefetchEmergency;
    if (href === "/announcements") return prefetchAnnouncements;
    if (href === "/feedback") return prefetchFeedback;
    if (href === "/security") return prefetchSecurity;
    if (href === "/settings") return prefetchSettings;
    if (href === "/notifications") return prefetchNotifications;
    if (href === "/sessions") return prefetchSessions;
    if (href === "/appointments") return prefetchAppointments;
    return undefined;
  };

  return (
    <nav aria-label="Workspace" className="space-y-4">
      {visible.map((g) => (
        <div key={g.label}>
          <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            {g.label}
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {g.links.map((l) => {
              const active = pathname === l.href;
              const pending = isPending(l.href);
              const count = counts.get(l.href) ?? 0;
              const Icon = LINK_ICONS[l.href] ?? BookOpen;
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    aria-label={count ? `${l.label}, ${count} new` : undefined}
                    onClick={() => {
                      startNavigation(l.href);
                      onNavigate?.();
                    }}
                    onMouseEnter={prefetchFor(l.href)}
                    onFocus={prefetchFor(l.href)}
                    title={l.desc ?? l.label}
                    className={cn(
                      "group flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                      active
                        ? "bg-primary-50 text-primary-700"
                        : "text-ink-soft hover:bg-cream hover:text-ink",
                      pending && "opacity-70"
                    )}
                  >
                    <Icon
                      aria-hidden
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active ? "text-primary-600" : "text-ink-faint group-hover:text-ink-soft"
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">{l.label}</span>
                    <span aria-hidden className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                      {pending && <Spinner size="xs" />}
                    </span>
                    <CountBadge count={count} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
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
      className="hidden w-60 shrink-0 flex-col border-r border-ink/10 bg-white md:sticky md:top-0 md:flex md:h-screen"
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-ink/10 px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2" aria-label="Chekie — back to home">
          <ChekieMark size={32} label="Chekie panda mascot" />
          <span className="leading-tight">
            <span className="block font-display text-[15px] font-semibold">Chekie</span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
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
    <aside aria-hidden className="hidden w-60 shrink-0 flex-col border-r border-ink/10 bg-white md:flex">
      <div className="h-14 shrink-0 border-b border-ink/10 px-4 py-3">
        <div className="h-8 w-32 animate-pulse rounded-md bg-ink/10" />
      </div>
      <div className="flex-1 space-y-4 px-3 py-4">
        {[0, 1, 2].map((g) => (
          <div key={g} className="animate-pulse">
            <div className="h-3 w-20 rounded-full bg-ink/10" />
            <div className="mt-2 space-y-1.5">
              <div className="h-8 rounded-md bg-ink/10" />
              <div className="h-8 rounded-md bg-ink/10" />
              <div className="h-8 rounded-md bg-ink/10" />
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
