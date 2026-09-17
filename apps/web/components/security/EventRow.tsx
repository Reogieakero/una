"use client";

import { Badge } from "@/components/ui/primitives";
import { timeAgo } from "@/lib/format";

export type GlassLog = {
  id: string;
  accessor_profile_id: string;
  student_id: string;
  justification: string;
  accessed_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

/**
 * One break-glass access event row.
 * Shared by app/(admin)/security/page.tsx ("preview": line-clamp-2, py-2.5)
 * and app/(admin)/security/events/page.tsx ("full": leading-relaxed, py-3).
 * The variant switch keeps both pages' original JSX/classes pixel-identical;
 * security-sensitive review logic stays in the pages and arrives via onMarkReviewed.
 * Reuses shared timeAgo.
 */
export function EventRow({
  log,
  accessorName,
  studentAlias,
  reviewerName,
  busy,
  variant,
  onMarkReviewed,
}: {
  log: GlassLog;
  accessorName: string | undefined;
  studentAlias: string | undefined;
  reviewerName: string | undefined;
  busy: boolean;
  variant: "preview" | "full";
  onMarkReviewed: (log: GlassLog) => void;
}) {
  const compact = variant === "preview";
  return (
    <li className={compact ? "py-2.5 first:pt-0 last:pb-0" : "py-3 first:pt-0 last:pb-0"}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={log.reviewed_at ? "success" : "danger"}>
          {log.reviewed_at ? "Reviewed" : "Unreviewed"}
        </Badge>
        <span className="text-[11px] font-medium text-ink-faint">{timeAgo(log.accessed_at)}</span>
        {!log.reviewed_at && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onMarkReviewed(log)}
            className="ml-auto text-[13px] font-bold text-primary-600 hover:underline disabled:opacity-50"
          >
            Mark reviewed
          </button>
        )}
      </div>
      <p className="mt-1 text-sm font-bold text-ink">
        {accessorName ?? "Staff"}
        <span className="font-medium text-ink-muted"> opened </span>
        {studentAlias ?? "Student"}
      </p>
      <p className={compact ? "mt-0.5 line-clamp-2 text-[13px] text-ink-muted" : "mt-0.5 text-[13px] leading-relaxed text-ink-muted"}>{log.justification}</p>
      {log.reviewed_at && (
        <p className="mt-0.5 text-[11px] font-medium text-ink-faint">
          Reviewed by {reviewerName ?? "Head"} · {timeAgo(log.reviewed_at)}
        </p>
      )}
    </li>
  );
}
