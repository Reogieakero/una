"use client";

import { Activity, Eye, LayoutGrid, List, Loader2, X } from "lucide-react";
import { Badge, Button, Card, Input } from "@/components/ui/primitives";
import { Dropdown } from "@/components/shared/dropdown";
import { HoverMenu } from "@/components/shared/hover-menu";
import { IconAction } from "@/components/shared/icon-action";
import { cn } from "@/lib/utils";
import {
  ACTION_ICON,
  PRIORITIES,
  STATUSES,
  TRIAGE_COPY,
  classificationSummary,
  nextMoves,
  priorityTone,
  referralStudentName,
  statusLabel,
  statusTone,
  type RefAction,
  type Referral,
  type TriageKind,
} from "./status";
import { ageShort, formatWhen, timeAgo, isSessionUpcoming } from "./format-helpers";
import { FOCUS_RING, useFocusRow } from "@/lib/hooks/use-focus-row";
import type { ReferralFilters } from "./use-referral-filters";

/**
 * Presentational referrals board — filters, list + grid views.
 * All data and callbacks come from props; the page owns fetching + mutations.
 */
export function ReferralsBoard({
  loading,
  role,
  isCounselor,
  canAssign,
  canReject,
  canSeeActions,
  visible,
  totalCount,
  trail,
  aliases,
  actorNames,
  facultyNames,
  counselors,
  sessionSchedule,
  escalatedAt,
  busyId,
  filters,
  canResolve,
  counselorName,
  referrerLabel,
  onAssign,
  onAskConfirm,
  onViewReason,
  onTrack,
}: {
  loading: boolean;
  role: string | null;
  isCounselor: boolean;
  canAssign: boolean;
  canReject: boolean;
  canSeeActions: boolean;
  visible: Referral[];
  totalCount: number;
  trail: Map<string, RefAction[]>;
  aliases: Map<string, string>;
  actorNames: Map<string, string>;
  facultyNames: Map<string, string>;
  counselors: { id: string; name: string }[];
  sessionSchedule: Map<string, string>;
  escalatedAt: Map<string, string>;
  busyId: string | null;
  filters: ReferralFilters;
  canResolve: (ref: Referral) => boolean;
  counselorName: (id: string | null) => string;
  referrerLabel: (r: Referral) => string;
  onAssign: (ref: Referral, counselorId: string) => void;
  onAskConfirm: (ref: Referral, to: TriageKind) => void;
  onViewReason: (ref: Referral) => void;
  onTrack: (ref: Referral) => void;
}) {
  const {
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    assigneeFilter,
    setAssigneeFilter,
    view,
    setView,
    query,
    setQuery,
    openMenuKey,
    setOpenMenuKey,
  } = filters;

  const referrerOf = (r: Referral): string => {
    if (r.referring_faculty_id) return facultyNames.get(r.referring_faculty_id) ?? "Faculty";
    return "Guidance office";
  };

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
          <div className="mt-4 animate-pulse space-y-3">
            <div className="h-12 rounded-xl bg-ink/10" />
            <div className="h-12 rounded-xl bg-ink/10" />
            <div className="h-12 rounded-xl bg-ink/10" />
            <div className="h-12 rounded-xl bg-ink/10" />
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
              <div className="flex rounded-full border border-ink/15 bg-white p-1 shadow-card" role="group" aria-label="Board layout">
                {(
                  [
                    { v: "list", label: "List", Icon: List },
                    { v: "grid", label: "Grid", Icon: LayoutGrid },
                  ] as const
                ).map(({ v, label, Icon }) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    onClick={() => setView(v)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-bold transition-colors",
                      view === v ? "bg-primary-600 text-white shadow-soft" : "text-ink-soft hover:bg-cream"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="px-4 text-xs font-medium text-ink-faint sm:px-5">
            Showing {visible.length} of {totalCount} referrals · student names stay private (aliases only).
          </p>

          {/* Board — list */}
          {view === "list" && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink/10 text-xs uppercase text-ink-muted">
                    <th className="px-4 py-3">Referred</th>
                    <th className="px-4 py-3">Session</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-center">Reason</th>
                    <th className="px-4 py-3 text-center">Track</th>
                    {canSeeActions && <th className="px-4 py-3">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => {
                    const actions = nextMoves(r.status, isCounselor);
                    // Resolve unlocks once the counselor-set session time passes.
                    const upcoming = isSessionUpcoming(sessionSchedule.get(r.id));
                    return (
                      <tr key={r.id} id={`focus-${r.id}`} className={`border-b border-ink/5 align-top last:border-0 ${focusedId === r.id ? FOCUS_RING : ""}`}>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="font-semibold">{formatWhen(r.created_at)}</span>
                          <span className="block text-[11px] font-medium text-ink-faint">{timeAgo(r.created_at)}</span>
                          {r.status === "escalated" && escalatedAt.get(r.id) && (
                            <span className="mt-1 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                              {ageShort(escalatedAt.get(r.id)!)} since escalation
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {sessionSchedule.get(r.id) ? (
                            <span className="font-semibold">{formatWhen(sessionSchedule.get(r.id)!)}</span>
                          ) : (
                            <span className="font-medium text-ink-faint">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">{referralStudentName(r, aliases)}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <Badge tone={priorityTone(r.priority)}>{statusLabel(r.priority)}</Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <IconAction label="View reason" variant="outline" icon={Eye} onClick={() => onViewReason(r)} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <IconAction label="Track referral" variant="accent" icon={Activity} onClick={() => onTrack(r)} />
                        </td>
                        {canSeeActions && (
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {/* Head: assign lives here now that the Counselor column is gone. */}
                              {canAssign && (
                                <span className="inline-flex items-center gap-1.5">
                                  <Dropdown
                                    menuKey={`ref-assign-${r.id}`}
                                    openMenuKey={openMenuKey}
                                    onOpenChange={setOpenMenuKey}
                                    value={r.assigned_counselor_id ?? ""}
                                    onChange={(v) => void onAssign(r, v)}
                                    ariaLabel={`Assign counselor for referral from ${referralStudentName(r, aliases)}`}
                                    buttonClassName="max-w-[170px] rounded-xl px-2.5 py-1.5 text-[13px]"
                                    disabled={busyId === r.id}
                                    options={[
                                      { value: "", label: "Unassigned" },
                                      ...counselors.map((c) => ({ value: c.id, label: c.name })),
                                    ]}
                                  />
                                  {busyId === r.id && (
                                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-faint" aria-label="Assigning counselor" />
                                  )}
                                </span>
                              )}
                              {/* Head: reject lives here (pending only). */}
                              {canReject && r.status === "pending" && (
                                <IconAction label="Reject" variant="outline" icon={X} disabled={busyId === r.id} onClick={() => onAskConfirm(r, "rejected")} />
                              )}
                              {canReject && r.status === "assigned" && (
                                <span className="text-xs font-medium text-ink-faint">Assigned — unassign to reject</span>
                              )}
                              {/* Counselor: assigned → confirmed → resolved / escalated (resolve after session time). */}
                              {isCounselor && r.status === "confirmed" && upcoming && (
                                <span className="text-xs font-medium text-ink-faint">Upcoming session</span>
                              )}
                              {isCounselor &&
                                !(r.status === "confirmed" && upcoming) &&
                                actions.map((s) => {
                                  if (s === "resolved" && upcoming) return null;
                                  const Icon = ACTION_ICON[s];
                                  const blocked = s === "resolved" && !canResolve(r);
                                  return (
                                    <IconAction
                                      key={s}
                                      label={blocked ? "Resolve (needs a confirmed session first)" : TRIAGE_COPY[s].ok}
                                      variant={s === "escalated" || s === "rejected" ? "outline" : "accent"}
                                      icon={Icon}
                                      disabled={busyId === r.id}
                                      onClick={() => onAskConfirm(r, s)}
                                    />
                                  );
                                })}
                              {(r.status === "resolved" || r.status === "rejected") && (
                                <span className="text-xs font-medium text-ink-faint">Terminal</span>
                              )}
                              {canReject &&
                                (r.status === "confirmed" ||
                                  r.status === "resolved" ||
                                  r.status === "escalated" ||
                                  r.status === "rejected" ||
                                  r.status === "acknowledged" ||
                                  r.status === "in_progress") && (
                                  <span className="text-xs font-medium text-ink-faint">Counselor step</span>
                                )}
                              {isCounselor && r.status === "pending" && (
                                <span className="text-xs font-medium text-ink-faint">Waiting for assignment</span>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!visible.length && (
                <p className="px-4 py-8 text-center text-sm text-ink-muted">
                  No referrals match these filters. Try clearing the search or choosing another status.
                </p>
              )}
            </div>
          )}

          {/* Board — grid cards with real labeled buttons */}
          {view === "grid" && (
            <div className="grid gap-4 p-4 sm:px-5 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((r) => {
                const history = trail.get(r.id) ?? [];
                const actions = nextMoves(r.status, isCounselor);
                // Resolve unlocks once the counselor-set session time passes.
                const upcoming = isSessionUpcoming(sessionSchedule.get(r.id));
                const showUpcoming = isCounselor && r.status === "confirmed" && upcoming;
                return (
                  <Card key={r.id} id={`focus-${r.id}`} className={`space-y-3 rounded-lg ${focusedId === r.id ? FOCUS_RING : ""}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={priorityTone(r.priority)}>{statusLabel(r.priority)}</Badge>
                      <Badge tone="info">{classificationSummary(r.case_classification)}</Badge>
                      <Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge>
                      {r.status === "escalated" && escalatedAt.get(r.id) && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                          {ageShort(escalatedAt.get(r.id)!)} since escalation
                        </span>
                      )}
                      <span className="ml-auto text-[11px] font-medium text-ink-faint">{timeAgo(r.created_at)}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-ink">{r.reason}</p>
                    <div className="grid gap-2 text-[13px] sm:grid-cols-2">
                      <p className="text-ink-muted">
                        Student <span className="font-bold text-ink">{referralStudentName(r, aliases)}</span>
                      </p>
                      <p className="text-ink-muted">
                        Referred by <span className="font-bold text-ink">{referrerOf(r)}</span>
                      </p>
                      <p className="text-ink-muted">
                        Referred <span className="font-bold text-ink">{formatWhen(r.created_at)}</span>
                      </p>
                      <p className="text-ink-muted">
                        Session{" "}
                        <span className="font-bold text-ink">
                          {sessionSchedule.get(r.id) ? formatWhen(sessionSchedule.get(r.id)!) : "—"}
                        </span>
                      </p>
                      <div className="flex items-center gap-2 text-ink-muted sm:col-span-2">
                        <span className="shrink-0">Handling</span>
                        {canAssign ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Dropdown
                              menuKey={`ref-grid-assign-${r.id}`}
                              openMenuKey={openMenuKey}
                              onOpenChange={setOpenMenuKey}
                              value={r.assigned_counselor_id ?? ""}
                              onChange={(v) => void onAssign(r, v)}
                              ariaLabel={`Assign counselor for referral from ${referralStudentName(r, aliases)}`}
                              buttonClassName="rounded-xl px-2.5 py-1.5 text-[13px]"
                              disabled={busyId === r.id}
                              options={[
                                { value: "", label: "Unassigned" },
                                ...counselors.map((c) => ({ value: c.id, label: c.name })),
                              ]}
                            />
                            {busyId === r.id && (
                              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-faint" aria-label="Assigning counselor" />
                            )}
                          </span>
                        ) : (
                          <span className="font-bold text-ink">{counselorName(r.assigned_counselor_id)}</span>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-auto px-2.5"
                          title="View reason"
                          aria-label="View reason"
                          onClick={() => onViewReason(r)}
                        >
                          <Eye className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="px-2.5"
                          title="Track referral"
                          aria-label="Track referral"
                          onClick={() => onTrack(r)}
                        >
                          <Activity className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    </div>
                    {showUpcoming ? (
                      <p className="text-xs font-medium text-ink-faint">Upcoming session</p>
                    ) : actions.length > 0 || (canReject && r.status === "pending") ? (
                      <div className="flex flex-wrap gap-2">
                        {/* Admin: assign happens in the Handling row; reject lives here (pending only). */}
                        {canReject && r.status === "pending" && (
                          <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => onAskConfirm(r, "rejected")}>
                            {TRIAGE_COPY.rejected.ok}
                          </Button>
                        )}
                        {/* Counselor: assigned → confirmed → resolved / escalated (resolve after session time). */}
                        {isCounselor &&
                          actions.map((s) => {
                            if (s === "resolved" && upcoming) return null;
                            const blocked = s === "resolved" && !canResolve(r);
                            return (
                              <Button
                                key={s}
                                size="sm"
                                variant={s === "escalated" || s === "rejected" ? "outline" : "accent"}
                                title={blocked ? "Resolve (needs a confirmed session first)" : TRIAGE_COPY[s].ok}
                                disabled={busyId === r.id}
                                onClick={() => onAskConfirm(r, s)}
                              >
                                {TRIAGE_COPY[s].ok}
                              </Button>
                            );
                          })}
                      </div>
                    ) : (
                      <p className="text-xs font-medium text-ink-faint">
                        {r.status === "pending" && isCounselor && "Waiting for assignment — the head assigns a counselor first."}
                        {r.status === "assigned" && canReject && "Assigned — unassign to reject."}
                        {(r.status === "assigned" || r.status === "confirmed" || r.status === "escalated") && !isCounselor && !canReject && "Waiting for counselor confirmation."}
                        {(r.status === "confirmed" || r.status === "escalated") && canReject && "Waiting for counselor confirmation."}
                        {(r.status === "resolved" || r.status === "rejected") && "Terminal — no further moves."}
                      </p>
                    )}
                    {history.length > 0 && (
                      <details className="rounded-xl bg-cream px-4 py-2.5 text-[13px]">
                        <summary className="cursor-pointer font-bold text-ink-soft">
                          Trail · {history.length} entr{history.length === 1 ? "y" : "ies"}
                        </summary>
                        <ul className="mt-2 space-y-1.5">
                          {history.map((h) => (
                            <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-2 text-ink-muted">
                              <span>
                                <span className="font-bold text-ink">{actorNames.get(h.actor_profile_id) ?? "Staff"}</span>
                                {" → "}
                                <span className="font-semibold">{statusLabel(h.action)}</span>
                                {h.note && <span className="italic"> — {h.note}</span>}
                              </span>
                              <span className="text-[11px] font-medium text-ink-faint">{timeAgo(h.created_at)}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </Card>
                );
              })}
              {!visible.length && (
                <Card><p className="text-center text-sm text-ink-muted">No referrals match these filters. Try clearing the search or choosing another status.</p></Card>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
