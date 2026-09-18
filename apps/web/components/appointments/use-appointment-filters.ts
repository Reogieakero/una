"use client";

import { useMemo, useState } from "react";
import type { Appt } from "./status";

/**
 * Filter state + derived stats/visible rows for the appointments board.
 * Extracted verbatim from page.tsx — same memo logic, no behavior change.
 */

/** Board tabs — regular sessions vs. sessions minted as follow-ups. */
export type AppointmentKind = "appointments" | "followups";

export function useAppointmentFilters({
  rows,
  role,
  counselorId,
  aliases,
}: {
  rows: Appt[];
  role: string | null;
  counselorId: string | null;
  aliases: Map<string, string>;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [counselorFilter, setCounselorFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<AppointmentKind>("appointments");

  const stats = useMemo(() => {
    const mine = role === "counselor" && counselorId ? rows.filter((a) => a.counselor_id === counselorId) : rows;
    return {
      total: mine.length,
      pending: mine.filter((a) => a.status === "pending").length,
      assigned: mine.filter((a) => a.status === "assigned").length,
      confirmed: mine.filter((a) => a.status === "confirmed").length,
      completed: mine.filter((a) => a.status === "completed").length,
      unassigned: mine.filter((a) => !a.counselor_id && !["completed", "cancelled", "rejected", "no_show"].includes(a.status)).length,
    };
  }, [rows, role, counselorId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((a) => (role === "counselor" && counselorId ? a.counselor_id === counselorId : true))
      .filter((a) => (statusFilter === "all" ? true : a.status === statusFilter))
      .filter((a) => (modeFilter === "all" ? true : a.mode === modeFilter))
      .filter((a) =>
        counselorFilter === "all" ? true : counselorFilter === "unassigned" ? !a.counselor_id : a.counselor_id === counselorFilter
      )
      .filter((a) =>
        !q
          ? true
          : a.concern.toLowerCase().includes(q) || (a.student_id ? (aliases.get(a.student_id) ?? "") : "walk-in").toLowerCase().includes(q)
      );
  }, [rows, role, counselorId, statusFilter, modeFilter, counselorFilter, query, aliases]);

  /** Per-tab counts under the current search/filters (stale rows count as regular). */
  const kindCounts = useMemo(
    () => ({
      appointments: filtered.filter((a) => !a.is_follow_up).length,
      followups: filtered.filter((a) => !!a.is_follow_up).length,
    }),
    [filtered]
  );

  const visible = useMemo(
    () => filtered.filter((a) => (kindFilter === "followups" ? !!a.is_follow_up : !a.is_follow_up)),
    [filtered, kindFilter]
  );

  return {
    query,
    setQuery,
    statusFilter,
    setStatusFilter,
    modeFilter,
    setModeFilter,
    counselorFilter,
    setCounselorFilter,
    kindFilter,
    setKindFilter,
    kindCounts,
    stats,
    visible,
  };
}

export type AppointmentFilters = ReturnType<typeof useAppointmentFilters>;
