"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { breakGlassSchema, type BreakGlassInput } from "@dorsu/shared-schemas";
import { actionPolicy, type AppAction } from "@dorsu/shared-services";
import { useSecurityBoard } from "@/lib/hooks/use-security-board";
import { Badge, Button, Card, FieldError, Textarea } from "@/components/ui/primitives";
import { Dropdown } from "@/components/shared/dropdown";
import { notifyStaff } from "@/lib/notify";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type GlassLog = {
  id: string;
  accessor_profile_id: string;
  student_id: string;
  justification: string;
  accessed_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

type AuditRow = {
  id: string;
  actor_profile_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const EMPTY_LOGS: GlassLog[] = [];
const EMPTY_AUDIT: AuditRow[] = [];
const EMPTY_MAP = new Map<string, string>();
const EMPTY_STUDENTS: { id: string; label: string }[] = [];
const EMPTY_COUNTS = new Map<string, number>();
const EMPTY_IDS: string[] = [];

const MATRIX_ROLES = ["student", "counselor", "guidance_head", "faculty"] as const;
const MATRIX_ROLE_LABEL: Record<string, string> = {
  student: "Student",
  counselor: "Counselor",
  guidance_head: "Head",
  faculty: "Faculty",
};

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

/** Head-only security console — break-glass oversight, audit trail, access matrix. */
export default function SecurityPage() {
  const { data: board, isLoading, isError, refetch } = useSecurityBoard();
  const logs = board?.logs ?? EMPTY_LOGS;
  const audit = board?.audit ?? EMPTY_AUDIT;
  const names = board?.names ?? EMPTY_MAP;
  const aliases = board?.aliases ?? EMPTY_MAP;
  const students = board?.students ?? EMPTY_STUDENTS;
  const roleCounts = board?.roleCounts ?? EMPTY_COUNTS;
  const deactivated = board?.deactivated ?? 0;
  const me = board?.me ?? null;
  const headIds = board?.headIds ?? EMPTY_IDS;
  const loading = isLoading && !board;
  const [entityFilter, setEntityFilter] = useState("all");
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [studentPick, setStudentPick] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { register, handleSubmit, formState, reset, setValue } = useForm<BreakGlassInput>({
    resolver: zodResolver(breakGlassSchema),
  });

  useEffect(() => {
    if (isError) toast.error("Couldn't load security data right now.");
  }, [isError]);

  const entities = useMemo(() => [...new Set(audit.map((a) => a.entity))].sort(), [audit]);
  const visibleAudit = useMemo(
    () => audit.filter((a) => (entityFilter === "all" ? true : a.entity === entityFilter)),
    [audit, entityFilter]
  );
  const unreviewed = useMemo(() => logs.filter((l) => !l.reviewed_at), [logs]);

  const logAccess = handleSubmit(async (v) => {
    if (!me) return;
    setBusyId("__new__");
    try {
      const res = await fetch("/api/staff/security/log-break-glass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: v.studentId, justification: v.justification }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "Couldn't log that access.");
      reset();
      setStudentPick("");
      await refetch();
      toast.success("Emergency access logged and audited.");
      await notifyStaff(headIds.filter((id) => id !== me), {
        type: "system",
        title: "Emergency access logged",
        body: `${names.get(me) ?? "Staff"} opened a restricted record with justification on file.`,
        link: "/security",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't log that access.");
    } finally {
      setBusyId(null);
    }
  });

  const markReviewed = async (log: GlassLog) => {
    if (!me) return;
    setBusyId(log.id);
    try {
      const res = await fetch("/api/staff/security/review-break-glass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: log.id }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "Couldn't record the review.");
      await refetch();
      toast.success("Marked as reviewed.");
      await notifyStaff([log.accessor_profile_id], {
        type: "system",
        title: "Emergency access reviewed",
        body: "The head reviewed your logged emergency access. No further action needed.",
        link: "/security",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't record the review.");
    } finally {
      setBusyId(null);
    }
  };

  const statCards = [
    { label: "Emergency accesses", value: logs.length },
    { label: "Awaiting review", value: unreviewed.length },
    { label: "Audit events", value: audit.length },
    { label: "Deactivated accounts", value: deactivated },
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
            <BreadcrumbPage>Security</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="font-display text-2xl font-bold">Security</h1>
        <p className="mt-1 max-w-[600px] text-sm leading-relaxed text-ink-muted">
          Emergency access oversight, the append-only audit trail, and who is allowed to do what.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
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

      {/* Break-glass */}
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <h2 className="font-display text-base font-bold text-ink">Log emergency access</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            Break-glass opens a restricted record now and audits it automatically — justification required.
          </p>
          <form className="mt-3 space-y-3" onSubmit={logAccess}>
            <div>
              <label className="mb-1 block text-xs font-bold text-ink-muted">Student</label>
              <Dropdown
                menuKey="glass-student"
                openMenuKey={openMenuKey}
                onOpenChange={setOpenMenuKey}
                value={studentPick}
                onChange={(val) => {
                  setStudentPick(val);
                  setValue("studentId", val, { shouldValidate: true });
                }}
                ariaLabel="Student for emergency access"
                options={students.map((s) => ({ value: s.id, label: s.label }))}
              />
              <FieldError message={formState.errors.studentId?.message} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-ink-muted">Emergency justification (min 20 chars)</label>
              <Textarea rows={3} placeholder="Why must this record be opened right now?" {...register("justification")} />
              <FieldError message={formState.errors.justification?.message} />
            </div>
            <div className="flex justify-end">
              <Button disabled={busyId === "__new__"}>
                {busyId === "__new__" ? "Logging…" : "Log emergency access"}
              </Button>
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-bold text-ink">
              Access events{" "}
              {unreviewed.length > 0 && (
                <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                  {unreviewed.length} unreviewed
                </span>
              )}
            </h2>
            <Link
              href="/security/events"
              className="shrink-0 text-[13px] font-bold text-primary-600 hover:underline"
            >
              See all access events
            </Link>
          </div>
          <p className="mt-0.5 text-[13px] text-ink-muted">Latest 2 events — the full log lives on its own page.</p>
          {loading ? (
            <div className="animate-pulse space-y-3 pt-3" aria-hidden>
              <div className="h-12 rounded-xl bg-ink/10" />
              <div className="h-12 rounded-xl bg-ink/10" />
            </div>
          ) : logs.length ? (
            <ul className="mt-3 divide-y divide-ink/10">
              {logs.slice(0, 2).map((l) => (
                <li key={l.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={l.reviewed_at ? "success" : "danger"}>
                      {l.reviewed_at ? "Reviewed" : "Unreviewed"}
                    </Badge>
                    <span className="text-[11px] font-medium text-ink-faint">{timeAgo(l.accessed_at)}</span>
                    {!l.reviewed_at && (
                      <button
                        type="button"
                        disabled={busyId === l.id}
                        onClick={() => void markReviewed(l)}
                        className="ml-auto text-[13px] font-bold text-primary-600 hover:underline disabled:opacity-50"
                      >
                        Mark reviewed
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-bold text-ink">
                    {names.get(l.accessor_profile_id) ?? "Staff"}
                    <span className="font-medium text-ink-muted"> opened </span>
                    {aliases.get(l.student_id) ?? "Student"}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-muted">{l.justification}</p>
                  {l.reviewed_at && (
                    <p className="mt-0.5 text-[11px] font-medium text-ink-faint">
                      Reviewed by {names.get(l.reviewed_by ?? "") ?? "Head"} · {timeAgo(l.reviewed_at)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[13px] text-ink-muted">No emergency accesses logged.</p>
          )}
        </section>
      </div>

      {/* Audit trail */}
      <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-ink">Audit trail</h2>
            <p className="mt-0.5 text-[13px] text-ink-muted">Append-only — rows can be written, never edited or deleted.</p>
          </div>
          <div className="w-full max-w-xs">
            <Dropdown
              menuKey="audit-entity"
              openMenuKey={openMenuKey}
              onOpenChange={setOpenMenuKey}
              value={entityFilter}
              onChange={setEntityFilter}
              ariaLabel="Filter by entity"
              options={[{ value: "all", label: "All entities" }, ...entities.map((e) => ({ value: e, label: e }))]}
            />
          </div>
        </div>
        {loading ? (
          <div className="animate-pulse space-y-3 pt-3" aria-hidden>
            <div className="h-10 rounded-xl bg-ink/10" />
            <div className="h-10 rounded-xl bg-ink/10" />
            <div className="h-10 rounded-xl bg-ink/10" />
          </div>
        ) : visibleAudit.length ? (
          <ul className="mt-3 max-h-[320px] divide-y divide-ink/10 overflow-y-auto">
            {visibleAudit.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                <p className="text-sm text-ink-muted">
                  <span className="font-bold text-ink">{names.get(a.actor_profile_id ?? "") ?? "System"}</span>
                  {" · "}
                  <span className="rounded-full bg-ink/10 px-2 py-0.5 font-mono text-[11px] font-bold text-ink">
                    {a.action}
                  </span>
                  {" · "}
                  <span className="font-semibold">{a.entity}</span>
                </p>
                <span className="text-[11px] font-medium text-ink-faint">{timeAgo(a.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-center text-[13px] text-ink-muted">
            {audit.length ? "No events for this entity." : "No audit events yet — break-glass accesses land here automatically."}
          </p>
        )}
      </section>

      {/* Access matrix */}
      <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <h2 className="font-display text-base font-bold text-ink">Who can do what</h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          Live from the shared access policy — head holds every office power, counselors run sessions, faculty only refer.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-xs uppercase text-ink-muted">
                <th className="px-4 py-3">Action</th>
                {MATRIX_ROLES.map((r) => (
                  <th key={r} className="px-4 py-3 text-center">{MATRIX_ROLE_LABEL[r]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(Object.keys(actionPolicy) as AppAction[]).map((action) => (
                <tr key={action} className="border-b border-ink/5 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-[13px] font-bold text-ink">{action}</td>
                  {MATRIX_ROLES.map((r) => (
                    <td key={r} className="px-4 py-2.5 text-center">
                      {actionPolicy[action].includes(r as never) ? (
                        <span aria-label="Allowed" className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-800">✓</span>
                      ) : (
                        <span aria-label="Not allowed" className="text-ink-faint">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
          {roleCounts.size > 0 && (
            <>Current accounts — {[...roleCounts.entries()].map(([r, n]) => `${n} ${r.replace(/_/g, " ")}`).join(" · ")} · </>
          )}
          {deactivated} deactivated. Role changes happen only through staff provisioning.
        </p>
      </section>
    </div>
  );
}
