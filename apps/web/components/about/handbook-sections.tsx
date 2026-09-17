import { AlertTriangle, Bell, BookOpen, CheckCheck, Info, ShieldCheck, Video } from "lucide-react";
import { APPOINTMENT_FLOW, REFERRAL_FLOW, SPLIT_ROWS } from "@/lib/about-content";
import { FlowStrip } from "./flow-strip";

/** Master pipeline — the two flows everything else serves. */
export function PipelineSection() {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
        <BookOpen className="h-4 w-4" aria-hidden /> How a case moves
      </h2>
      <p className="mt-0.5 text-[13px] text-ink-muted">
        Two start lines, one discipline: the head routes, the counselor runs and closes.
      </p>
      <p className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-wider text-ink-muted">Sessions</p>
      <FlowStrip steps={APPOINTMENT_FLOW} />
      <p className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-wider text-ink-muted">Referrals</p>
      <FlowStrip steps={REFERRAL_FLOW} />
      <ul className="mt-4 space-y-1.5 text-[13px] leading-relaxed text-ink-muted">
        <li><span className="font-bold text-ink">Rejected, Cancelled, Completed, Resolved, No-show</span> are terminal — nothing moves out of them.</li>
        <li><span className="font-bold text-ink">Every move notifies whoever is affected</span> — student, referrer, counselor, heads — in realtime, and lights their nav badges until read.</li>
        <li><span className="font-bold text-ink">Student names stay aliased</span> everywhere except audited break-glass reveals.</li>
      </ul>
    </section>
  );
}

/** Role daily checklist. */
export function ChecklistSection({ isHead, checklist, title }: { isHead: boolean; checklist: string[]; title?: string }) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
        <CheckCheck className="h-4 w-4" aria-hidden />
        {title ?? (isHead ? "Head daily checklist" : "Counselor daily checklist")}
      </h2>
      <ol className="mt-3 space-y-2">
        {checklist.map((c, i) => (
          <li key={c} className="flex items-start gap-3 text-sm leading-relaxed text-ink-soft">
            <span aria-hidden className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-600 text-[12px] font-bold text-white">
              {i + 1}
            </span>
            {c}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Non-negotiable rules — scoped to the viewer's role. */
export function RulesSection({ isHead, isFaculty }: { isHead: boolean; isFaculty?: boolean }) {
  if (isFaculty) {
    return (
      <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
          <ShieldCheck className="h-4 w-4" aria-hidden /> Rules you live by
        </h2>
        <ul className="mt-3 space-y-1.5 text-[13px] leading-relaxed text-ink-muted">
          <li><span className="font-bold text-ink">Flag with context</span> — describe what you observed and pick the right urgency; urgent + high are triaged first.</li>
          <li><span className="font-bold text-ink">Track, don&apos;t triage</span> — assigning, confirming, and resolving belong to the office (enforced server-side).</li>
          <li className="flex gap-2"><Bell className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span><span className="font-bold text-ink">Badges equal unread inbox</span> — visiting a page never clears them; marking the notification read does.</span></li>
          <li><span className="font-bold text-ink">Student names stay aliased</span> everywhere except audited break-glass reveals.</li>
        </ul>
      </section>
    );
  }
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
        <ShieldCheck className="h-4 w-4" aria-hidden /> Rules you live by
      </h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-xs uppercase text-ink-muted">
              <th className="px-3 py-2">Move</th>
              <th className="px-3 py-2 text-center">{isHead ? "Head" : "You"}</th>
              <th className="px-3 py-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {SPLIT_ROWS.filter((r) => (isHead ? r.admin : r.counselor)).map((r) => (
              <tr key={r.move} className="border-b border-ink/5 align-top last:border-0">
                <td className="px-3 py-2 font-bold text-ink">{r.move}</td>
                <td className="px-3 py-2 text-center font-bold">✓</td>
                <td className="px-3 py-2 text-[13px] text-ink-muted">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-4 space-y-1.5 text-[13px] leading-relaxed text-ink-muted">
        <li className="flex gap-2"><Video className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span><span className="font-bold text-ink">Online sessions need a Meet link at confirm</span> — Google blocks Meet inside iframes, so the board and calendar offer Join buttons that open the meeting.</span></li>
        <li className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span><span className="font-bold text-ink">Resolve is counselor-only, enforced server-side</span> — a referral can never read Resolved unless a counselor resolved it, even bypassing the UI.</span></li>
        <li className="flex gap-2"><Bell className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span><span className="font-bold text-ink">Badges equal unread inbox</span> — visiting a page never clears them; marking the notification read does.</span></li>
        <li className="flex gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span><span className="font-bold text-ink">Student booking needs a fresh PSS-10</span> — a check-in from the last 30 days gates every new booking.</span></li>
      </ul>
    </section>
  );
}
