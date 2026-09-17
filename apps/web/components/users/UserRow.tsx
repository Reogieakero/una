"use client";

import { Badge, Button } from "@/components/ui/primitives";
import { initials } from "@/lib/format";
import type { UsersProfile } from "@/lib/hooks/use-users-board";
import { RolePill } from "./RolePill";

/**
 * One directory table row — avatar, role pill, detail, status, joined, access.
 * Extracted verbatim from app/(admin)/users/page.tsx (same JSX/classes).
 * Reuses shared lib/format initials and the RolePill mapping.
 */
export function UserRow({
  user,
  isSelf,
  busy,
  detail,
  onAccessToggle,
}: {
  user: UsersProfile;
  isSelf: boolean;
  busy: boolean;
  detail: string | undefined;
  onAccessToggle: (user: UsersProfile) => void;
}) {
  const u = user;
  return (
    <tr className="border-b border-ink/5 align-top last:border-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-600 font-display text-xs font-bold text-white"
          >
            {initials(u.full_name ?? u.email)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-bold text-ink">
              {u.full_name ?? "Unnamed"}
              {isSelf && <span className="ml-2 text-[11px] font-bold text-ink-faint">(you)</span>}
            </span>
            <span className="block truncate text-xs font-medium text-ink-muted">{u.email}</span>
          </span>
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <RolePill role={u.role} />
      </td>
      <td className="max-w-[200px] truncate px-4 py-3 text-ink-muted" title={detail ?? ""}>
        {detail ?? "—"}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-center">
        <Badge tone={u.is_active ? "success" : "danger"}>{u.is_active ? "Active" : "Deactivated"}</Badge>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
        {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        {isSelf ? (
          <span className="text-xs font-medium text-ink-faint" title="You can't change your own access">
            Locked
          </span>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onAccessToggle(u)}
          >
            {u.is_active ? "Deactivate" : "Activate"}
          </Button>
        )}
      </td>
    </tr>
  );
}
