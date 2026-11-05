"use client";

import { useCallback, useState } from "react";

/** Local board filter state — search, status/priority/assignee, open menu. */
export function useReferralFilters() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);

  const resetFilters = useCallback(() => {
    setStatusFilter("all");
    setPriorityFilter("all");
    setAssigneeFilter("all");
    setQuery("");
  }, []);

  return {
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    assigneeFilter,
    setAssigneeFilter,
    query,
    setQuery,
    openMenuKey,
    setOpenMenuKey,
    resetFilters,
  };
}

export type ReferralFilters = ReturnType<typeof useReferralFilters>;
