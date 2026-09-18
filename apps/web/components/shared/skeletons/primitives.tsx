/**
 * Shared skeleton primitives — exact class matches for real views.
 *
 * Every skeleton here is content-only (rendered INSIDE StaffShell as
 * `children`). Do NOT include nav/sidebar chrome or the shell will appear
 * to flash on navigation.
 *
 * Conventions mirrored from real views:
 * - Page header: `h1 font-display text-2xl` + `max-w-[600px] text-sm` desc
 * - KPI cards: `rounded-lg border border-ink/10 bg-white p-6 shadow-card`
 *   with 3 lines (label 13px / value text-3xl / sub xs)
 * - Panels: `PanelShell` = `rounded-lg border border-ink/10 bg-white p-5`
 * - Charts: trend/bars `mt-4 h-[240px]`, donut `h-[200px]` + legend
 * - Lists: `mt-3 divide-y` rows `py-2.5`, skeleton rows `h-10 rounded-lg`
 * - Tables: `Card` + filter bar (`h-8` inputs/menus) + `Showing n of m`
 */

export function SkeletonRoot({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-w-0 animate-pulse space-y-4" aria-hidden role="status" aria-label="Loading">
      {children}
    </div>
  );
}

export function CrumbSkeleton({ width = "w-44" }: { width?: string }) {
  return <div className={`h-4 ${width} rounded-full bg-ink/10`} />;
}

/** Matches every `flex items-start justify-between` page header. */
export function PageHeaderSkeleton({
  descWidth = "max-w-[600px]",
  action = "stats",
}: {
  descWidth?: string;
  /** stats = h-8 Stats button · cta = rounded-full pill · filters = 2x h-8 · tabs = tab row · none */
  action?: "stats" | "cta" | "filters" | "tabs" | "buttons" | "none";
}) {
  return (
    <div className="space-y-3">
      <CrumbSkeleton />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="h-7 w-64 max-w-full rounded-lg bg-ink/10" />
          <div className={`mt-2 h-4 w-full ${descWidth} rounded-full bg-ink/10`} />
        </div>
        {action === "stats" && <div className="h-8 w-20 shrink-0 rounded border border-ink/10 bg-ink/10" />}
        {action === "cta" && <div className="h-9 w-36 shrink-0 rounded-full bg-ink/10" />}
        {action === "filters" && (
          <div className="flex shrink-0 items-center gap-2">
            <div className="h-8 w-32 rounded bg-ink/10" />
            <div className="h-8 w-40 rounded bg-ink/10" />
          </div>
        )}
        {action === "buttons" && (
          <div className="flex shrink-0 items-center gap-2">
            <div className="h-8 w-24 rounded-lg bg-ink/10" />
            <div className="h-8 w-32 rounded-lg bg-ink/10" />
          </div>
        )}
      </div>
      {action === "tabs" && (
        <div className="flex gap-2">
          <div className="h-9 w-36 rounded-lg bg-ink/10" />
          <div className="h-9 w-44 rounded-lg bg-ink/10" />
        </div>
      )}
    </div>
  );
}

