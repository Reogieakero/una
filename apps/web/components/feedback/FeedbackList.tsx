"use client";

import { HoverMenu } from "@/components/shared/hover-menu";
import { Card, Input } from "@/components/ui/primitives";
import { timeAgo } from "@/lib/format";

export type Feedback = {
  id: string;
  appointment_id: string;
  student_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type FeedbackContext = { concern: string; counselor: string; when: string };

export function stars(r: number) {
  return (
    <span className="text-sm font-bold tracking-tight" aria-label={`${r} out of 5 stars`}>
      <span className="text-amber-500">{"★".repeat(r)}</span>
      <span className="text-ink/20">{"★".repeat(Math.max(0, 5 - r))}</span>
    </span>
  );
}

/**
 * Needs follow-up — 1–2★ ratings. Extracted verbatim from page.tsx.
 */
export function FollowUpList({
  loading,
  low,
  totalCount,
  aliases,
  contexts,
  isCounselor,
}: {
  loading: boolean;
  low: Feedback[];
  totalCount: number;
  aliases: Map<string, string>;
  contexts: Map<string, FeedbackContext>;
  isCounselor: boolean;
}) {
  return (
    <section className="rounded-lg border border-red-200 bg-red-50/50 p-5 shadow-card">
      <h2 className="font-display text-base font-bold text-ink">Needs follow-up</h2>
      <p className="mt-0.5 text-[13px] text-ink-muted">1–2★ ratings — reach out while it&apos;s fresh.</p>
      {loading ? (
        <div className="animate-pulse space-y-3 pt-3" aria-hidden>
          <div className="h-10 rounded-xl bg-ink/10" />
          <div className="h-10 rounded-xl bg-ink/10" />
        </div>
      ) : low.length ? (
        <ul className="mt-3 max-h-[260px] divide-y divide-red-100 overflow-y-auto">
          {low.slice(0, 8).map((f) => {
            const ctx = contexts.get(f.appointment_id);
            return (
              <li key={f.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  {stars(f.rating)}
                  <span className="text-[11px] font-medium text-ink-faint">{timeAgo(f.created_at)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-soft">
                  {f.comment?.trim() || "No written comment."}
                </p>
                <p className="mt-1 text-xs font-medium text-ink-muted">
                  {aliases.get(f.student_id) ?? "Student"}
                  {ctx ? (isCounselor ? ` · ${ctx.concern.slice(0, 48)}` : ` · ${ctx.counselor} · ${ctx.concern.slice(0, 48)}`) : ""}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[13px] text-ink-muted">
          {totalCount ? "No low ratings — nothing to chase." : "No ratings yet."}
        </p>
      )}
    </section>
  );
}

/**
 * Recent feedback — filters live inside, above the list.
 * Extracted verbatim from page.tsx.
 */
export function FeedbackList({
  loading,
  visible,
  rowsLength,
  query,
  setQuery,
  sentimentFilter,
  setSentimentFilter,
  aliases,
  contexts,
  isCounselor,
}: {
  loading: boolean;
  visible: Feedback[];
  rowsLength: number;
  query: string;
  setQuery: (v: string) => void;
  sentimentFilter: string;
  setSentimentFilter: (v: string) => void;
  aliases: Map<string, string>;
  contexts: Map<string, FeedbackContext>;
  isCounselor: boolean;
}) {
  return (
    <Card className="p-0">
      <h2 className="px-4 pt-4 font-display text-base font-bold text-ink sm:px-5">Recent feedback</h2>
      <div className="flex flex-wrap items-center gap-3 p-4 sm:px-5">
        <Input
          placeholder={isCounselor ? "Search comments, students…" : "Search comments, students, counselors…"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full sm:w-56"
        />
        <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
          <HoverMenu
            ariaLabel="Filter by sentiment"
            align="right"
            buttonLabel={
              <>
                Sentiment:{" "}
                {sentimentFilter === "all"
                  ? "All"
                  : sentimentFilter === "positive"
                    ? "Positive"
                    : sentimentFilter === "neutral"
                      ? "Neutral"
                      : "Negative"}
              </>
            }
            options={[
              { value: "all", label: "All" },
              { value: "positive", label: "Positive 4–5★" },
              { value: "neutral", label: "Neutral 3★" },
              { value: "negative", label: "Negative 1–2★" },
            ]}
            value={sentimentFilter}
            onPick={setSentimentFilter}
          />
        </div>
      </div>
      <div className="px-4 pb-4 sm:px-5">
      {loading ? (
        <div className="animate-pulse space-y-3 pt-4" aria-hidden>
          <div className="h-16 rounded-xl bg-ink/10" />
          <div className="h-16 rounded-xl bg-ink/10" />
        </div>
      ) : visible.length ? (
        <ul className="mt-3 divide-y divide-ink/10">
          {visible.map((f) => {
            const ctx = contexts.get(f.appointment_id);
            return (
              <li key={f.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  {stars(f.rating)}
                  <span className="text-[11px] font-medium text-ink-faint">
                    {aliases.get(f.student_id) ?? "Student"} · {timeAgo(f.created_at)}
                  </span>
                </div>
                {f.comment?.trim() && (
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{f.comment}</p>
                )}
                {ctx && (
                  <p className="mt-1 truncate text-xs font-medium text-ink-muted">
                    {isCounselor ? ctx.concern : `${ctx.counselor} · ${ctx.concern}`}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-center text-[13px] text-ink-muted">
          {rowsLength ? "No feedback matches these filters." : "No feedback yet — ratings appear here after completed sessions."}
        </p>
      )}
      </div>
    </Card>
  );
}
