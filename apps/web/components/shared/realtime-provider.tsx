"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { patchBoard } from "@/lib/patch-board";
import { logEvent } from "@/lib/log-event";
import {
  NOTIFICATIONS_BOARD_KEY,
  type NotificationsBoardData,
  type NotificationsRow,
} from "@/lib/hooks/use-notifications-board";
import {
  APPOINTMENTS_BOARD_KEY,
  type AppointmentsBoardData,
  type BoardAppointment,
} from "@/lib/hooks/use-appointments-board";
import { REFERRALS_BOARD_KEY, upsertReferralRow, type ReferralsRow } from "@/lib/hooks/use-referrals-board";
import {
  ANNOUNCEMENTS_BOARD_KEY,
  type AnnouncementsBoardData,
  type AnnouncementsRow,
} from "@/lib/hooks/use-announcements-board";
import { CHAT_BOARD_KEY } from "@/lib/hooks/use-chat-board";
import { FEEDBACK_BOARD_KEY } from "@/lib/hooks/use-feedback-board";
import { SECURITY_BOARD_KEY } from "@/lib/hooks/use-security-board";

export type RealtimeConnection = "connecting" | "connected" | "reconnecting" | "disconnected";

export type BellItem = { id: string; title: string; link: string | null; created_at: string };

type RealtimeContextValue = {
  unreadCount: number;
  /** Per-link unread counts (link prefix without query string). */
  linkCounts: Map<string, number>;
  latestUnread: BellItem[];
  connection: RealtimeConnection;
  /** ISO timestamp of the last processed event (drives PR3 resync). */
  lastSeenAt: string | null;
};

const RealtimeContext = createContext<RealtimeContextValue>({
  unreadCount: 0,
  linkCounts: new Map(),
  latestUnread: [],
  connection: "connecting",
  lastSeenAt: null,
});

export function useRealtime(): RealtimeContextValue {
  return useContext(RealtimeContext);
}

/** Notification types with their own realtime surface — no toast needed. */
const SILENT_TYPES = new Set(["chat"]);

/** Burst window: same-type+link events inside it merge into one toast. */
const COALESCE_WINDOW_MS = 3000;

const COALESCE_LABEL: Record<string, string> = {
  appointment: "appointment updates",
  referral: "referral updates",
  announcement: "announcements",
  chat: "new messages",
  assessment: "assessment updates",
  system: "system updates",
};

/** Board cache to refresh in the background when an event link points at it. */
const BOARD_BY_LINK: { prefix: string; key: readonly unknown[] }[] = [
  { prefix: "/appointments", key: APPOINTMENTS_BOARD_KEY },
  { prefix: "/referrals", key: REFERRALS_BOARD_KEY },
  { prefix: "/announcements", key: ANNOUNCEMENTS_BOARD_KEY },
  { prefix: "/chat", key: CHAT_BOARD_KEY },
  { prefix: "/feedback", key: FEEDBACK_BOARD_KEY },
  { prefix: "/security", key: SECURITY_BOARD_KEY },
];

const linkKey = (link: string | null) => (link ? link.split("?")[0] : null);

type IncomingNotification = NotificationsRow & {
  type?: string | null;
  profile_id?: string;
  /** Migration 00044 — absent until deployed, defaults to success. */
  tone?: string | null;
  /** Encodes entity + event (referral:<id>:… / appt:<id>:…), when present. */
  dedupe_key?: string | null;
};

const refIdFrom = (key: string | null, prefix: string): string | null => {
  if (!key || !key.startsWith(`${prefix}:`)) return null;
  const id = key.slice(prefix.length + 1).split(":")[0];
  return id || null;
};

