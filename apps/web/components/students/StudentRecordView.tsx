"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, ClipboardList, ExternalLink, FileText, Inbox, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { EmptyState, PanelShell } from "@/components/shared/panel-shell";
import { useStudentRecord, type StudentTimelineRow } from "@/lib/hooks/use-student-record";
import { SessionNotesModal } from "@/components/appointments/SessionNotesModal";
import { formatWhen } from "@/lib/format";
import { cn } from "@/lib/utils";

const EVENT_META: Record<string, { label: string; icon: typeof CalendarDays; tone: string }> = {
  session: { label: "Session", icon: CalendarDays, tone: "bg-blue-100 text-blue-800" },
  referral: { label: "Referral", icon: Inbox, tone: "bg-amber-100 text-amber-800" },
  screening: { label: "Screening", icon: ClipboardList, tone: "bg-primary-100 text-primary-800" },
  feedback: { label: "Feedback", icon: FileText, tone: "bg-emerald-100 text-emerald-800" },
  note: { label: "Note", icon: FileText, tone: "bg-cream text-ink-soft" },
  follow_up: { label: "Follow-up", icon: CalendarDays, tone: "bg-accent-100 text-accent-700" },
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "session", label: "Sessions" },
  { key: "referral", label: "Referrals" },
  { key: "screening", label: "Screenings" },
  { key: "note", label: "Notes" },
  { key: "feedback", label: "Feedback" },
  { key: "follow_up", label: "Follow-ups" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function bandTone(band: string): string {
  if (band === "high") return "bg-accent-700 text-white";
  if (band === "moderate") return "bg-accent-100 text-accent-700";
  return "bg-primary-100 text-primary-800";
}

function monthLabel(iso: string | null): string {
  if (!iso) return "Undated";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Undated";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function TimelineItem({ row, onReadNote }: { row: StudentTimelineRow; onReadNote: (row: StudentTimelineRow) => void }) {
  const meta = EVENT_META[row.event_type] ?? {
    label: row.event_type,
    icon: FileText,
    tone: "bg-cream text-ink-soft",
  };
  const Icon = meta.icon;
  const canReadNote = row.event_type === "note" && !!row.appointment_id;

  return (
    <li className="relative pl-8">
      <span className="absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white ring-1 ring-ink/10">
        <Icon aria-hidden className="h-3.5 w-3.5 text-ink-muted" />
      </span>
      <div className="rounded-lg border border-ink/10 bg-white p-3 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", meta.tone)}>
            {meta.label}
          </span>
          {row.band && (
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold capitalize", bandTone(row.band))}>
              {row.band}
            </span>
          )}
          {row.rating != null && (
            <span className="text-[11px] font-bold text-accent-500" aria-label={`${row.rating} out of 5 stars`}>
              {"★".repeat(row.rating)}
            </span>
          )}
          <span className="ml-auto text-[11px] font-medium text-ink-faint">
            {row.occurred_at ? formatWhen(row.occurred_at) : "—"}
          </span>
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm font-semibold text-ink">{row.label ?? meta.label}</p>
        {row.status && row.event_type !== "screening" && (
          <p className="mt-0.5 text-[11px] font-medium capitalize text-ink-muted">{row.status.replace(/_/g, " ")}</p>
        )}
        {row.score != null && (
          <p className="mt-0.5 text-[11px] font-medium text-ink-muted">PSS-10 score {row.score}/40</p>
        )}
        {row.event_type === "session" && (
          <Link
            href={`/appointments#focus-${row.appointment_id ?? row.event_id}`}
            className="mt-2 inline-flex h-7 items-center gap-1 rounded border border-ink/10 bg-white px-2.5 text-[11px] font-bold text-ink-soft transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            Open session <ExternalLink aria-hidden className="h-3 w-3" />
          </Link>
        )}
        {canReadNote && (
          <button
            type="button"
            onClick={() => onReadNote(row)}
            className="mt-2 inline-flex h-7 items-center rounded border border-ink/10 bg-white px-2.5 text-[11px] font-bold text-ink-soft transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            Read note
          </button>
        )}
      </div>
    </li>
  );
}

