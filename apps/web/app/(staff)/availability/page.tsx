"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  AVAILABILITY_BOARD_KEY,
  useAvailabilityBoard,
  type AvailabilityAppt,
  type AvailabilityBoardData,
  type AvailabilityCounselor,
  type AvailabilitySlot,
} from "@/lib/hooks/use-availability-board";
import { useMutationAction } from "@/lib/hooks/use-mutation-action";
import { patchBoard } from "@/lib/patch-board";
import { useManagedCounselor } from "@/lib/hooks/use-managed-counselor";
import { fmtHours, slotMinutes } from "@/lib/availability";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, Card, Input } from "@/components/ui/primitives";
import { CoverageGrid } from "@/components/availability/coverage-grid";
import { SLOT_ADD_BUSY_ID, SlotForm, type PendingSlots } from "@/components/availability/slot-form";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const EMPTY_COUNSELORS: AvailabilityCounselor[] = [];
const EMPTY_SLOTS: AvailabilitySlot[] = [];
const EMPTY_APPTS: AvailabilityAppt[] = [];

/**
 * Shared /availability — one URL, role-aware UI (same pattern as /appointments).
 * Counselors manage their own weekly slots; the head sees office coverage,
 * toggle counselor availability, and manage any counselor's slots.
 */
const byWeekday = (a: AvailabilitySlot, b: AvailabilitySlot) =>
  a.weekday - b.weekday || a.start_time.localeCompare(b.start_time);

