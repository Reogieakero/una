import {
  ChartBlockSkeleton,
  DivideListSkeleton,
  DonutBlockSkeleton,
  FilterBarSkeleton,
  PageHeaderSkeleton,
  PanelShellSkeleton,
  SkeletonRoot,
  TableSkeleton,
} from "./primitives";

/** Shared board chrome: header + tabs/filter + single Card table. */
function BoardShell({
  action = "stats",
  tabs = false,
  menus = 3,
  cols = 7,
  rows = 4,
}: {
  action?: "stats" | "cta" | "filters" | "tabs" | "buttons" | "none";
  tabs?: boolean;
  menus?: number;
  cols?: number;
  rows?: number;
}) {
  return (
    <SkeletonRoot>
      <PageHeaderSkeleton action={action} />
      {tabs && (
        <div className="flex gap-2">
          <div className="h-9 w-40 rounded-lg bg-ink/10" />
          <div className="h-9 w-48 rounded-lg bg-ink/10" />
        </div>
      )}
      <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-card">
        <FilterBarSkeleton menus={menus} />
        <TableSkeleton rows={rows} cols={cols} />
      </div>
    </SkeletonRoot>
  );
}

/** /appointments: tabs (Appointments / Follow-ups) + 7-col table, Stats hidden. */
export function AppointmentsSkeleton() {
  return <BoardShell action="stats" tabs menus={3} cols={7} rows={4} />;
}

/** /referrals: List/Grid toggle + 8-col table/cards, 6 hidden stats. */
export function ReferralsSkeleton() {
  return (
    <SkeletonRoot>
      <PageHeaderSkeleton action="stats" />
      <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-8 min-w-[200px] flex-1 rounded-lg bg-ink/10" />
          <div className="h-8 w-28 rounded-lg bg-ink/10" />
          <div className="h-8 w-28 rounded-lg bg-ink/10" />
          <div className="h-8 w-28 rounded-lg bg-ink/10" />
          <div className="h-8 w-20 rounded-lg bg-ink/10" />
        </div>
        <div className="mt-3 h-3 w-40 rounded-full bg-ink/10" />
        <TableSkeleton rows={4} cols={8} />
      </div>
    </SkeletonRoot>
  );
}

/**
 * /students: hidden 6-stat menu + 2x xl:2 grids (Needs attention list +
 * per-program bars / screening donut + Never booked) + 6-col directory table.
 */
export function StudentsSkeleton() {
  return (
    <SkeletonRoot>
      <PageHeaderSkeleton action="stats" />
      <div className="grid gap-4 xl:grid-cols-2">
        <PanelShellSkeleton withHint>
          <DivideListSkeleton rows={3} />
        </PanelShellSkeleton>
        <PanelShellSkeleton withHint>
          <ChartBlockSkeleton />
        </PanelShellSkeleton>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <PanelShellSkeleton withHint>
          <DonutBlockSkeleton />
        </PanelShellSkeleton>
        <PanelShellSkeleton withHint>
          <DivideListSkeleton rows={3} />
        </PanelShellSkeleton>
      </div>
      <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-card">
        <FilterBarSkeleton menus={3} />
        <TableSkeleton rows={5} cols={6} />
      </div>
    </SkeletonRoot>
  );
}

/** /announcements feed: narrow max-w-2xl composer + avatar cards. */
export function AnnouncementsSkeleton() {
  return (
    <SkeletonRoot>
      <PageHeaderSkeleton action="stats" />
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-ink/10" />
            <div className="h-8 flex-1 rounded-lg bg-ink/10" />
          </div>
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-ink/10" />
              <div className="flex-1">
                <div className="h-3.5 w-1/3 rounded-full bg-ink/10" />
                <div className="mt-1.5 h-3 w-1/4 rounded-full bg-ink/10" />
              </div>
            </div>
            <div className="mt-3 h-4 w-2/3 rounded-full bg-ink/10" />
            <div className="mt-2 h-16 rounded-lg bg-ink/10" />
          </div>
        ))}
      </div>
    </SkeletonRoot>
  );
}

/** /notifications: hidden 4 stats + Mark-all-read + 1 inbox card, h-16 rows. */
export function NotificationsSkeleton() {
  return (
    <SkeletonRoot>
      <PageHeaderSkeleton action="buttons" />
      <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-card">
        <FilterBarSkeleton menus={2} />
        <ul className="mt-3 divide-y divide-ink/10" aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="flex items-start gap-3 py-3">
              <div className="h-10 w-10 shrink-0 rounded-full bg-ink/10" />
              <div className="min-w-0 flex-1">
                <div className="h-3.5 w-2/3 rounded-full bg-ink/10" />
                <div className="mt-1.5 h-3 w-full rounded-full bg-ink/10" />
                <div className="mt-1.5 h-3 w-1/4 rounded-full bg-ink/10" />
              </div>
              <div className="h-5 w-16 shrink-0 rounded-full bg-ink/10" />
            </li>
          ))}
        </ul>
      </div>
    </SkeletonRoot>
  );
}

/**
 * /feedback: hidden 6 stats + verdict banner + 3x xl:2 grids
 * (bars/lines h-240, donut h-200, word pills, follow-ups) + recent list.
 */
