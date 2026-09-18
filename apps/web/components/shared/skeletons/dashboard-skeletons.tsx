import {
  ActionCardsSkeleton,
  CrumbSkeleton,
  DivideListSkeleton,
  ChartBlockSkeleton,
  KpiGridSkeleton,
  PanelShellSkeleton,
  QuickLinksSkeleton,
  SkeletonRoot,
} from "./primitives";

/**
 * Counselor dashboard — exact layout match:
 * Breadcrumb + H1 "Welcome back" + desc + Stats h-8 dropdown button,
 * grid [1fr_320px]: left (Needs confirmation card-grid + My referrals list)
 * + rail (Today's sessions + 6 Quick links).
 */
export function CounselorDashboardSkeleton() {
  return (
    <SkeletonRoot>
      <CrumbSkeleton />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="h-7 w-56 rounded-lg bg-ink/10" />
          <div className="mt-2 h-4 w-full max-w-[600px] rounded-full bg-ink/10" />
        </div>
        <div className="h-8 w-20 shrink-0 rounded border border-ink/10 bg-ink/10" />
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
            <div className="h-4 w-44 rounded-full bg-ink/10" />
            <div className="mt-1.5 h-3 w-2/3 rounded-full bg-ink/10" />
            <ActionCardsSkeleton count={2} columns="sm:grid-cols-2" />
          </section>
          <PanelShellSkeleton withViewAll rows={3}>
            <DivideListSkeleton rows={3} />
          </PanelShellSkeleton>
        </div>
        <div className="min-w-0 space-y-4">
          <PanelShellSkeleton withViewAll rows={2}>
            <DivideListSkeleton rows={2} />
          </PanelShellSkeleton>
          <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
            <div className="h-4 w-28 rounded-full bg-ink/10" />
            <QuickLinksSkeleton rows={6} />
          </section>
        </div>
      </div>
    </SkeletonRoot>
  );
}

/**
 * Head dashboard — exact layout match:
 * H1 "Dashboard" + Stats dropdown, ReferralsWaiting custom section
 * (count pill + sm:2 xl:3 card grid up to 6) + Needs a counselor,
 * rail: Upcoming (1 row) + 6 Quick links.
 */
export function HeadDashboardSkeleton() {
  return (
    <SkeletonRoot>
      <CrumbSkeleton />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="h-7 w-40 rounded-lg bg-ink/10" />
          <div className="mt-2 h-4 w-full max-w-[600px] rounded-full bg-ink/10" />
        </div>
        <div className="h-8 w-20 shrink-0 rounded border border-ink/10 bg-ink/10" />
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <section aria-label="Referrals waiting">
            <div className="flex flex-wrap items-center gap-2">
              <div className="h-4 w-36 rounded-full bg-ink/10" />
              <div className="h-5 w-24 rounded-full bg-ink/10" />
              <div className="ml-auto h-4 w-14 rounded-full bg-ink/10" />
            </div>
            <div className="mt-1.5 h-3 w-64 rounded-full bg-ink/10" />
            <ActionCardsSkeleton count={6} columns="sm:grid-cols-2 xl:grid-cols-3" />
          </section>
          <PanelShellSkeleton withViewAll rows={3}>
            <DivideListSkeleton rows={3} />
          </PanelShellSkeleton>
        </div>
        <div className="min-w-0 space-y-4">
          <PanelShellSkeleton withViewAll rows={1}>
            <DivideListSkeleton rows={1} />
          </PanelShellSkeleton>
          <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
            <div className="h-4 w-28 rounded-full bg-ink/10" />
            <QuickLinksSkeleton rows={6} />
          </section>
        </div>
      </div>
    </SkeletonRoot>
  );
}

/**
 * Faculty dashboard — exact layout match:
 * H1 + Flag-a-student pill CTA, 5x p-6 KPIs (sm:2 lg:3 xl:5),
 * full-width 14-day trend (h-[180px]), [1fr_320px] 2+2 panels
 * (Needs office / Recent / News / 7 Quick links).
 */
export function FacultyDashboardSkeleton() {
  return (
    <SkeletonRoot>
      <CrumbSkeleton />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="h-7 w-56 rounded-lg bg-ink/10" />
          <div className="mt-2 h-4 w-full max-w-[600px] rounded-full bg-ink/10" />
        </div>
        <div className="h-9 w-36 shrink-0 rounded-full bg-ink/10" />
      </div>
      <KpiGridSkeleton count={5} columns="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" />
      <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <div className="flex items-start justify-between gap-2">
          <div className="h-4 w-56 rounded-full bg-ink/10" />
          <div className="h-4 w-14 shrink-0 rounded-full bg-ink/10" />
        </div>
        <ChartBlockSkeleton height="h-[180px]" />
      </section>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <PanelShellSkeleton withHint withViewAll rows={3}>
            <DivideListSkeleton rows={3} />
          </PanelShellSkeleton>
          <PanelShellSkeleton withHint withViewAll rows={3}>
            <DivideListSkeleton rows={3} />
          </PanelShellSkeleton>
        </div>
        <div className="min-w-0 space-y-4">
          <PanelShellSkeleton withHint withViewAll rows={3}>
            <DivideListSkeleton rows={3} />
          </PanelShellSkeleton>
          <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
            <div className="h-4 w-28 rounded-full bg-ink/10" />
            <QuickLinksSkeleton rows={7} />
          </section>
        </div>
      </div>
    </SkeletonRoot>
  );
}
