"use client";

import { Badge } from "@/components/ui/primitives";

export const ROLES = ["student", "counselor", "guidance_head", "faculty"] as const;

export const ROLE_LABEL: Record<string, string> = {
  student: "Student",
  counselor: "Counselor",
  guidance_head: "Guidance head",
  faculty: "Faculty",
};

export function roleTone(r: string): "info" | "success" | "warning" | "danger" {
  if (r === "counselor") return "success";
  if (r === "guidance_head") return "warning";
  return "info";
}

/**
 * Role badge — same tone/label mapping as the former locals in
 * app/(admin)/users/page.tsx. Reuses the shared Badge primitive.
 */
export function RolePill({ role }: { role: string }) {
  return <Badge tone={roleTone(role)}>{ROLE_LABEL[role] ?? role}</Badge>;
}