export function FeedbackSkeleton() {
  return (
    <SkeletonRoot>
      <PageHeaderSkeleton action="stats" />
      <div className="flex items-center gap-3 rounded-lg border border-ink/10 bg-white p-4 shadow-card">
        <div className="h-8 w-20 rounded-full bg-ink/10" />
        <div className="h-4 w-64 rounded-full bg-ink/10" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <PanelShellSkeleton>
          <ChartBlockSkeleton />
        </PanelShellSkeleton>
        <PanelShellSkeleton>
          <ChartBlockSkeleton />
        </PanelShellSkeleton>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <PanelShellSkeleton>
          <DonutBlockSkeleton />
        </PanelShellSkeleton>
        <PanelShellSkeleton>
          <DivideListSkeleton rows={3} />
        </PanelShellSkeleton>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <div className="h-4 w-40 rounded-full bg-ink/10" />
          <div className="mt-4 flex flex-wrap gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-7 w-20 rounded-full bg-ink/10" />
            ))}
          </div>
        </section>
        <PanelShellSkeleton rows={3} rowHeight="h-16" />
      </div>
      <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-card">
        <div className="h-4 w-44 rounded-full bg-ink/10" />
        <div className="mt-3">
          <FilterBarSkeleton menus={1} />
        </div>
        <DivideListSkeleton rows={3} />
      </div>
    </SkeletonRoot>
  );
}

/** /users (admin): Stats pill + 1 directory card, 6-col table, h-10 rows. */
export function UsersSkeleton() {
  return <BoardShell action="stats" menus={2} cols={6} rows={5} />;
}

/**
 * /security (admin): 4 visible cards md:4 + xl:2 (break-glass form +
 * preview 2 rows) + full-width audit trail + access matrix.
 */
export function SecuritySkeleton() {
  return (
    <SkeletonRoot>
      <PageHeaderSkeleton action="none" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
            <div className="h-3.5 w-2/3 rounded-full bg-ink/10" />
            <div className="mt-3 h-8 w-1/3 rounded-lg bg-ink/10" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <div className="h-4 w-44 rounded-full bg-ink/10" />
          <div className="mt-4 space-y-3">
            <div className="h-10 rounded-lg bg-ink/10" />
            <div className="h-20 rounded-lg bg-ink/10" />
            <div className="h-9 w-32 rounded-lg bg-ink/10" />
          </div>
        </section>
        <PanelShellSkeleton rows={2} rowHeight="h-12" withViewAll />
      </div>
      <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <div className="h-4 w-40 rounded-full bg-ink/10" />
        <div className="mt-4 max-h-[320px] space-y-3">
          <div className="h-10 rounded-lg bg-ink/10" />
          <div className="h-10 rounded-lg bg-ink/10" />
          <div className="h-10 rounded-lg bg-ink/10" />
        </div>
      </section>
      <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <div className="h-4 w-48 rounded-full bg-ink/10" />
        <div className="mt-4 space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 rounded-lg bg-ink/10" />
          ))}
        </div>
      </section>
    </SkeletonRoot>
  );
}

/** /security/events: 3-level crumb + filter card md:2 + list h-12 rows. */
export function AccessEventsSkeleton() {
  return (
    <SkeletonRoot>
      <div className="h-4 w-56 rounded-full bg-ink/10" />
      <div>
        <div className="h-7 w-56 rounded-lg bg-ink/10" />
        <div className="mt-2 h-4 w-full max-w-[600px] rounded-full bg-ink/10" />
      </div>
      <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex gap-2">
            <div className="h-8 w-24 rounded-lg bg-ink/10" />
            <div className="h-8 w-28 rounded-lg bg-ink/10" />
          </div>
          <div className="h-8 rounded-lg bg-ink/10" />
        </div>
        <div className="mt-3 h-3 w-40 rounded-full bg-ink/10" />
      </div>
      <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-ink/10" />
          ))}
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** /backups: header buttons + latest banner + 6-col history + runbook. */
export function BackupsSkeleton() {
  return (
    <SkeletonRoot>
      <PageHeaderSkeleton action="buttons" />
      <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-ink/10" />
          <div className="flex-1">
            <div className="h-4 w-1/3 rounded-full bg-ink/10" />
            <div className="mt-1.5 h-3 w-2/3 rounded-full bg-ink/10" />
          </div>
          <div className="h-6 w-20 rounded-full bg-ink/10" />
        </div>
        <div className="mt-3 h-3 w-full rounded-full bg-ink/10" />
      </div>
      <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-card">
        <div className="h-4 w-40 rounded-full bg-ink/10" />
        <TableSkeleton rows={3} cols={6} />
      </div>
      <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <div className="h-4 w-48 rounded-full bg-ink/10" />
        <div className="mt-3 space-y-2">
          <div className="h-3 w-full rounded-full bg-ink/10" />
          <div className="h-3 w-5/6 rounded-full bg-ink/10" />
          <div className="h-3 w-4/6 rounded-full bg-ink/10" />
        </div>
      </div>
    </SkeletonRoot>
  );
}
