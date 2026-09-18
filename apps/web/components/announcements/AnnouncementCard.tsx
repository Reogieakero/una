"use client";

import { timeAgoWithDate, initials } from "@/lib/format";
import { Badge, Button } from "@/components/ui/primitives";

export type Announcement = {
  id: string;
  author_profile_id: string;
  title: string;
  body: string;
  audience: string[] | null;
  image_url: string | null;
  published_at: string | null;
  created_at: string;
};

export function statusOf(a: Announcement, now: number): "published" | "draft" | "scheduled" {
  if (!a.published_at) return "draft";
  return new Date(a.published_at).getTime() <= now ? "published" : "scheduled";
}

export function statusTone(s: string): "success" | "warning" | "info" {
  if (s === "published") return "success";
  if (s === "scheduled") return "info";
  return "warning";
}

export function audienceLabel(a: string[] | null): string {
  if (!a || !a.length) return "Everyone";
  const names: Record<string, string> = { student: "Students", counselor: "Counselors", faculty: "Faculty", guidance_head: "Head" };
  return a.map((r) => names[r] ?? r).join(", ");
}

/**
 * Single newsfeed post — extracted verbatim from page.tsx.
 * Page owns publishing/mutations; this is pure presentation.
 */
export function AnnouncementCard({
  a,
  now,
  authorName,
  isHead,
  busyId,
  onPublish,
  onUnpublish,
  onDelete,
  focused,
}: {
  a: Announcement;
  now: number;
  authorName: string;
  isHead: boolean;
  busyId: string | null;
  onPublish: (a: Announcement) => void;
  onUnpublish: (a: Announcement) => void;
  onDelete: (a: Announcement) => void;
  focused?: boolean;
}) {
  const st = statusOf(a, now);
  return (
    <article key={a.id} id={`focus-${a.id}`} className={`rounded-lg border border-ink/10 bg-white p-5 shadow-card ${focused ? "ring-2 ring-primary-500 ring-offset-2 ring-offset-white scroll-mt-24" : ""}`}>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-600 font-display text-sm font-bold text-white"
        >
          {initials(authorName)}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-bold text-ink">{authorName}</p>
          <p className="truncate text-xs font-medium text-ink-muted">
            {timeAgoWithDate(a.published_at ?? a.created_at)} · {audienceLabel(a.audience)}
          </p>
        </div>
        {st !== "published" && <Badge tone={statusTone(st)}>{st === "draft" ? "Draft" : "Scheduled"}</Badge>}
      </div>
      <h2 className="mt-3 font-display text-base font-bold text-ink">{a.title}</h2>
      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{a.body}</p>
      {a.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={a.image_url}
          alt=""
          loading="lazy"
          className="mt-3 max-h-96 w-full rounded-lg border border-ink/10 object-cover"
        />
      )}
      {isHead && (
      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-ink/10 pt-3">
        {st !== "published" && (
          <Button size="sm" variant="accent" disabled={busyId === `pub-${a.id}`} onClick={() => onPublish(a)}>
            Publish
          </Button>
        )}
        {st === "published" && (
          <Button size="sm" variant="outline" disabled={busyId === `unpub-${a.id}`} onClick={() => onUnpublish(a)}>
            Unpublish
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={busyId === a.id} onClick={() => onDelete(a)}>
          Delete
        </Button>
      </div>
      )}
    </article>
  );
}
