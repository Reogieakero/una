/* ── Label maps ── */

export const APPT_STATUS: Record<string, string> = {
  pending: "Pending",
  assigned: "Assigned",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
  no_show: "No-show",
};

export const REF_STATUS: Record<string, string> = {
  pending: "Pending",
  assigned: "Assigned",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  confirmed: "Confirmed",
  resolved: "Resolved",
  escalated: "Escalated",
  rejected: "Rejected",
};

export const PRIORITY: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export function titleCase(raw: string | null | undefined): string {
  if (!raw) return "—";
  return raw
    .split("_")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function pct(part: number, whole: number): string {
  if (!whole) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

/** Privacy-safe display name: alias when known, otherwise a masked Student-XXXX code. Never a real name. */
export function aliasOrMasked(alias: string | null | undefined, id: string | null | undefined): string {
  if (alias && alias.trim()) return alias.trim();
  const tail = (id ?? "").replace(/-/g, "").slice(0, 4).toUpperCase() || "—";
  return `Student-${tail}`;
}

export function countBy(items: any[], pick: (x: any) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = pick(it) ?? "—";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}
