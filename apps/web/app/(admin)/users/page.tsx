"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useUsersBoard, type UsersProfile } from "@/lib/hooks/use-users-board";
import { clampPage } from "@/lib/pagination";
import { Pager } from "@/components/shared/Pager";
import { HoverMenu } from "@/components/shared/hover-menu";
import { ROLES, ROLE_LABEL } from "@/components/users/RolePill";
import { UserRow } from "@/components/users/UserRow";
import { Button, Card, Input } from "@/components/ui/primitives";

type Profile = UsersProfile;

const EMPTY_ROWS: Profile[] = [];
const EMPTY_DETAILS = new Map<string, string>();
/** The directory is fixed at 10 rows per page. */
const USERS_PAGE_SIZE = 10;

/** Admin user directory — stats, filters, and activate/deactivate (via a service-role route). */
export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse space-y-4" aria-hidden>
          <div className="h-8 w-48 rounded-lg bg-ink/10" />
          <div className="h-12 rounded-lg bg-ink/10" />
          <div className="h-12 rounded-lg bg-ink/10" />
        </div>
      }
    >
      <AdminUsersPageInner />
    </Suspense>
  );
}

function AdminUsersPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Client-side pager over the loaded directory (?page=, fixed 10 rows).
  // Filters and stats stay exact over the full loaded set — only the
  // rendered table rows are sliced (DOM cost, not fetch cost).
  const page = clampPage(searchParams.get("page"));
  const size = USERS_PAGE_SIZE;
  const gotoPage = useCallback(
    (p: number) => {
      router.replace(`/users?page=${p}`, { scroll: false });
    },
    [router]
  );
  const { data: board, isLoading, isError, refetch } = useUsersBoard();
  const me = board?.me ?? null;
  const rows = board?.rows ?? EMPTY_ROWS;
  const details = board?.details ?? EMPTY_DETAILS;
  const loading = isLoading && !board;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [roleFilter, setRoleFilterState] = useState<string>("all");
  const [statusFilter, setStatusFilterState] = useState<string>("all");
  const [query, setQueryState] = useState("");
  // Any filter change resets to page 1 (page window belongs to a result set).
  const setRoleFilter = useCallback((v: string) => { setRoleFilterState(v); gotoPage(1); }, [gotoPage]);
  const setStatusFilter = useCallback((v: string) => { setStatusFilterState(v); gotoPage(1); }, [gotoPage]);
  const setQuery = useCallback((v: string) => { setQueryState(v); gotoPage(1); }, [gotoPage]);
  const [confirming, setConfirming] = useState<{ user: Profile; toActive: boolean } | null>(null);

  useEffect(() => {
    if (isError) toast.error("Couldn't load users right now.");
  }, [isError]);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const byRole = new Map<string, number>();
    for (const u of rows) byRole.set(u.role, (byRole.get(u.role) ?? 0) + 1);
    return {
      total: rows.length,
      active: rows.filter((u) => u.is_active && u.approval_status !== "pending").length,
      inactive: rows.filter((u) => !u.is_active && u.approval_status !== "pending").length,
      pending: rows.filter((u) => u.approval_status === "pending").length,
      staff: rows.filter((u) => u.role !== "student").length,
      newWeek: rows.filter((u) => new Date(u.created_at).getTime() >= weekAgo).length,
      byRole,
    };
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((u) =>
        roleFilter === "all" ? true : roleFilter === "staff" ? u.role !== "student" : u.role === roleFilter
      )
      .filter((u) =>
        statusFilter === "all"
          ? true
          : statusFilter === "active"
            ? u.is_active && u.approval_status !== "pending"
            : statusFilter === "pending"
              ? u.approval_status === "pending"
              : !u.is_active && u.approval_status !== "pending"
      )
      .filter((u) =>
        !q ? true : `${u.full_name ?? ""} ${u.email}`.toLowerCase().includes(q)
      );
  }, [rows, roleFilter, statusFilter, query]);

  // Render window into the filtered set (exact totals).
  const totalPages = Math.max(1, Math.ceil(visible.length / size));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => visible.slice((safePage - 1) * size, safePage * size),
    [visible, safePage, size]
  );

  const runConfirming = async () => {
    if (!confirming || busyId) return;
    const { user, toActive } = confirming;
    setConfirming(null);
    setBusyId(user.id);
    try {
      const res = await fetch("/api/staff/users/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, isActive: toActive }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "Couldn't update that account.");
      await refetch();
      toast.success(toActive ? "Account activated." : "Account deactivated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update that account.");
    } finally {
      setBusyId(null);
    }
  };

  const runApproving = async (user: Profile) => {
    if (busyId) return;
    setBusyId(user.id);
    try {
      const res = await fetch("/api/staff/users/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "Couldn't approve that account.");
      await refetch();
      toast.success(`${user.full_name ?? user.email} can now finish setting up their staff profile.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't approve that account.");
    } finally {
      setBusyId(null);
    }
  };

  const resetFilters = () => {
    setRoleFilter("all");
    setStatusFilter("all");
    setQuery("");
  };

  const statCards = [
    { label: "Total accounts", value: stats.total, pick: resetFilters },
    { label: "Active", value: stats.active, pick: () => setStatusFilter("active") },
    { label: "Pending approval", value: stats.pending, pick: () => setStatusFilter("pending") },
    { label: "Deactivated", value: stats.inactive, pick: () => setStatusFilter("inactive") },
    { label: "Staff", value: stats.staff, pick: () => setRoleFilter("staff") },
    { label: "New this week", value: stats.newWeek, pick: null },
  ];

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Users</h1>

      {/* Visible stats cards — same row pattern as /appointments. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {statCards.map((s) =>
          s.pick ? (
            <button
              key={s.label}
              type="button"
              onClick={s.pick}
              title={`Filter by ${s.label}`}
              className="rounded-lg border border-ink/10 bg-white p-4 text-left shadow-card transition hover:border-primary-300 hover:bg-cream/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <span className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted">{s.label}</span>
              {loading ? (
                <span className="mt-2 block h-8 w-12 animate-pulse rounded bg-ink/10" aria-hidden />
              ) : (
                <span className="mt-1 block font-display text-2xl font-bold text-ink">{s.value}</span>
              )}
            </button>
          ) : (
            <div key={s.label} className="rounded-lg border border-ink/10 bg-white p-4 shadow-card">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted">{s.label}</span>
              {loading ? (
                <span className="mt-2 block h-8 w-12 animate-pulse rounded bg-ink/10" aria-hidden />
              ) : (
                <span className="mt-1 block font-display text-2xl font-bold text-ink">{s.value}</span>
              )}
            </div>
          )
        )}
      </div>

      {/* Directory — filters live inside, above the user table */}
      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 p-4 sm:px-5">
          <Input
            placeholder="Search name or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full sm:w-56"
          />
          <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
            <HoverMenu
              ariaLabel="Filter by role"
              buttonLabel={
                <>
                  Role:{" "}
                  {roleFilter === "all"
                    ? "All"
                    : roleFilter === "staff"
                      ? "Staff only"
                      : (ROLE_LABEL[roleFilter] ?? "All")}
                </>
              }
              options={[
                { value: "all", label: `All roles · ${stats.total}` },
                { value: "staff", label: `Staff only · ${stats.staff}` },
                ...ROLES.map((r) => ({ value: r, label: `${ROLE_LABEL[r]} · ${stats.byRole.get(r) ?? 0}` })),
              ]}
              value={roleFilter}
              onPick={setRoleFilter}
            />
            <HoverMenu
              ariaLabel="Filter by status"
              align="right"
              buttonLabel={
                <>
                  Status:{" "}
                  {statusFilter === "all"
                    ? "All"
                    : statusFilter === "active"
                      ? "Active"
                      : statusFilter === "pending"
                        ? "Pending approval"
                        : "Deactivated"}
                </>
              }
              options={[
                { value: "all", label: "All statuses" },
                { value: "active", label: `Active · ${stats.active}` },
                { value: "pending", label: `Pending approval · ${stats.pending}` },
                { value: "inactive", label: `Deactivated · ${stats.inactive}` },
              ]}
              value={statusFilter}
              onPick={setStatusFilter}
            />
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-xs uppercase text-ink-muted">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Detail</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Access</th>
            </tr>
          </thead>
          <tbody aria-busy={loading}>
            {loading
              ? Array.from({ length: Math.min(Math.max(size, 3), 10) }).map((_, i) => (
                  <tr key={`user-skeleton-${i}`} className="border-b border-ink/5 align-top last:border-0" aria-hidden>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-ink/10" />
                        <div className="min-w-0 flex-1">
                          <div className="h-4 w-28 animate-pulse rounded bg-ink/10" />
                          <div className="mt-1.5 h-3 w-36 animate-pulse rounded bg-ink/10" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><div className="h-5 w-20 animate-pulse rounded-full bg-ink/10" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-32 animate-pulse rounded bg-ink/10" /></td>
                    <td className="px-4 py-3"><div className="mx-auto h-5 w-16 animate-pulse rounded-full bg-ink/10" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-24 animate-pulse rounded bg-ink/10" /></td>
                    <td className="px-4 py-3"><div className="h-6 w-20 animate-pulse rounded bg-ink/10" /></td>
                  </tr>
                ))
              : paged.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    isSelf={u.id === me}
                    busy={busyId === u.id}
                    detail={details.get(u.id)}
                    onAccessToggle={(user) => setConfirming({ user, toActive: !user.is_active })}
                    onApprove={runApproving}
                  />
                ))}
          </tbody>
        </table>
        {!loading && !visible.length && (
          <p className="px-4 py-8 text-center text-sm text-ink-muted">
            No accounts match these filters. Try clearing the search or choosing another role.
          </p>
        )}
        </div>
        <Pager
          page={safePage}
          size={size}
          totalApprox={visible.length}
          hasMore={safePage * size < visible.length}
          onPage={(p) => gotoPage(p)}
        />
      </Card>

      {/* Activate/deactivate confirm */}
      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="user-status-title"
          aria-describedby="user-status-desc"
        >
          <div aria-hidden className="absolute inset-0 bg-ink/40" onClick={() => setConfirming(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-card">
            <h2 id="user-status-title" className="font-display text-lg font-bold text-ink">
              {confirming.toActive ? "Activate" : "Deactivate"} {confirming.user.full_name ?? confirming.user.email}?
            </h2>
            <p id="user-status-desc" className="mt-1 text-sm leading-relaxed text-ink-muted">
              {confirming.toActive
                ? "They'll be able to sign in and use the workspace again."
                : "They'll be signed out and blocked at login until reactivated. Their records stay intact."}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirming(null)} autoFocus>
                Back
              </Button>
              <Button
                size="sm"
                variant={confirming.toActive ? "primary" : "danger"}
                onClick={runConfirming}
              >
                {confirming.toActive ? "Activate account" : "Deactivate account"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
