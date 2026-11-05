"use client";

import { ArrowRight } from "lucide-react";
import { Eyebrow, Stagger, StaggerItem } from "@/components/AnimatedSection";
import { features, type Feature } from "@/lib/content";

function FeatureCard({ f, i }: { f: Feature; i: number }) {
  const Icon = f.icon;
  return (
    <article
      aria-label={`Feature ${i + 1}: ${f.title}`}
      className="group flex h-full min-h-[300px] flex-col rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-7 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1.5 hover:border-blue-400/30 hover:bg-white/[0.07]"
    >
      <div className="flex items-center justify-between">
        <span className={`flex h-12 w-12 items-center justify-center rounded-2xl p-3 text-white shadow-sm ${f.tint}`}>
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <span className="font-display text-sm font-semibold text-blue-100/30">
          {String(i + 1).padStart(2, "0")} / 10
        </span>
      </div>
      <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-100/45">
        {f.tag}
      </p>
      <h3 className="mt-1 font-display text-xl font-semibold leading-snug text-white">
        {f.title}
      </h3>
      <p className="mt-2.5 text-[15px] leading-relaxed text-blue-100/55">
        {f.body}
      </p>
      <div className="mt-auto flex items-center gap-2 pt-5 text-sm font-bold text-yellow-300">
        <span
          className="h-1.5 w-8 rounded-full bg-yellow-400/40 transition-all duration-300 group-hover:w-12 group-hover:bg-yellow-400"
          aria-hidden
        />
        Made for DOrSU
      </div>
    </article>
  );
}

export function KeyFeatures() {
  return (
    <section id="features" aria-labelledby="features-heading" className="relative py-20 lg:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Everything in one safe place</Eyebrow>
          <h2
            id="features-heading"
            className="mt-5 text-balance text-3xl font-semibold tracking-[-0.03em] text-white sm:text-[2.6rem]"
          >
            Key features,{" "}
            <span className="font-serif font-normal italic text-yellow-300">
              designed with care.
            </span>
          </h2>
          <p className="mt-4 text-[17px] text-blue-100/55">
            Ten gentle tools that remove friction for students and give
            counselors time back.
          </p>
        </div>

        <Stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" delay={0.05}>
          {features.map((f, i) => (
            <StaggerItem key={f.title}>
              <FeatureCard f={f} i={i} />
            </StaggerItem>
          ))}

          {/* closing card */}
          <StaggerItem>
            <div className="flex h-full min-h-[300px] flex-col items-start justify-center rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-blue-600 to-blue-700 p-8 text-white shadow-soft">
              <p className="font-display text-2xl font-semibold leading-snug">
                And it all works together quietly.
              </p>
              <p className="mt-3 text-[15px] leading-relaxed text-white/80">
                Booking → PSS-10 → chat → Meet → follow-up — with analytics
                learning how to help earlier.
              </p>
              <a
                href="#how-it-works"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-yellow-400 px-5 py-2.5 text-sm font-bold text-ink transition-transform hover:-translate-y-0.5 hover:bg-yellow-300"
              >
                See how it works <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            </div>
          </StaggerItem>
        </Stagger>
      </div>
    </section>
  );
}