export function StudentRecordView({ studentId }: { studentId: string }) {
  const { data, isPending, isError, error, refetch } = useStudentRecord(studentId);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [openNote, setOpenNote] = useState<StudentTimelineRow | null>(null);

  const timeline = data?.timeline ?? [];
  const filtered = useMemo(
    () => (filter === "all" ? timeline : timeline.filter((row) => row.event_type === filter)),
    [timeline, filter]
  );
  const groups = useMemo(() => {
    const map = new Map<string, StudentTimelineRow[]>();
    for (const row of filtered) {
      const key = monthLabel(row.occurred_at);
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [filtered]);

  const counts = data?.counts ?? null;
  const role = data?.viewerRole ?? null;
  const oversight = role === "guidance_head" || role === "admin";
  const alias = data?.header.anonymous_alias ?? "Student record";

  if (isPending) {
    return (
      <div className="animate-pulse space-y-4" aria-hidden>
        <div className="h-8 w-56 rounded-lg bg-ink/10" />
        <div className="h-28 rounded-lg bg-ink/10" />
        <div className="h-64 rounded-lg bg-ink/10" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <Link
          href="/students"
          className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink-muted transition hover:text-ink"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" /> Back to students
        </Link>
        <Card>
          <p className="text-sm font-bold text-ink">Couldn&apos;t open this student record</p>
          <p className="mt-1 text-[13px] text-ink-muted">
            {(error as Error)?.message ?? "It may be outside your caseload."}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 inline-flex h-8 items-center rounded bg-primary-600 px-4 text-[13px] font-bold text-white transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            Try again
          </button>
        </Card>
      </div>
    );
  }

  const { header } = data;
  const summary = [
    { label: "Sessions booked", value: counts?.total_sessions ?? 0 },
    { label: "Sessions completed", value: counts?.completed_sessions ?? 0 },
    { label: "Open referrals", value: counts?.open_referrals ?? 0 },
    { label: "Follow-ups due", value: counts?.follow_ups_due ?? 0 },
  ];

  return (
    <div className="space-y-5">
      <Link
        href="/students"
        className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink-muted transition hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back to students
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold">{alias}</h1>
            {counts?.latest_band && (
              <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize", bandTone(counts.latest_band))}>
                Latest: {counts.latest_band}
              </span>
            )}
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                oversight ? "bg-amber-100 text-amber-800" : "bg-primary-100 text-primary-800"
              )}
            >
              {oversight ? "Oversight view" : "On my caseload"}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {[header.program, header.year_level, header.college].filter(Boolean).join(" · ") || "No program on file"}
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-faint">
            <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
            Alias-only record · note text is read per session, never in this timeline
          </p>
        </div>
        <p className="text-[11px] font-medium text-ink-faint">On record since {formatWhen(header.created_at)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summary.map((s) => (
          <div key={s.label} className="rounded-lg border border-ink/10 bg-white p-4 shadow-card">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{s.label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-ink">{s.value}</p>
          </div>
        ))}
      </div>

      <PanelShell
        title="Session timeline"
        hint="Sessions, referrals, screenings, feedback, notes, and follow-ups in one place."
      >
        <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filter timeline">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                filter === f.key
                  ? "bg-primary-600 text-white"
                  : "border border-ink/10 bg-white text-ink-muted hover:border-primary-300 hover:text-primary-700"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {groups.length ? (
          <div className="space-y-5">
            {groups.map(([month, rows]) => (
              <section key={month}>
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint">{month}</h3>
                <ol className="relative space-y-3 before:absolute before:bottom-3 before:left-3 before:top-3 before:w-px before:bg-ink/10">
                  {rows.map((row) => (
                    <TimelineItem
                      key={`${row.event_type}-${row.event_id}-${row.occurred_at ?? ""}`}
                      row={row}
                      onReadNote={setOpenNote}
                    />
                  ))}
                </ol>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CalendarDays}
            title={timeline.length ? "Nothing in this filter" : "No activity yet"}
            hint={
              timeline.length
                ? "Try another filter to see the rest of this record."
                : "Sessions, referrals, and screenings will appear here as they are recorded."
            }
          />
        )}
      </PanelShell>

      {openNote && (
        <SessionNotesModal
          appt={{ id: openNote.appointment_id as string, scheduled_at: openNote.occurred_at ?? "", ends_at: null }}
          studentLabel={alias}
          studentProfileId={null}
          editable={!oversight && role === "counselor"}
          enforceFollowUpScope={false}
          headIds={[]}
          onClose={() => setOpenNote(null)}
        />
      )}
    </div>
  );
}
