"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { MoveRight } from "lucide-react";
import { Eyebrow } from "@/components/AnimatedSection";
import { usePinnedX } from "@/lib/use-pinned-x";
import { features, type Feature } from "@/lib/content";

function FeatureCard({ f, i }: { f: Feature; i: number }) {
  const Icon = f.icon;
  return (
    <article
      aria-label={`Feature ${i + 1}: ${f.title}`}
      className="group flex h-[420px] w-[300px] shrink-0 snap-center flex-col rounded-[1.75rem] border border-white/60 bg-white/90 p-7 shadow-card backdrop-blur transition-all duration-300 hover:-translate-y-2 hover:shadow-soft sm:w-[340px]"
    >
      <div className="flex items-center justify-between">
        <span className={`flex h-12 w-12 items-center justify-center rounded-2xl p-3 text-white shadow-sm ${f.tint}`}>
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <span className="font-display text-sm font-semibold text-ink-faint">
          {String(i + 1).padStart(2, "0")} / 10
        </span>
      </div>
      <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">
        {f.tag}
      </p>
      <h3 className="mt-1 font-display text-xl font-semibold leading-snug">{f.title}</h3>
      <p className="mt-2.5 text-[15px] leading-relaxed text-ink-muted">{f.body}</p>
      <div className="mt-auto flex items-center gap-2 pt-5 text-sm font-bold text-sage-600">
        <span className="h-1.5 w-8 rounded-full bg-sage-200 transition-all duration-300 group-hover:w-12 group-hover:bg-sage-500" aria-hidden />
        Made for DOrSU
      </div>
    </article>
  );
}

export function KeyFeatures() {
  const targetRef = useRef<HTMLDivElement>(null);
  // Keeby-style: vertical wheel drives a pixel-exact horizontal glide.
  const { trackRef, x, progress, active } = usePinnedX(true, targetRef);

  return (
    <section id="features" aria-labelledby="features-heading" className="relative py-20 lg:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Everything in one safe place</Eyebrow>
          <h2 id="features-heading" className="mt-4 text-3xl font-semibold sm:text-[2.6rem]">
            Key features, <span className="text-sage-600">designed with care.</span>
          </h2>
          <p className="mt-4 text-[17px] text-ink-muted">
            Ten gentle tools that remove friction for students and give
            counselors time back. Keep scrolling — the cards glide sideways.
          </p>
          <p className="mt-3 hidden items-center justify-center gap-2 text-sm font-bold text-ink-muted md:flex" aria-hidden>
            Scroll down to travel sideways <MoveRight className="h-4 w-4" />
          </p>
        </div>
      </div>

      {/* ── Desktop: pinned viewport, vertical scroll drives horizontal glide ── */}
      {/* Reduced-motion users get the same cards as a calm static grid. */}
      <div
        ref={targetRef}
        className={active ? "relative hidden h-[340vh] md:block" : "relative hidden md:block"}
      >
        <div
          className={
            active
              ? "sticky top-0 flex h-dvh flex-col justify-center overflow-hidden"
              : "mx-auto max-w-6xl px-4 py-6 sm:px-6"
          }
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,#EFF6F0_50%,transparent_100%)]"
          />
          <motion.div
            ref={trackRef}
            style={active ? { x } : undefined}
            className={
              active
                ? "relative flex w-max items-stretch gap-6 px-[8vw] will-change-transform"
                : "relative mx-auto grid max-w-5xl grid-cols-2 gap-5 lg:grid-cols-3"
            }
          >
            {features.map((f, i) => (
              <div key={f.title} className={active ? "contents" : "flex justify-center"}>
                <FeatureCard f={f} i={i} />
              </div>
            ))}
            {/* end card */}
            <div className={active ? "contents" : "flex justify-center"}>
              <div className="flex h-[420px] w-[300px] shrink-0 flex-col items-start justify-center rounded-[1.75rem] bg-sage-600 p-8 text-white shadow-soft sm:w-[340px]">
                <p className="font-display text-2xl font-semibold leading-snug">
                  And it all works together quietly.
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-white/85">
                  Booking → PSS-10 → chat → Meet → follow-up — with analytics
                  learning how to help earlier.
                </p>
                <a
                  href="#how-it-works"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-sage-700 transition-transform hover:-translate-y-0.5"
                >
                  See how it works <MoveRight className="h-4 w-4" aria-hidden />
                </a>
              </div>
            </div>
          </motion.div>

          {/* progress — shows how far through the sideways journey you are */}
          {active && (
            <div className="relative mx-auto mt-10 w-[min(560px,80vw)]">
              <div className="h-1.5 overflow-hidden rounded-full bg-sage-100">
                <motion.div style={{ scaleX: progress }} className="h-full w-full origin-left rounded-full bg-gradient-to-r from-sage-500 via-lav-400 to-peach-400" />
              </div>
              <div className="mt-3 flex justify-between text-xs font-bold uppercase tracking-widest text-ink-muted" aria-hidden>
                <span>01 — Booking</span>
                <span>05 — Analytics</span>
                <span>10 — Referral</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile: swipeable row (no scroll-jacking on touch) ── */}
      <div className="mt-10 md:hidden">
        <div
          className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4"
          role="region"
          aria-label="Key features — swipe sideways"
          tabIndex={0}
        >
          {features.map((f, i) => (
            <FeatureCard key={f.title} f={f} i={i} />
          ))}
        </div>
        <p className="mt-2 text-center text-xs font-bold uppercase tracking-widest text-ink-muted">
          Swipe sideways →
        </p>
      </div>
    </section>
  );
}
