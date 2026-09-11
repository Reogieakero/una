"use client";

import { ArrowRight, MapPin } from "lucide-react";
import { AnimatedSection } from "@/components/AnimatedSection";
import { Button } from "@/components/ui/button";
import { ChekieMark, Logo } from "@/components/Logo";

const stack = ["Next.js", "Tailwind CSS", "shadcn/ui", "Supabase", "Vercel"];

export function FinalCTA() {
  return (
    <>
      <section id="cta" aria-labelledby="cta-heading" className="relative overflow-hidden py-20 lg:py-28">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-cream via-sage-50 to-lav-100/60" />
          <div className="absolute left-1/2 top-10 h-80 w-80 -translate-x-1/2 rounded-full bg-peach-200/40 blur-[90px]" />
        </div>
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <AnimatedSection>
            <ChekieMark
              size={48}
              label="Chekie, the panda mascot"
              className="mx-auto animate-breathe"
            />
            <h2 id="cta-heading" className="mx-auto mt-6 max-w-2xl text-balance text-3xl font-semibold sm:text-[2.8rem]">
              You deserve support that meets you{" "}
              <span className="text-sage-600">where you are.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-ink-muted">
              Whether it&apos;s stress before exams, homesickness, or something
              heavier — the Guidance Office is ready to listen. Book privately,
              check in with PSS-10, and take the first gentle step today.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a href="#top">
                <Button size="lg">
                  Book a Session <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              </a>
              <a href="#how-it-works">
                <Button variant="secondary" size="lg">
                  See how it works
                </Button>
              </a>
            </div>
            <p className="mt-5 text-sm font-medium text-ink-muted">
              Free for all DOrSU students • Anonymous by default • Online or in-person
            </p>
          </AnimatedSection>

          {/* Built-with strip */}
          <AnimatedSection delay={0.1} className="mt-12">
            <div className="rounded-[2rem] border border-white/60 bg-white/75 px-6 py-6 shadow-card backdrop-blur">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-muted">
                Built with — capstone tech stack
              </p>
              <ul className="mt-4 flex flex-wrap items-center justify-center gap-2.5" aria-label="Technologies used">
                {stack.map((t) => (
                  <li
                    key={t}
                    className="rounded-full border border-sage-200 bg-cream px-4 py-1.5 text-sm font-bold text-ink-soft"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </AnimatedSection>
        </div>
      </section>

      <footer className="border-t border-sage-100 bg-white/70 backdrop-blur" aria-label="Footer">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
            <div>
              <Logo subtitle="DOrSU Guidance & Counseling" />
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-muted">
                A capstone project for Davao Oriental State University&apos;s
                Guidance and Counseling Office — making student wellbeing
                accessible, private, and data-informed.
              </p>
              <p className="mt-3 flex items-start gap-1.5 text-sm text-ink-muted">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Guang-guang, Dahican, City of Mati, Davao Oriental
              </p>
            </div>
            <nav aria-label="Explore">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">Explore</p>
              <ul className="mt-3 space-y-2 text-[15px] font-medium">
                {[
                  ["The Problem", "#problem"],
                  ["Our Solution", "#solution"],
                  ["Key Features", "#features"],
                  ["How It Works", "#how-it-works"],
                  ["Analytics", "#analytics"],
                ].map(([label, href]) => (
                  <li key={href}>
                    <a href={href} className="text-ink-soft hover:text-sage-700 hover:underline">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Trust and roles">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">Trust & roles</p>
              <ul className="mt-3 space-y-2 text-[15px] font-medium">
                {[
                  ["For Students & Counselors", "#roles"],
                  ["Safety & Privacy", "#safety"],
                  ["Book a Session", "#cta"],
                  ["Back to top", "#top"],
                ].map(([label, href]) => (
                  <li key={label}>
                    <a href={href} className="text-ink-soft hover:text-sage-700 hover:underline">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-sage-100 pt-6 text-[13px] text-ink-muted sm:flex-row">
            <p>© 2026 DOrSU Guidance and Counseling Office • Capstone project demo</p>
            <p>Data Privacy Act (RA 10173) aware • Crafted with care in Mati City</p>
          </div>
        </div>
      </footer>
    </>
  );
}
