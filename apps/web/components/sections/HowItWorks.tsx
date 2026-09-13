"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { MoveRight } from "lucide-react";
import { Eyebrow } from "@/components/AnimatedSection";
import { usePinnedX } from "@/lib/use-pinned-x";
import { steps, type Step } from "@/lib/content";

function StepCard({ s, i }: { s: Step; i: number }) {
  const Icon = s.icon;
  return (
    <article className="relative flex h-[400px] w-[300px] shrink-0 snap-center flex-col rounded-[1.75rem] border border-white/60 bg-white/92 p-7 pt-9 shadow-card backdrop-blur sm:w-[360px]">
      <span
        aria-hidden
        className="absolute -top-5 left-7 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-display text-base font-bold text-white shadow-soft"
      >
        {i + 1}
      </span>
      <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white ${s.tint}`}>
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">{s.step}</p>
      <h3 className="mt-1 font-display text-[22px] font-semibold">{s.title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{s.body}</p>
      <p className="mt-auto rounded-2xl bg-cream-dark px-4 py-2.5 text-[13px] font-bold text-ink-soft">
        {s.meta}
      </p>
    </article>
  );
}

export function HowItWorks() {
  const targetRef = useRef<HTMLDivElement>(null);
  // Keeby-style: vertical wheel drives a pixel-exact horizontal glide.
  const { trackRef, x, active } = usePinnedX(true, targetRef);

  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="relative py-20 lg:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>A calmer path to help</Eyebrow>
          <h2 id="how-heading" className="mt-4 text-3xl font-semibold sm:text-[2.6rem]">
            How it works <span className="text-blue-600">for a student.</span>
          </h2>
          <p className="mt-4 text-[17px] text-ink-muted">
            Five small steps — each one designed to lower the courage it takes
            to ask for support.
          </p>
          <p className="mt-3 hidden items-center justify-center gap-2 text-sm font-bold text-ink-muted md:flex" aria-hidden>
            Keep scrolling — the journey moves sideways <MoveRight className="h-4 w-4" />
          </p>
        </div>
      </div>

      {/* Desktop: pinned viewport, vertical scroll drives horizontal glide */}
      {/* Reduced-motion users get the same steps as a calm static grid. */}
      <div
        ref={targetRef}
        className={active ? "relative hidden h-[280vh] md:block" : "relative hidden md:block"}
      >
        <div
          className={
            active
              ? "sticky top-0 flex h-dvh flex-col justify-center overflow-hidden"
              : "mx-auto max-w-6xl px-4 sm:px-6"
          }
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent,#BFDBFE_50%,transparent)] opacity-70" />
          <div className={active ? "relative" : "relative mx-auto grid max-w-5xl grid-cols-2 gap-x-5 gap-y-9 py-6 lg:grid-cols-3"}>
            <motion.div
              ref={trackRef}
              style={active ? { x } : undefined}
              className={
                active
                  ? "relative flex w-max items-start gap-6 px-[8vw] pt-10 will-change-transform"
                  : "contents"
              }
            >
              {steps.map((s, i) => (
                <div key={s.title} className={active ? "contents" : "flex justify-center pt-6"}>
                  <StepCard s={s} i={i} />
                </div>
              ))}
            </motion.div>
          </div>
          {active && (
            <div className="relative mx-auto mt-10 flex items-center gap-2" aria-hidden>
              {steps.map((_, i) => (
                <span key={i} className="h-2 rounded-full bg-blue-200" style={{ width: 28 - i * 2, opacity: 1 - i * 0.12 }} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile: swipeable stepper (no scroll-jacking on touch) */}
      <div className="mt-10 md:hidden">
        <ol
          className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-6 pt-6"
          aria-label="Steps — swipe sideways"
        >
          {steps.map((s, i) => (
            <li key={s.title} className="snap-center">
              <StepCard s={s} i={i} />
            </li>
          ))}
        </ol>
        <p className="text-center text-xs font-bold uppercase tracking-widest text-ink-muted">
          Swipe to walk through →
        </p>
      </div>
    </section>
  );
}
