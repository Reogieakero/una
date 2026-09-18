import { CrumbSkeleton, PageHeaderSkeleton, PanelShellSkeleton, DivideListSkeleton, SkeletonRoot } from "./primitives";

/**
 * Specialized skeletons — asymmetric / single-column layouts where the
 * generic 3-card + 2-panel shape is actively misleading.
 */

/** /chat: 340px thread list + 1fr conversation + composer. */
export function ChatSkeleton() {
  return (
    <SkeletonRoot>
      <CrumbSkeleton />
      <div>
        <div className="h-7 w-48 rounded-lg bg-ink/10" />
        <div className="mt-2 h-4 w-full max-w-[600px] rounded-full bg-ink/10" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="rounded-lg border border-ink/10 bg-white p-4 shadow-card">
          <div className="flex items-center justify-between">
            <div className="h-4 w-24 rounded-full bg-ink/10" />
            <div className="h-8 w-8 rounded-lg bg-ink/10" />
          </div>
          <div className="mt-3 h-8 rounded-lg bg-ink/10" />
          <div className="mt-3 flex gap-2">
            <div className="h-7 w-16 rounded-full bg-ink/10" />
            <div className="h-7 w-16 rounded-full bg-ink/10" />
            <div className="h-7 w-16 rounded-full bg-ink/10" />
          </div>
          <ul className="mt-3 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-ink/10" />
                <div className="min-w-0 flex-1">
                  <div className="h-3.5 w-2/3 rounded-full bg-ink/10" />
                  <div className="mt-1.5 h-3 w-full rounded-full bg-ink/10" />
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-ink/10 bg-white p-4 shadow-card">
          <div className="flex items-center gap-3 border-b border-ink/10 pb-3">
            <div className="h-10 w-10 rounded-full bg-ink/10" />
            <div className="flex-1">
              <div className="h-3.5 w-1/4 rounded-full bg-ink/10" />
              <div className="mt-1.5 h-3 w-1/3 rounded-full bg-ink/10" />
            </div>
            <div className="h-5 w-16 rounded-full bg-ink/10" />
          </div>
          <div className="h-[46vh] min-h-[300px] space-y-3 overflow-hidden py-4">
            <div className="h-10 w-2/3 rounded-2xl bg-ink/10" />
            <div className="ml-auto h-10 w-1/2 rounded-2xl bg-ink/10" />
            <div className="h-10 w-3/5 rounded-2xl bg-ink/10" />
            <div className="ml-auto h-12 w-2/3 rounded-2xl bg-ink/10" />
          </div>
          <div className="flex items-center gap-2 border-t border-ink/10 pt-3">
            <div className="h-10 flex-1 rounded-lg bg-ink/10" />
            <div className="h-10 w-16 rounded-lg bg-ink/10" />
          </div>
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** /sessions: toolbar + tabs + 2:1 calendar:schedule (7-col month grid). */
export function SessionsSkeleton() {
  return (
    <SkeletonRoot>
      <CrumbSkeleton />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="h-7 w-48 rounded-lg bg-ink/10" />
          <div className="mt-2 h-4 w-64 rounded-full bg-ink/10" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-lg bg-ink/10" />
          <div className="h-9 w-24 rounded-lg bg-ink/10" />
          <div className="h-9 w-24 rounded-lg bg-ink/10" />
        </div>
      </div>
      <div className="h-12 rounded-lg bg-ink/10" />
      <div className="grid items-start gap-4 xl:grid-cols-3">
        <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-card xl:col-span-2">
          <div className="flex items-center justify-between">
            <div className="h-8 w-24 rounded-lg bg-ink/10" />
            <div className="h-5 w-40 rounded-full bg-ink/10" />
            <div className="h-4 w-20 rounded-full bg-ink/10" />
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={`h-${i}`} className="h-4 rounded-full bg-ink/10" />
            ))}
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={`c-${i}`} className="min-h-[88px] rounded-lg bg-ink/10" />
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <div className="h-4 w-40 rounded-full bg-ink/10" />
          <div className="mt-4 space-y-3">
            <div className="h-16 rounded-lg bg-ink/10" />
            <div className="h-16 rounded-lg bg-ink/10" />
            <div className="h-24 rounded-lg bg-ink/10" />
          </div>
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** /availability: hidden Stats + 7-col coverage board + table/form. */
export function AvailabilitySkeleton() {
  return (
    <SkeletonRoot>
      <PageHeaderSkeleton action="stats" />
      <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <div className="h-4 w-40 rounded-full bg-ink/10" />
        <div className="mt-1.5 h-3 w-64 rounded-full bg-ink/10" />
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-28 rounded-lg bg-ink/10" />
          ))}
        </div>
      </section>
      <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <div className="h-4 w-48 rounded-full bg-ink/10" />
        <div className="mt-4 space-y-3">
          <div className="h-10 rounded-lg bg-ink/10" />
          <div className="h-10 rounded-lg bg-ink/10" />
          <div className="h-10 rounded-lg bg-ink/10" />
        </div>
      </div>
    </SkeletonRoot>
  );
}

