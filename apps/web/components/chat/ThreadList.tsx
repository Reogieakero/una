"use client";

import { Plus, Search } from "lucide-react";
import { Button, Input } from "@/components/ui/primitives";
import { initials, timeAgoShort } from "@/lib/format";
import type { ChatDm, ChatMsg, ChatThread } from "@/lib/hooks/use-chat-board";

export type Convo =
  | { kind: "thread"; key: string; at: string; thread: ChatThread }
  | { kind: "dm"; key: string; at: string; peer: string; last: ChatDm; unread: number };

/**
 * ThreadList — thread + DM list with search/filter.
 * Extracted verbatim from app/(staff)/chat/page.tsx (JSX/classes unchanged).
 */
export function ThreadList({
  convos,
  loading,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  isOffice,
  isFaculty,
  isCounselor,
  showThreadMobile,
  aliases,
  previews,
  staffNames,
  me,
  activeId,
  activeDm,
  openThread,
  openDm,
  needsReply,
  onNewMessage,
}: {
  convos: Convo[];
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  isOffice: boolean;
  /** Faculty inbox is DMs only — shows the compose button, hides thread pills. */
  isFaculty?: boolean;
  /** Counselors get the compose button to message faculty (threads stay). */
  isCounselor?: boolean;
  showThreadMobile: boolean;
  aliases: Map<string, { alias: string; profileId: string }>;
  previews: Map<string, ChatMsg>;
  staffNames: Map<string, string>;
  me: string | null;
  activeId: string | null;
  activeDm: string | null;
  openThread: (id: string) => void;
  openDm: (peer: string) => void;
  needsReply: (t: ChatThread) => boolean;
  onNewMessage: () => void;
}) {
  return (
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
        {(isOffice || isFaculty || isCounselor) && (
          <button
            type="button"
            onClick={onNewMessage}
            title={isFaculty ? "Message the office" : isCounselor ? "Message faculty" : "Message a counselor"}
            aria-label={isFaculty ? "Message the office" : isCounselor ? "Message faculty" : "Message a counselor"}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary-600 text-white shadow-soft transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
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
      {/* Thread open/closed pills — counselors only; the head and faculty inboxes are DMs. */}
      {!isOffice && !isFaculty && (
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
      )}
      <ul className="no-scrollbar mt-3 max-h-[52vh] space-y-1 overflow-y-auto pr-1 lg:max-h-none lg:min-h-0 lg:flex-1">
        {loading &&
          Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="flex animate-pulse items-center gap-3 rounded-lg px-2 py-2.5" aria-hidden>
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
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors ${
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
                        <span className="shrink-0 text-[11px] font-medium text-ink-faint">{timeAgoShort(c.at)}</span>
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
                  className={`flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors ${
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
                      <span className="shrink-0 text-[11px] font-medium text-ink-faint">{timeAgoShort(c.at)}</span>
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
  );
}
