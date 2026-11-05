"use client";

import { Activity, Eye } from "lucide-react";
import { Badge, Button, Card, Input } from "@/components/ui/primitives";
import { Pager } from "@/components/shared/Pager";
import { pageRange } from "@/lib/pagination";
import { HoverMenu } from "@/components/shared/hover-menu";
import {
  PRIORITIES,
  STATUSES,
  classificationSummary,
  priorityTone,
  referralStudentName,
  statusLabel,
  statusTone,
  type Referral,
} from "./status";
import { ageShort, timeAgo } from "./format-helpers";
import { FOCUS_RING, useFocusRow } from "@/lib/hooks/use-focus-row";

/**
 * Presentational referrals board — filters plus a compact overview grid.
 * Full details and triage actions live in the ReferralDetailModal overlay;
 * the referral record (trail) opens from the card or that overlay.
 */
export function ReferralsBoard({
  loading,
  fetching = false,
  role,
  visible,
  totalApprox,
  page,
  size,
  hasMore,
  onPageChange,
  searchActive,
  aliases,
  escalatedAt,
  counselors,
  filters,
  onDetails,
  onTrack,
}: {
  loading: boolean;
  /** A page/filter fetch is in flight over cached rows — show row skeletons. */
  fetching?: boolean;
  role: string | null;
  visible: Referral[];
  totalApprox: number;
  page: number;
  size: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
  /** Free-text search filters the loaded page only (structured filters are server-side). */
  searchActive: boolean;
  aliases: Map<string, string>;
  escalatedAt: Map<string, string>;
  counselors: { id: string; name: string }[];
  // Filter state with plain setter signatures (the page wraps picks to reset
  // the pager; Dispatch setters satisfy this shape too).
  filters: {
    statusFilter: string;
    setStatusFilter: (s: string) => void;
    priorityFilter: string;
    setPriorityFilter: (p: string) => void;
    assigneeFilter: string;
    setAssigneeFilter: (a: string) => void;
    query: string;
    setQuery: (q: string) => void;
  };
  onDetails: (ref: Referral) => void;
  onTrack: (ref: Referral) => void;
}) {
  const {
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    assigneeFilter,
    setAssigneeFilter,
    query,
    setQuery,
  } = filters;

  const focusedId = useFocusRow(visible);

  return (
    <Card className="p-0">
      {loading ? (
        <div className="p-4 sm:px-5" aria-hidden>
          <div className="flex animate-pulse flex-wrap items-center gap-3">
            <div className="h-10 w-full rounded-full bg-ink/10 sm:w-56" />
            <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
              <div className="h-9 w-32 rounded-full bg-ink/10" />
              <div className="h-9 w-32 rounded-full bg-ink/10" />
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="h-40 animate-pulse rounded-lg bg-ink/10" />
            <div className="h-40 animate-pulse rounded-lg bg-ink/10" />
            <div className="h-40 animate-pulse rounded-lg bg-ink/10" />
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 p-4 sm:px-5">
            <Input
              placeholder="Search reason or student…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full sm:w-56"
            />
            <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
              <HoverMenu
                ariaLabel="Filter by status"
                buttonLabel={<>Status: {statusFilter === "all" ? "All" : statusLabel(statusFilter)}</>}
                options={["all", ...STATUSES].map((s) => ({ value: s, label: s === "all" ? "All" : statusLabel(s) }))}
                value={statusFilter}
                onPick={setStatusFilter}
              />
              <HoverMenu
                ariaLabel="Filter by priority"
                buttonLabel={
                  <>Priority: {priorityFilter === "all" ? "All" : statusLabel(priorityFilter)}</>
                }
                options={[
                  { value: "all", label: "All priorities" },
                  ...PRIORITIES.map((p) => ({ value: p, label: statusLabel(p) })),
                ]}
                value={priorityFilter}
                onPick={setPriorityFilter}
              />
              {role !== "counselor" && (
                <HoverMenu
                  ariaLabel="Filter by assignee"
                  buttonLabel={
                    <>
                      Counselor:{" "}
                      {assigneeFilter === "all"
                        ? "All"
                        : assigneeFilter === "unassigned"
                          ? "Unassigned"
                          : (counselors.find((c) => c.id === assigneeFilter)?.name ?? "All")}
                    </>
                  }
                  options={[
                    { value: "all", label: "All counselors" },
                    { value: "unassigned", label: "Unassigned only" },
                    ...counselors.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                  value={assigneeFilter}
                  onPick={setAssigneeFilter}
                />
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5">
            <p className="text-xs font-medium text-ink-faint">
              {fetching ? (
                "Loading referrals…"
              ) : (
                <>
                  Showing {pageRange(page, size, visible.length).start}–{pageRange(page, size, visible.length).end} of ~{totalApprox} referrals
                  {searchActive ? " · search matches this page only" : ""} · student names stay private (aliases only).
                </>
              )}
            </p>
          </div>

          {/* Overview cards — details and actions open in the overlay. */}
          <div className="grid gap-4 p-4 sm:px-5 md:grid-cols-2 xl:grid-cols-3">
            {fetching
              ? Array.from({ length: Math.min(Math.max(size, 3), 6) }).map((_, i) => (
                  <Card key={`referral-card-skeleton-${i}`} className="space-y-3 rounded-lg" aria-hidden>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="h-5 w-16 animate-pulse rounded-full bg-ink/10" />
                      <div className="h-5 w-24 animate-pulse rounded-full bg-ink/10" />
                      <div className="h-5 w-20 animate-pulse rounded-full bg-ink/10" />
                    </div>
                    <div className="h-4 w-3/4 animate-pulse rounded bg-ink/10" />
                    <div className="h-9 w-full animate-pulse rounded-full bg-ink/10" />
                  </Card>
                ))
              : visible.map((r) => (
                  <Card
                    key={r.id}
                    id={`focus-${r.id}`}
                    className={`flex flex-col gap-3 rounded-lg ${focusedId === r.id ? FOCUS_RING : ""}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={priorityTone(r.priority)}>{statusLabel(r.priority)}</Badge>
                      <Badge tone="info">{classificationSummary(r.case_classification)}</Badge>
                      <Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge>
                      {r.status === "escalated" && escalatedAt.get(r.id) && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">
                          {ageShort(escalatedAt.get(r.id)!)} since escalation
                        </span>
                      )}
                      <span className="ml-auto text-[11px] font-medium text-ink-faint">{timeAgo(r.created_at)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink">{referralStudentName(r, aliases)}</p>
                      <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-ink-muted">{r.reason}</p>
                    </div>
                    <div className="mt-auto flex flex-wrap gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => onDetails(r)}>
                        <Eye className="h-4 w-4" aria-hidden />
                        View details
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onTrack(r)}>
                        <Activity className="h-4 w-4" aria-hidden />
                        Referral record
                      </Button>
                    </div>
                  </Card>
                ))}
            {!fetching && !visible.length && (
              <Card><p className="text-center text-sm text-ink-muted">No referrals match these filters. Try clearing the search or choosing another status.</p></Card>
            )}
          </div>
          <Pager page={page} size={size} totalApprox={totalApprox} hasMore={hasMore} onPage={onPageChange} busy={fetching} />
        </>
      )}
    </Card>
  );
}
