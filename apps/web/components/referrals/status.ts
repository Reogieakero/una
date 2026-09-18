import { AlertTriangle, Check, CheckCheck, X } from "lucide-react";
import type {
  ReferralsAction,
  ReferralsRow,
} from "@/lib/hooks/use-referrals-board";

/** Board row / trail aliases — single source of truth lives in use-referrals-board. */
export type Referral = ReferralsRow;
export type RefAction = ReferralsAction;

/** Core strict flow — mirrors appointment statuses (pending → assigned →
 * confirmed → resolved, plus rejected/escalated). Legacy acknowledged /
 * in_progress rows still render under "All" but have no pill and no entry
 * buttons; they exit via counselor resolve / escalate. */
export const STATUSES = ["pending", "assigned", "confirmed", "resolved", "escalated", "rejected"] as const;
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

/**
 * Official sheet Case Classification (FM-DOrSU-GCTC-02) in paper order:
 * left column first, then right column. Keep in sync with
 * REFERRAL_CLASSIFICATIONS in @dorsu/shared-types.
 */
export const CLASSIFICATIONS = [
  "Behavioral",
  "Relational",
  "Financial",
  "Absenteeism",
  "Social Adjustment",
  "Academic-related",
  "Health",
  "Others",
] as const;

/** Left / right checkbox columns exactly as printed on the paper form. */
export const CLASSIFICATION_COLUMNS = [
  ["Behavioral", "Relational", "Financial", "Absenteeism"],
  ["Social Adjustment", "Academic-related", "Health", "Others"],
] as const;

/** "Academic-related, Health" or "Academic-related +2" for compact rows. */
export function classificationSummary(c: readonly string[] | null | undefined): string {
  const list = (c ?? []).filter(Boolean);
  if (!list.length) return "Not specified";
  if (list.length <= 2) return list.join(", ");
  return `${list.slice(0, 2).join(", ")} +${list.length - 2}`;
}

/**
 * Queue display name — privacy-safe alias for linked students, typed paper
 * name for walk-ins (no account yet), "Student" when neither resolves.
 */
export function referralStudentName(
  r: { student_id: string | null; student_name_text?: string | null },
  aliases: Map<string, string>
): string {
  if (r.student_id) return aliases.get(r.student_id) || r.student_name_text?.trim() || "Student";
  return r.student_name_text?.trim() || "Student";
}

export function statusTone(s: string): "info" | "success" | "warning" | "danger" {
  if (s === "resolved") return "success";
  if (s === "escalated" || s === "rejected") return "danger";
  if (s === "assigned" || s === "confirmed") return "info";
  return "warning";
}

export function priorityTone(p: string): "info" | "success" | "warning" | "danger" {
  if (p === "urgent") return "danger";
  if (p === "high") return "warning";
  if (p === "medium") return "info";
  return "success";
}

/** Re-exported from shared lib — do not redefine locally. */
import { statusLabel } from "@/lib/format";
export { statusLabel };

export const HEAD_LEGEND: { icon: typeof Check; label: string; desc: string; variant: "accent" | "outline" }[] = [
  { icon: Check, label: "Assign", desc: "Pending → assigned", variant: "accent" },
  { icon: X, label: "Reject", desc: "Pending → rejected", variant: "outline" },
];

export const COUNSELOR_LEGEND: { icon: typeof Check; label: string; desc: string; variant: "accent" | "outline" }[] = [
  { icon: Check, label: "Confirm", desc: "Assigned → confirmed + creates session", variant: "accent" },
  { icon: CheckCheck, label: "Resolve", desc: "Confirmed → resolved (once session time passes)", variant: "accent" },
  { icon: AlertTriangle, label: "Escalate", desc: "Flag as urgent", variant: "outline" },
];

/** Strict triage moves — assign happens in the Counselor column, never here. */
export type TriageKind = "confirmed" | "resolved" | "escalated" | "rejected";

export const TRIAGE_COPY: Record<TriageKind, { title: string; body: string; ok: string }> = {
  confirmed: { title: "Confirm and schedule this session?", body: "Set the final session date and time plus how you'll meet. Confirming creates the session itself — the student is notified with the schedule.", ok: "Confirm session" },
  resolved: { title: "Resolve this referral?", body: "Closes the loop — the student needs a confirmed session with a schedule first, and the session time must have passed. Resolve stays blocked until then. After resolving you can attach the optional confidential record (notes, images, follow-up) for the linked session.", ok: "Resolve" },
  escalated: { title: "Escalate this referral?", body: "Flags it as needing urgent attention from leadership.", ok: "Escalate" },
  rejected: { title: "Reject this referral?", body: "The referral ends as Rejected and leaves the queue. This can't be undone.", ok: "Reject referral" },
};

/**
 * Next moves per status, split by role — same split as appointments:
 * admin assigns + rejects, counselor confirms + resolves + escalates. Pending
 * items wait for assignment; assigned items wait for counselor confirmation.
 * Legacy acknowledged / in_progress only exit via counselor resolve/escalate.
 */
export const COUNSELOR_NEXT: Record<string, TriageKind[]> = {
  pending: [],
  assigned: ["confirmed", "escalated"],
  confirmed: ["resolved", "escalated"],
  escalated: ["confirmed", "resolved"],
  acknowledged: ["resolved", "escalated"],
  in_progress: ["resolved", "escalated"],
  resolved: [],
  rejected: [],
};

export const HEAD_NEXT: Record<string, TriageKind[]> = {
  pending: ["rejected"],
  assigned: [],
  acknowledged: [],
  in_progress: [],
  confirmed: [],
  escalated: [],
  resolved: [],
  rejected: [],
};

export const ACTION_ICON: Record<TriageKind, typeof Check> = {
  confirmed: Check,
  resolved: CheckCheck,
  escalated: AlertTriangle,
  rejected: X,
};

/** Shown whenever resolve is attempted without a confirmed scheduled session. */
export const NO_SESSION_MSG =
  "Resolve needs a confirmed session first — confirm the student's appointment with its schedule before closing this referral.";

/** Role-split next moves for a status — counselors confirm/resolve/escalate, heads reject. */
export function nextMoves(status: string, isCounselor: boolean): TriageKind[] {
  return isCounselor ? (COUNSELOR_NEXT[status] ?? []) : (HEAD_NEXT[status] ?? []);
}
