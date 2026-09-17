"use client";

import { CalendarClock, Check, CheckCheck, Loader2, UserX, Video, X } from "lucide-react";
import { Badge, Input } from "@/components/ui/primitives";
import { Dropdown } from "@/components/shared/dropdown";
import { HoverMenu } from "@/components/shared/hover-menu";
import { IconAction } from "@/components/shared/icon-action";
import { FOCUS_RING, useFocusRow } from "@/lib/hooks/use-focus-row";
import { formatWhen, isUpcomingSession, statusLabel, statusTone, STATUSES } from "./status";
import type { ActionKind, Appt, CounselorOpt } from "./status";

/**
 * Board — filters live inside, above the student table.
 * Extracted verbatim from page.tsx (table + Meet-URL logic unchanged).
 */
export function AppointmentsBoard({
  visible,
  loading,
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
  modeFilter,
  setModeFilter,
  counselorFilter,
  setCounselorFilter,
  counselors,
  aliases,
  role,
  busyId,
  canAssign,
  canReject,
  isCounselor,
  canSeeActions,
  counselorName,
  openMenuKey,
  setOpenMenuKey,
  onAssign,
  onDetail,
  onConfirming,
}: {
  visible: Appt[];
  loading: boolean;
  query: string;
  setQuery: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  modeFilter: string;
  setModeFilter: (v: string) => void;
  counselorFilter: string;
  setCounselorFilter: (v: string) => void;
  counselors: CounselorOpt[];
  aliases: Map<string, string>;
  role: string | null;
  busyId: string | null;
  canAssign: boolean;
  canReject: boolean;
  isCounselor: boolean;
  canSeeActions: boolean;
  counselorName: (id: string | null) => string;
  openMenuKey: string | null;
  setOpenMenuKey: (k: string | null) => void;
  onAssign: (appt: Appt, counselorId: string | null) => void;
  onDetail: (appt: Appt) => void;
  onConfirming: (v: { appt: Appt; kind: ActionKind }) => void;
}) {
  const focusedId = useFocusRow(visible);
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 p-4 sm:px-5">
        <Input
          placeholder="Search concern or student alias…"
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
          ariaLabel="Filter by mode"
          buttonLabel={
            <>Mode: {modeFilter === "all" ? "All" : modeFilter === "in_person" ? "In person" : "Online"}</>
          }
          options={[
            { value: "all", label: "All modes" },
            { value: "in_person", label: "In person" },
            { value: "online", label: "Online" },
          ]}
          value={modeFilter}
          onPick={setModeFilter}
        />
        {role !== "counselor" && (
          <HoverMenu
            ariaLabel="Filter by counselor"
            align="right"
            buttonLabel={
              <>
                Counselor:{" "}
                {counselorFilter === "all"
                  ? "All"
                  : counselorFilter === "unassigned"
                    ? "Unassigned"
                    : (counselors.find((c) => c.id === counselorFilter)?.name ?? "All")}
              </>
            }
            options={[
              { value: "all", label: "All counselors" },
              { value: "unassigned", label: "Unassigned only" },
              ...counselors.map((c) => ({ value: c.id, label: c.name })),
            ]}
            value={counselorFilter}
            onPick={setCounselorFilter}
          />
        )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
        <thead>
          <tr className="border-b border-ink/10 text-xs uppercase text-ink-muted">
            <th className="px-4 py-3">When</th>
            <th className="px-4 py-3">Student</th>
            <th className="px-4 py-3">Counselor</th>
            <th className="px-4 py-3">Mode</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Concern</th>
            {canSeeActions && <th className="px-4 py-3">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {visible.map((a) => (
            <tr
              key={a.id}
              id={`focus-${a.id}`}
              onClick={() => onDetail(a)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onDetail(a);
                }
              }}
              tabIndex={0}
              title="View session details"
              aria-label={`View details for the session on ${formatWhen(a.scheduled_at)}`}
              className={`cursor-pointer border-b border-ink/5 align-top transition-colors last:border-0 hover:bg-cream/60 focus-visible:outline-none focus-visible:bg-cream ${focusedId === a.id ? FOCUS_RING : ""}`}
            >
              <td className="whitespace-nowrap px-4 py-3 font-semibold">{formatWhen(a.scheduled_at)}</td>
              <td className="whitespace-nowrap px-4 py-3">{a.student_id ? (aliases.get(a.student_id) ?? "Student") : "Walk-in"}</td>
              <td
                className="px-4 py-3"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {canAssign ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Dropdown
                      menuKey={`assign-${a.id}`}
                      openMenuKey={openMenuKey}
                      onOpenChange={setOpenMenuKey}
                      value={a.counselor_id ?? ""}
                      onChange={(v) => onAssign(a, v || null)}
                      ariaLabel={`Assign counselor for session ${formatWhen(a.scheduled_at)}`}
                      buttonClassName="max-w-[170px] rounded-xl px-2.5 py-1.5 text-[13px]"
                      disabled={busyId === a.id}
                      options={[
                        { value: "", label: "Unassigned" },
                        ...counselors.map((c) => ({ value: c.id, label: c.name })),
                      ]}
                    />
                    {busyId === a.id && (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-faint" aria-label="Assigning counselor" />
                    )}
                  </span>
                ) : (
                  <span className="whitespace-nowrap">{counselorName(a.counselor_id)}</span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                {a.mode === "online" ? "Online" : "In person"}
                {a.mode === "online" && a.meeting_url && (
                  <a
                    href={a.meeting_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800 transition-colors hover:bg-blue-200"
                    aria-label={`Join the Google Meet for the session on ${formatWhen(a.scheduled_at)}`}
                  >
                    <Video className="h-3 w-3" aria-hidden />
                    Join Meet
                  </a>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <Badge tone={statusTone(a.status)}>{statusLabel(a.status)}</Badge>
              </td>
              <td className="max-w-[220px] truncate px-4 py-3" title={a.concern}>{a.concern}</td>
              {canSeeActions && (
                <td
                  className="px-4 py-3"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <div className="flex flex-wrap gap-1.5">
                    {/* Admin: assign happens in the Counselor column; reject lives here (pending only). */}
                    {canReject && a.status === "pending" && (
                      <IconAction label="Reject" variant="outline" icon={X} disabled={busyId === a.id} onClick={() => onConfirming({ appt: a, kind: "reject" })} />
                    )}
                    {canReject && a.status === "assigned" && (
                      <span className="text-xs font-medium text-ink-faint">Assigned — unassign to reject</span>
                    )}
                    {/* Counselor: assigned → confirmed → completed / no-show (after session time). */}
                    {isCounselor && a.status === "assigned" && (
                      <IconAction label="Confirm" variant="accent" icon={Check} disabled={busyId === a.id} onClick={() => onConfirming({ appt: a, kind: "confirm" })} />
                    )}
                    {isCounselor && (a.status === "assigned" || (a.status === "confirmed" && isUpcomingSession(a.scheduled_at))) && (
                      <IconAction label="Reschedule" variant="outline" icon={CalendarClock} disabled={busyId === a.id} onClick={() => onConfirming({ appt: a, kind: "reschedule" })} />
                    )}
                    {isCounselor && a.status === "confirmed" && isUpcomingSession(a.scheduled_at) && (
                      <span className="text-xs font-medium text-ink-faint">Upcoming session</span>
                    )}
                    {isCounselor && a.status === "confirmed" && !isUpcomingSession(a.scheduled_at) && (
                      <>
                        <IconAction label="Complete" variant="accent" icon={CheckCheck} disabled={busyId === a.id} onClick={() => onConfirming({ appt: a, kind: "complete" })} />
                        <IconAction label="No-show" variant="outline" icon={UserX} disabled={busyId === a.id} onClick={() => onConfirming({ appt: a, kind: "no-show" })} />
                      </>
                    )}
                    {(a.status === "completed" || a.status === "cancelled" || a.status === "rejected" || a.status === "no_show") && (
                      <span className="text-xs font-medium text-ink-faint">Terminal</span>
                    )}
                    {canReject && (a.status === "confirmed" || a.status === "completed" || a.status === "cancelled" || a.status === "rejected" || a.status === "no_show") && (
                      <span className="text-xs font-medium text-ink-faint">Counselor / student step</span>
                    )}
                    {isCounselor && a.status === "pending" && (
                      <span className="text-xs font-medium text-ink-faint">Waiting for assignment</span>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {!loading && !visible.length && (
        <p className="px-4 py-8 text-center text-sm text-ink-muted">
          No sessions match these filters. Try clearing the search or choosing another status.
        </p>
      )}
      {loading && (
        <div className="animate-pulse space-y-3 p-4" aria-hidden>
          <div className="h-10 rounded-xl bg-ink/10" />
          <div className="h-10 rounded-xl bg-ink/10" />
          <div className="h-10 rounded-xl bg-ink/10" />
        </div>
      )}
    </>
  );
}
