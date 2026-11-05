"use client";

import { Loader2 } from "lucide-react";
import { PAGE_SIZES } from "@/lib/pagination";
import { cn } from "@/lib/utils";

/**
 * Shared numbered pager (plan pilot: referrals first, then appointments,
 * students, feedback, security, users). Page numbers bound by the
 * approximate total; Prev/Next clamp at the edges. hasMore=false hides
 * forward motion past the last known page.
 *
 * `busy` is the canonical "page/filter change in flight" state: controls are
 * disabled, `aria-busy` is set, and a small inline spinner replaces the
 * dead space — the rows above stay visible (keepPreviousData), so the page
 * never blanks during pagination.
 */
export function Pager({
  page,
  size,
  totalApprox,
  hasMore,
  onPage,
  busy = false,
}: {
  page: number;
  size: number;
  totalApprox: number;
  hasMore: boolean;
  onPage: (page: number) => void;
  busy?: boolean;
}) {
  const approxPages = Math.max(1, Math.ceil(totalApprox / size));
  // Compact window around the current page (bounded by the approx total).
  const nums: number[] = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(approxPages, page + 2); p++) nums.push(p);
  if (nums[0] > 1) nums.unshift(1);
  if (nums[nums.length - 1] < approxPages && hasMore) nums.push(approxPages);
  return (
    <nav
      aria-label="Pagination"
      aria-busy={busy || undefined}
      className="flex flex-wrap items-center justify-center gap-1.5 px-4 py-4 sm:px-5"
    >
      <span className="inline-flex w-16 items-center justify-start gap-1.5 text-[11px] font-bold text-ink-faint">
        {busy ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            <span className="sr-only">Loading page</span>
          </>
        ) : (
          !hasMore && <span className="w-16" aria-hidden />
        )}
      </span>
      <button
        type="button"
        disabled={busy || page <= 1}
        onClick={() => onPage(page - 1)}
        aria-label="Previous page"
        className="rounded-full px-3.5 py-1.5 text-[13px] font-bold text-ink-soft transition hover:bg-cream disabled:opacity-40"
      >
        Prev
      </button>
      {nums.map((p) => (
        <button
          key={p}
          type="button"
          disabled={busy}
          onClick={() => onPage(p)}
          aria-label={`Page ${p}`}
          aria-current={p === page ? "page" : undefined}
          className={cn(
            "min-w-[2rem] rounded-full px-2.5 py-1.5 text-[13px] font-bold transition disabled:opacity-60",
            p === page ? "bg-primary-600 text-white" : "text-ink-soft hover:bg-cream"
          )}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        disabled={busy || !hasMore}
        onClick={() => onPage(page + 1)}
        aria-label="Next page"
        className="rounded-full px-3.5 py-1.5 text-[13px] font-bold text-ink-soft transition hover:bg-cream disabled:opacity-40"
      >
        Next
      </button>
    </nav>
  );
}

/** Page-size picker (10/25/50, max 50 enforced). */
export function PageSize({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (size: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs font-bold text-ink-soft">
      Per page
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Rows per page"
        className="rounded-full border border-ink/15 bg-white px-2.5 py-1.5 text-[13px] font-bold text-ink disabled:opacity-50"
      >
        {PAGE_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </label>
  );
}
