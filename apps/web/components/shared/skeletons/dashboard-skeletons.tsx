import { DashboardBackdrop } from "../dashboard/dashboard-backdrop";

/**
 * Counselor dashboard content (below the hero) — mirrors the head layout:
 * filtered session cards, the live at-a-glance snapshot, the chart stack, and
 * the counselor's own queue panels.
 */
export function CounselorDashboardBodySkeleton() {
  return (
    <div className="animate-pulse space-y-5" aria-hidden>
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="h-3 w-36 rounded-full bg-white/10" />
          <div className="h-3 w-44 rounded-full bg-white/[0.06]" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <HeadStatCardSkeleton key={i} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="h-3 w-24 rounded-full bg-white/10" />
          <div className="h-3 w-56 rounded-full bg-white/[0.06]" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <HeadStatCardSkeleton key={i} />
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <HeadPanelSkeleton titleWidth="w-28">
          <div className="mt-3 h-[164px] rounded-xl bg-white/[0.06]" />
          <div className="mt-2 h-3 w-44 rounded-full bg-white/[0.06]" />
        </HeadPanelSkeleton>
        <HeadPanelSkeleton titleWidth="w-32">
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="mx-auto h-[164px] w-[164px] shrink-0 rounded-full bg-white/[0.06]" />
            <div className="min-w-0 flex-1 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-3 w-full rounded-full bg-white/[0.06]" />
              ))}
            </div>
          </div>
        </HeadPanelSkeleton>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, panel) => (
          <HeadPanelSkeleton key={panel} titleWidth="w-24">
            <div className="mt-3 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i}>
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="h-3 w-24 rounded-full bg-white/[0.06]" />
                    <div className="h-3 w-6 rounded-full bg-white/10" />
                  </div>
                  <div className="mt-1.5 h-2.5 w-full rounded-full bg-white/[0.07]" />
                </div>
              ))}
            </div>
          </HeadPanelSkeleton>
        ))}
      </div>

      <HeadPanelSkeleton titleWidth="w-36">
        <div className="mt-3 h-[190px] rounded-xl bg-white/[0.06]" />
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <div className="h-3 w-40 rounded-full bg-white/[0.06]" />
          <div className="h-3 w-32 rounded-full bg-white/[0.06]" />
        </div>
      </HeadPanelSkeleton>

      <HeadPanelSkeleton titleWidth="w-36">
        <div className="mt-3 h-[164px] rounded-xl bg-white/[0.06]" />
        <div className="mt-2 h-3 w-56 rounded-full bg-white/[0.06]" />
      </HeadPanelSkeleton>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <HeadPanelSkeleton titleWidth="w-36">
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-[124px] rounded-xl bg-white/[0.06]" />
              ))}
            </div>
          </HeadPanelSkeleton>
          <HeadPanelSkeleton titleWidth="w-32">
            <div className="mt-3 space-y-2.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-11 rounded-xl bg-white/[0.06]" />
              ))}
            </div>
          </HeadPanelSkeleton>
        </div>
        <div className="min-w-0 space-y-4">
          <HeadPanelSkeleton titleWidth="w-28">
            <div className="mt-3 space-y-2.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-11 rounded-xl bg-white/[0.06]" />
              ))}
            </div>
          </HeadPanelSkeleton>
          <HeadPanelSkeleton titleWidth="w-24">
            <div className="mt-3 space-y-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-11 rounded-xl bg-white/[0.06]" />
              ))}
            </div>
          </HeadPanelSkeleton>
        </div>
      </div>
    </div>
  );
}

/**
 * Counselor dashboard — dark canvas with the period filter, greeting, and the
 * same body silhouette as the loaded view. The backdrop comes from the staff
 * shell (counselor/head share the guidance canvas), so this fallback never
 * flashes a cream page.
 */
export function CounselorDashboardSkeleton() {
  return (
    <div
      className="-m-4 min-h-[calc(100vh-3.5rem)]"
      aria-hidden
      role="status"
      aria-label="Loading"
      data-head-dashboard
    >
      <div className="relative overflow-hidden">
        <div className="relative z-10 space-y-5 px-4 pb-6 pt-4 sm:px-6 sm:pb-8 lg:px-8">
          <div className="animate-pulse">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="h-[26px] w-56 rounded-full border border-white/10 bg-white/[0.04]" />
              <div className="h-8 w-40 shrink-0 rounded-full border border-white/10 bg-white/[0.04]" />
            </div>
            <div className="mt-4">
              <div className="h-8 w-[520px] max-w-full rounded-lg bg-white/10 sm:h-9" />
              <div className="mt-2 h-3 w-[420px] max-w-full rounded-full bg-white/[0.06]" />
            </div>
          </div>

          <CounselorDashboardBodySkeleton />
        </div>
      </div>
    </div>
  );
}

