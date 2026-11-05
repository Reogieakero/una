"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuditTrail, AUDIT_TRAIL_PAGE_SIZE } from "@/lib/hooks/use-audit-trail";
import { useClearSectionBadge } from "@/lib/hooks/use-clear-section-badge";
import { formatWhen, timeAgo } from "@/lib/format";
import { Button, Card, Input } from "@/components/ui/primitives";
import { Dropdown } from "@/components/shared/dropdown";
import { Pager } from "@/components/shared/Pager";

const ROLE_LABEL: Record<string, string> = {
  student: "Student",
  counselor: "Counselor",
  guidance_head: "Guidance head",
  faculty: "Faculty",
  guidance_personnel: "Guidance personnel",
  admin: "Admin",
};

function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role.replace(/_/g, " ");
}

/**
 * Head-only full audit trail.
 *
 * The security console shows a short preview; this page pages through every
 * append-only `audit_logs` row and resolves the actor, so the office can
 * answer "who changed what, and exactly when" for the whole system.
 */
export default function AuditTrailPage() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState("all");
  const [action, setAction] = useState("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);

  // Keystroke-friendly: only query after the typist pauses.
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isFetching, isError, refetch } = useAuditTrail({
    page,
    entity,
    action,
    query,
  });

  useClearSectionBadge("/security", !!data);

  useEffect(() => {
    if (isError) toast.error("Couldn't load the audit trail right now.");
  }, [isError]);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const filtered = entity !== "all" || action !== "all" || !!query;

  const statCards = useMemo(
    () => [
      { label: "Total events", value: data ? data.totalAll.toLocaleString() : "—" },
      { label: "Today", value: data ? data.today.toLocaleString() : "—" },
      { label: "Tracked actions", value: data ? String(data.actions.length) : "—" },
      { label: "Tracked entities", value: data ? String(data.entities.length) : "—" },
      { label: "Matching filters", value: data ? total.toLocaleString() : "—" },
    ],
    [data, total]
  );

  const clearFilters = () => {
    setEntity("all");
    setAction("all");
    setSearch("");
    setQuery("");
    setPage(1);
  };

  const showingFrom = total === 0 ? 0 : (page - 1) * AUDIT_TRAIL_PAGE_SIZE + 1;
  const showingTo = Math.min(page * AUDIT_TRAIL_PAGE_SIZE, total);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Audit trail</h1>
          <p className="mt-1 max-w-[640px] text-sm leading-relaxed text-ink-muted">
            Every recorded action across the system — who did it, what changed, and the exact time.
            Append-only: rows can be written, never edited or deleted.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          {isFetching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          )}
          {isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {isLoading && !data
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-ink/10 bg-white p-4 shadow-card">
                <div className="h-3 w-24 max-w-full animate-pulse rounded-full bg-ink/10" />
                <div className="mt-2 h-8 w-12 animate-pulse rounded bg-ink/10" />
              </div>
            ))
          : statCards.map((s) => (
              <div key={s.label} className="rounded-lg border border-ink/10 bg-white p-4 shadow-card">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                  {s.label}
                </span>
                <span className="mt-1 block font-display text-2xl font-bold text-ink">{s.value}</span>
              </div>
            ))}
      </div>

      {/* Filters */}
      <Card className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-ink-muted">Search</span>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Action, entity, or staff name…"
              aria-label="Search audit events"
            />
          </label>
          <div>
            <span className="mb-1 block text-xs font-bold text-ink-muted">Entity</span>
            <Dropdown
              menuKey="audit-entity"
              openMenuKey={openMenuKey}
              onOpenChange={setOpenMenuKey}
              value={entity}
              onChange={(v) => {
                setEntity(v);
                setPage(1);
              }}
              ariaLabel="Filter by entity"
              options={[
                { value: "all", label: "All entities" },
                ...(data?.entities ?? []).map((e) => ({ value: e, label: e })),
              ]}
            />
          </div>
          <div>
            <span className="mb-1 block text-xs font-bold text-ink-muted">Action</span>
            <Dropdown
              menuKey="audit-action"
              openMenuKey={openMenuKey}
              onOpenChange={setOpenMenuKey}
              value={action}
              onChange={(v) => {
                setAction(v);
                setPage(1);
              }}
              ariaLabel="Filter by action"
              options={[
                { value: "all", label: "All actions" },
                ...(data?.actions ?? []).map((a) => ({ value: a, label: a })),
              ]}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-ink-faint">
            {data ? `Showing ${showingFrom}–${showingTo} of ${total.toLocaleString()} events.` : "Loading events…"}
            {filtered && data ? " Filters applied." : ""}
          </p>
          {filtered && (
            <Button type="button" size="sm" variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </Card>

      {/* Trail table */}
      <section className="overflow-hidden rounded-lg border border-ink/10 bg-white shadow-card">
        {isLoading && !data ? (
          <div className="space-y-3 p-5" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-ink/10" />
            ))}
          </div>
        ) : rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-xs uppercase text-ink-muted">
                  <th className="px-4 py-3 whitespace-nowrap">When</th>
                  <th className="px-4 py-3">Who</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const actor = r.actor_profile_id ? data?.actors.get(r.actor_profile_id) : undefined;
                  return (
                    <tr key={r.id} className="border-b border-ink/5 align-top last:border-0">
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="font-semibold text-ink">{formatWhen(r.created_at)}</span>
                        <span className="mt-0.5 block text-[11px] font-medium text-ink-faint">{timeAgo(r.created_at)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-ink">{actor?.name ?? "System"}</span>
                        <span className="mt-0.5 block text-[11px] font-medium text-ink-faint">
                          {actor ? roleLabel(actor.role) : "Automated"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-ink/10 px-2 py-0.5 font-mono text-[11px] font-bold text-ink">
                          {r.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-ink">{r.entity}</span>
                        {r.entity_id && (
                          <span className="mt-0.5 block font-mono text-[11px] text-ink-faint" title={r.entity_id}>
                            {r.entity_id.slice(0, 8)}…
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <MetadataCell metadata={r.metadata} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-[13px] text-ink-muted">
            {filtered ? "No events match these filters." : "No audit events yet."}
          </p>
        )}
        {data && total > AUDIT_TRAIL_PAGE_SIZE && (
          <Pager
            page={page}
            size={AUDIT_TRAIL_PAGE_SIZE}
            totalApprox={total}
            hasMore={page * AUDIT_TRAIL_PAGE_SIZE < total}
            onPage={setPage}
          />
        )}
      </section>
    </div>
  );
}

/** Compact metadata preview; expand for the full JSON record. */
function MetadataCell({ metadata }: { metadata: Record<string, unknown> | null }) {
  if (!metadata) return <span className="text-ink-faint">—</span>;
  const entries = Object.entries(metadata);
  if (!entries.length) return <span className="text-ink-faint">—</span>;
  const [firstKey, firstValue] = entries[0];
  const summary = `${firstKey}: ${typeof firstValue === "string" ? firstValue : JSON.stringify(firstValue)}`;
  return (
    <details className="max-w-[340px]">
      <summary className="cursor-pointer list-none text-[13px] text-ink-muted marker:hidden">
        <span className="line-clamp-1">{summary}</span>
        {entries.length > 1 && (
          <span className="text-[11px] font-bold text-primary-600"> +{entries.length - 1} more</span>
        )}
      </summary>
      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-cream p-2 font-mono text-[11px] leading-relaxed text-ink-muted">
        {JSON.stringify(metadata, null, 2)}
      </pre>
    </details>
  );
}
