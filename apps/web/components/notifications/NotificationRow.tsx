"use client";

import Link from "next/link";
import {
  Bell,
  CalendarDays,
  ClipboardList,
  Inbox,
  Megaphone,
  MessagesSquare,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { timeAgo } from "@/lib/format";
import type { NotificationsRow } from "@/lib/hooks/use-notifications-board";

export const TYPE_META: Record<string, { label: string; icon: typeof Bell; tone: "info" | "success" | "warning" | "danger" }> = {
  appointment: { label: "Session", icon: CalendarDays, tone: "info" },
  referral: { label: "Referral", icon: Inbox, tone: "warning" },
  announcement: { label: "News", icon: Megaphone, tone: "info" },
  chat: { label: "Chat", icon: MessagesSquare, tone: "success" },
  assessment: { label: "Check-in", icon: ClipboardList, tone: "success" },
  system: { label: "System", icon: Bell, tone: "danger" },
};

/**
 * NotificationRow — inbox row with TYPE_META icon/tone + timeAgo + mark-read.
 * Extracted verbatim from app/(staff)/notifications/page.tsx (JSX/classes unchanged).
 */
export function NotificationRow({
  notice,
  onMarkRead,
}: {
  notice: NotificationsRow;
  onMarkRead: (id: string) => void;
}) {
  const n = notice;
  // Feedback arrives as type "system" (the enum has no feedback
  // value) — present it neutrally, never with the red System badge.
  const meta =
    n.link === "/feedback"
      ? { label: "Feedback", icon: Star, tone: "info" as const }
      : (TYPE_META[n.type] ?? { label: n.type, icon: Bell, tone: "info" as const });
  const Icon = meta.icon;
  return (
    <li
      className={`flex items-start gap-3 rounded-lg px-3 py-3 transition-colors ${n.is_read ? "" : "bg-blue-50/60"}`}
    >
      <span
        aria-hidden
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          n.is_read ? "bg-ink/10 text-ink-muted" : "bg-primary-600 text-white"
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 leading-snug">
        <p className="flex flex-wrap items-center gap-2">
          <span className={`truncate text-sm ${n.is_read ? "font-semibold text-ink-soft" : "font-bold text-ink"}`}>
            {n.title}
          </span>
          <Badge tone={meta.tone}>{meta.label}</Badge>
        </p>
        {n.body && <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-ink-muted">{n.body}</p>}
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-medium text-ink-faint">
          <span>{timeAgo(n.created_at)}</span>
          {n.link && (
            <Link href={n.link} className="font-bold text-primary-600 hover:underline">
              Open
            </Link>
          )}
          {!n.is_read && (
            <button
              type="button"
              onClick={() => void onMarkRead(n.id)}
              className="inline-flex h-8 items-center rounded px-3 text-[13px] font-bold text-primary-600 transition hover:bg-blue-50 hover:underline"
            >
              Mark read
            </button>
          )}
        </p>
      </div>
      {!n.is_read && (
        <span aria-label="Unread" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary-600" />
      )}
    </li>
  );
}
