"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, Card, Input } from "@/components/ui/primitives";
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

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

/** Head-only full log of emergency accesses, with review actions. */
export default function AccessEventsPage() {
  const [logs, setLogs] = useState<GlassLog[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [aliases, setAliases] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("break_glass_logs")
      .select("*")
      .order("accessed_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    const list = ((data ?? []) as GlassLog[]);
    setLogs(list);
    const profileIds = [...new Set(list.flatMap((l) => [l.accessor_profile_id, l.reviewed_by]).filter(Boolean))] as string[];
    if (profileIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", profileIds.slice(0, 200));
      setNames(
        new Map(
          ((profiles ?? []) as { id: string; full_name: string | null; email: string }[]).map((p) => [p.id, p.full_name ?? p.email])
        )
      );
    }
    const studentIds = [...new Set(list.map((l) => l.student_id))];
    if (studentIds.length) {
      const { data: students } = await supabase.from("students").select("id, anonymous_alias").in("id", studentIds.slice(0, 200));
      setAliases(
        new Map(
          ((students ?? []) as { id: string; anonymous_alias: string | null }[]).map((s) => [s.id, s.anonymous_alias ?? "Student"])
        )
      );
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await reload();
      } catch {
        toast.error("Couldn't load access events right now.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs
      .filter((l) => {
        if (statusFilter === "unreviewed") return !l.reviewed_at;
        if (statusFilter === "reviewed") return !!l.reviewed_at;
        return true;
      })
      .filter((l) => {
        if (!q) return true;
        const who = names.get(l.accessor_profile_id) ?? "";
        const alias = aliases.get(l.student_id) ?? "";
        return `${who} ${alias} ${l.justification}`.toLowerCase().includes(q);
      });
  }, [logs, statusFilter, query, names, aliases]);

  const unreviewed = useMemo(() => logs.filter((l) => !l.reviewed_at).length, [logs]);

  const markReviewed = async (log: GlassLog) => {
    setBusyId(log.id);
    try {
      const res = await fetch("/api/staff/security/review-break-glass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: log.id }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "Couldn't record the review.");
      await reload();
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

  return (
    <div className="space-y-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/security">Security</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Access events</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="font-display text-2xl font-bold">Access events</h1>
        <p className="mt-1 max-w-[600px] text-sm leading-relaxed text-ink-muted">
          Every logged emergency access. Review each one so nothing sits unexamined.
        </p>
      </div>

      <Card className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { v: "all", label: `All · ${logs.length}` },
                { v: "unreviewed", label: `Unreviewed · ${unreviewed}` },
                { v: "reviewed", label: "Reviewed" },
              ] as const
            ).map((s) => (
              <Button
                key={s.v}
                size="sm"
                variant={statusFilter === s.v ? "primary" : "outline"}
                onClick={() => setStatusFilter(s.v)}
              >
                {s.label}
              </Button>
            ))}
          </div>
          <Input
            placeholder="Search accessor, student, or justification…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <p className="text-xs font-medium text-ink-faint">
          Showing {visible.length} of {logs.length} events.
        </p>
      </Card>

      <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        {loading ? (
          <div className="animate-pulse space-y-3" aria-hidden>
            <div className="h-12 rounded-xl bg-ink/10" />
            <div className="h-12 rounded-xl bg-ink/10" />
            <div className="h-12 rounded-xl bg-ink/10" />
          </div>
        ) : visible.length ? (
          <ul className="divide-y divide-ink/10">
            {visible.map((l) => (
              <li key={l.id} className="py-3 first:pt-0 last:pb-0">
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
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">{l.justification}</p>
                {l.reviewed_at && (
                  <p className="mt-0.5 text-[11px] font-medium text-ink-faint">
                    Reviewed by {names.get(l.reviewed_by ?? "") ?? "Head"} · {timeAgo(l.reviewed_at)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-cream px-4 py-3 text-center text-[13px] text-ink-muted">
            {logs.length ? "No events match these filters." : "No emergency accesses logged."}
          </p>
        )}
      </section>
    </div>
  );
}