/**
 * /settings: profile hero (gradient h-24 + avatar h-20 + progress) +
 * tab bar + 1fr/340px (head) content + side stack.
 */
export function SettingsSkeleton() {
  return (
    <SkeletonRoot>
      <CrumbSkeleton />
      <div>
        <div className="h-7 w-40 rounded-lg bg-ink/10" />
        <div className="mt-2 h-4 w-96 max-w-full rounded-full bg-ink/10" />
      </div>
      <div className="overflow-hidden rounded-lg border border-ink/10 bg-white shadow-card">
        <div className="h-24 bg-ink/10" />
        <div className="flex items-center gap-4 p-5">
          <div className="h-20 w-20 shrink-0 rounded-full bg-ink/10" />
          <div className="flex-1">
            <div className="h-4 w-48 rounded-full bg-ink/10" />
            <div className="mt-2 h-2 w-64 max-w-full rounded-full bg-ink/10" />
          </div>
          <div className="h-8 w-20 rounded-lg bg-ink/10" />
        </div>
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-28 rounded-lg bg-ink/10" />
        ))}
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between gap-3">
                <div className="h-3.5 w-1/4 rounded-full bg-ink/10" />
                <div className="h-3.5 w-1/2 rounded-full bg-ink/10" />
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="h-10 rounded-lg bg-ink/10" />
            <div className="h-10 rounded-lg bg-ink/10" />
            <div className="h-10 rounded-lg bg-ink/10" />
            <div className="h-10 rounded-lg bg-ink/10" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
            <div className="h-4 w-36 rounded-full bg-ink/10" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-ink/10" />
              ))}
            </div>
          </div>
          <PanelShellSkeleton rows={2} />
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** /refer-student: stacked CTA card + 9-col history table. */
export function ReferStudentSkeleton() {
  return (
    <SkeletonRoot>
      <PageHeaderSkeleton action="buttons" />
      <div className="rounded-lg border border-ink/10 bg-white p-6 text-center shadow-card">
        <div className="mx-auto h-4 w-56 rounded-full bg-ink/10" />
        <div className="mx-auto mt-2 h-3 w-96 max-w-full rounded-full bg-ink/10" />
        <div className="mx-auto mt-4 h-10 w-48 rounded-lg bg-ink/10" />
      </div>
      <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-card">
        <div className="h-4 w-48 rounded-full bg-ink/10" />
        <div className="mt-4 grid grid-cols-9 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-3 rounded-full bg-ink/10" />
          ))}
        </div>
        <div className="mt-3 space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-ink/10" />
          ))}
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** /emergency: narrow max-w-2xl stepped form (select h-10 + textarea h-20). */
export function EmergencySkeleton() {
  return (
    <SkeletonRoot>
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <CrumbSkeleton />
        <div>
          <div className="h-7 w-56 rounded-lg bg-ink/10" />
          <div className="mt-2 h-4 w-full rounded-full bg-ink/10" />
        </div>
        <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <div className="h-4 w-48 rounded-full bg-ink/10" />
          <div className="mt-4 h-10 rounded-lg bg-ink/10" />
          <div className="mt-3 h-20 rounded-lg bg-ink/10" />
          <div className="mt-3 h-9 w-32 rounded-lg bg-ink/10" />
        </div>
        <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <div className="h-4 w-40 rounded-full bg-ink/10" />
          <div className="mt-3 h-12 rounded-lg bg-ink/10" />
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** /about: narrow max-w-3xl doc stack (hero + pipeline + accordions). */
export function AboutSkeleton() {
  return (
    <SkeletonRoot>
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <CrumbSkeleton />
        <div className="text-center">
          <div className="mx-auto h-7 w-64 rounded-lg bg-ink/10" />
          <div className="mx-auto mt-2 h-4 w-96 max-w-full rounded-full bg-ink/10" />
        </div>
        <div className="h-32 rounded-lg bg-ink/10" />
        <div className="h-24 rounded-lg bg-ink/10" />
        <div className="h-24 rounded-lg bg-ink/10" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-ink/10" />
          ))}
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** /users/new: single Card 2-col static form. */
export function UserFormSkeleton() {
  return (
    <SkeletonRoot>
      <CrumbSkeleton width="w-56" />
      <div>
        <div className="h-7 w-48 rounded-lg bg-ink/10" />
        <div className="mt-2 h-4 w-96 max-w-full rounded-full bg-ink/10" />
      </div>
      <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-card">
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <div className="h-3 w-24 rounded-full bg-ink/10" />
              <div className="mt-2 h-10 rounded-lg bg-ink/10" />
            </div>
          ))}
        </div>
        <div className="mt-4 h-10 w-40 rounded-lg bg-ink/10" />
      </div>
    </SkeletonRoot>
  );
}

/** Generic inbox-list reuse for future routes. */
export function InboxListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <PanelShellSkeleton>
      <DivideListSkeleton rows={rows} />
    </PanelShellSkeleton>
  );
}
