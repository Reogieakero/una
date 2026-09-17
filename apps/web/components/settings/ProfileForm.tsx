"use client";

import { Badge, Button, Input } from "@/components/ui/primitives";
import { initials } from "@/lib/format";

/**
 * Profile header card — avatar, role/joined line, completeness bar,
 * and the inline name/email edit fields.
 * Extracted verbatim from app/(staff)/settings/page.tsx (same JSX/classes).
 * All state and mutations stay in the page; this is presentational only.
 */
export function ProfileForm({
  loading,
  fullName,
  email,
  roleLabel,
  isHead,
  officeLocation,
  joined,
  completeness,
  editing,
  saving,
  onFullNameChange,
  onEditToggle,
}: {
  loading: boolean;
  fullName: string;
  email: string;
  roleLabel: string;
  isHead: boolean;
  officeLocation: string;
  joined: string;
  completeness: number;
  editing: boolean;
  saving: string | null;
  onFullNameChange: (v: string) => void;
  onEditToggle: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-ink/10 bg-white shadow-card">
      <div aria-hidden className="h-24 bg-gradient-to-r from-primary-700 via-primary-600 to-accent-400" />
      <div className="px-5 pb-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="-mt-10 flex items-end gap-3">
            <span
              aria-hidden
              className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-600 font-display text-2xl font-bold text-white ring-4 ring-white"
            >
              {loading ? "?" : initials(fullName || email)}
            </span>
            <div className="pb-1 leading-tight">
              <p className="font-display text-xl font-bold text-ink">{loading ? "…" : fullName || "Unnamed"}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] font-medium text-ink-muted">
                <Badge tone={isHead ? "warning" : "info"}>{loading ? "…" : roleLabel}</Badge>
                {isHead && <span>{officeLocation || "—"}</span>}
                {joined && <span>· Joined {new Date(joined).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>}
              </p>
            </div>
          </div>
          <Button size="sm" variant={editing ? "ghost" : "outline"} onClick={onEditToggle} disabled={saving === "profile"}>
            {saving === "profile" ? "Saving…" : editing ? "Done" : "Edit profile"}
          </Button>
        </div>
        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[13px] font-bold text-ink">Profile complete</p>
            <p className="font-display text-sm font-bold text-primary-700">{completeness}%</p>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuenow={completeness} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completeness">
            <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${completeness}%` }} />
          </div>
        </div>
        {editing && (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-ink-muted" htmlFor="settings-name">Full name</label>
              <Input id="settings-name" value={fullName} onChange={(e) => onFullNameChange(e.target.value)} autoComplete="name" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-ink-muted">Email (managed by Auth)</label>
              <Input value={email} disabled />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * About card — read-only profile directory rows.
 * Extracted verbatim from the overview tab in app/(staff)/settings/page.tsx.
 */
export function ProfileAbout({
  loading,
  fullName,
  roleLabel,
  email,
  isHead,
  officeName,
  officeLocation,
  officeContact,
}: {
  loading: boolean;
  fullName: string;
  roleLabel: string;
  email: string;
  isHead: boolean;
  officeName: string;
  officeLocation: string;
  officeContact: string;
}) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
      <h2 className="font-display text-base font-bold text-ink">About</h2>
      {loading ? (
        <div className="animate-pulse space-y-2 pt-3" aria-hidden>
          <div className="h-4 rounded-full bg-ink/10" />
          <div className="h-4 w-2/3 rounded-full bg-ink/10" />
        </div>
      ) : (
        <dl className="mt-3 divide-y divide-ink/10 text-sm">
          {[
            ["Name", fullName || "—"],
            ["Role", roleLabel],
            ["Email", email || "—"],
            ...(isHead
              ? [
                  ["Office", officeName || "—"],
                  ["Location", officeLocation || "—"],
                  ["Contact", officeContact || "—"],
                ]
              : []),
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <dt className="font-medium text-ink-muted">{k}</dt>
              <dd className="truncate font-bold text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