export default function AvailabilityPage() {
  const qc = useQueryClient();
  const { data: board, isLoading, isError, refetch } = useAvailabilityBoard();
  const { busyId, run: runMutation } = useMutationAction();
  const role = board?.role ?? null;
  const ownId = board?.ownId ?? null;
  const counselors = board?.counselors ?? EMPTY_COUNSELORS;
  const slots = board?.slots ?? EMPTY_SLOTS;
  const appts = board?.appts ?? EMPTY_APPTS;
  const loading = isLoading && !board;
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [rosterQuery, setRosterQuery] = useState("");

  const { managedId, setManagedId } = useManagedCounselor({
    ready: !!board,
    role,
    ownId,
    counselors,
  });

  useEffect(() => {
    if (isError) toast.error("Couldn't load availability right now.");
  }, [isError]);

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

  const visibleCounselors = useMemo(() => {
    const q = rosterQuery.trim().toLowerCase();
    if (!q) return counselors;
    return counselors.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.spec ?? "").toLowerCase().includes(q)
    );
  }, [counselors, rosterQuery]);

  // Standard mutation lifecycle (same as /appointments): busy resolves the
  // moment the DB write settles (inside the hook's finally) — the cache is
  // patched in place and the full-board refetch reconciles in the background,
  // so the spinner never waits on refetches or notification delivery.
  // Errors map through the hook (friendly service messages pass through,
  // everything else becomes a reload-and-retry prompt). Returns true only
  // when the write landed, so the confirm dialog can stay open for retry.
  const patchSlots = (fn: (prev: AvailabilitySlot[]) => AvailabilitySlot[]) =>
    patchBoard<AvailabilityBoardData>(qc, [...AVAILABILITY_BOARD_KEY], (prev) => ({
      ...prev,
      slots: fn(prev.slots),
    }));

  const addSlots = async (p: PendingSlots, cid: string): Promise<boolean> => {
    const label = p.days.length > 1 ? `add ${p.days.length} slots` : "add this slot";
    const result = await runMutation(
      SLOT_ADD_BUSY_ID,
      async () => {
        const { data, error } = await createClient()
          .from("counselor_availability")
          .insert(
            p.days.map((weekday) => ({
              counselor_id: cid,
              weekday,
              start_time: p.startTime,
              end_time: p.endTime,
              is_recurring: p.isRecurring,
            }))
          )
          .select();
        if (error) throw error;
        return ((data ?? []) as AvailabilitySlot[]);
      },
      { label, friendly: /overlap|conflict|duplicate|valid|weekday|start|end|future/i }
    );
    if (!result.ok) return false;
    if (result.data.length) patchSlots((prev) => [...prev, ...result.data].sort(byWeekday));
    // Background reconcile — never awaited, never blocks the toast.
    void refetch().catch(() => {});
    toast.success(p.days.length > 1 ? `${p.days.length} slots added.` : "Slot added.", { position: "top-right" });
    return true;
  };

  const removeSlot = async (id: string): Promise<boolean> => {
    const result = await runMutation(
      id,
      async () => {
        const { error } = await createClient().from("counselor_availability").delete().eq("id", id);
        if (error) throw error;
      },
      { label: "remove this slot", friendly: /not found|permission|policy/i }
    );
    if (!result.ok) return false;
    patchSlots((prev) => prev.filter((s) => s.id !== id));
    // Background reconcile — never awaited, never blocks the toast.
    void refetch().catch(() => {});
    toast.success("Slot removed.", { position: "top-right" });
    return true;
  };

  // Live slot sync — the same realtime pipe as chat: inserts/updates/deletes
  // from any session patch the cached board in place, so a removal in another
  // tab (or the head's coverage view) lands here without a reload. The board
  // query uses keepPreviousData, so the list never flashes.
  useEffect(() => {
    if (role !== "counselor" && role !== "guidance_head") return;
    const ch = createClient()
      .channel("availability-board")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "counselor_availability" }, (p) => {
        const row = p.new as AvailabilitySlot;
        if (!row?.id) return;
        patchBoard<AvailabilityBoardData>(qc, [...AVAILABILITY_BOARD_KEY], (prev) =>
          prev.slots.some((s) => s.id === row.id)
            ? prev
            : { ...prev, slots: [...prev.slots, row].sort(byWeekday) }
        );
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "counselor_availability" }, (p) => {
        const row = p.new as AvailabilitySlot;
        if (!row?.id) return;
        patchBoard<AvailabilityBoardData>(qc, [...AVAILABILITY_BOARD_KEY], (prev) => ({
          ...prev,
          slots: prev.slots.map((s) => (s.id === row.id ? { ...s, ...row } : s)),
        }));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "counselor_availability" }, (p) => {
        const old = p.old as { id?: string } | null;
        if (!old?.id) return;
        patchBoard<AvailabilityBoardData>(qc, [...AVAILABILITY_BOARD_KEY], (prev) => ({
          ...prev,
          slots: prev.slots.filter((s) => s.id !== old.id),
        }));
      })
      .subscribe();
    return () => {
      createClient().removeChannel(ch);
    };
  }, [role, qc]);

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

      <div className="flex flex-wrap items-start justify-between gap-3">
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
        <div ref={statsRef} className="relative shrink-0" onMouseEnter={openStats} onMouseLeave={scheduleStatsClose}>
          <button
            type="button"
            onClick={toggleStats}
            onFocus={openStats}
            onBlur={scheduleStatsClose}
            aria-haspopup="dialog"
            aria-expanded={statsOpen}
            className="inline-flex h-8 items-center gap-1.5 rounded border border-ink/10 bg-white px-3 text-[13px] font-bold text-ink-soft shadow-card transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            Stats
            <ChevronDown aria-hidden className={cn("h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200", statsOpen && "rotate-180")} />
          </button>
          {statsOpen && (
            <div
              role="dialog"
              aria-label="Availability stats"
              className="absolute right-0 top-full z-20 mt-2 w-72 overflow-hidden rounded-lg border border-ink/10 bg-white py-1 shadow-card"
            >
              {loading ? (
                <div className="animate-pulse px-4 py-3" aria-hidden>
                  <div className="h-10 rounded-lg bg-ink/10" />
                  <div className="mt-2 h-10 rounded-lg bg-ink/10" />
                  <div className="mt-2 h-10 rounded-lg bg-ink/10" />
                </div>
              ) : (
                statCards.map((s) => (
                  <div
                    key={s.label}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left"
                  >
                    <span className="text-[13px] font-medium text-ink-muted">{s.label}</span>
                    <span className="font-display text-xl font-bold text-ink">{s.value}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Weekly coverage board */}
      <CoverageGrid slots={slots} counselors={counselors} loading={loading} />

      {/* Counselor roster (office view — read-only) */}
      {isOffice && (
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-ink">Counselors</h2>
              <p className="mt-0.5 text-[13px] text-ink-muted">The team roster and current load per counselor.</p>
            </div>
            <Input
              placeholder="Search counselors…"
              value={rosterQuery}
              onChange={(e) => setRosterQuery(e.target.value)}
              aria-label="Search counselors"
              className="w-full sm:w-56"
            />
          </div>
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
                {visibleCounselors.map((c) => (
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
            {!loading && !!counselors.length && !visibleCounselors.length && (
              <p className="px-4 py-8 text-center text-sm text-ink-muted">
                No counselors match “{rosterQuery.trim()}”.{" "}
                <button
                  type="button"
                  onClick={() => setRosterQuery("")}
                  className="font-bold text-primary-700 hover:underline"
                >
                  Clear search
                </button>
              </p>
            )}
          </div>
        </section>
      )}

      {/* Slot manager — counselor only (head never sees this section) */}
      {canManage && (
        <SlotForm
          role={role}
          isOffice={isOffice}
          counselors={counselors}
          managed={managed}
          managedId={managedId}
          onManagedChange={setManagedId}
          managedSlots={managedSlots}
          upcomingCount={managed ? (upcomingBy.get(managed.id) ?? 0) : 0}
          busyId={busyId}
          addBusy={busyId === SLOT_ADD_BUSY_ID}
          openMenuKey={openMenuKey}
          onOpenMenuChange={setOpenMenuKey}
          onAdd={addSlots}
          onRemove={removeSlot}
        />
      )}
    </div>
  );
}