/* ── Guidance-head (dark canvas) ──────────────────────────────────────────── */

/** One `HeadStatCard` silhouette: label + icon chip / value / hint + trend. */
function HeadStatCardSkeleton() {
  return (
    <div className="flex min-h-[142px] flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_8px_24px_-24px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="h-2.5 w-24 rounded-full bg-white/10" />
        <div className="h-9 w-9 shrink-0 rounded-xl border border-white/10 bg-white/[0.06]" />
      </div>
      <div className="mt-3 h-8 w-16 rounded-lg bg-white/10" />
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
        <div className="h-3 w-20 rounded-full bg-white/[0.06]" />
        <div className="h-4 w-24 rounded-full bg-white/[0.06]" />
      </div>
    </div>
  );
}

/** `DarkPanel` chrome: title + hint over a p-5 glass card. */
function HeadPanelSkeleton({
  titleWidth = "w-32",
  children,
}: {
  titleWidth?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_8px_24px_-24px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <div className={`h-[15px] ${titleWidth} rounded-full bg-white/10`} />
      <div className="mt-1.5 h-3 w-48 rounded-full bg-white/[0.06]" />
      {children}
    </section>
  );
}

/**
 * Head dashboard content (below the hero) — exact silhouette of the filtered
 * stat cards, office snapshot, and the four chart panels. Shared by the route
 * `loading.tsx` and the view's own first-load state so both look identical.
 */
export function HeadDashboardBodySkeleton() {
  return (
    <div className="animate-pulse space-y-5" aria-hidden>
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="h-3 w-36 rounded-full bg-white/10" />
          <div className="h-3 w-44 rounded-full bg-white/[0.06]" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <HeadStatCardSkeleton key={i} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="h-3 w-28 rounded-full bg-white/10" />
          <div className="h-3 w-52 rounded-full bg-white/[0.06]" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <HeadStatCardSkeleton key={i} />
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <HeadPanelSkeleton titleWidth="w-28">
          <div className="mt-3 h-[164px] rounded-xl bg-white/[0.06]" />
          <div className="mt-2 h-3 w-44 rounded-full bg-white/[0.06]" />
        </HeadPanelSkeleton>
        <HeadPanelSkeleton titleWidth="w-32">
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="mx-auto h-[164px] w-[164px] shrink-0 rounded-full bg-white/[0.06]" />
            <div className="min-w-0 flex-1 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-3 w-full rounded-full bg-white/[0.06]" />
              ))}
            </div>
          </div>
        </HeadPanelSkeleton>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <HeadPanelSkeleton titleWidth="w-20">
          <div className="mt-3 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="h-3 w-24 rounded-full bg-white/[0.06]" />
                  <div className="h-3 w-6 rounded-full bg-white/10" />
                </div>
                <div className="mt-1.5 h-2.5 w-full rounded-full bg-white/[0.07]" />
              </div>
            ))}
          </div>
        </HeadPanelSkeleton>
        <HeadPanelSkeleton titleWidth="w-36">
          <div className="mt-3 h-[190px] rounded-xl bg-white/[0.06]" />
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <div className="h-3 w-40 rounded-full bg-white/[0.06]" />
            <div className="h-3 w-32 rounded-full bg-white/[0.06]" />
          </div>
        </HeadPanelSkeleton>
      </div>

      <HeadPanelSkeleton titleWidth="w-36">
        <div className="mt-3 h-[164px] rounded-xl bg-white/[0.06]" />
        <div className="mt-2 h-3 w-56 rounded-full bg-white/[0.06]" />
      </HeadPanelSkeleton>
    </div>
  );
}

/**
 * Head dashboard — exact layout match of the dark, landing-style canvas:
 * dark backdrop, eyebrow + date-range trigger, greeting headline, then the
 * filtered referral cards, office snapshot, and the four chart panels.
 */
