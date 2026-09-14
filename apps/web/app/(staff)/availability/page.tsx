"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { type AvailabilityInput } from "@dorsu/shared-schemas";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, Card, FieldError } from "@/components/ui/primitives";
import { Dropdown } from "@/components/shared/dropdown";
import { TimePicker } from "@/components/shared/time-picker";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type Counselor = { id: string; name: string; spec: string | null; available: boolean };
type Slot = {
  id: string;
  counselor_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  is_recurring: boolean;
};
type ApptLite = { counselor_id: string | null; scheduled_at: string; status: string };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];

function hhmm(t: string): string {
  return t.slice(0, 5);
}

function slotMinutes(s: Slot): number {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  return Math.max(0, toMin(s.end_time) - toMin(s.start_time));
}

function fmtHours(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Shared /availability — one URL, role-aware UI (same pattern as /appointments).
 * Counselors manage their own weekly slots; the head sees office coverage,
 * toggle counselor availability, and manage any counselor's slots.
 */
export default function AvailabilityPage() {
  const [role, setRole] = useState<string | null>(null);
  const [ownId, setOwnId] = useState<string | null>(null);
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [appts, setAppts] = useState<ApptLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [managedId, setManagedId] = useState<string>("");
  const [removeTarget, setRemoveTarget] = useState<Slot | null>(null);
  const [pendingSlots, setPendingSlots] = useState<{
    days: number[];
    startTime: string;
    endTime: string;
    isRecurring: boolean;
  } | null>(null);

  // Same time rules as the shared availabilitySchema, minus weekday
  // (days are picked as multi-chips and submitted as one row per day).
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
  const { register, handleSubmit, formState, setValue, watch } = useForm<Omit<AvailabilityInput, "weekday" | "counselorId">>({
    resolver: zodResolver(slotTimeSchema),
    defaultValues: { startTime: "09:00", endTime: "12:00", isRecurring: true },
  });
  const [slotDays, setSlotDays] = useState<number[]>([1]);

  const reload = async () => {
    const supabase = createClient();
    const [{ data: counselorRows }, { data: slotRows }, { data: apptRows }] = await Promise.all([
      supabase.from("counselors").select("id, profile_id, specialization, is_available").limit(100),
      supabase.from("counselor_availability").select("*").order("weekday").limit(500),
      supabase.from("appointments").select("counselor_id, scheduled_at, status").limit(500),
    ]);
    const list = ((counselorRows ?? []) as { id: string; profile_id: string; specialization: string | null; is_available: boolean }[]);
    const profileIds = list.map((c) => c.profile_id);
    let names = new Map<string, string>();
    if (profileIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", profileIds);
      names = new Map(((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? "Counselor"]));
    }
    const mapped = list.map((c) => ({
      id: c.id,
      name: names.get(c.profile_id) ?? "Counselor",
      spec: c.specialization,
      available: c.is_available,
    }));
    setCounselors(mapped);
    setSlots(((slotRows ?? []) as Slot[]));
    setAppts(((apptRows ?? []) as ApptLite[]));
    setManagedId((prev) => {
      if (prev && mapped.some((c) => c.id === prev)) return prev;
      return mapped[0]?.id ?? "";
    });
  };

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        const r = (profile as { role: string } | null)?.role ?? null;
        setRole(r);
        if (r === "counselor") {
          const { data } = await supabase.from("counselors").select("id").eq("profile_id", user.id).single();
          const cid = (data as { id: string } | null)?.id ?? null;
          setOwnId(cid);
          if (cid) setManagedId(cid);
        }
        if (r && ["counselor", "guidance_head"].includes(r)) await reload();
      } catch {
        toast.error("Couldn't load availability right now.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isOffice = role === "guidance_head";
  // Slot management is counselor-only — the head view is strictly read-only.
  const canManage = role === "counselor";
  const managed = counselors.find((c) => c.id === (role === "counselor" ? ownId : managedId));
  const managedSlots = useMemo(() => slots.filter((s) => s.counselor_id === managed?.id), [slots, managed]);

  const stats = useMemo(() => {
    const now = Date.now();
    const weekOut = now + 7 * 24 * 60 * 60 * 1000;
    const covered = new Set(slots.map((s) => s.weekday));
    return {
      counselors: counselors.length,
      available: counselors.filter((c) => c.available).length,
      slots: slots.length,
      uncovered: 7 - covered.size,
      next7: appts.filter((a) => {
        const t = new Date(a.scheduled_at).getTime();
        return t >= now && t <= weekOut && ["pending", "confirmed"].includes(a.status);
      }).length,
      unassigned: appts.filter((a) => !a.counselor_id && ["pending", "confirmed"].includes(a.status)).length,
    };
  }, [counselors, slots, appts]);

  const upcomingBy = useMemo(() => {
    const m = new Map<string, number>();
    const now = Date.now();
    for (const a of appts) {
      if (!a.counselor_id || !["pending", "confirmed"].includes(a.status)) continue;
      if (new Date(a.scheduled_at).getTime() < now) continue;
      m.set(a.counselor_id, (m.get(a.counselor_id) ?? 0) + 1);
    }
    return m;
  }, [appts]);

  const hoursBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of slots) m.set(s.counselor_id, (m.get(s.counselor_id) ?? 0) + slotMinutes(s));
    return m;
  }, [slots]);

  const coverage = useMemo(
    () =>
      MON_FIRST.map((d) => ({
        day: d,
        label: DAYS[d],
        items: slots
          .filter((s) => s.weekday === d)
          .map((s) => ({
            id: s.id,
            name: counselors.find((c) => c.id === s.counselor_id)?.name ?? "Counselor",
            range: `${hhmm(s.start_time)}–${hhmm(s.end_time)}`,
          }))
          .sort((a, b) => a.range.localeCompare(b.range)),
      })),
    [slots, counselors]
  );

  // Confirm dialogs: Escape closes, background stays put while open.
  useEffect(() => {
    if (!pendingSlots && !removeTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPendingSlots(null);
        setRemoveTarget(null);
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [pendingSlots, removeTarget]);

  const mutate = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await reload();
    } catch {
      toast.error(`Couldn't ${label} — please reload and try again.`);
    } finally {
      setBusy(false);
    }
  };

  if (!loading && (!role || !["counselor", "guidance_head"].includes(role))) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">Availability</h1>
        <Card><p className="text-sm text-ink-muted">Only counselors and the guidance head can open availability.</p></Card>
      </div>
    );
  }

  const statCards = [
    { label: "Counselors", value: stats.counselors },
    { label: "Marked available", value: stats.available },
    { label: "Weekly slots", value: stats.slots },
    { label: "Days uncovered", value: stats.uncovered },
    { label: "Sessions next 7 days", value: stats.next7 },
    { label: "Unassigned sessions", value: stats.unassigned },
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
            <BreadcrumbPage>Availability</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="font-display text-2xl font-bold">
          {role === "counselor" ? "My availability" : "Availability"}
        </h1>
        <p className="mt-1 max-w-[600px] text-sm leading-relaxed text-ink-muted">
          {role === "counselor"
            ? "Your weekly slots — students book against these, so keep them current."
            : "Office coverage at a glance — spot gap days and see each counselor's load. Slots are managed by each counselor."}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
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

      {/* Weekly coverage board */}
      <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <h2 className="font-display text-base font-bold text-ink">Weekly coverage</h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">Who holds open slots each day. Empty days can&apos;t take bookings.</p>
        {loading ? (
          <div className="mt-4 grid animate-pulse grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7" aria-hidden>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-ink/10" />
            ))}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {coverage.map((d) => (
              <div
                key={d.day}
                className={
                  d.items.length
                    ? "rounded-xl border border-ink/10 bg-cream px-3 py-2.5"
                    : "rounded-xl border-2 border-dashed border-red-300 bg-red-50 px-3 py-2.5"
                }
              >
                <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">{d.label}</p>
                {d.items.length ? (
                  <ul className="mt-1.5 space-y-1.5">
                    {d.items.map((it) => (
                      <li key={it.id} className="text-[13px] leading-snug">
                        <span className="block truncate font-bold text-ink">{it.name}</span>
                        <span className="font-medium text-ink-muted">{it.range}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-[13px] font-bold text-red-600">No coverage</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Counselor roster (office view — read-only) */}
      {isOffice && (
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <h2 className="font-display text-base font-bold text-ink">Counselors</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">The team roster and current load per counselor.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-xs uppercase text-ink-muted">
                  <th className="px-4 py-3">Counselor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Slots</th>
                  <th className="px-4 py-3 text-center">Weekly hrs</th>
                  <th className="px-4 py-3">Upcoming</th>
                </tr>
              </thead>
              <tbody>
                {counselors.map((c) => (
                  <tr key={c.id} className="border-b border-ink/5 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-bold text-ink">{c.name}</p>
                      <p className="text-xs font-medium text-ink-muted">{c.spec ?? "Counselor"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={c.available ? "success" : "warning"}>{c.available ? "Available" : "Unavailable"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">{slots.filter((s) => s.counselor_id === c.id).length}</td>
                    <td className="px-4 py-3 text-center">{fmtHours(hoursBy.get(c.id) ?? 0)}</td>
                    <td className="px-4 py-3">{upcomingBy.get(c.id) ?? 0} sessions</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && !counselors.length && (
              <p className="px-4 py-8 text-center text-sm text-ink-muted">No counselors yet — add them via the Users page.</p>
            )}
          </div>
        </section>
      )}

      {/* Slot manager — counselor only (head never sees this section) */}
      {canManage && (
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-ink">
                {role === "counselor" ? "My weekly slots" : "Manage slots"}
              </h2>
              <p className="mt-0.5 text-[13px] text-ink-muted">
                {managed
                  ? `${managed.name} · ${managedSlots.length} slot${managedSlots.length === 1 ? "" : "s"} · ${fmtHours(managedSlots.reduce((a, s) => a + slotMinutes(s), 0))}/week · ${upcomingBy.get(managed.id) ?? 0} upcoming`
                  : "Pick a counselor to manage their slots."}
              </p>
            </div>
            {isOffice && (
              <div className="w-full max-w-xs">
                <Dropdown
                  menuKey="managed-counselor"
                  openMenuKey={openMenuKey}
                  onOpenChange={setOpenMenuKey}
                  value={managedId}
                  onChange={setManagedId}
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
                  disabled={busy}
                  onClick={() => setRemoveTarget(s)}
                  className="shrink-0 text-[13px] font-bold text-red-600 hover:underline disabled:opacity-50"
                >
                  Remove
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
              <Button disabled={busy} className="mb-0.5">
                {slotDays.length > 1 ? `Add ${slotDays.length} slots` : "Add slot"}
              </Button>
            </form>
          )}
        </section>
      )}

      {/* Add-slots confirm */}
      {pendingSlots && managed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="slot-add-title"
          aria-describedby="slot-add-desc"
        >
          <div aria-hidden className="absolute inset-0 bg-ink/40" onClick={() => setPendingSlots(null)} />
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
              <Button size="sm" variant="outline" onClick={() => setPendingSlots(null)} autoFocus>
                Back
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={async () => {
                  const p = pendingSlots;
                  const cid = managed.id;
                  setPendingSlots(null);
                  await mutate(p.days.length > 1 ? `add ${p.days.length} slots` : "add this slot", async () => {
                    const { error } = await createClient().from("counselor_availability").insert(
                      p.days.map((weekday) => ({
                        counselor_id: cid,
                        weekday,
                        start_time: p.startTime,
                        end_time: p.endTime,
                        is_recurring: p.isRecurring,
                      }))
                    );
                    if (error) throw error;
                  });
                }}
              >
                {pendingSlots.days.length > 1 ? `Add ${pendingSlots.days.length} slots` : "Add slot"}
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
          <div aria-hidden className="absolute inset-0 bg-ink/40" onClick={() => setRemoveTarget(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-card">
            <h2 id="slot-remove-title" className="font-display text-lg font-bold text-ink">Remove this slot?</h2>
            <p id="slot-remove-desc" className="mt-1 text-sm leading-relaxed text-ink-muted">
              {DAYS[removeTarget.weekday]} · {hhmm(removeTarget.start_time)}–{hhmm(removeTarget.end_time)} will stop
              accepting new bookings. This can&apos;t be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setRemoveTarget(null)} autoFocus>
                Back
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={async () => {
                  const id = removeTarget.id;
                  setRemoveTarget(null);
                  await mutate("remove this slot", async () => {
                    const { error } = await createClient().from("counselor_availability").delete().eq("id", id);
                    if (error) throw error;
                  });
                }}
              >
                Remove slot
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
