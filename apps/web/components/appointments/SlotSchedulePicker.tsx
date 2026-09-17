"use client";

import Link from "next/link";
import { useState } from "react";
import { Clock } from "lucide-react";
import { Dropdown } from "@/components/shared/dropdown";
import type { BoardSlot } from "@/lib/hooks/use-appointments-board";

export type ScheduleSelection = { date: string; start: string; end: string };

/** How far ahead the counselor may place a session. */
export const SCHEDULE_WINDOW_DAYS = 28;
/** Time-step granularity (matches the app's quarter-hour convention). */
const STEP_MINS = 15;
/** Default session length when seeding the picker. */
const DEFAULT_LENGTH_MINS = 60;

type Window = { start: number; end: number };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function hhmmToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minsToHHMM(mins: number): string {
  return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
}

function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${period}`;
}

function dayToMs(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function inValidRange(slot: BoardSlot, dayMs: number): boolean {
  if (!slot.valid_from && !slot.valid_to) return true;
  if (slot.valid_from) {
    const from = dayToMs(slot.valid_from.slice(0, 10));
    if (from !== null && dayMs < from) return false;
  }
  if (slot.valid_to) {
    const to = dayToMs(slot.valid_to.slice(0, 10));
    if (to !== null && dayMs > to) return false;
  }
  return true;
}

/** Availability windows (minutes) covering a calendar date. */
export function slotWindowsForDate(slots: BoardSlot[], dateISO: string): Window[] {
  const d = parseISODate(dateISO);
  if (!d) return [];
  const dayMs = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return slots
    .filter((s) => s.weekday === d.getDay() && inValidRange(s, dayMs))
    .map((s) => ({ start: hhmmToMins(s.start_time), end: hhmmToMins(s.end_time) }))
    .filter((w) => w.end > w.start)
    .sort((a, b) => a.start - b.start);
}

/** Upcoming dates (local yyyy-mm-dd) that carry at least one slot window. */
export function validScheduleDates(slots: BoardSlot[], days = SCHEDULE_WINDOW_DAYS): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const iso = toISODate(d);
    if (slotWindowsForDate(slots, iso).length) out.push(iso);
  }
  return out;
}

/** 15-minute start options inside a date's windows (future-only for today). */
export function startOptionsForDate(slots: BoardSlot[], dateISO: string, nowMs = Date.now()): string[] {
  const opts: string[] = [];
  for (const w of slotWindowsForDate(slots, dateISO)) {
    for (let t = Math.ceil(w.start / STEP_MINS) * STEP_MINS; t + STEP_MINS <= w.end; t += STEP_MINS) {
      const dt = new Date(`${dateISO}T${minsToHHMM(t)}:00`);
      if (Number.isNaN(dt.getTime()) || dt.getTime() <= nowMs) continue;
      opts.push(minsToHHMM(t));
    }
  }
  return [...new Set(opts)].sort();
}

/** 15-minute end options after `start` inside the SAME window. */
export function endOptionsForDate(slots: BoardSlot[], dateISO: string, startHHMM: string): string[] {
  const start = hhmmToMins(startHHMM);
  const win = slotWindowsForDate(slots, dateISO).find((w) => start >= w.start && start + STEP_MINS <= w.end);
  if (!win) return [];
  const opts: string[] = [];
  for (let t = start + STEP_MINS; t <= win.end; t += STEP_MINS) opts.push(minsToHHMM(t));
  return opts;
}

/** Client-side mirror of the service scope gate (service is source of truth). */
export function selectionFitsScope(slots: BoardSlot[], sel: ScheduleSelection): boolean {
  const wins = slotWindowsForDate(slots, sel.date);
  const s = hhmmToMins(sel.start);
  const e = hhmmToMins(sel.end);
  if (!(s < e)) return false;
  return wins.some((w) => s >= w.start && e <= w.end);
}

/** Compose a browser-local Date from a date + "HH:MM" pair. */
export function composeLocal(dateISO: string, hhmm: string): Date {
  return new Date(`${dateISO}T${hhmm}:00`);
}

/**
 * Seed a selection: keep the existing schedule when it already sits inside
 * the availability scope (reschedule reopen), otherwise the first valid
 * window (60 minutes, clamped to the slot).
 */
export function defaultSchedule(slots: BoardSlot[], seedFrom?: Date | null): ScheduleSelection | null {
  if (seedFrom && !Number.isNaN(seedFrom.getTime()) && seedFrom.getTime() > Date.now()) {
    const date = toISODate(seedFrom);
    const start = minsToHHMM(seedFrom.getHours() * 60 + Math.floor(seedFrom.getMinutes() / STEP_MINS) * STEP_MINS);
    const wins = slotWindowsForDate(slots, date);
    const s = hhmmToMins(start);
    const win = wins.find((w) => s >= w.start && s + STEP_MINS <= w.end);
    if (win) {
      const end = Math.min(s + DEFAULT_LENGTH_MINS, win.end);
      if (end > s) return { date, start, end: minsToHHMM(end) };
    }
  }
  for (const date of validScheduleDates(slots)) {
    const starts = startOptionsForDate(slots, date);
    if (!starts.length) continue;
    const start = starts[0];
    const ends = endOptionsForDate(slots, date, start);
    if (!ends.length) continue;
    const want = minsToHHMM(hhmmToMins(start) + DEFAULT_LENGTH_MINS);
    return { date, start, end: ends.includes(want) ? want : ends[ends.length - 1] };
  }
  return null;
}

function dateLabel(iso: string): string {
  const d = parseISODate(iso);
  if (!d) return iso;
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const rel = dd === t0 ? "Today" : dd === t0 + 24 * 60 * 60 * 1000 ? "Tomorrow" : null;
  const base = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return rel ? `${rel} · ${base}` : base;
}

/**
 * Availability-scoped schedule picker — date + start + end dropdowns whose
 * options only ever come from the counselor's own availability slots.
 * The service layer re-validates the scope, so a bypassed UI still fails.
 */
export function SlotSchedulePicker({
  slots,
  value,
  onChange,
}: {
  slots: BoardSlot[];
  value: ScheduleSelection | null;
  onChange: (v: ScheduleSelection) => void;
}) {
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const dates = validScheduleDates(slots);

  if (!dates.length) {
    return (
      <div className="rounded-2xl border border-ink/15 bg-white p-4 shadow-card">
        <p className="text-sm font-bold text-ink">No availability windows</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
          You have no slots in the next {SCHEDULE_WINDOW_DAYS} days — sessions must fall inside your
          availability.{" "}
          <Link href="/availability" className="font-bold text-primary-700 hover:underline">
            Set your slots first
          </Link>
          .
        </p>
      </div>
    );
  }

  const date = value && dates.includes(value.date) ? value.date : dates[0];
  const starts = startOptionsForDate(slots, date);
  const start = value && starts.includes(value.start) ? value.start : (starts[0] ?? "");
  const ends = start ? endOptionsForDate(slots, date, start) : [];
  const end = value && ends.includes(value.end) ? value.end : (ends[ends.length - 1] ?? "");
  const win = start ? slotWindowsForDate(slots, date).find((w) => hhmmToMins(start) >= w.start && hhmmToMins(start) + STEP_MINS <= w.end) : null;

  return (
    <div role="group" aria-label="Session schedule inside your availability" className="rounded-2xl border border-ink/15 bg-white p-4 shadow-card">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink-muted">
        <Clock className="h-3.5 w-3.5" aria-hidden /> Date, start and end — inside your availability only
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Dropdown
          menuKey="sched-date"
          openMenuKey={openMenuKey}
          onOpenChange={setOpenMenuKey}
          value={date}
          onChange={(v) => {
            const ns = startOptionsForDate(slots, v)[0] ?? "";
            const ne = ns ? endOptionsForDate(slots, v, ns) : [];
            onChange({ date: v, start: ns, end: ne[ne.length - 1] ?? "" });
          }}
          ariaLabel="Session date"
          options={dates.map((d) => ({ value: d, label: dateLabel(d) }))}
        />
        <Dropdown
          menuKey="sched-start"
          openMenuKey={openMenuKey}
          onOpenChange={setOpenMenuKey}
          value={start}
          onChange={(v) => {
            const ne = endOptionsForDate(slots, date, v);
            onChange({ date, start: v, end: ne[ne.length - 1] ?? "" });
          }}
          ariaLabel="Start time"
          options={starts.map((t) => ({ value: t, label: to12h(t) }))}
        />
        <Dropdown
          menuKey="sched-end"
          openMenuKey={openMenuKey}
          onOpenChange={setOpenMenuKey}
          value={end}
          onChange={(v) => onChange({ date, start, end: v })}
          ariaLabel="End time"
          options={ends.map((t) => ({ value: t, label: to12h(t) }))}
        />
      </div>
      <p className="mt-1.5 text-[11px] font-medium text-ink-faint">
        {win
          ? `Inside your ${to12h(minsToHHMM(win.start))}–${to12h(minsToHHMM(win.end))} slot.`
          : "Pick a date and start time first."}
      </p>
    </div>
  );
}
