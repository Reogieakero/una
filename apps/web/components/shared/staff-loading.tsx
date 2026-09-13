/**
 * Content-only loading skeleton — rendered INSIDE StaffShell as `children`.
 * The shell (top nav + sidebar) stays mounted during client navigation,
 * so this must NOT include its own nav/sidebar skeleton or the sidebar
 * will appear to flash/reload on every page change (e.g. /reports).
 */
export function StaffPageSkeleton() {
  return (
    <div className="min-w-0 animate-pulse space-y-4" aria-hidden>
      <div className="h-4 w-44 rounded-full bg-ink/10" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="h-[104px] rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <div className="h-3.5 w-2/3 rounded-full bg-ink/10" />
          <div className="mt-3 h-8 w-1/3 rounded-lg bg-ink/10" />
        </div>
        <div className="h-[104px] rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <div className="h-3.5 w-2/3 rounded-full bg-ink/10" />
          <div className="mt-3 h-8 w-1/3 rounded-lg bg-ink/10" />
        </div>
        <div className="h-[104px] rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <div className="h-3.5 w-2/3 rounded-full bg-ink/10" />
          <div className="mt-3 h-8 w-1/3 rounded-lg bg-ink/10" />
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="min-h-[220px] rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <div className="h-4 w-40 rounded-full bg-ink/10" />
          <div className="mt-4 space-y-3">
            <div className="h-10 rounded-xl bg-ink/10" />
            <div className="h-10 rounded-xl bg-ink/10" />
            <div className="h-10 rounded-xl bg-ink/10" />
          </div>
        </div>
        <div className="min-h-[220px] rounded-lg border border-ink/10 bg-white p-5 shadow-card">
          <div className="h-4 w-40 rounded-full bg-ink/10" />
          <div className="mt-4 space-y-3">
            <div className="h-10 rounded-xl bg-ink/10" />
            <div className="h-10 rounded-xl bg-ink/10" />
            <div className="h-10 rounded-xl bg-ink/10" />
          </div>
        </div>
      </div>
    </div>
  );
}
