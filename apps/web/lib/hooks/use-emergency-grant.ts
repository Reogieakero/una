"use client";

/**
 * Emergency-grant local store — persistence for the 30-minute break-glass
 * grant across full page refreshes. Extracted from
 * app/(staff)/emergency/page.tsx. The DB row stays the source of truth;
 * this store only keeps the waiting state visible while the board refetches.
 */

export type EmergencyGrant = {
  studentId: string;
  alias: string;
  expiresAt: string;
  logId: string;
  reviewed: boolean;
};

export type StoredEmergencyGrant = EmergencyGrant & { accessorId: string | null };

export const GRANT_STORAGE_KEY = "dorsu:emergency-grant";

export function isUnexpiredGrant(g: { expiresAt: string }): boolean {
  const t = new Date(g.expiresAt).getTime();
  return Number.isFinite(t) && t > Date.now();
}

export function loadStoredGrant(): StoredEmergencyGrant | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GRANT_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<StoredEmergencyGrant>;
    if (!p || typeof p.studentId !== "string" || typeof p.expiresAt !== "string" || typeof p.logId !== "string") {
      return null;
    }
    const g: StoredEmergencyGrant = {
      studentId: p.studentId,
      alias: typeof p.alias === "string" ? p.alias : "Student",
      expiresAt: p.expiresAt,
      logId: p.logId,
      reviewed: p.reviewed === true,
      accessorId: typeof p.accessorId === "string" ? p.accessorId : null,
    };
    if (!isUnexpiredGrant(g)) {
      try {
        window.localStorage.removeItem(GRANT_STORAGE_KEY);
      } catch {
        // best-effort cleanup
      }
      return null;
    }
    return g;
  } catch {
    return null;
  }
}

export function saveStoredGrant(g: EmergencyGrant, accessorId: string | null) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GRANT_STORAGE_KEY, JSON.stringify({ ...g, accessorId }));
  } catch {
    // Private mode etc. — persistence is best-effort.
  }
}

export function clearStoredGrant() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(GRANT_STORAGE_KEY);
  } catch {
    // best-effort
  }
}

export function fmtLeft(ms: number): string {
  if (ms <= 0) return "00:00";
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
