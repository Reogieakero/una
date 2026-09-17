"use client";

import { useEffect, useState } from "react";
import type { AvailabilityCounselor } from "./use-availability-board";

/**
 * Managed-counselor selection for /availability.
 * Defaults from cached board data — head starts at the first counselor,
 * counselors resolve via ownId. A valid pick survives refetches; a stale
 * one falls back instead of pointing at nobody.
 */
export function useManagedCounselor({
  ready,
  role,
  ownId,
  counselors,
}: {
  ready: boolean;
  role: string | null;
  ownId: string | null;
  counselors: AvailabilityCounselor[];
}) {
  const [managedId, setManagedId] = useState<string>("");

  useEffect(() => {
    if (!ready) return;
    setManagedId((prev) => {
      if (prev && counselors.some((c) => c.id === prev)) return prev;
      if (role === "counselor" && ownId) return ownId;
      return counselors[0]?.id ?? "";
    });
  }, [ready, counselors, role, ownId]);

  return { managedId, setManagedId };
}
