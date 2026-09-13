"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, Card, Input } from "@/components/ui/primitives";
import { Dropdown } from "@/components/shared/dropdown";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type Profile = {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
};

const ROLES = ["student", "counselor", "guidance_head", "faculty"] as const;

const ROLE_LABEL: Record<string, string> = {
  student: "Student",
  counselor: "Counselor",
  guidance_head: "Guidance head",
  faculty: "Faculty",
};

function roleTone(r: string): "info" | "success" | "warning" | "danger" {
  if (r === "counselor") return "success";
  if (r === "guidance_head") return "warning";
  return "info";
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("") || "?";
}

/** Admin user directory — stats, filters, and activate/deactivate (via a service-role route). */
export default function AdminUsersPage() {
  const [me, setMe] = useState<string | null>(null);
  const [rows, setRows] = useState<Profile[]>([]);
  const [details, setDetails] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ user: Profile; toActive: boolean } | null>(null);

  const reload = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, role, full_name, is_active, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    const list = ((data ?? []) as Profile[]);
    setRows(list);

    const ids = list.map((u) => u.id);
    const detail = new Map<string, string>();
    if (ids.length) {
      const [counselors, students, faculty] = await Promise.all([
        supabase.from("counselors").select("profile_id, specialization").in("profile_id", ids.slice(0, 200)),
        supabase.from("students").select("profile_id, program, year_level").in("profile_id", ids.slice(0, 200)),
        supabase.from("faculty_members").select("profile_id, department").in("profile_id", ids.slice(0, 200)),
      ]);
      for (const c of ((counselors.data ?? []) as { profile_id: string; specialization: string | null }[])) {
        if (c.specialization) detail.set(c.profile_id, c.specialization);
      }
      for (const s of ((students.data ?? []) as { profile_id: string; program: string | null; year_level: string | null }[])) {
        detail.set(s.profile_id, [s.program, s.year_level].filter(Boolean).join(" · ") || "Student");
      }
      for (const f of ((faculty.data ?? []) as { profile_id: string; department: string | null }[])) {
        if (f.department) detail.set(f.profile_id, f.department);
      }
    }
    setDetails(detail);
  };

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await createClient().auth.getUser();
        setMe(user?.id ?? null);
        await reload();
      } catch {
        toast.error("Couldn't load users right now.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      .filter((u) => (roleFilter === "all" ? true : u.role === roleFilter))
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
      await reload();
      toast.success(toActive ? "Account activated." : "Account deactivated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update that account.");
    } finally {
      setBusyId(null);
    }
  };

  const statCards = [
    { label: "Total accounts", value: stats.total },
    { label: "Active", value: stats.active },
    { label: "Deactivated", value: stats.inactive },
    { label: "Staff", value: stats.staff },
    { label: "New this week", value: stats.newWeek },
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

      <div>
        <h1 className="font-display text-2xl font-bold">Users</h1>
        <p className="mt-1 max-w-[600px] text-sm leading-relaxed text-ink-muted">
          Every account in the workspace — filter the directory and switch access off or back on.
          Deactivated accounts are signed out and blocked at login.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg border border-ink/10 bg-white p-5 shadow-card">
                <div className="h-3.5 w-2/3 rounded-full bg-ink/10" />
                <div className="mt-3 h-8 w-1/3 rounded-lg bg-ink/10" />
              </div>
            ))
          : statCards.map((s) => (
              <div key={s.label} className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
                <p className="text-[13px] font-medium text-ink-muted">{s.label}</p>
                <p className="mt-1 font-display text-3xl font-bold text-ink">{s.value}</p>
              </div>
            ))}
      </div>

      {/* Filters */}
      <Card className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <Dropdown
            menuKey="role"
            openMenuKey={openMenuKey}
            onOpenChange={setOpenMenuKey}
            value={roleFilter}
            onChange={setRoleFilter}
            ariaLabel="Filter by role"
            options={[
              { value: "all", label: `All roles · ${stats.total}` },
              ...ROLES.map((r) => ({ value: r, label: `${ROLE_LABEL[r]} · ${stats.byRole.get(r) ?? 0}` })),
            ]}
          />
          <Dropdown
            menuKey="status"
            openMenuKey={openMenuKey}
            onOpenChange={setOpenMenuKey}
            value={statusFilter}
            onChange={setStatusFilter}
            ariaLabel="Filter by status"
            options={[
              { value: "all", label: "All statuses" },
              { value: "active", label: `Active · ${stats.active}` },
              { value: "inactive", label: `Deactivated · ${stats.inactive}` },
            ]}
          />
          <Input
            placeholder="Search name or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <p className="text-xs font-medium text-ink-faint">
          Showing {visible.length} of {rows.length} accounts.
        </p>
      </Card>

      {/* Directory */}
      <Card className="overflow-x-auto p-0">
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
            {visible.map((u) => {
              const isSelf = u.id === me;
              return (
                <tr key={u.id} className="border-b border-ink/5 align-top last:border-0">
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
                    <Badge tone={roleTone(u.role)}>{ROLE_LABEL[u.role] ?? u.role}</Badge>
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-ink-muted" title={details.get(u.id) ?? ""}>
                    {details.get(u.id) ?? "—"}
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
                        disabled={busyId === u.id}
                        onClick={() => setConfirming({ user: u, toActive: !u.is_active })}
                      >
                        {u.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
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
