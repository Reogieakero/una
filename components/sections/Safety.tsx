"use client";

import { AnimatedSection, Eyebrow, Stagger, StaggerItem } from "@/components/AnimatedSection";
import { safetyItems as items } from "@/lib/content";

export function Safety() {
  return (
    <section id="safety" aria-labelledby="safety-heading" className="relative py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="overflow-hidden rounded-[2.5rem] border border-white/60 bg-gradient-to-br from-sage-50 via-white to-lav-50 p-8 shadow-soft sm:p-12 lg:p-16">
          <AnimatedSection className="mx-auto max-w-2xl text-center">
            <Eyebrow>Safety & privacy</Eyebrow>
            <h2 id="safety-heading" className="mt-4 text-3xl font-semibold sm:text-[2.6rem]">
              Your story stays yours. <span className="text-sage-600">We built it that way.</span>
            </h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink-muted">
              Seeking help takes trust. So anonymity isn&apos;t a setting — it&apos;s
              the starting point. And when safety truly requires an exception,
              the process is strict, transparent, and reviewable.
            </p>
          </AnimatedSection>

          <Stagger className="mt-10 grid gap-5 md:grid-cols-2" delay={0.1}>
            {items.map(({ icon: Icon, tint, title, body }) => (
              <StaggerItem key={title}>
                <article className="flex h-full gap-4 rounded-3xl border border-white bg-white/90 p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-soft">
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white ${tint}`}>
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-display text-[17px] font-semibold">{title}</h3>
                    <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-muted">{body}</p>
                  </div>
                </article>
              </StaggerItem>
            ))}
          </Stagger>

          <AnimatedSection delay={0.15} className="mt-8">
            <p className="mx-auto max-w-3xl rounded-2xl bg-sage-600 px-6 py-4 text-center text-[15px] font-medium leading-relaxed text-white shadow-soft">
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