/** Exact match for `p-6` 3-line KPI cards (faculty dash + all reports). */
export function KpiGridSkeleton({
  count,
  columns = "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
}: {
  count: number;
  columns?: string;
}) {
  return (
    <div className={`grid gap-4 ${columns}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-ink/10 bg-white p-6 shadow-card">
          <div className="h-3.5 w-2/3 rounded-full bg-ink/10" />
          <div className="mt-3 h-8 w-1/3 rounded-lg bg-ink/10" />
          <div className="mt-2 h-3 w-1/2 rounded-full bg-ink/10" />
        </div>
      ))}
    </div>
  );
}

/** Matches PanelShell chrome: h2 text-base + 13px hint + View all link. */
export function PanelShellSkeleton({
  rows = 3,
  rowHeight = "h-10",
  withHint = false,
  withViewAll = false,
  children,
}: {
  rows?: number;
  rowHeight?: string;
  withHint?: boolean;
  withViewAll?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="h-4 w-40 rounded-full bg-ink/10" />
          {withHint && <div className="mt-1.5 h-3 w-2/3 rounded-full bg-ink/10" />}
        </div>
        {withViewAll && <div className="h-4 w-14 shrink-0 rounded-full bg-ink/10" />}
      </div>
      {children ?? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className={`${rowHeight} rounded-lg bg-ink/10`} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Exact: `pt-4 h-[240px]` trend/bars block inside a PanelShell. */
export function ChartBlockSkeleton({ height = "h-[240px]" }: { height?: string }) {
  return (
    <div className="pt-4" aria-hidden>
      <div className={`${height} rounded-lg bg-ink/10`} />
    </div>
  );
}

/** Exact: `h-[200px]` donut + centered legend pills. */
export function DonutBlockSkeleton() {
  return (
    <div className="mt-4" aria-hidden>
      <div className="mx-auto h-[200px] w-2/3 rounded-full bg-ink/10" />
      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        <div className="h-4 w-20 rounded-full bg-ink/10" />
        <div className="h-4 w-24 rounded-full bg-ink/10" />
        <div className="h-4 w-16 rounded-full bg-ink/10" />
      </div>
    </div>
  );
}

/** Cream summary rows: `mt-4 space-y-3 bg-cream px-4 py-3` pills. */
export function CreamListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="mt-4 space-y-3 rounded-lg bg-cream px-4 py-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-8 rounded-lg bg-ink/10" />
      ))}
    </div>
  );
}

/** Progress-bar rows: `mt-4 space-y-3 h-2.5` bars (SessionMode/TopConcerns). */
export function ProgressBarsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mt-4 space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex justify-between">
            <div className="h-3 w-1/3 rounded-full bg-ink/10" />
            <div className="h-3 w-10 rounded-full bg-ink/10" />
          </div>
          <div className="h-2.5 w-full rounded-full bg-ink/10" />
        </div>
      ))}
    </div>
  );
}

/** Quick-links rows: `h-9 w-9` chip + 2 text lines + chevron. */
export function QuickLinksSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul className="mt-1 divide-y divide-ink/10" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 py-2.5">
          <div className="h-9 w-9 shrink-0 rounded-full bg-ink/10" />
          <div className="min-w-0 flex-1">
            <div className="h-3.5 w-1/2 rounded-full bg-ink/10" />
            <div className="mt-1.5 h-3 w-2/3 rounded-full bg-ink/10" />
          </div>
          <div className="h-4 w-4 shrink-0 rounded-full bg-ink/10" />
        </li>
      ))}
    </ul>
  );
}

/** Divide-y list rows: bold line + muted line + pill (sessions/referrals). */
export function DivideListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="mt-3 divide-y divide-ink/10" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-start justify-between gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="h-3.5 w-3/4 rounded-full bg-ink/10" />
            <div className="mt-1.5 h-3 w-1/2 rounded-full bg-ink/10" />
          </div>
          <div className="h-5 w-16 shrink-0 rounded-full bg-ink/10" />
        </li>
      ))}
    </ul>
  );
}

/** Card-grid (Needs confirmation / ReferralsWaiting): avatar + lines + CTA. */
export function ActionCardsSkeleton({ count = 2, columns = "sm:grid-cols-2" }: { count?: number; columns?: string }) {
  return (
    <div className={`mt-3 grid gap-3 ${columns}`} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-ink/10 bg-white p-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 shrink-0 rounded-full bg-ink/10" />
            <div className="min-w-0 flex-1">
              <div className="h-3.5 w-2/3 rounded-full bg-ink/10" />
              <div className="mt-1.5 h-3 w-1/2 rounded-full bg-ink/10" />
            </div>
            <div className="h-5 w-16 shrink-0 rounded-full bg-ink/10" />
          </div>
          <div className="h-3 w-full rounded-full bg-ink/10" />
          <div className="h-3 w-2/3 rounded-full bg-ink/10" />
        </div>
      ))}
    </div>
  );
}

/** In-card filter bar: search input + 2-3 hover menus + count line. */
export function FilterBarSkeleton({ menus = 3 }: { menus?: number }) {
  return (
    <div aria-hidden>
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-8 min-w-[200px] flex-1 rounded-lg bg-ink/10" />
        {Array.from({ length: menus }).map((_, i) => (
          <div key={i} className="h-8 w-28 rounded-lg bg-ink/10" />
        ))}
      </div>
      <div className="mt-3 h-3 w-40 rounded-full bg-ink/10" />
    </div>
  );
}

/** Wide table: header row + N body rows with avatar/pill/action cols. */
export function TableSkeleton({ rows = 4, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-ink/10" aria-hidden>
      <div className="grid gap-3 border-b border-ink/10 bg-cream/60 p-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3 rounded-full bg-ink/10" />
        ))}
      </div>
      <div className="divide-y divide-ink/10 bg-white">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="grid items-center gap-3 p-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className={c === 0 ? "flex items-center gap-2" : ""}>
                {c === 0 ? (
                  <>
                    <div className="h-8 w-8 shrink-0 rounded-full bg-ink/10" />
                    <div className="h-3.5 flex-1 rounded-full bg-ink/10" />
                  </>
                ) : (
                  <div className="h-3.5 rounded-full bg-ink/10" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
