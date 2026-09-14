"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { breakGlassSchema, type BreakGlassInput } from "@dorsu/shared-schemas";
import { createClient } from "@/lib/supabase/client";
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

type Identity = {
  fullName: string | null;
  email: string | null;
  studentNo: string;
  program: string | null;
  yearLevel: string | null;
  college: string | null;
  contactNo: string | null;
  alias: string | null;
};

type Grant = { studentId: string; alias: string; expiresAt: string; logId: string; reviewed: boolean };

function fmtLeft(ms: number): string {
  if (ms <= 0) return "00:00";
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Shared /emergency — break-glass anonymity override for authorized
 * counselors and the head. Logging access opens a 30-minute grant; resolving
 * the real identity requires the grant and audit-logs every view. The head
 * reviews all events under /security.
 */
export default function EmergencyPage() {
  const [role, setRole] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [myName, setMyName] = useState("Staff");
  const [students, setStudents] = useState<{ id: string; label: string; alias: string }[]>([]);
  const [headIds, setHeadIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [studentPick, setStudentPick] = useState("");
  const [grant, setGrant] = useState<Grant | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [busy, setBusy] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const { register, handleSubmit, formState, reset, setValue } = useForm<BreakGlassInput>({
    resolver: zodResolver(breakGlassSchema),
  });

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setMe(user.id);
        const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
        const r = (profile as { role: string } | null)?.role ?? null;
        setRole(r);
        const nm = (profile as { full_name: string | null } | null)?.full_name;
        if (nm) setMyName(nm);
        if (!r || !["counselor", "guidance_head"].includes(r)) return;
        // Counselor scope — step 1 may only target students on their caseload:
        // referrals assigned to them or appointments assigned to them.
        // The head keeps the full directory.
        let directory: { id: string; anonymous_alias: string | null; student_no: string }[] = [];
        if (r === "counselor") {
          const { data: c } = await supabase.from("counselors").select("id").eq("profile_id", user.id).single();
          const cid = (c as { id: string } | null)?.id ?? null;
          if (cid) {
            const [{ data: apptRows }, { data: refRows }] = await Promise.all([
              supabase.from("appointments").select("student_id").eq("counselor_id", cid).limit(1000),
              supabase.from("referrals").select("student_id").eq("assigned_counselor_id", cid).limit(1000),
            ]);
            const ids = [
              ...new Set([
                ...(((apptRows ?? []) as { student_id: string }[]).map((a) => a.student_id)),
                ...(((refRows ?? []) as { student_id: string }[]).map((x) => x.student_id)),
              ]),
            ];
            for (let i = 0; i < ids.length; i += 200) {
              const chunk = ids.slice(i, i + 200);
              if (!chunk.length) break;
              const { data } = await supabase
                .from("students")
                .select("id, anonymous_alias, student_no")
                .in("id", chunk);
              directory.push(...((data ?? []) as typeof directory));
            }
          }
        } else {
          const { data } = await supabase
            .from("students")
            .select("id, anonymous_alias, student_no")
            .order("created_at", { ascending: false })
            .limit(200);
          directory = ((data ?? []) as typeof directory);
        }
        const [{ data: heads }, { data: mine }] = await Promise.all([
          supabase.from("profiles").select("id").eq("role", "guidance_head").eq("is_active", true),
          supabase
            .from("break_glass_logs")
            .select("id, student_id, expires_at, reviewed_at")
            .eq("accessor_profile_id", user.id)
            .gt("expires_at", new Date().toISOString())
            .order("accessed_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        const dir = directory;
        setStudents(dir.map((s) => ({ id: s.id, alias: s.anonymous_alias ?? "Student", label: `${s.anonymous_alias ?? "Student"} · ${s.student_no}` })));
        setHeadIds(((heads ?? []) as { id: string }[]).map((h) => h.id));
        const g = mine as { id: string; student_id: string; expires_at: string; reviewed_at: string | null } | null;
        if (g) {
          const alias = dir.find((s) => s.id === g.student_id)?.anonymous_alias ?? "Student";
          setGrant({ studentId: g.student_id, alias, expiresAt: g.expires_at, logId: g.id, reviewed: !!g.reviewed_at });
          setStudentPick(g.student_id);
        }
      } catch {
        toast.error("Couldn't load emergency access right now.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown tick while a grant is live.
  useEffect(() => {
    if (!grant) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [grant]);

  const msLeft = grant ? new Date(grant.expiresAt).getTime() - now : 0;
  useEffect(() => {
    if (grant && msLeft <= 0) {
      setGrant(null);
      setIdentity(null);
      toast.error("Emergency grant expired — log access again if still needed.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msLeft > 0]);

  const logAccess = handleSubmit(async (v) => {
    if (!me) return;
    setBusy(true);
    try {
      // Server-enforced caseload scope: counselors may only log access for
      // referred students / assigned appointments (see log-break-glass route).
      const res = await fetch("/api/staff/security/log-break-glass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: v.studentId, justification: v.justification }),
      });
      const json = (await res.json().catch(() => null)) as {
        error?: string;
        log?: { id: string; student_id: string; expires_at: string };
      } | null;
      if (!res.ok) throw new Error(json?.error ?? "Couldn't log that access.");
      const row = json?.log as { id: string; student_id: string; expires_at: string };
      const alias = students.find((s) => s.id === v.studentId)?.alias ?? "Student";
      // A fresh log is unreviewed — counselors wait for head review before reveal.
      setGrant({ studentId: row.student_id, alias, expiresAt: row.expires_at, logId: row.id, reviewed: false });
      setIdentity(null);
      reset();
      setStudentPick(v.studentId);
      toast.success(
        role === "counselor"
          ? "Emergency access logged — waiting for head review before the identity can be revealed."
          : "Emergency access logged — 30-minute grant open."
      );
      await notifyStaff(headIds.filter((id) => id !== me), {
        type: "system",
        title: "Emergency access logged",
        body: `${myName} opened a restricted record with justification on file.`,
        link: "/security",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't log that access.");
    } finally {
      setBusy(false);
    }
  });

  const reveal = async () => {
    if (!grant) return;
    setRevealing(true);
    try {
      const res = await fetch("/api/staff/security/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: grant.studentId }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string; identity?: Identity } | null;
      if (!res.ok) {
        // Counselor hitting the review gate (e.g. grant reviewed state changed
        // mid-session) — re-check so the UI reflects the current status.
        if (res.status === 403 && role === "counselor") void checkReview();
        throw new Error(json?.error ?? "Couldn't reveal that identity.");
      }
      setIdentity(json?.identity ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't reveal that identity.");
    } finally {
      setRevealing(false);
    }
  };

  // Re-read the grant's review flag (counselors can read their own log rows).
  const checkReview = async () => {
    if (!grant || !me) return false;
    setChecking(true);
    try {
      const { data } = await createClient()
        .from("break_glass_logs")
        .select("id, expires_at, reviewed_at")
        .eq("accessor_profile_id", me)
        .eq("student_id", grant.studentId)
        .gt("expires_at", new Date().toISOString())
        .order("accessed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const g = data as { id: string; expires_at: string; reviewed_at: string | null } | null;
      if (!g) return false; // expired/closed — the expiry effect resets the UI
      if (g.reviewed_at) {
        setGrant((prev) => (prev ? { ...prev, logId: g.id, reviewed: true, expiresAt: g.expires_at } : prev));
        toast.success("Head review complete — you may now reveal the identity.");
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setChecking(false);
    }
  };

  // Counselors see no Reveal button until the head reviews the log.
  const needsReview = role === "counselor" && !!grant && !grant.reviewed && !identity;

  // While waiting, poll so Reveal appears on its own once reviewed.
  useEffect(() => {
    if (!needsReview) return;
    const t = setInterval(() => {
      void checkReview();
    }, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsReview, grant?.studentId]);

  if (!loading && (!role || !["counselor", "guidance_head"].includes(role))) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">Emergency access</h1>
        <Card><p className="text-sm text-ink-muted">Only counselors and the guidance head can open emergency access.</p></Card>
      </div>
    );
  }

  const idRows: [string, string | null][] = identity
    ? [
        ["Full name", identity.fullName],
        ["Email", identity.email],
        ["Student no.", identity.studentNo],
        ["Program", identity.program],
        ["Year level", identity.yearLevel],
        ["College", identity.college],
        ["Contact no.", identity.contactNo],
      ]
    : [];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Emergency access</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="font-display text-2xl font-bold">Emergency access</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          Crisis only: logging access temporarily lifts anonymity for one student for{" "}
          <span className="font-bold text-ink">30 minutes</span>. Every view is audit-logged
          and reviewed by the head.
        </p>
      </div>

      {/* Step 1 — log access */}
      <Card>
        <h2 className="font-display text-base font-bold text-ink">1 · Log emergency access</h2>
        {loading ? (
          <div className="animate-pulse space-y-3 pt-3" aria-hidden>
            <div className="h-10 rounded-xl bg-ink/10" />
            <div className="h-20 rounded-xl bg-ink/10" />
          </div>
        ) : (
          <form className="mt-3 space-y-3" onSubmit={logAccess}>
            <div>
              <label className="mb-1 block text-xs font-bold text-ink-muted">Student (shown by alias)</label>
              <Dropdown
                menuKey="emergency-student"
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
              {role === "counselor" && (
                <p className="mt-1 text-[11px] font-medium text-ink-faint">
                  {students.length
                    ? "Only students from your assigned appointments and referrals appear here."
                    : "No students on your caseload yet — emergency access unlocks once you have an assigned appointment or referral."}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-ink-muted">Emergency justification (min 20 chars)</label>
              <Textarea rows={3} placeholder="Why must this student's identity be revealed right now?" {...register("justification")} />
              <FieldError message={formState.errors.justification?.message} />
            </div>
            <div className="flex justify-end">
              <Button disabled={busy}>{busy ? "Logging…" : "Log emergency access"}</Button>
            </div>
          </form>
        )}
      </Card>

      {/* Step 2 — grant + reveal */}
      {grant && (
        <Card className="border-red-300">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-bold text-ink">2 · Active grant — {grant.alias}</h2>
            <Badge tone={msLeft > 5 * 60 * 1000 ? "warning" : "danger"}>
              Expires in {fmtLeft(msLeft)}
            </Badge>
          </div>
          {!identity ? (
            needsReview ? (
              <div className="mt-3 space-y-3">
                <div className="rounded-xl bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-800 ring-1 ring-amber-200">
                  <span className="font-bold">Waiting for head review.</span> Your access is logged
                  and the guidance head has been notified. The Reveal button appears here once they
                  review it — this page checks automatically.
                </div>
                <Button size="sm" variant="outline" disabled={checking} onClick={() => void checkReview()}>
                  {checking ? "Checking…" : "Check review status"}
                </Button>
              </div>
            ) : (
            <div className="mt-3">
              <p className="text-[13px] leading-relaxed text-ink-muted">
                Resolving the real identity writes a second audit row tied to you. Only proceed
                if the crisis requires it.
              </p>
              <Button size="sm" variant="danger" disabled={revealing} onClick={reveal} className="mt-3">
                {revealing ? "Resolving…" : "Reveal identity"}
              </Button>
            </div>
            )
          ) : (
            <div className="mt-3 space-y-3">
              <div className="rounded-xl bg-red-50 px-4 py-2.5 text-[13px] font-semibold text-red-800 ring-1 ring-red-200">
                This view was audit-logged under your name. Handle these details with care.
              </div>
              <dl className="divide-y divide-ink/10 rounded-xl border border-ink/10">
                {idRows.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <dt className="font-medium text-ink-muted">{k}</dt>
                    <dd className="truncate font-bold text-ink">{v ?? "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