export function HeadDashboardSkeleton() {
  return (
    <div
      className="-m-4 min-h-[calc(100vh-3.5rem)]"
      aria-hidden
      role="status"
      aria-label="Loading"
    >
      <div className="relative overflow-hidden">
        <DashboardBackdrop />
        <div className="relative z-10 space-y-5 px-4 pb-6 pt-4 sm:px-6 sm:pb-8 lg:px-8">
          <div className="animate-pulse">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="h-[26px] w-56 rounded-full border border-white/10 bg-white/[0.04]" />
              <div className="h-8 w-40 shrink-0 rounded-full border border-white/10 bg-white/[0.04]" />
            </div>
            <div className="mt-4">
              <div className="h-8 w-[520px] max-w-full rounded-lg bg-white/10 sm:h-9" />
            </div>
          </div>

          <HeadDashboardBodySkeleton />
        </div>
      </div>
    </div>
  );
}

/**
 * Faculty dashboard body — same silhouette as the loaded dark-canvas view:
 * 5 stat cards, trend + status charts, two bar panels, and the queue panels.
 */
export function FacultyDashboardBodySkeleton() {
  return (
    <div className="animate-pulse space-y-5" aria-hidden>
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="h-3 w-40 rounded-full bg-white/10" />
          <div className="h-3 w-56 rounded-full bg-white/[0.06]" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <HeadStatCardSkeleton key={i} />
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <HeadPanelSkeleton titleWidth="w-32">
          <div className="mt-3 h-[190px] rounded-xl bg-white/[0.06]" />
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <div className="h-3 w-40 rounded-full bg-white/[0.06]" />
            <div className="h-3 w-32 rounded-full bg-white/[0.06]" />
          </div>
        </HeadPanelSkeleton>
        <HeadPanelSkeleton titleWidth="w-32">
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="mx-auto h-[164px] w-[164px] shrink-0 rounded-full bg-white/[0.06]" />
            <div className="min-w-0 flex-1 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-3 w-full rounded-full bg-white/[0.06]" />
              ))}
            </div>
          </div>
        </HeadPanelSkeleton>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, panel) => (
          <HeadPanelSkeleton key={panel} titleWidth="w-28">
            <div className="mt-3 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="h-3 w-24 rounded-full bg-white/[0.06]" />
                    <div className="h-3 w-6 rounded-full bg-white/10" />
                  </div>
                  <div className="mt-1.5 h-2.5 w-full rounded-full bg-white/[0.07]" />
                </div>
              ))}
            </div>
          </HeadPanelSkeleton>
        ))}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <HeadPanelSkeleton key={i} titleWidth="w-40">
              <div className="mt-3 space-y-2.5">
                {Array.from({ length: 3 }).map((_, row) => (
                  <div key={row} className="h-11 rounded-xl bg-white/[0.06]" />
                ))}
              </div>
            </HeadPanelSkeleton>
          ))}
        </div>
        <div className="min-w-0 space-y-4">
          <HeadPanelSkeleton titleWidth="w-24">
            <div className="mt-3 space-y-2.5">
              {Array.from({ length: 3 }).map((_, row) => (
                <div key={row} className="h-11 rounded-xl bg-white/[0.06]" />
              ))}
            </div>
          </HeadPanelSkeleton>
          <HeadPanelSkeleton titleWidth="w-24">
            <div className="mt-3 space-y-2.5">
              {Array.from({ length: 6 }).map((_, row) => (
                <div key={row} className="h-11 rounded-xl bg-white/[0.06]" />
              ))}
            </div>
          </HeadPanelSkeleton>
        </div>
      </div>
    </div>
  );
}

/**
 * Faculty dashboard — dark canvas with the greeting hero and the same body
 * silhouette as the loaded view. The backdrop comes from the staff shell
 * (counselor, head, and faculty share the guidance canvas).
 */
export function FacultyDashboardSkeleton() {
  return (
    <div
      className="-m-4 min-h-[calc(100vh-3.5rem)]"
      aria-hidden
      role="status"
      aria-label="Loading"
      data-head-dashboard
    >
      <div className="relative overflow-hidden">
        <div className="relative z-10 space-y-5 px-4 pb-6 pt-4 sm:px-6 sm:pb-8 lg:px-8">
          <div className="animate-pulse">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="h-[26px] w-56 rounded-full border border-white/10 bg-white/[0.04]" />
              <div className="h-8 w-40 shrink-0 rounded-full border border-white/10 bg-white/[0.04]" />
            </div>
            <div className="mt-4">
              <div className="h-8 w-[520px] max-w-full rounded-lg bg-white/10 sm:h-9" />
              <div className="mt-2 h-3 w-[420px] max-w-full rounded-full bg-white/[0.06]" />
            </div>
          </div>

          <FacultyDashboardBodySkeleton />
        </div>
      </div>
    </div>
  );
}
