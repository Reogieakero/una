"use client";

import { ArrowRight } from "lucide-react";
import { Eyebrow, Stagger, StaggerItem } from "@/components/AnimatedSection";
import { steps, type Step } from "@/lib/content";

function StepCard({ s, i }: { s: Step; i: number }) {
  const Icon = s.icon;
  return (
    <article className="relative flex h-full min-h-[320px] flex-col rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-7 pt-9 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1.5 hover:border-blue-400/30 hover:bg-white/[0.07]">
      <span
        aria-hidden
        className="absolute -top-5 left-7 flex h-10 w-10 items-center justify-center rounded-full bg-yellow-400 font-display text-base font-bold text-ink shadow-soft"
      >
        {i + 1}
      </span>
      <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white ${s.tint}`}>
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-blue-100/45">
        {s.step}
      </p>
      <h3 className="mt-1 font-display text-[22px] font-semibold text-white">
        {s.title}
      </h3>
      <p className="mt-2 text-[15px] leading-relaxed text-blue-100/55">{s.body}</p>
      <p className="mt-auto rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[13px] font-bold text-blue-100/70">
        {s.meta}
      </p>
    </article>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="relative py-20 lg:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>A calmer path to help</Eyebrow>
          <h2
            id="how-heading"
            className="mt-5 text-balance text-3xl font-semibold tracking-[-0.03em] text-white sm:text-[2.6rem]"
          >
            How it works{" "}
            <span className="font-serif font-normal italic text-yellow-300">
              for a student.
            </span>
          </h2>
          <p className="mt-4 text-[17px] text-blue-100/55">
            Five small steps — each one designed to lower the courage it takes
            to ask for support.
          </p>
        </div>

        <Stagger className="mt-12 grid gap-x-5 gap-y-9 pt-5 sm:grid-cols-2 lg:grid-cols-3" delay={0.05}>
          {steps.map((s, i) => (
            <StaggerItem key={s.title}>
              <StepCard s={s} i={i} />
            </StaggerItem>
          ))}

          {/* closing card */}
          <StaggerItem>
            <div className="flex h-full min-h-[320px] flex-col items-start justify-center rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-blue-600 to-blue-700 p-8 text-white shadow-soft">
              <p className="font-display text-2xl font-semibold leading-snug">
                Ready when you are.
              </p>
              <p className="mt-3 text-[15px] leading-relaxed text-white/80">
                Create a free student account and take the first step in about
                a minute — privately.
              </p>
              <a
                href="/register"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-yellow-400 px-5 py-2.5 text-sm font-bold text-ink transition-transform hover:-translate-y-0.5 hover:bg-yellow-300"
              >
                Create account <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            </div>
          </StaggerItem>
        </Stagger>
      </div>
    </section>
  );
}
