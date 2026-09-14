"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowLeft, MessagesSquare, Plus, Search, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getThreadWithMessages,
  listStaffMessages,
  markStaffMessagesRead,
  sendMessage,
  sendStaffMessage,
} from "@dorsu/shared-services";
import { Badge, Button, Card, Input, Textarea } from "@/components/ui/primitives";
import { Dropdown } from "@/components/shared/dropdown";
import { notifyStaff } from "@/lib/notify";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type Thread = {
  id: string;
  student_id: string;
  counselor_id: string | null;
  appointment_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type Msg = {
  id: string;
  thread_id: string;
  sender_profile_id: string;
  body: string;
  created_at: string;
};

type Dm = {
  id: string;
  sender_profile_id: string;
  recipient_profile_id: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

type Convo =
  | { kind: "thread"; key: string; at: string; thread: Thread }
  | { kind: "dm"; key: string; at: string; peer: string; last: Dm; unread: number };

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (day === today) return "Today";
  if (day === today - 24 * 60 * 60 * 1000) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("") || "?";
}

const LAST_CHAT_KEY = "chekie.chat.last";

function readLastChat(): { threadId: string | null; dmPeer: string | null } {
  try {
    const raw = localStorage.getItem(LAST_CHAT_KEY);
    if (!raw) return { threadId: null, dmPeer: null };
    const p = JSON.parse(raw) as { threadId?: unknown; dmPeer?: unknown };
    return {
      threadId: typeof p.threadId === "string" ? p.threadId : null,
      dmPeer: typeof p.dmPeer === "string" ? p.dmPeer : null,
    };
  } catch {
    return { threadId: null, dmPeer: null };
  }
}

function writeLastChat(v: { threadId: string | null; dmPeer: string | null }) {
  try {
    localStorage.setItem(LAST_CHAT_KEY, JSON.stringify(v));
  } catch {
    // Private mode etc. — persistence is best-effort.
  }
}

/**
 * Shared /chat — one URL, role-aware UI (same pattern as /appointments).
 * Counselors read + reply on their own threads; the head supervises every
 * thread (only participants may send there) and exchanges direct messages
 * with counselors, which appear as tiles next to the threads.
 */
export default function ChatPage() {
  const [role, setRole] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [myName, setMyName] = useState("Staff");
  const [ownCounselorId, setOwnCounselorId] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [aliases, setAliases] = useState<Map<string, { alias: string; profileId: string }>>(new Map());
  const [counselorNames, setCounselorNames] = useState<Map<string, string>>(new Map());
  const [counselorProfiles, setCounselorProfiles] = useState<Map<string, string>>(new Map());
  const [previews, setPreviews] = useState<Map<string, Msg>>(new Map());
  const [dms, setDms] = useState<Dm[]>([]);
  const [staffNames, setStaffNames] = useState<Map<string, string>>(new Map());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDm, setActiveDm] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [showThreadMobile, setShowThreadMobile] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgCounselor, setMsgCounselor] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [msgBusy, setMsgBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const onMessagesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    atBottomRef.current = atBottom;
    setShowJump(!atBottom);
  };

  const jumpToLatest = () => {
    atBottomRef.current = true;
    setShowJump(false);
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  const loadList = async (r: string, cid: string | null): Promise<Thread[]> => {
    const supabase = createClient();
    let q = supabase.from("chat_threads").select("*").order("updated_at", { ascending: false }).limit(100);
    if (r === "counselor" && cid) q = q.eq("counselor_id", cid);
    const { data, error } = await q;
    if (error) throw error;
    const list = ((data ?? []) as Thread[]);
    setThreads(list);

    const studentIds = [...new Set(list.map((t) => t.student_id))];
    if (studentIds.length) {
      const { data: students } = await supabase
        .from("students")
        .select("id, profile_id, anonymous_alias")
        .in("id", studentIds.slice(0, 200));
      setAliases(
        new Map(
          ((students ?? []) as { id: string; profile_id: string; anonymous_alias: string | null }[]).map((s) => [
            s.id,
            { alias: s.anonymous_alias ?? "Student", profileId: s.profile_id },
          ])
        )
      );
    }
    const { data: counselorRows } = await supabase.from("counselors").select("id, profile_id").limit(100);
    const rows = ((counselorRows ?? []) as { id: string; profile_id: string }[]);
    if (rows.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", rows.map((c) => c.profile_id));
      const names = new Map(((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? "Counselor"]));
      setCounselorNames(new Map(rows.map((c) => [c.id, names.get(c.profile_id) ?? "Counselor"])));
      setCounselorProfiles(new Map(rows.map((c) => [c.id, c.profile_id])));
    }
    const threadIds = list.map((t) => t.id).slice(0, 100);
    if (threadIds.length) {
      const { data: recent } = await supabase
        .from("chat_messages")
        .select("id, thread_id, sender_profile_id, body, created_at")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: false })
        .limit(400);
      const latest = new Map<string, Msg>();
      for (const m of ((recent ?? []) as Msg[])) {
        if (!latest.has(m.thread_id)) latest.set(m.thread_id, m);
      }
      setPreviews(latest);
    } else {
      setPreviews(new Map());
    }
    return list;
  };

  const loadDms = async (myId: string): Promise<Dm[]> => {
    const supabase = createClient();
    const rows = ((await listStaffMessages(supabase, myId)) ?? []) as Dm[];
    setDms(rows);
    const peers = [...new Set(rows.flatMap((d) => [d.sender_profile_id, d.recipient_profile_id]))].filter(
      (id) => id !== myId
    );
    if (peers.length) {
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", peers.slice(0, 100));
      setStaffNames(
        new Map(((data ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? "Staff"]))
      );
    }
    return rows;
  };

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setMe(user.id);
        const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
        const r = (profile as { role: string } | null)?.role ?? null;
        setRole(r);
        const fullName = (profile as { full_name: string | null } | null)?.full_name;
        if (fullName) setMyName(fullName);
        let cid: string | null = null;
        if (r === "counselor") {
          const { data } = await supabase.from("counselors").select("id").eq("profile_id", user.id).single();
          cid = (data as { id: string } | null)?.id ?? null;
          setOwnCounselorId(cid);
        }
        if (r && ["counselor", "guidance_head"].includes(r)) {
          const list = await loadList(r, cid);
          const dmRows = await loadDms(user.id);
          // Return to the last open chat after a refresh (validated — stale ids are dropped).
          const last = readLastChat();
          if (last.threadId && list.some((t) => t.id === last.threadId)) {
            setActiveId(last.threadId);
            setShowThreadMobile(true);
          } else if (
            last.dmPeer &&
            last.dmPeer !== user.id &&
            dmRows.some((d) => d.sender_profile_id === last.dmPeer || d.recipient_profile_id === last.dmPeer)
          ) {
            setActiveDm(last.dmPeer);
            setShowThreadMobile(true);
          }
        }
      } catch {
        toast.error("Couldn't load chats right now.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Active thread messages + realtime.
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let alive = true;
    getThreadWithMessages(createClient(), activeId)
      .then(({ messages: ms }) => {
        if (alive) setMessages((ms ?? []) as Msg[]);
      })
      .catch(() => {});
    const ch = createClient()
      .channel(`thread-${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${activeId}` },
        (p) => {
          const row = p.new as Msg;
          setMessages((m) => (m.some((x) => x.id === row.id) ? m : [...m, row]));
          setPreviews((prev) => new Map(prev).set(activeId, row));
        }
      )
      .subscribe();
    return () => {
      alive = false;
      createClient().removeChannel(ch);
    };
  }, [activeId]);

  // Keep the thread list fresh when any new message lands.
  useEffect(() => {
    if (!role || !["counselor", "guidance_head"].includes(role)) return;
    const ch = createClient()
      .channel("chat-list")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => {
        loadList(role, ownCounselorId).catch(() => {});
      })
      .subscribe();
    return () => {
      createClient().removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, ownCounselorId]);

  // Staff DMs land live for both sides.
  useEffect(() => {
    if (!me) return;
    const ch = createClient()
      .channel("staff-dms")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "staff_messages" }, (p) => {
        const row = p.new as Dm;
        setDms((prev) => (prev.some((x) => x.id === row.id) ? prev : [row, ...prev]));
      })
      .subscribe();
    return () => {
      createClient().removeChannel(ch);
    };
  }, [me]);

  // New arrivals stick to the bottom only while already viewing the latest —
  // reading history is never yanked away.
  useEffect(() => {
    if (atBottomRef.current) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, dms]);

  // Switching conversations always lands on the latest messages.
  useEffect(() => {
    atBottomRef.current = true;
    setShowJump(false);
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [activeId, activeDm]);

  // Persist the open chat locally (skipped until first load so boot never wipes it).
  useEffect(() => {
    if (loading) return;
    writeLastChat({ threadId: activeId, dmPeer: activeDm });
  }, [activeId, activeDm, loading]);

  // Message-counselor dialog: Escape closes, background stays put while open.
  useEffect(() => {
    if (!msgOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMsgOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [msgOpen]);

  const openMessenger = () => {
    const first = [...counselorNames.keys()][0] ?? "";
    setMsgCounselor((prev) => prev || first);
    setMsgOpen(true);
  };

  const sendToCounselor = async () => {
    const body = msgBody.trim();
    if (!me || !msgCounselor || !body || msgBusy) return;
    const peerProfile = counselorProfiles.get(msgCounselor);
    if (!peerProfile) {
      toast.error("Couldn't find that counselor.");
      return;
    }
    setMsgBusy(true);
    try {
      await sendStaffMessage(createClient(), { senderProfileId: me, recipientProfileId: peerProfile, body });
      setMsgOpen(false);
      setMsgBody("");
      await loadDms(me);
      setActiveId(null);
      setMessages([]);
      setActiveDm(peerProfile);
      setShowThreadMobile(true);
      await notifyStaff([peerProfile], {
        type: "chat",
        title: `New message from ${myName}`,
        body: body.length > 140 ? `${body.slice(0, 140)}…` : body,
        link: "/chat",
      });
    } catch {
      toast.error("Couldn't deliver the message — please try again.");
    } finally {
      setMsgBusy(false);
    }
  };

  const isOffice = role === "guidance_head";

  const dmGroups = useMemo(() => {
    const byPeer = new Map<string, Dm[]>();
    for (const d of dms) {
      const peer = d.sender_profile_id === me ? d.recipient_profile_id : d.sender_profile_id;
      if (!byPeer.has(peer)) byPeer.set(peer, []);
      byPeer.get(peer)!.push(d);
    }
    return [...byPeer.entries()].map(([peer, list]) => {
      const sorted = [...list].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
      return {
        peer,
        last: sorted[sorted.length - 1],
        unread: list.filter((x) => x.recipient_profile_id === me && !x.is_read).length,
      };
    });
  }, [dms, me]);

  const convos: Convo[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out: Convo[] = [];
    for (const t of threads) {
      if (statusFilter !== "all" && t.status !== statusFilter) continue;
      const alias = aliases.get(t.student_id)?.alias ?? "";
      const cname = (t.counselor_id && counselorNames.get(t.counselor_id)) || "";
      const preview = previews.get(t.id)?.body ?? "";
      if (q && !`${alias} ${cname} ${preview}`.toLowerCase().includes(q)) continue;
      // Order by the latest message when known — thread.updated_at can lag
      // rows written before the bump trigger (00032) existed.
      const previewAt = previews.get(t.id)?.created_at;
      const at = previewAt && previewAt > t.updated_at ? previewAt : t.updated_at;
      out.push({ kind: "thread", key: `t-${t.id}`, at, thread: t });
    }
    for (const g of dmGroups) {
      const name = staffNames.get(g.peer) ?? "Staff";
      if (q && !`${name} ${g.last.body}`.toLowerCase().includes(q)) continue;
      out.push({ kind: "dm", key: `d-${g.peer}`, at: g.last.created_at, peer: g.peer, last: g.last, unread: g.unread });
    }
    return out.sort((a, b) => +new Date(b.at) - +new Date(a.at));
  }, [threads, dmGroups, search, statusFilter, aliases, counselorNames, previews, staffNames]);

  const dmHistory = useMemo(() => {
    if (!activeDm) return [];
    return dms
      .filter(
        (d) =>
          (d.sender_profile_id === me && d.recipient_profile_id === activeDm) ||
          (d.sender_profile_id === activeDm && d.recipient_profile_id === me)
      )
      .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  }, [dms, activeDm, me]);

  const active = threads.find((t) => t.id === activeId) ?? null;
  const activeAlias = active ? (aliases.get(active.student_id)?.alias ?? "Student") : "";
  const activeCounselor = active?.counselor_id ? (counselorNames.get(active.counselor_id) ?? "Counselor") : "Unassigned";
  const iAmParticipant = !!active && role === "counselor" && active.counselor_id === ownCounselorId;
  const activeDmName = activeDm ? (staffNames.get(activeDm) ?? "Staff") : "";

  const needsReply = (t: Thread): boolean => {
    if (t.status !== "open") return false;
    const last = previews.get(t.id);
    if (!last) return true;
    const studentProfile = aliases.get(t.student_id)?.profileId;
    return !!studentProfile && last.sender_profile_id === studentProfile;
  };

  const openThread = (id: string) => {
    setActiveDm(null);
    setActiveId(id);
    setShowThreadMobile(true);
  };

  const openDm = (peer: string) => {
    setActiveId(null);
    setMessages([]);
    setActiveDm(peer);
    setShowThreadMobile(true);
    if (me) {
      void markStaffMessagesRead(createClient(), { readerProfileId: me, counterpartProfileId: peer })
        .then(() =>
          setDms((prev) =>
            prev.map((d) =>
              d.sender_profile_id === peer && d.recipient_profile_id === me ? { ...d, is_read: true } : d
            )
          )
        )
        .catch(() => {});
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me || !activeId || !draft.trim() || sending) return;
    setSending(true);
    try {
      const body = draft.trim();
      const sent = (await sendMessage(createClient(), { threadId: activeId, senderProfileId: me, body })) as Msg;
      setMessages((m) => (m.some((x) => x.id === sent.id) ? m : [...m, sent]));
      setDraft("");
      const thread = threads.find((t) => t.id === activeId);
      const otherProfile = thread
        ? thread.counselor_id === ownCounselorId
          ? aliases.get(thread.student_id)?.profileId
          : counselorProfiles.get(thread.counselor_id ?? "")
        : null;
      await notifyStaff([otherProfile], {
        type: "chat",
        title: `New message from ${myName}`,
        body: body.length > 140 ? `${body.slice(0, 140)}…` : body,
        link: "/chat",
      });
    } catch {
      toast.error("Couldn't send — please try again.");
    } finally {
      setSending(false);
    }
  };

  const sendDm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me || !activeDm || !draft.trim() || sending) return;
    setSending(true);
    try {
      const body = draft.trim();
      const sent = (await sendStaffMessage(createClient(), {
        senderProfileId: me,
        recipientProfileId: activeDm,
        body,
      })) as Dm;
      setDms((prev) => (prev.some((x) => x.id === sent.id) ? prev : [sent, ...prev]));
      setDraft("");
      await notifyStaff([activeDm], {
        type: "chat",
        title: `New message from ${myName}`,
        body: body.length > 140 ? `${body.slice(0, 140)}…` : body,
        link: "/chat",
      });
    } catch {
      toast.error("Couldn't send — please try again.");
    } finally {
      setSending(false);
    }
  };

  if (!loading && (!role || !["counselor", "guidance_head"].includes(role))) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">Chat</h1>
        <Card><p className="text-sm text-ink-muted">Only counselors and the guidance head can open chat.</p></Card>
      </div>
    );
  }

  let lastDay = "";
  const showing = active ?? activeDm;

  return (
    <div className="space-y-4 lg:flex lg:h-[calc(100vh-5rem-1.5rem-1rem)] lg:flex-col lg:gap-4 lg:space-y-0 lg:overflow-hidden">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Chat</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="lg:shrink-0">
        <h1 className="font-display text-2xl font-bold">Checki chats</h1>
      </div>

      <div className="grid items-start gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Thread list */}
        <section
          aria-label="Conversations"
          className={`rounded-lg border border-ink/10 bg-white p-4 shadow-card lg:h-full lg:min-h-0 ${showThreadMobile ? "hidden lg:flex lg:flex-col" : "lg:flex lg:flex-col"}`}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-bold text-ink">
              Conversations{" "}
              <span className="ml-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-primary-700">
                {convos.length}
              </span>
            </h2>
            {isOffice && (
              <button
                type="button"
                onClick={openMessenger}
                title="Message a counselor"
                aria-label="Message a counselor"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white shadow-soft transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <Plus className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
          <div className="relative mt-3">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats…"
              aria-label="Search chats"
              className="pl-9"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {["all", "open", "closed"].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "primary" : "outline"}
                onClick={() => setStatusFilter(s)}
              >
                {s === "all" ? "All" : s === "open" ? "Open" : "Closed"}
              </Button>
            ))}
          </div>
          <ul className="no-scrollbar mt-3 max-h-[52vh] space-y-1 overflow-y-auto pr-1 lg:max-h-none lg:min-h-0 lg:flex-1">
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="flex animate-pulse items-center gap-3 rounded-xl px-2 py-2.5" aria-hidden>
                  <div className="h-10 w-10 shrink-0 rounded-full bg-ink/10" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="h-3 w-2/3 rounded-full bg-ink/10" />
                    <div className="h-3 w-full rounded-full bg-ink/10" />
                  </div>
                </li>
              ))}
            {!loading &&
              convos.map((c) => {
                if (c.kind === "thread") {
                  const t = c.thread;
                  const alias = aliases.get(t.student_id)?.alias ?? "Student";
                  const last = previews.get(t.id);
                  const flag = needsReply(t);
                  const selected = t.id === activeId;
                  return (
                    <li key={c.key}>
                      <button
                        type="button"
                        onClick={() => openThread(t.id)}
                        aria-current={selected ? "true" : undefined}
                        className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors ${
                          selected ? "bg-blue-50 ring-1 ring-blue-100" : "hover:bg-cream"
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold text-white ${
                            t.status === "open" ? "bg-primary-600" : "bg-ink/30"
                          }`}
                        >
                          {initials(alias)}
                        </span>
                        <span className="min-w-0 flex-1 leading-snug">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm font-bold text-ink">{alias}</span>
                            <span className="shrink-0 text-[11px] font-medium text-ink-faint">{timeAgo(c.at)}</span>
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5">
                            {flag && (
                              <span aria-label="Needs reply" title="Waiting on a counselor reply" className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                            )}
                            <span className="truncate text-[13px] text-ink-muted">
                              {last
                                ? `${last.sender_profile_id === me ? "You: " : ""}${last.body}`
                                : t.status === "open"
                                  ? "No messages yet."
                                  : "Closed · no messages."}
                            </span>
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                }
                const name = staffNames.get(c.peer) ?? "Staff";
                const selected = c.peer === activeDm;
                return (
                  <li key={c.key}>
                    <button
                      type="button"
                      onClick={() => openDm(c.peer)}
                      aria-current={selected ? "true" : undefined}
                      className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors ${
                        selected ? "bg-blue-50 ring-1 ring-blue-100" : "hover:bg-cream"
                      }`}
                    >
                      <span
                        aria-hidden
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink font-display text-sm font-bold text-white"
                      >
                        {initials(name)}
                      </span>
                      <span className="min-w-0 flex-1 leading-snug">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-bold text-ink">{name}</span>
                          <span className="shrink-0 text-[11px] font-medium text-ink-faint">{timeAgo(c.at)}</span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5">
                          <span className="shrink-0 rounded-full bg-ink/10 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                            Direct
                          </span>
                          <span className="truncate text-[13px] text-ink-muted">
                            {`${c.last.sender_profile_id === me ? "You: " : ""}${c.last.body}`}
                          </span>
                          {c.unread > 0 && (
                            <span aria-label={`${c.unread} unread`} className="shrink-0 rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-bold text-amber-800">
                              {c.unread}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            {!loading && !convos.length && (
              <li className="px-2 py-8 text-center text-sm text-ink-muted">
                No conversations match. Try clearing the search or filters.
              </li>
            )}
          </ul>
        </section>

        {/* Conversation */}
        <section
          aria-label={active ? `Chat with ${activeAlias}` : activeDm ? `Direct chat with ${activeDmName}` : "No chat selected"}
          className={`overflow-hidden rounded-lg border border-ink/10 bg-white shadow-card lg:h-full lg:min-h-0 ${showThreadMobile ? "flex flex-col" : "hidden lg:flex lg:flex-col"}`}
        >
          {!showing ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center px-6 py-12 text-center lg:min-h-0 lg:flex-1">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-primary-600 ring-1 ring-blue-100">
                <MessagesSquare className="h-8 w-8" aria-hidden />
              </span>
              <p className="mt-4 font-display text-lg font-bold text-ink">No chat selected</p>
              <p className="mt-1 max-w-[320px] text-sm leading-relaxed text-ink-muted">
                Select a conversation from the list to read and reply. Threads open from student sessions —
                the amber dot marks ones waiting on a counselor.
                {isOffice && " Use + to message a counselor directly."}
              </p>
            </div>
          ) : active ? (
            <>
              <div className="flex items-center gap-3 border-b border-ink/10 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setShowThreadMobile(false)}
                  aria-label="Back to conversations"
                  className="rounded-full p-1.5 text-ink-soft hover:bg-cream lg:hidden"
                >
                  <ArrowLeft className="h-5 w-5" aria-hidden />
                </button>
                <span
                  aria-hidden
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold text-white ${
                    active.status === "open" ? "bg-primary-600" : "bg-ink/30"
                  }`}
                >
                  {initials(activeAlias)}
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-[15px] font-bold text-ink">{activeAlias}</p>
                  <p className="truncate text-xs font-medium text-ink-muted">
                    {activeCounselor} · {active.status === "open" ? "Open" : "Closed"}
                  </p>
                </div>
                <Badge tone={active.status === "open" ? "success" : "info"}>{active.status === "open" ? "Open" : "Closed"}</Badge>
              </div>

              <div className="relative h-[46vh] min-h-[320px] lg:h-auto lg:min-h-0 lg:flex-1">
                <div onScroll={onMessagesScroll} className="no-scrollbar h-full space-y-3 overflow-y-auto px-4 py-4">
                {messages.map((m) => {
                  const mine = m.sender_profile_id === me;
                  const day = dayLabel(m.created_at);
                  const showDay = day !== lastDay;
                  lastDay = day;
                  return (
                    <div key={m.id}>
                      {showDay && (
                        <p className="mb-3 mt-1 text-center text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                          {day}
                        </p>
                      )}
                      <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                            mine
                              ? "rounded-br-md bg-primary-600 text-white"
                              : "rounded-bl-md bg-cream-dark text-ink"
                          }`}
                        >
                          <p>{m.body}</p>
                          <p className={`mt-1 text-right text-[10px] font-medium ${mine ? "text-white/70" : "text-ink-faint"}`}>
                            {new Date(m.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!messages.length && (
                  <p className="py-10 text-center text-sm text-ink-muted">No messages yet — say hello first.</p>
                )}
                <div ref={bottomRef} />
                </div>
                {showJump && messages.length > 0 && (
                  <button
                    type="button"
                    onClick={jumpToLatest}
                    title="Jump to latest"
                    aria-label="Jump to latest messages"
                    className="absolute bottom-4 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-ink/10 bg-white text-primary-600 shadow-card transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>

              {iAmParticipant ? (
                <form onSubmit={send} className="flex gap-2 border-t border-ink/10 px-4 py-3">
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Reply…"
                    aria-label="Reply"
                    disabled={sending}
                  />
                  <Button disabled={sending || !draft.trim()} aria-label="Send reply" className="shrink-0 px-4">
                    <Send className="h-4 w-4" aria-hidden />
                  </Button>
                </form>
              ) : (
                <p className="border-t border-ink/10 bg-cream px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
                  Supervisory view — replies come from the assigned counselor ({activeCounselor}), so this
                  conversation is read-only for you.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-ink/10 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setShowThreadMobile(false)}
                  aria-label="Back to conversations"
                  className="rounded-full p-1.5 text-ink-soft hover:bg-cream lg:hidden"
                >
                  <ArrowLeft className="h-5 w-5" aria-hidden />
                </button>
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink font-display text-sm font-bold text-white"
                >
                  {initials(activeDmName)}
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-[15px] font-bold text-ink">{activeDmName}</p>
                  <p className="truncate text-xs font-medium text-ink-muted">Direct message</p>
                </div>
                <Badge tone="info">Direct</Badge>
              </div>

              <div className="relative h-[46vh] min-h-[320px] lg:h-auto lg:min-h-0 lg:flex-1">
                <div onScroll={onMessagesScroll} className="no-scrollbar h-full space-y-3 overflow-y-auto px-4 py-4">
                {dmHistory.map((m) => {
                  const mine = m.sender_profile_id === me;
                  const day = dayLabel(m.created_at);
                  const showDay = day !== lastDay;
                  lastDay = day;
                  return (
                    <div key={m.id}>
                      {showDay && (
                        <p className="mb-3 mt-1 text-center text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                          {day}
                        </p>
                      )}
                      <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                            mine
                              ? "rounded-br-md bg-primary-600 text-white"
                              : "rounded-bl-md bg-cream-dark text-ink"
                          }`}
                        >
                          <p>{m.body}</p>
                          <p className={`mt-1 text-right text-[10px] font-medium ${mine ? "text-white/70" : "text-ink-faint"}`}>
                            {new Date(m.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
                </div>
                {showJump && dmHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={jumpToLatest}
                    title="Jump to latest"
                    aria-label="Jump to latest messages"
                    className="absolute bottom-4 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-ink/10 bg-white text-primary-600 shadow-card transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>

              <form onSubmit={sendDm} className="flex gap-2 border-t border-ink/10 px-4 py-3">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write a message…"
                  aria-label="Write a message"
                  disabled={sending}
                />
                <Button disabled={sending || !draft.trim()} aria-label="Send message" className="shrink-0 px-4">
                  <Send className="h-4 w-4" aria-hidden />
                </Button>
              </form>
            </>
          )}
        </section>
      </div>

      {/* Message-a-counselor dialog (head only) */}
      {msgOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="msg-counselor-title"
        >
          <div aria-hidden className="absolute inset-0 bg-ink/40" onClick={() => setMsgOpen(false)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-card">
            <h2 id="msg-counselor-title" className="font-display text-lg font-bold text-ink">
              Message a counselor
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              Opens a direct conversation shown right in this list.
            </p>
            <div className="mt-4 space-y-3">
              <Dropdown
                menuKey="msg-counselor"
                openMenuKey={openMenuKey}
                onOpenChange={setOpenMenuKey}
                value={msgCounselor}
                onChange={setMsgCounselor}
                ariaLabel="Choose counselor"
                options={[...counselorNames.entries()].map(([id, name]) => ({ value: id, label: name }))}
              />
              <Textarea
                rows={4}
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
                placeholder="Write your message…"
                aria-label="Message"
                maxLength={2000}
              />
              <p className="text-right text-[11px] font-medium text-ink-faint">{msgBody.trim().length}/2000</p>
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setMsgOpen(false)} autoFocus>
                Back
              </Button>
              <Button size="sm" variant="primary" disabled={msgBusy || !msgCounselor || !msgBody.trim()} onClick={sendToCounselor}>
                {msgBusy ? "Sending…" : "Send message"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
