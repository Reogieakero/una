"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { useTheme } from "@/components/providers/theme-provider";
import { isCustomRangeValid, type ReportSection } from "@/lib/reports-scope";
import { useRestoreReportScope, writeStoredScope } from "@/lib/hooks/use-report-scope";
import { cn } from "@/lib/utils";

const RANGE_PRESETS = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom" },
];

/** Reports-only custom window rule: ordered and at most ~12 months. */
function validateCustomRange(from: string, to: string): string | null {
  return isCustomRangeValid(from, to) ? null : "Keep the range within 12 months.";
}

/**
 * Report scope controls — section tabs plus the shared Stats period filter.
 * URL-driven via replace() so the server streams the scoped report and
 * print/export see the same scope; the last selection also persists locally
 * so a refresh restores it. Explicit URL params always win over storage.
 *
 * The period control is the same `DateRangeFilter` used by the dashboard
 * hero — only the tone and preset list differ.
 */
export function ReportsFilters({
  sections,
  section,
  preset,
  fromDay,
  toDay,
  rangeLabel,
  fetching = false,
}: {
  /** Tabs this role can actually fill (see `reportSectionsForRole`). */
  sections: { key: ReportSection; label: string }[];
  section: ReportSection;
  preset: string;
  fromDay: string;
  toDay: string;
  rangeLabel: string;
  /** True while the report query refetches (section/range change). */
  fetching?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { resolvedTheme } = useTheme();
  // The reports shell follows the app theme, so the filter must too — otherwise
  // dark mode renders the light palette through the global `.dark` overrides.
  const tone = resolvedTheme === "dark" ? "dark" : "light";

  // Restore the last stored scope on first load (URL params win).
  useRestoreReportScope();

  const go = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const pickSection = (v: string) => {
    const s = v as ReportSection;
    // Always write the param explicitly — a missing ?section= means the
    // "Overview" default, so Overview must be set, not deleted.
    go({ section: s });
    writeStoredScope({ section: s, preset, from: fromDay, to: toDay });
  };

  const applyRange = (selection: { preset: string; from: string; to: string }) => {
    if (selection.preset === "custom") {
      go({ range: null, from: selection.from, to: selection.to });
      writeStoredScope({
        section,
        preset: "custom",
        from: selection.from,
        to: selection.to,
      });
      return;
    }
    go({ range: selection.preset, from: null, to: null });
    writeStoredScope({ section, preset: selection.preset, from: "", to: "" });
  };

  const clearRange = () => {
    go({ range: null, from: null, to: null });
    writeStoredScope({ section, preset: "30d", from: "", to: "" });
  };

  return (
    <div
      className="flex w-full flex-wrap items-center justify-start gap-2 print:hidden sm:w-auto sm:justify-end"
      aria-busy={fetching}
    >
      <nav
        aria-label="Report sections"
        className="-mx-1 flex max-w-full items-center gap-0.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sections.map((s) => {
          const active = s.key === section;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => pickSection(s.key)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                active
                  ? "bg-primary-600 text-white shadow-soft"
                  : "border border-ink/10 bg-white text-ink-muted hover:border-primary-300 hover:text-primary-700"
              )}
            >
              {s.label}
            </button>
          );
        })}
      </nav>

      <div className="shrink-0">
        <DateRangeFilter
          presets={RANGE_PRESETS}
          preset={preset}
          from={fromDay}
          to={toDay}
          rangeLabel={rangeLabel}
          pending={fetching}
          tone={tone}
          dialogLabel="Report date range"
          footer="Every report section follows the selected period."
          validateCustom={validateCustomRange}
          onApply={applyRange}
          onClear={clearRange}
        />
      </div>
    </div>
  );
}

/** Slim exact-position skeleton for the filter row while it streams in. */
export function ReportsFiltersSkeleton() {
  return (
    <div aria-hidden className="flex animate-pulse flex-wrap items-center justify-between gap-2">
      <div className="flex gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-7 w-16 rounded-full bg-ink/10" />
        ))}
      </div>
      <div className="h-7 w-32 rounded-full bg-ink/10" />
    </div>
  );
}
