"use client";

import { Dropdown } from "@/components/shared/dropdown";

/**
 * Audit-trail entity filter.
 * Extracted verbatim from app/(admin)/security/page.tsx (same JSX/classes).
 * The openMenuKey sharing with the break-glass student dropdown stays in the
 * page and arrives via props, so menu behavior is unchanged.
 */
export function AuditEntityFilter({
  value,
  entities,
  openMenuKey,
  onOpenChange,
  onChange,
}: {
  value: string;
  entities: string[];
  openMenuKey: string | null;
  onOpenChange: (k: string | null) => void;
  onChange: (v: string) => void;
}) {
  return (
    <div className="w-full max-w-xs">
      <Dropdown
        menuKey="audit-entity"
        openMenuKey={openMenuKey}
        onOpenChange={onOpenChange}
        value={value}
        onChange={onChange}
        ariaLabel="Filter by entity"
        options={[{ value: "all", label: "All entities" }, ...entities.map((e) => ({ value: e, label: e }))]}
      />
    </div>
  );
}
