"use client";

import { motion } from "framer-motion";
import { TrendingDown, TrendingUp, FileDown, Sparkles } from "lucide-react";
import { AnimatedSection, Eyebrow, Stagger, StaggerItem } from "@/components/AnimatedSection";
import { CountUp } from "@/components/CountUp";
import { Badge } from "@/components/ui/badge";
import { concernBars as concerns, stressBars as bars } from "@/lib/content";

export function Analytics() {
  return (
    <section
      id="analytics"
      aria-labelledby="analytics-heading"
      className="relative overflow-hidden py-20 lg:py-28"
    >
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,#FDF8F1,#EFF3FA_55%,#FDF8F1)]" />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <AnimatedSection className="mx-auto max-w-2xl text-center">
          <Eyebrow>Analytics & impact</Eyebrow>
          <h2 id="analytics-heading" className="mt-4 text-3xl font-semibold sm:text-[2.6rem]">
            From quiet check-ins to <span className="text-sage-600">confident decisions.</span>
          </h2>
          <p className="mt-4 text-[17px] text-ink-muted">
            Anonymous PSS-10 scores and booking patterns become early signals —
            so the Guidance Office can add slots before midterms, plan the
            right wellness topics, and prove what&apos;s working.
          </p>
        </AnimatedSection>

        {/* Mock dashboard */}
        <AnimatedSection delay={0.1} className="mt-12">
          <div className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/85 shadow-soft backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sage-100 px-6 py-4 sm:px-8">
              <div className="flex items-center gap-3">
                <span className="flex gap-1.5" aria-hidden>
                  <span className="h-3 w-3 rounded-full bg-peach-300" />
                  <span className="h-3 w-3 rounded-full bg-[#E8C86A]" />
                  <span className="h-3 w-3 rounded-full bg-sage-400" />
                </span>
                <p className="text-sm font-bold">Guidance Analytics — sample preview</p>
                <Badge variant="sky">Live trends</Badge>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-50 px-3 py-1 text-xs font-bold text-sage-700">
                <Sparkles className="h-3.5 w-3.5" aria-hidden /> Anonymized & aggregated
              </span>
            </div>

            <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr]">
              {/* left: counters + bar chart */}
              <div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { v: 1240, suffix: "+", label: "PSS-10 check-ins" },
                    { v: 42, suffix: "%", label: "avg. stress drop*", prefix: "−" },
                    { v: 96, suffix: "%", label: "show-up rate" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-2xl bg-cream p-4 text-center">
                      <p className="font-display text-2xl font-semibold text-sage-700 sm:text-3xl">
                        <CountUp to={s.v} suffix={s.suffix} prefix={s.prefix ?? ""} />
                      </p>
                      <p className="mt-1 text-[12px] font-bold uppercase tracking-wide text-ink-muted">
                        {s.label}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-2xl border border-sage-100 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-[15px] font-semibold">
                      Average stress by period
                    </h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-peach-50 px-2.5 py-1 text-xs font-bold text-peach-600">
                      <TrendingUp className="h-3.5 w-3.5" aria-hidden /> Peaks: midterms & finals
                    </span>
                  </div>
                  <div className="mt-5 flex h-40 items-end justify-between gap-2" role="img" aria-label="Bar chart showing stress peaking during midterms and finals">
                    {bars.map((b, i) => (
                      <div key={b.label} className="flex flex-1 flex-col items-center gap-2">
                        <motion.div
                          initial={{ height: 0 }}
                          whileInView={{ height: `${b.h}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.7, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                          className={`w-full rounded-t-xl ${
                            b.label === "Mid" || b.label === "Fin"
                              ? "bg-gradient-to-t from-peach-400 to-peach-300"
                              : "bg-gradient-to-t from-sage-500 to-sage-300"
                          }`}
                          style={{ minHeight: 8 }}
                        />
                        <span className="text-[11px] font-bold text-ink-muted">{b.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* right: concerns + insight */}
              <div className="flex flex-col gap-4">
                <div className="rounded-2xl border border-sage-100 bg-white p-5">
                  <h3 className="font-display text-[15px] font-semibold">Most common concerns</h3>
                  <div className="mt-4 space-y-3.5">
                    {concerns.map((c, i) => (
                      <div key={c.label}>
                        <div className="flex justify-between text-[13px] font-bold">
                          <span>{c.label}</span>
                          <span className="text-ink-muted">{c.pct}%</span>
                        </div>
                        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-cream-deeper/60">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${c.pct}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, delay: 0.15 + i * 0.08 }}
                            className={`h-full rounded-full ${c.color}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-1 rounded-2xl bg-sage-600 p-5 text-white">
                  <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
                    <TrendingDown className="h-3.5 w-3.5" aria-hidden /> Early intervention win
                  </p>
                  <p className="mt-3 font-display text-lg font-semibold leading-snug">
                    “We added 6 evening slots before finals week — waitlists
                    cleared in 4 days.”
                  </p>
                  <p className="mt-2 text-sm text-white/80">
                    Sample insight the Guidance Head could act on. Real reports
                    export in one click for planning and accreditation.
                  </p>
                  <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-bold text-sage-700">
                    <FileDown className="h-4 w-4" aria-hidden /> One-click reports (PDF/CSV)
                  </p>
                </div>
              </div>
            </div>
            <p className="border-t border-sage-100 px-6 py-3 text-center text-xs text-ink-muted sm:px-8">
              *Sample figures for design preview. Real data stays anonymized and aggregated. Avg. stress drop measured after 3 sessions in pilot scenario.
            </p>
          </div>
        </AnimatedSection>

        <Stagger className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-3">
          {[
            { t: "See peak periods", d: "Know when students need you most — midterms, finals, enrollment." },
            { t: "Plan with evidence", d: "Choose wellness topics and slots from real concerns, not guesses." },
            { t: "Prove the impact", d: "Track PSS-10 change over time for reports and continuous care." },
          ].map((c) => (
            <StaggerItem key={c.t}>
              <div className="h-full rounded-3xl border border-white/60 bg-white/80 p-5 text-center shadow-sm">
                <h3 className="font-display text-[16px] font-semibold">{c.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{c.d}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
