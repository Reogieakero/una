"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Activity, ChevronDown, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReferralsBoard, type ReferralStudentOption } from "@/lib/hooks/use-referrals-board";
import { Button, Card, Badge } from "@/components/ui/primitives";
import { IconAction } from "@/components/shared/icon-action";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ReferralExcelModal } from "@/components/referrals/ReferralExcelModal";
import { ReferralFormModal } from "@/components/referrals/ReferralFormModal";
import { ReferralTrackingModal } from "@/components/referrals/ReferralTrackingModal";
import { useClampedPanel } from "@/components/shared/hover-menu";
import {
  classificationSummary,
  referralStudentName,
  statusLabel,
  statusTone,
  type RefAction,
  type Referral,
} from "@/components/referrals/status";
import { formatSessionMode, formatWhen, hasReschedule, latestSessionSchedule, parseScheduleNote, parseSessionMode, timeAgo } from "@/components/referrals/format-helpers";

const EMPTY_MAP = new Map<string, string>();
const EMPTY_STUDENTS: ReferralStudentOption[] = [];
const EMPTY_IDS: string[] = [];
const EMPTY_TRAIL: Map<string, RefAction[]> = new Map();

/**
 * What-happens-next help — opens on hover or click, top-right of the page.
 * Same floating-panel behavior as the notification bell (viewport-clamped,
 * outside-click / Escape to dismiss).
 */
function WhatNextMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pos = useClampedPanel(open, ref, 300, "right");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const peek = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 150);
  };
  const toggle = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open]);

  return (
    <div ref={ref} className="shrink-0 pt-1" onMouseEnter={peek} onMouseLeave={hide}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={open}
        className="inline-flex h-8 items-center gap-1.5 rounded border-2 border-ink/15 bg-white px-4 text-[13px] font-bold text-ink transition hover:border-primary-400"
      >
        What happens next?
        <ChevronDown aria-hidden className={cn("h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && pos && (
        <div
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          className="fixed z-50 rounded-lg border border-ink/10 bg-white p-4 shadow-card"
        >
          <p className="text-sm font-bold text-ink">What happens next?</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
            The head assigns a counselor, the counselor confirms a session, then resolves the
            case. Follow every step under{" "}
            <Link href="/referrals" className="font-bold text-primary-700 hover:underline">
              Referrals
            </Link>{" "}
            or your{" "}
            <Link href="/dashboard" className="font-bold text-primary-700 hover:underline">
              Dashboard
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Faculty-only /refer-student — the dedicated referral submission page.
 * The form files an academic / behavioral / relational concern with the
 * Guidance Office; tracking lives on /referrals and the dashboard. Kept as
 * its own route so the faculty referral flow can grow here later.
 */
export default function ReferStudentPage() {
  const { data: board, isLoading, refetch } = useReferralsBoard();
  const role = board?.role ?? null;
  const loading = isLoading && !board;
  const [excelOpen, setExcelOpen] = useState(false);
  const [formRef, setFormRef] = useState<Referral | null>(null);
  const [trackRef, setTrackRef] = useState<Referral | null>(null);

  // Counselor-set session time + mode per referral. The confirm trail note
  // carries the first schedule and every later reschedule overrides it
  // (faculty cannot read appointments via RLS — the trail is the channel).
  // Unconfirmed referrals simply show "—".
  const trail = board?.trail ?? (EMPTY_TRAIL as Map<string, RefAction[]>);
  const sessionSchedule = useMemo(() => {
    const m = new Map<string, string>();
    for (const [refId, actions] of trail) {
      const iso = latestSessionSchedule(actions, null);
      if (iso) m.set(refId, iso);
    }
    return m;
  }, [trail]);
  const sessionMode = useMemo(() => {
    const m = new Map<string, "in_person" | "online">();
    for (const [refId, actions] of trail) {
      const confirm = actions.find((a) => a.action === "confirmed" && parseScheduleNote(a.note));
      const mode = confirm ? parseSessionMode(confirm.note) : null;
      if (mode) m.set(refId, mode);
    }
    return m;
  }, [trail]);

  if (!loading && role !== "faculty") {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">Refer a student</h1>
        <Card className="rounded-lg"><p className="text-sm text-ink-muted">Only faculty can file student referrals.</p></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Refer a student</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Refer a student</h1>
          <p className="mt-1 max-w-[600px] text-sm leading-relaxed text-ink-muted">
            Flag a student with an observed academic, behavioral, or relational concern — the
            Guidance Office triages every submission. You&apos;ll be notified as your referral moves.
          </p>
        </div>
        <WhatNextMenu />
      </div>

      {loading || !board ? (
        <div className="animate-pulse space-y-3" aria-hidden>
          <div className="h-64 rounded-lg bg-ink/10" />
        </div>
      ) : (
        <>
          <Card className="rounded-lg">
            <h2 className="font-display text-lg font-bold text-ink">Fill student referrals</h2>
            <p className="mt-1 max-w-[600px] text-sm leading-relaxed text-ink-muted">
              Flag a student with an observed academic, behavioral, or relational concern — fill
              up one form and either submit it straight to the Guidance Office or download it
              pre-filled on the official Excel template (FM-DOrSU-GCTC-02).
            </p>
            <div className="mt-4 flex justify-center">
              <Button onClick={() => setExcelOpen(true)}>
                Fill up referral form
              </Button>
            </div>
          </Card>
          <ReferralExcelModal
            open={excelOpen}
            myName={board.myName}
            students={board.students ?? EMPTY_STUDENTS}
            facultyId={board.facultyId}
            headIds={board.headIds ?? EMPTY_IDS}
            onSubmitted={() => {
              refetch().catch(() => {});
            }}
            onClose={() => setExcelOpen(false)}
          />
          <Card className="rounded-lg">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-ink">Sent referrals history</h2>
              <Link href="/referrals" className="text-[13px] font-bold text-primary-700 hover:underline">
                Track all
              </Link>
            </div>
            {(board.rows ?? []).length === 0 ? (
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                No referrals sent yet — your filed referrals will list here.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-lg border border-ink/10">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-cream-dark/60 text-[11px] uppercase tracking-wider text-ink-muted">
                      <th className="whitespace-nowrap px-4 py-2.5 font-bold">Student</th>
                      <th className="whitespace-nowrap px-4 py-2.5 font-bold">Classification</th>
                      <th className="whitespace-nowrap px-4 py-2.5 font-bold">Status</th>
                      <th className="whitespace-nowrap px-4 py-2.5 font-bold">Session</th>
                      <th className="whitespace-nowrap px-4 py-2.5 font-bold">Mode</th>
                      <th className="px-4 py-2.5 font-bold">Reason</th>
                      <th className="whitespace-nowrap px-4 py-2.5 font-bold">Sent</th>
                      <th className="whitespace-nowrap px-4 py-2.5 font-bold">Form</th>
                      <th className="whitespace-nowrap px-4 py-2.5 font-bold">Track</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(board.rows ?? []).map((r) => (
                      <tr key={r.id} className="border-t border-ink/10">
                        <td className="whitespace-nowrap px-4 py-3 font-bold text-ink">
                          {referralStudentName(r, board.aliases ?? EMPTY_MAP)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <Badge tone="info">{classificationSummary(r.case_classification)}</Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold">
                          {sessionSchedule.get(r.id) ? (
                            <span className="inline-flex flex-col items-start gap-1">
                              <span>{formatWhen(sessionSchedule.get(r.id)!)}</span>
                              {hasReschedule(trail.get(r.id) ?? []) && (
                                <span className="rounded-full bg-accent-100 px-2 py-px text-[10px] font-bold uppercase tracking-wider text-accent-700">
                                  Rescheduled
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="font-medium text-ink-faint">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
                          {sessionSchedule.get(r.id) ? (
                            formatSessionMode(sessionMode.get(r.id) ?? null)
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </td>
                        <td className="max-w-[280px] truncate px-4 py-3 text-ink-muted">{r.reason}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[13px] font-medium text-ink-faint">
                          {timeAgo(r.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <IconAction label="View sent form" variant="outline" icon={Eye} onClick={() => setFormRef(r)} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <IconAction label="Track referral" variant="accent" icon={Activity} onClick={() => setTrackRef(r)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <ReferralFormModal
            referral={formRef}
            referrerName={board.myName}
            onClose={() => setFormRef(null)}
          />
          <ReferralTrackingModal
            referral={trackRef}
            alias={trackRef ? referralStudentName(trackRef, board.aliases ?? EMPTY_MAP) : ""}
            counselorName={
              trackRef?.assigned_counselor_id
                ? ((board.counselors ?? []).find((c) => c.id === trackRef.assigned_counselor_id)?.name ?? "Counselor")
                : "Unassigned — waiting for head"
            }
            sessionIso={trackRef ? (sessionSchedule.get(trackRef.id) ?? null) : null}
            sessionMode={trackRef ? (sessionMode.get(trackRef.id) ?? null) : null}
            trail={trackRef ? (trail.get(trackRef.id) ?? []) : []}
            actorNames={board.actorNames ?? EMPTY_MAP}
            onClose={() => setTrackRef(null)}
          />
        </>
      )}
    </div>
  );
}
