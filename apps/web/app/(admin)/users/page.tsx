"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BarChart3, ChevronDown } from "lucide-react";
import { useUsersBoard, type UsersProfile } from "@/lib/hooks/use-users-board";
import { cn } from "@/lib/utils";
import { HoverMenu } from "@/components/shared/hover-menu";
import { ROLES, ROLE_LABEL } from "@/components/users/RolePill";
import { UserRow } from "@/components/users/UserRow";
import { Button, Card, Input } from "@/components/ui/primitives";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type Profile = UsersProfile;

const EMPTY_ROWS: Profile[] = [];
const EMPTY_DETAILS = new Map<string, string>();

/** Admin user directory — stats, filters, and activate/deactivate (via a service-role route). */
export default function AdminUsersPage() {
  const { data: board, isLoading, isError, refetch } = useUsersBoard();
  const me = board?.me ?? null;
  const rows = board?.rows ?? EMPTY_ROWS;
  const details = board?.details ?? EMPTY_DETAILS;
  const loading = isLoading && !board;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState<{ user: Profile; toActive: boolean } | null>(null);

  // Stats live in a floating panel — same hover/click behavior as the
  // /appointments Stats menu. Closes on mouse leave, outside click, or Escape.
  const [statsOpen, setStatsOpen] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  const statsCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openStats = () => {
    if (statsCloseTimer.current) clearTimeout(statsCloseTimer.current);
    setStatsOpen(true);
  };
  const scheduleStatsClose = () => {
    if (statsCloseTimer.current) clearTimeout(statsCloseTimer.current);
    statsCloseTimer.current = setTimeout(() => setStatsOpen(false), 150);
  };
  const toggleStats = () => {
    if (statsCloseTimer.current) clearTimeout(statsCloseTimer.current);
    setStatsOpen((v) => !v);
  };

  useEffect(() => {
    if (!statsOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (statsRef.current && !statsRef.current.contains(e.target as Node)) setStatsOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStatsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      if (statsCloseTimer.current) clearTimeout(statsCloseTimer.current);
    };
  }, [statsOpen]);

  useEffect(() => {
    if (isError) toast.error("Couldn't load users right now.");
  }, [isError]);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const byRole = new Map<string, number>();
    for (const u of rows) byRole.set(u.role, (byRole.get(u.role) ?? 0) + 1);
    return {
      total: rows.length,
      active: rows.filter((u) => u.is_active).length,
      inactive: rows.filter((u) => !u.is_active).length,
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
      .filter((u) => (statusFilter === "all" ? true : statusFilter === "active" ? u.is_active : !u.is_active))
      .filter((u) =>
        !q ? true : `${u.full_name ?? ""} ${u.email}`.toLowerCase().includes(q)
      );
  }, [rows, roleFilter, statusFilter, query]);

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

  const resetFilters = () => {
    setRoleFilter("all");
    setStatusFilter("all");
    setQuery("");
  };

  const statCards = [
    { label: "Total accounts", value: stats.total, pick: resetFilters },
    { label: "Active", value: stats.active, pick: () => setStatusFilter("active") },
    { label: "Deactivated", value: stats.inactive, pick: () => setStatusFilter("inactive") },
    { label: "Staff", value: stats.staff, pick: () => setRoleFilter("staff") },
    { label: "New this week", value: stats.newWeek, pick: null },
  ];

  return (
    <div className="space-y-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Users</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Users</h1>
          <p className="mt-1 max-w-[600px] text-sm leading-relaxed text-ink-muted">
            Every account in the workspace — filter the directory and switch access off or back on.
            Deactivated accounts are signed out and blocked at login.
          </p>
        </div>
        <div ref={statsRef} className="relative shrink-0" onMouseEnter={openStats} onMouseLeave={scheduleStatsClose}>
          <button
            type="button"
            onClick={toggleStats}
            onFocus={openStats}
            onBlur={scheduleStatsClose}
            aria-haspopup="dialog"
            aria-expanded={statsOpen}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3.5 py-2 text-[13px] font-bold text-ink-soft shadow-card transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <BarChart3 className="h-4 w-4" aria-hidden />
            Stats
            <ChevronDown
              aria-hidden
              className={cn("h-4 w-4 transition-transform", statsOpen && "rotate-180")}
            />
          </button>
          {statsOpen && (
            <div
              role="dialog"
              aria-label="User stats"
              className="absolute right-0 top-full z-20 mt-2 w-72 overflow-hidden rounded-xl border border-ink/10 bg-white py-1 shadow-card"
            >
              {loading ? (
                <div className="animate-pulse px-4 py-3" aria-hidden>
                  <div className="h-10 rounded-lg bg-ink/10" />
                  <div className="mt-2 h-10 rounded-lg bg-ink/10" />
                  <div className="mt-2 h-10 rounded-lg bg-ink/10" />
                </div>
              ) : (
                statCards.map((s) =>
                  s.pick ? (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => {
                        s.pick();
                        setStatsOpen(false);
                      }}
                      title={`Filter by ${s.label}`}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-cream focus-visible:outline-none focus-visible:bg-cream"
                    >
                      <span className="text-[13px] font-medium text-ink-muted">{s.label}</span>
                      <span className="font-display text-xl font-bold text-ink">{s.value}</span>
                    </button>
                  ) : (
                    <div
                      key={s.label}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left"
                    >
                      <span className="text-[13px] font-medium text-ink-muted">{s.label}</span>
                      <span className="font-display text-xl font-bold text-ink">{s.value}</span>
                    </div>
                  )
                )
              )}
            </div>
          )}
        </div>
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
                <>Status: {statusFilter === "all" ? "All" : statusFilter === "active" ? "Active" : "Deactivated"}</>
              }
              options={[
                { value: "all", label: "All statuses" },
                { value: "active", label: `Active · ${stats.active}` },
                { value: "inactive", label: `Deactivated · ${stats.inactive}` },
              ]}
              value={statusFilter}
              onPick={setStatusFilter}
            />
          </div>
        </div>
        <p className="px-4 text-xs font-medium text-ink-faint sm:px-5">
          Showing {visible.length} of {rows.length} accounts.
        </p>
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
          <tbody>
            {visible.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                isSelf={u.id === me}
                busy={busyId === u.id}
                detail={details.get(u.id)}
                onAccessToggle={(user) => setConfirming({ user, toActive: !user.is_active })}
              />
            ))}
          </tbody>
        </table>
        {!loading && !visible.length && (
          <p className="px-4 py-8 text-center text-sm text-ink-muted">
            No accounts match these filters. Try clearing the search or choosing another role.
          </p>
        )}
        {loading && (
          <div className="animate-pulse space-y-3 p-4" aria-hidden>
            <div className="h-10 rounded-xl bg-ink/10" />
            <div className="h-10 rounded-xl bg-ink/10" />
            <div className="h-10 rounded-xl bg-ink/10" />
          </div>
        )}
        </div>
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
