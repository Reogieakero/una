import Link from "next/link";
import type { PageDoc } from "@/lib/about-content";

/** Per-page handbook accordion — purpose, displayed, actions, handoff. */
export function PageAccordion({ doc }: { doc: PageDoc }) {
  const Icon = doc.icon;
  return (
    <details className="group rounded-lg border border-ink/10 bg-white shadow-card">
      <summary className="flex cursor-pointer items-center gap-3 px-5 py-4">
        <span aria-hidden className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream text-ink">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[15px] font-bold text-ink">{doc.label}</span>
          <span className="block truncate text-[13px] text-ink-muted">{doc.purpose}</span>
        </span>
        <span aria-hidden className="text-xs font-bold text-ink-faint transition-transform group-open:rotate-90">▶</span>
      </summary>
      <div className="space-y-4 border-t border-ink/10 px-5 py-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">What you see</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-soft">
            {doc.displayed.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">What you can do</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-soft">
            {doc.actions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
        <p className="rounded-lg bg-cream px-4 py-2.5 text-[13px] leading-relaxed text-ink-soft">
          <span className="font-bold text-ink">Then what: </span>
          {doc.handoff}
        </p>
        <Link href={doc.href} className="inline-block text-[13px] font-bold text-primary-700 hover:underline">
          Open {doc.label} →
        </Link>
      </div>
    </details>
  );
}
