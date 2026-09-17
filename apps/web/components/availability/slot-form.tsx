"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { type AvailabilityInput } from "@dorsu/shared-schemas";
import type { AvailabilityCounselor, AvailabilitySlot } from "@/lib/hooks/use-availability-board";
import { DAYS, MON_FIRST, fmtHours, hhmm, slotMinutes } from "@/lib/availability";
import { Button, FieldError } from "@/components/ui/primitives";
import { Dropdown } from "@/components/shared/dropdown";
import { TimePicker } from "@/components/shared/time-picker";

export type PendingSlots = {
  days: number[];
  startTime: string;
  endTime: string;
  isRecurring: boolean;
};

/** Busy id for the add-slot mutation (removes use the slot id itself). */
export const SLOT_ADD_BUSY_ID = "slot-add";

// Same time rules as the shared availabilitySchema, minus weekday and
// counselorId (days are picked as multi-chips and submitted as one row per
// day; the counselor is resolved by the page). Kept local on purpose — the
// shared schema requires counselorId + weekday, so it is not equivalent.
const slotTimeSchema = z
  .object({
    startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use HH:MM"),
    endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use HH:MM"),
    isRecurring: z.boolean().default(true),
  })
  .refine((v) => v.startTime < v.endTime, {
    message: "Start time must be before end time",
    path: ["endTime"],
  });

/**
 * Slot manager — counselor-only section: the managed counselor's slot list,
 * the add-slot form (day chips + shared TimePickers), and the add/remove
 * confirm dialogs. The page owns persistence via onAdd/onRemove.
 */