/**
 * App-level realtime layer — mounted ONCE in the root layout (inside
 * QueryProvider), never per-page or per-route.
 *
 * Owns exactly one Supabase channel per session (`global-notif-{uid}`,
 * INSERT + UPDATE on `notifications` filtered to the signed-in user —
 * authorization stays server-side via RLS, the filter is defense in depth).
 * On every event it ALWAYS bumps the unread context AND fires a Sonner toast
 * immediately, no matter which page is mounted. The inbox cache is patched
 * in place and the board matching the event link refreshes in the background.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [linkCounts, setLinkCounts] = useState<Map<string, number>>(new Map());
  const [latestUnread, setLatestUnread] = useState<BellItem[]>([]);
  const [connection, setConnection] = useState<RealtimeConnection>("connecting");
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);

  const uidRef = useRef<string | null>(null);
  const unreadIdsRef = useRef<Set<string>>(new Set());
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const wasConnectedRef = useRef(false);
  const hadDropRef = useRef(false);
  const coalesceRef = useRef(new Map<string, { count: number; timer: ReturnType<typeof setTimeout> }>());
  const routerRef = useRef(router);
  routerRef.current = router;

  const bumpLink = useCallback((link: string | null, delta: 1 | -1) => {
    const key = linkKey(link);
    if (!key) return;
    setLinkCounts((prev) => {
      const next = new Map(prev);
      const v = (next.get(key) ?? 0) + delta;
      if (v <= 0) next.delete(key);
      else next.set(key, v);
      return next;
    });
  }, []);

  const fetchUnread = useCallback(async (uid: string) => {
    const supabase = createClient();
    const { data, count, error } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, dedupe_key, created_at", { count: "exact" })
      .eq("profile_id", uid)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return { rows: ((data ?? []) as IncomingNotification[]), count: count ?? 0 };
  }, []);

  const applySnapshot = useCallback((rows: IncomingNotification[], count: number) => {
    unreadIdsRef.current = new Set(rows.map((r) => r.id));
    const m = new Map<string, number>();
    for (const r of rows) {
      const key = linkKey(r.link);
      if (key) m.set(key, (m.get(key) ?? 0) + 1);
    }
    setUnreadCount(count || rows.length);
    setLinkCounts(m);
    setLatestUnread(
      rows.slice(0, 5).map((r) => ({ id: r.id, title: r.title, link: r.link ?? null, created_at: r.created_at }))
    );
  }, []);

  const loadUnread = useCallback(
    async (uid: string) => {
      const { rows, count } = await fetchUnread(uid);
      applySnapshot(rows, count);
    },
    [fetchUnread, applySnapshot]
  );

  useEffect(() => {
    let alive = true;
    const supabase = createClient();
    let ch: ReturnType<typeof supabase.channel> | null = null;

    const reset = () => {
      uidRef.current = null;
      unreadIdsRef.current = new Set();
      seenEventIdsRef.current = new Set();
      wasConnectedRef.current = false;
      hadDropRef.current = false;
      for (const { timer } of coalesceRef.current.values()) clearTimeout(timer);
      coalesceRef.current.clear();
      setUnreadCount(0);
      setLinkCounts(new Map());
      setLatestUnread([]);
      setLastSeenAt(null);
      setConnection("disconnected");
      logEvent("SUBSCRIPTION_DISCONNECTED", { reason: "sign-out" });
    };

    const teardownChannel = () => {
      if (ch) {
        supabase.removeChannel(ch);
        ch = null;
      }
    };

    // Fast-path row patch — the toast and the data land together. The
    // notification's dedupe_key encodes the entity id, so one indexed fetch
    // upserts the exact row instead of waiting on a full-board refetch.
    // touchBoards still reconciles everything else (aliases, trails, stats)
    // in the background right after.
    const patchEntityRow = async (dedupeKey: string | null) => {
      const supabase = createClient();
      try {
        const referralId = refIdFrom(dedupeKey, "referral");
        if (referralId) {
          const { data } = await supabase.from("referrals").select("*").eq("id", referralId).single();
          const row = data as ReferralsRow | null;
          if (!row?.id) return;
          let alias: string | null = null;
          if (row.student_id) {
            const { data: s } = await supabase
              .from("students")
              .select("anonymous_alias")
              .eq("id", row.student_id)
              .single();
            alias = (s as { anonymous_alias: string | null } | null)?.anonymous_alias ?? null;
          }
          upsertReferralRow(qc, row, alias);
          return;
        }
        if (dedupeKey?.startsWith("appt:")) {
          const apptId = refIdFrom(dedupeKey, "appt");
          if (!apptId) return;
          const { data } = await supabase
            .from("appointments")
            .select("id, student_id, counselor_id, scheduled_at, ends_at, mode, status, concern, meeting_url")
            .eq("id", apptId)
            .single();
          const row = data as BoardAppointment | null;
          if (!row?.id) return;
          patchBoard<AppointmentsBoardData>(qc, [...APPOINTMENTS_BOARD_KEY], (prev) => ({
            ...prev,
            appointments: prev.appointments.some((a) => a.id === row.id)
              ? prev.appointments.map((a) => (a.id === row.id ? { ...a, ...row } : a))
              : [row, ...prev.appointments],
          }));
          return;
        }
        const announcementId = refIdFrom(dedupeKey, "announcement");
        if (announcementId) {
          const { data } = await supabase.from("announcements").select("*").eq("id", announcementId).single();
          const row = data as AnnouncementsRow | null;
          if (!row?.id) return;
          patchBoard<AnnouncementsBoardData>(qc, [...ANNOUNCEMENTS_BOARD_KEY], (prev) => ({
            ...prev,
            rows: prev.rows.some((r) => r.id === row.id)
              ? prev.rows.map((r) => (r.id === row.id ? { ...r, ...row } : r))
              : [row, ...prev.rows],
          }));
        }
      } catch {
        // RLS or network said no — the background invalidate still converges.
      }
    };

    const touchBoards = (link: string | null) => {
      const key = linkKey(link);
      if (!key) return;
      for (const { prefix, key: boardKey } of BOARD_BY_LINK) {
        if (key === prefix || key.startsWith(`${prefix}/`)) {
          // Background reconcile only — cached rows stay on screen (the
          // boards use keepPreviousData), so lists never flash.
          qc.invalidateQueries({ queryKey: [...boardKey] }).catch(() => {});
        }
      }
    };

    const removeUnread = (id: string, link: string | null) => {
      if (!unreadIdsRef.current.has(id)) return;
      unreadIdsRef.current.delete(id);
      setUnreadCount((c) => Math.max(0, c - 1));
      bumpLink(link, -1);
      setLatestUnread((prev) => prev.filter((x) => x.id !== id));
      patchBoard<NotificationsBoardData>(qc, [...NOTIFICATIONS_BOARD_KEY], (prev) => ({
        ...prev,
        rows: prev.rows.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      }));
    };

    const onInsert = (row: IncomingNotification) => {
      if (!row?.id || seenEventIdsRef.current.has(row.id)) return;
      seenEventIdsRef.current.add(row.id);
      if (seenEventIdsRef.current.size > 2000) seenEventIdsRef.current.clear();
      logEvent("REALTIME_EVENT_RECEIVED", { entityId: row.id, link: row.link ?? null, kind: "insert" });
      unreadIdsRef.current.add(row.id);
      setUnreadCount((c) => c + 1);
      bumpLink(row.link ?? null, 1);
      setLatestUnread((prev) =>
        prev.some((x) => x.id === row.id)
          ? prev
          : [{ id: row.id, title: row.title, link: row.link ?? null, created_at: row.created_at }, ...prev].slice(0, 5)
      );
      patchBoard<NotificationsBoardData>(qc, [...NOTIFICATIONS_BOARD_KEY], (prev) =>
        prev.rows.some((x) => x.id === row.id)
          ? prev
          : { ...prev, rows: [{ ...(row as NotificationsRow), is_read: false }, ...prev.rows] }
      );
      setLastSeenAt(row.created_at ?? new Date().toISOString());
      // Exact row first (single indexed fetch — lands with the toast), full
      // board reconcile right after (fills aliases, trails, stats).
      void patchEntityRow(row.dedupe_key ?? null).catch(() => {});
      touchBoards(row.link ?? null);
      if (!row.title?.trim()) return;
      fireToast(row);
    };

    // Toast dispatch with burst coalescing: the first event toasts at once;
    // further same-type+link events inside the window replace it with an
    // aggregate ("3 referral updates") via a stable Sonner id. Counts, badge,
    // and cache still apply per event above — only the visible toast merges.
    // Chat toasts only when the recipient isn't looking at /chat (messages
    // land live there anyway); every other type always toasts, any page.
    const fireToast = (row: IncomingNotification) => {
      const silentChat = !!row.type && SILENT_TYPES.has(row.type);
      if (silentChat) {
        const onChatPage =
          typeof window !== "undefined" && window.location.pathname.startsWith("/chat");
        if (onChatPage) return;
      }
      const key = `${row.type ?? "other"}:${linkKey(row.link) ?? "none"}`;
      const prev = coalesceRef.current.get(key);
      const count = (prev?.count ?? 0) + 1;
      if (prev) clearTimeout(prev.timer);
      const timer = setTimeout(() => {
        const cur = coalesceRef.current.get(key);
        if (cur && cur.timer === timer) coalesceRef.current.delete(key);
      }, COALESCE_WINDOW_MS);
      coalesceRef.current.set(key, { count, timer });
      const action = row.link
        ? { label: "Open", onClick: () => routerRef.current.push(row.link as string) }
        : undefined;
      const opts = {
        ...(row.body?.trim() ? { description: row.body } : {}),
        position: "top-right" as const,
        ...(action ? { action } : {}),
        id: `evt-${key}`,
        // Notification toasts auto-dismiss after 4s if the user doesn't
        // close them first. (Actor-side mutation toasts keep the global
        // 2s duration; those confirm your own action, these demand attention.)
        duration: 4000,
      };
      if (silentChat) {
        logEvent("NOTIFICATION_DELIVERED", {
          entityId: row.id,
          link: row.link ?? null,
          tone: "message",
          coalesced: count,
        });
        toast.message(count > 1 ? `${count} new messages` : row.title, opts);
        return;
      }
      const tone = row.tone === "info" || row.tone === "error" ? row.tone : "success";
      logEvent("NOTIFICATION_DELIVERED", {
        entityId: row.id,
        link: row.link ?? null,
        tone,
        coalesced: count,
      });
      const show =
        tone === "error" ? toast.error : tone === "info" ? toast.info : toast.success;
      show(
        count > 1 ? `${count} ${COALESCE_LABEL[row.type ?? ""] ?? "updates"}` : row.title,
        opts
      );
    };

    const onUpdate = (row: IncomingNotification) => {
      // Read receipts (the only UPDATE this table sees) clear the badge
      // everywhere, with no extra query — the unread set is tracked locally.
      if (!row?.id || !unreadIdsRef.current.has(row.id)) return;
      if (!row.is_read) return;
      logEvent("REALTIME_EVENT_RECEIVED", { entityId: row.id, link: row.link ?? null, kind: "update" });
      removeUnread(row.id, row.link ?? null);
      setLastSeenAt(new Date().toISOString());
    };

    // Reconnect reconcile — the DB is the source of truth, realtime is the
    // fast path. Diff current unread against the local set: missed INSERTs
    // replay through onInsert (toast + count + cache, deduped by event id),
    // rows read elsewhere are cleared, and every live board refreshes in the
    // background so no missed data change survives the drop.
    const resync = async (uid: string) => {
      let rows: IncomingNotification[];
      try {
        ({ rows } = await fetchUnread(uid));
      } catch {
        return;
      }
      if (!alive || uidRef.current !== uid) return;
      const fetched = new Set(rows.map((r) => r.id));
      const missed = rows
        .filter((r) => !unreadIdsRef.current.has(r.id))
        .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
      for (const row of missed) {
        if (!alive || uidRef.current !== uid) return;
        onInsert(row);
      }
      for (const id of [...unreadIdsRef.current]) {
        if (!fetched.has(id)) {
          const cached = qc
            .getQueryData<NotificationsBoardData>([...NOTIFICATIONS_BOARD_KEY])
            ?.rows.find((n) => n.id === id);
          removeUnread(id, cached?.link ?? null);
        }
      }
      for (const { key: boardKey } of BOARD_BY_LINK) {
        qc.invalidateQueries({ queryKey: [...boardKey] }).catch(() => {});
      }
      setLastSeenAt(new Date().toISOString());
      logEvent("SUBSCRIPTION_RECONNECTED", { missed: missed.length });
    };

    const setup = async (uid: string) => {
      if (uidRef.current === uid && ch) return;
      teardownChannel();
      uidRef.current = uid;
      setConnection("connecting");
      try {
        await loadUnread(uid);
      } catch {
        // Offline at boot — the channel still connects and later events
        // arrive live; resync on the next reconnect reconciles the gap.
      }
      if (!alive || uidRef.current !== uid) return;
      ch = supabase
        .channel(`global-notif-${uid}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `profile_id=eq.${uid}` },
          (payload) => {
            if (alive) onInsert(payload.new as IncomingNotification);
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "notifications", filter: `profile_id=eq.${uid}` },
          (payload) => {
            if (alive) onUpdate(payload.new as IncomingNotification);
          }
        )
        .subscribe((status) => {
          if (!alive) return;
          if (status === "SUBSCRIBED") {
            setConnection("connected");
            if (hadDropRef.current) {
              // Reconnected after a drop — reconcile whatever was missed.
              hadDropRef.current = false;
              wasConnectedRef.current = true;
              void resync(uid).catch(() => {});
            } else if (!wasConnectedRef.current) {
              wasConnectedRef.current = true;
              logEvent("SUBSCRIPTION_CONNECTED", { channel: `global-notif-${uid}` });
            }
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            // Supabase retries with backoff internally; resync runs on the
            // next SUBSCRIBED after a drop.
            if (wasConnectedRef.current) {
              hadDropRef.current = true;
              setConnection("reconnecting");
              logEvent("SUBSCRIPTION_RECONNECTING", { channel: `global-notif-${uid}`, status });
            } else {
              setConnection("connecting");
            }
          }
        });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      if (event === "SIGNED_OUT" || !session?.user) {
        teardownChannel();
        reset();
        return;
      }
      void setup(session.user.id).catch(() => {});
    });
    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (alive && user) void setup(user.id).catch(() => {});
        else if (alive) setConnection("disconnected");
      })
      .catch(() => {
        if (alive) setConnection("disconnected");
      });

    return () => {
      alive = false;
      subscription.unsubscribe();
      teardownChannel();
    };
    // Single mount per session — auth events drive (re)setup, never navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<RealtimeContextValue>(
    () => ({ unreadCount, linkCounts, latestUnread, connection, lastSeenAt }),
    [unreadCount, linkCounts, latestUnread, connection, lastSeenAt]
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
