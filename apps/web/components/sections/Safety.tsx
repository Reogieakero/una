"use client";

import { AnimatedSection, Eyebrow, Stagger, StaggerItem } from "@/components/AnimatedSection";
import { safetyItems as items } from "@/lib/content";

export function Safety() {
  return (
    <section id="safety" aria-labelledby="safety-heading" className="relative py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="overflow-hidden rounded-[2.5rem] border border-white/10 bg-[linear-gradient(160deg,rgba(37,99,235,0.16),rgba(255,255,255,0.03)_45%,rgba(251,191,36,0.07))] p-8 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:p-12 lg:p-16">
          <AnimatedSection className="mx-auto max-w-2xl text-center">
            <Eyebrow>Safety &amp; privacy</Eyebrow>
            <h2
              id="safety-heading"
              className="mt-5 text-balance text-3xl font-semibold tracking-[-0.03em] text-white sm:text-[2.6rem]"
            >
              Your story stays yours.{" "}
              <span className="font-serif font-normal italic text-yellow-300">
                We built it that way.
              </span>
            </h2>
            <p className="mt-4 text-[17px] leading-relaxed text-blue-100/55">
              Seeking help takes trust. So anonymity isn&apos;t a setting — it&apos;s
              the starting point. And when safety truly requires an exception,
              the process is strict, transparent, and reviewable.
            </p>
          </AnimatedSection>

          <Stagger className="mt-10 grid gap-5 md:grid-cols-2" delay={0.1}>
            {items.map(({ icon: Icon, tint, title, body }) => (
              <StaggerItem key={title}>
                <article className="flex h-full gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.9)] backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-blue-400/30 hover:bg-white/[0.06]">
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white ${tint}`}>
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-display text-[17px] font-semibold text-white">
                      {title}
                    </h3>
                    <p className="mt-1.5 text-[14.5px] leading-relaxed text-blue-100/55">
                      {body}
                    </p>
                  </div>
                </article>
              </StaggerItem>
            ))}
          </Stagger>

          <AnimatedSection delay={0.15} className="mt-8">
            <p className="mx-auto max-w-3xl rounded-2xl border border-blue-400/20 bg-blue-600/85 px-6 py-4 text-center text-[15px] font-medium leading-relaxed text-white shadow-soft">
              If you&apos;re ever in crisis, you don&apos;t have to wait for a slot —
              reach out to the Guidance Office directly or contact local emergency
              services. This system supports care; it never replaces urgent help.
            </p>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}
