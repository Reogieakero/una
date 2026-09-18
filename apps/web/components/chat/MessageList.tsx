"use client";

import { ArrowDown } from "lucide-react";
import { dayLabel } from "@/lib/format";

type MsgLike = {
  id: string;
  sender_profile_id: string;
  body: string;
  created_at: string;
};

/**
 * MessageList — messages + day dividers + jump-to-latest.
 * Extracted verbatim from app/(staff)/chat/page.tsx (JSX/classes unchanged).
 * Pass `emptyText` for the thread empty state; omit it for the DM pane
 * (the original DM pane renders no empty-state paragraph).
 */
export function MessageList({
  messages,
  me,
  bottomRef,
  showJump,
  onScroll,
  onJump,
  emptyText,
}: {
  messages: MsgLike[];
  me: string | null;
  bottomRef: React.RefObject<HTMLDivElement>;
  showJump: boolean;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  onJump: () => void;
  emptyText?: string | null;
}) {
  let lastDay = "";
  return (
    <div className="relative h-[46vh] min-h-[320px] lg:h-auto lg:min-h-0 lg:flex-1">
      <div onScroll={onScroll} className="no-scrollbar h-full space-y-3 overflow-y-auto px-4 py-4">
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
                className={`max-w-[75%] rounded-lg px-3.5 py-2 text-sm leading-relaxed ${
                  mine
                    ? "rounded-br-lg bg-primary-600 text-white"
                    : "rounded-bl-lg bg-cream-dark text-ink"
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
      {emptyText && !messages.length && (
        <p className="py-10 text-center text-sm text-ink-muted">{emptyText}</p>
      )}
      <div ref={bottomRef} />
      </div>
      {showJump && messages.length > 0 && (
        <button
          type="button"
          onClick={onJump}
          title="Jump to latest"
          aria-label="Jump to latest messages"
          className="absolute bottom-4 left-1/2 inline-flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded border border-ink/10 bg-white text-primary-600 shadow-card transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          <ArrowDown className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
