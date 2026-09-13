import { motion } from "framer-motion";
import { FileDown, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { JourneyPanel, JourneyHeading } from "../shell";
import { AnimatedSection, Eyebrow } from "@/components/AnimatedSection";
import { CountUp } from "@/components/CountUp";
import { Badge } from "@/components/ui/badge";
import { concernBars, stressBars } from "@/lib/content";

export function AnalyticsPanel() {
  return (
    <JourneyPanel id="j-analytics" width="w-[130vw]">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent,#EFF3FA_55%,transparent)]" />
      <div className="relative mx-auto flex max-w-none items-center gap-[3vw]">
        <AnimatedSection className="w-[24vw] max-w-[340px] shrink-0">
          <JourneyHeading
            eyebrow={<Eyebrow>Analytics & impact</Eyebrow>}
            title={
              <>
                From quiet check-ins to{" "}
                <span className="text-blue-600">confident decisions.</span>
              </>
            }
            copy="Anonymous PSS-10 scores become early signals — extra slots before midterms, the right wellness topics, proof of what's working."
          />
        </AnimatedSection>

        <AnimatedSection delay={0.08} className="w-[88vw] max-w-[1120px] shrink-0">
          <div className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/85 shadow-soft backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 px-5 py-3">
              <div className="flex items-center gap-2.5">
                <p className="text-[13px] font-bold">Guidance Analytics — sample preview</p>
                <Badge variant="sky">Live trends</Badge>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700">
                <Sparkles className="h-3.5 w-3.5" aria-hidden /> Anonymized & aggregated
              </span>
            </div>
            <div className="grid grid-cols-[1.1fr_0.9fr] gap-4 p-5">
              <div>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { v: 1240, suffix: "+", label: "PSS-10 check-ins" },
                    { v: 42, suffix: "%", label: "avg. stress drop", prefix: "−" },
                    { v: 96, suffix: "%", label: "show-up rate" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-2xl bg-cream p-3 text-center">
                       <p className="font-display text-2xl font-semibold text-blue-700">
                        <CountUp to={s.v} suffix={s.suffix} prefix={s.prefix ?? ""} />
                      </p>
                      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                        {s.label}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-2xl border border-blue-100 bg-white p-4">
                   <div className="flex items-center justify-between gap-2">
                     <h3 className="font-display text-[13px] font-semibold">Average stress by period</h3>
                     <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-0.5 text-[11px] font-bold text-yellow-600">
                      <TrendingUp className="h-3 w-3" aria-hidden /> Peaks: midterms & finals
                    </span>
                  </div>
                  <div className="mt-3 flex h-24 items-end justify-between gap-2" role="img" aria-label="Bar chart showing stress peaking during midterms and finals">
                    {stressBars.map((b, i) => (
                      <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
                        <motion.div
                          initial={{ height: 0 }}
                          whileInView={{ height: `${b.h}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.6, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                          className={`w-full rounded-t-lg ${
                            b.label === "Mid" || b.label === "Fin"
                              ? "bg-gradient-to-t from-yellow-400 to-yellow-300"
                              : "bg-gradient-to-t from-blue-500 to-blue-300"
                          }`}
                          style={{ minHeight: 6 }}
                        />
                        <span className="text-[10px] font-bold text-ink-muted">{b.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <div className="rounded-2xl border border-blue-100 bg-white p-4">
                   <h3 className="font-display text-[13px] font-semibold">Most common concerns</h3>
                  <div className="mt-2.5 space-y-2.5">
                    {concernBars.map((c, i) => (
                      <div key={c.label}>
                        <div className="flex justify-between text-[12px] font-bold">
                          <span>{c.label}</span>
                          <span className="text-ink-muted">{c.pct}%</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-cream-deeper/60">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${c.pct}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7, delay: 0.1 + i * 0.07 }}
                            className={`h-full rounded-full ${c.color}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-1 rounded-2xl bg-blue-600 p-4 text-white">
                  <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold">
                    <TrendingDown className="h-3 w-3" aria-hidden /> Early intervention win
                  </p>
                  <p className="mt-2 font-display text-[15px] font-semibold leading-snug">
                    “We added 6 evening slots before finals — waitlists cleared in 4 days.”
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-blue-700">
                    <FileDown className="h-3.5 w-3.5" aria-hidden /> One-click reports
                  </p>
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </JourneyPanel>
  );
}
