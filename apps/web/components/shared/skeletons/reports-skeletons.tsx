import {
  ChartBlockSkeleton,
  CreamListSkeleton,
  DivideListSkeleton,
  DonutBlockSkeleton,
  KpiGridSkeleton,
  PageHeaderSkeleton,
  PanelShellSkeleton,
  ProgressBarsSkeleton,
  SkeletonRoot,
} from "./primitives";

/**
 * Reports skeletons — exact layout match per role.
 * All share: Breadcrumb + H1 + max-w-[560px] desc + ReportsFilters row
 * (Section dropdown h-8 w-32 + range button h-8 w-40), KPI p-6 3-line cards,
 * sections in `grid sm:2` with full-width trend (`sm:col-span-2`).
 */

function ReportsHeaderSkeleton() {
  return <PageHeaderSkeleton descWidth="max-w-[560px]" action="filters" />;
}

function SessionsSectionSkeleton() {
  return (
    <>
      <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card sm:col-span-2">
        <div className="h-4 w-48 rounded-full bg-ink/10" />
        <ChartBlockSkeleton />
      </section>
      <PanelShellSkeleton>
        <DonutBlockSkeleton />
      </PanelShellSkeleton>
      <PanelShellSkeleton>
        <ProgressBarsSkeleton rows={4} />
      </PanelShellSkeleton>
    </>
  );
}

function ReferralsSectionSkeleton({ pipeline = true }: { pipeline?: boolean }) {
  return (
    <>
      <PanelShellSkeleton>
        <DonutBlockSkeleton />
      </PanelShellSkeleton>
      <PanelShellSkeleton>
        <ChartBlockSkeleton />
      </PanelShellSkeleton>
      {pipeline && (
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card sm:col-span-2">
          <div className="h-4 w-44 rounded-full bg-ink/10" />
          <CreamListSkeleton rows={3} />
        </section>
      )}
    </>
  );
}

/** Counselor: 8 KPIs + sessions/referrals/satisfaction/wellbeing/operations + guide. */
export function CounselorReportsSkeleton() {
  return (
    <SkeletonRoot>
      <ReportsHeaderSkeleton />
      <KpiGridSkeleton count={8} columns="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" />
      <div className="grid gap-4 sm:grid-cols-2">
        <SessionsSectionSkeleton />
        <ReferralsSectionSkeleton />
        <PanelShellSkeleton>
          <ChartBlockSkeleton />
        </PanelShellSkeleton>
        <PanelShellSkeleton>
          <DivideListSkeleton rows={3} />
        </PanelShellSkeleton>
        <PanelShellSkeleton>
          <DonutBlockSkeleton />
        </PanelShellSkeleton>
        <PanelShellSkeleton>
          <CreamListSkeleton rows={3} />
        </PanelShellSkeleton>
        <PanelShellSkeleton>
          <CreamListSkeleton rows={3} />
        </PanelShellSkeleton>
        <PanelShellSkeleton>
          <ProgressBarsSkeleton rows={4} />
        </PanelShellSkeleton>
      </div>
      <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-card">
        <div className="h-4 w-48 rounded-full bg-ink/10" />
        <div className="mt-3 h-3 w-full rounded-full bg-ink/10" />
        <div className="mt-2 h-3 w-2/3 rounded-full bg-ink/10" />
      </div>
    </SkeletonRoot>
  );
}

/** Head: 8 KPIs + same sections, workload ranked list uses divide rows. */
export function HeadReportsSkeleton() {
  return (
    <SkeletonRoot>
      <ReportsHeaderSkeleton />
      <KpiGridSkeleton count={8} columns="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" />
      <div className="grid gap-4 sm:grid-cols-2">
        <SessionsSectionSkeleton />
        <ReferralsSectionSkeleton />
        <PanelShellSkeleton>
          <ChartBlockSkeleton />
        </PanelShellSkeleton>
        <PanelShellSkeleton>
          <DivideListSkeleton rows={3} />
        </PanelShellSkeleton>
        <PanelShellSkeleton>
          <DonutBlockSkeleton />
        </PanelShellSkeleton>
        <PanelShellSkeleton>
          <CreamListSkeleton rows={3} />
        </PanelShellSkeleton>
        <PanelShellSkeleton>
          <DivideListSkeleton rows={4} />
        </PanelShellSkeleton>
        <PanelShellSkeleton>
          <ProgressBarsSkeleton rows={4} />
        </PanelShellSkeleton>
      </div>
      <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-card">
        <div className="h-4 w-48 rounded-full bg-ink/10" />
        <div className="mt-3 h-3 w-full rounded-full bg-ink/10" />
        <div className="mt-2 h-3 w-2/3 rounded-full bg-ink/10" />
      </div>
    </SkeletonRoot>
  );
}

/** Faculty: 4 KPIs + referrals (trend full-width + status/priority/classification) + operations. */
export function FacultyReportsSkeleton() {
  return (
    <SkeletonRoot>
      <ReportsHeaderSkeleton />
      <KpiGridSkeleton count={4} columns="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" />
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card sm:col-span-2">
          <div className="h-4 w-48 rounded-full bg-ink/10" />
          <ChartBlockSkeleton />
        </section>
        <PanelShellSkeleton>
          <DonutBlockSkeleton />
        </PanelShellSkeleton>
        <PanelShellSkeleton>
          <ChartBlockSkeleton />
        </PanelShellSkeleton>
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card sm:col-span-2">
          <div className="h-4 w-48 rounded-full bg-ink/10" />
          <ChartBlockSkeleton />
        </section>
        <PanelShellSkeleton>
          <CreamListSkeleton rows={3} />
        </PanelShellSkeleton>
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <div className="h-4 w-44 rounded-full bg-ink/10" />
          <div className="mt-4 space-y-2.5">
            <div className="h-3 w-full rounded-full bg-ink/10" />
            <div className="h-3 w-5/6 rounded-full bg-ink/10" />
            <div className="h-3 w-4/6 rounded-full bg-ink/10" />
          </div>
        </section>
      </div>
      <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-card">
        <div className="h-4 w-48 rounded-full bg-ink/10" />
        <div className="mt-3 h-3 w-full rounded-full bg-ink/10" />
      </div>
    </SkeletonRoot>
  );
}