export function SlotForm({
  role,
  isOffice,
  counselors,
  managed,
  managedId,
  onManagedChange,
  managedSlots,
  upcomingCount,
  busyId,
  addBusy,
  openMenuKey,
  onOpenMenuChange,
  onAdd,
  onRemove,
}: {
  role: string | null;
  isOffice: boolean;
  counselors: AvailabilityCounselor[];
  managed: AvailabilityCounselor | undefined;
  managedId: string;
  onManagedChange: (id: string) => void;
  managedSlots: AvailabilitySlot[];
  upcomingCount: number;
  /** In-flight mutation id (slot id for removes) — same contract as the appointments board. */
  busyId: string | null;
  /** True while the add-slot confirm is writing. */
  addBusy: boolean;
  openMenuKey: string | null;
  onOpenMenuChange: (k: string | null) => void;
  onAdd: (p: PendingSlots, counselorId: string) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
}) {
  const { register, handleSubmit, formState, setValue, watch } = useForm<Omit<AvailabilityInput, "weekday" | "counselorId">>({
    resolver: zodResolver(slotTimeSchema),
    defaultValues: { startTime: "09:00", endTime: "12:00", isRecurring: true },
  });
  const [slotDays, setSlotDays] = useState<number[]>([1]);
  const [removeTarget, setRemoveTarget] = useState<AvailabilitySlot | null>(null);
  const [pendingSlots, setPendingSlots] = useState<PendingSlots | null>(null);

  // The remove confirm stays open while its mutation is in flight (busyId
  // tracks the slot id) — same loading contract as the appointment dialogs:
  // spinner + blocked close, dialog closes only when the write lands so a
  // failure can be retried without reopening.
  const removing = removeTarget !== null && busyId === removeTarget.id;
  // Confirm dialogs: Escape closes, background stays put while open. Escape
  // and backdrop are blocked mid-write so a mutation is never orphaned.
  useEffect(() => {
    if (!pendingSlots && !removeTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (addBusy || removing) return;
      setPendingSlots(null);
      setRemoveTarget(null);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [pendingSlots, removeTarget, addBusy, removing]);

  return (
    <>
      <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-ink">
              {role === "counselor" ? "My weekly slots" : "Manage slots"}
            </h2>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              {managed
                ? `${managed.name} · ${managedSlots.length} slot${managedSlots.length === 1 ? "" : "s"} · ${fmtHours(managedSlots.reduce((a, s) => a + slotMinutes(s), 0))}/week · ${upcomingCount} upcoming`
                : "Pick a counselor to manage their slots."}
            </p>
          </div>
          {isOffice && (
            <div className="w-full max-w-xs">
              <Dropdown
                menuKey="managed-counselor"
                openMenuKey={openMenuKey}
                onOpenChange={onOpenMenuChange}
                value={managedId}
                onChange={onManagedChange}
                ariaLabel="Choose counselor to manage"
                options={counselors.map((c) => ({ value: c.id, label: c.name }))}
              />
            </div>
          )}
        </div>

        <ul className="mt-3 divide-y divide-ink/10">
          {managedSlots.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
                  {DAYS[s.weekday]}
                </span>
                <span className="truncate text-sm font-semibold text-ink">
                  {hhmm(s.start_time)}–{hhmm(s.end_time)}
                </span>
                <span className="shrink-0 text-xs font-medium text-ink-faint">
                  {s.is_recurring ? "Weekly" : "One-off"}
                </span>
              </div>
              <button
                type="button"
                disabled={busyId === s.id}
                onClick={() => setRemoveTarget(s)}
                className="inline-flex shrink-0 items-center gap-1 text-[13px] font-bold text-red-600 hover:underline disabled:opacity-50"
              >
                {busyId === s.id && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                {busyId === s.id ? "Removing…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
        {!managedSlots.length && (
          <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[13px] text-ink-muted">
            No slots yet — {managed ? "add the first one below." : "pick a counselor above first."}
          </p>
        )}

        {managed && (
          <form
            className="mt-4 flex flex-wrap items-end gap-3 border-t border-ink/10 pt-4"
            onSubmit={handleSubmit(async (v) => {
              if (!slotDays.length) {
                toast.error("Choose at least one day for the slot.");
                return;
              }
              setPendingSlots({
                days: [...slotDays].sort((a, b) => MON_FIRST.indexOf(a) - MON_FIRST.indexOf(b)),
                startTime: v.startTime,
                endTime: v.endTime,
                isRecurring: v.isRecurring,
              });
            })}
          >
            <div className="min-w-[220px] flex-1">
              <span className="mb-1 block text-xs font-bold text-ink-muted">Days</span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Slot days">
                {MON_FIRST.map((d) => {
                  const on = slotDays.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setSlotDays((prev) =>
                          prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
                        )
                      }
                      className={
                        on
                          ? "rounded-full bg-primary-600 px-3 py-1.5 text-xs font-bold text-white shadow-soft"
                          : "rounded-full bg-cream px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-cream-dark"
                      }
                    >
                      {DAYS[d]}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-[11px] font-medium text-ink-faint">Tick multiple days to repeat the slot.</p>
            </div>
            <div>
              <span className="mb-1 block text-xs font-bold text-ink-muted">Start</span>
              <TimePicker
                id="slot-start"
                value={watch("startTime")}
                onChange={(v) => setValue("startTime", v, { shouldValidate: true })}
                ariaLabel="Start time"
              />
            </div>
            <div>
              <span className="mb-1 block text-xs font-bold text-ink-muted">End</span>
              <TimePicker
                id="slot-end"
                value={watch("endTime")}
                onChange={(v) => setValue("endTime", v, { shouldValidate: true })}
                ariaLabel="End time"
              />
              <FieldError message={formState.errors.endTime?.message} />
            </div>
            <label className="flex items-center gap-2 pb-2.5 text-sm font-semibold text-ink-soft">
              <input type="checkbox" className="h-4 w-4 accent-[#2563EB]" {...register("isRecurring")} />
              Repeats weekly
            </label>
            <Button disabled={busyId !== null} className="mb-0.5">
              {slotDays.length > 1 ? `Add ${slotDays.length} slots` : "Add slot"}
            </Button>
          </form>
        )}
      </section>

      {/* Add-slots confirm */}
      {pendingSlots && managed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="slot-add-title"
          aria-describedby="slot-add-desc"
        >
          <div aria-hidden className="absolute inset-0 bg-ink/40" onClick={() => { if (!addBusy) setPendingSlots(null); }} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-card">
            <h2 id="slot-add-title" className="font-display text-lg font-bold text-ink">
              Add {pendingSlots.days.length} slot{pendingSlots.days.length === 1 ? "" : "s"}?
            </h2>
            <p id="slot-add-desc" className="mt-1 text-sm leading-relaxed text-ink-muted">
              This opens new bookings for {managed.name}.
            </p>
            <div className="mt-3 space-y-1.5 rounded-xl bg-cream px-3 py-2.5 text-[13px] font-semibold text-ink-soft">
              <p>{pendingSlots.days.map((d) => DAYS[d]).join(", ")}</p>
              <p>
                {pendingSlots.startTime}–{pendingSlots.endTime} · {pendingSlots.isRecurring ? "Repeats weekly" : "One-off"}
              </p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="outline" disabled={addBusy} onClick={() => setPendingSlots(null)} autoFocus>
                Back
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={addBusy}
                onClick={() => {
                  const p = pendingSlots;
                  const cid = managed.id;
                  void (async () => {
                    const ok = await onAdd(p, cid);
                    if (ok) setPendingSlots(null);
                  })();
                }}
              >
                {addBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {addBusy ? "Adding…" : pendingSlots.days.length > 1 ? `Add ${pendingSlots.days.length} slots` : "Add slot"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Remove-slot confirm */}
      {removeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="slot-remove-title"
          aria-describedby="slot-remove-desc"
        >
          <div aria-hidden className="absolute inset-0 bg-ink/40" onClick={() => { if (!removing) setRemoveTarget(null); }} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-card">
            <h2 id="slot-remove-title" className="font-display text-lg font-bold text-ink">Remove this slot?</h2>
            <p id="slot-remove-desc" className="mt-1 text-sm leading-relaxed text-ink-muted">
              {DAYS[removeTarget.weekday]} · {hhmm(removeTarget.start_time)}–{hhmm(removeTarget.end_time)} will stop
              accepting new bookings. This can&apos;t be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="outline" disabled={removing} onClick={() => setRemoveTarget(null)} autoFocus>
                Back
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={removing}
                onClick={() => {
                  const id = removeTarget.id;
                  void (async () => {
                    const ok = await onRemove(id);
                    if (ok) setRemoveTarget(null);
                  })();
                }}
              >
                {removing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {removing ? "Removing…" : "Remove slot"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
