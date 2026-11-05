"use client";

import { ArrowRight, MapPin } from "lucide-react";
import { AnimatedSection } from "@/components/AnimatedSection";
import { ChekieMark, Logo } from "@/components/Logo";

const stack = ["Next.js", "Tailwind CSS", "shadcn/ui", "Supabase", "Vercel"];

export function FinalCTA() {
  return (
    <>
      <section id="cta" aria-labelledby="cta-heading" className="relative overflow-hidden py-20 lg:py-28">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <AnimatedSection>
            {/* Light auth-style card: same surface treatment as the login panel. */}
            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#F6F9FF] px-6 py-10 text-center text-ink shadow-[0_28px_80px_-24px_rgba(0,0,0,0.85)] sm:px-12 sm:py-14">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_80%_at_80%_0%,rgba(37,99,235,0.12),transparent_55%)]"
              />
              <div className="relative">
                <ChekieMark
                  size={44}
                  label="Chekie, the panda mascot"
                  className="mx-auto block animate-breathe"
                />
                <h2
                  id="cta-heading"
                  className="mx-auto mt-6 max-w-2xl text-balance font-display text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-[2.8rem]"
                >
                  You deserve support that meets you{" "}
                  <span className="font-serif font-normal italic text-blue-600">
                    where you are.
                  </span>
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-ink-muted">
                  Whether it&apos;s stress before exams, homesickness, or something
                  heavier — the Guidance Office is ready to listen. Book privately,
                  check in with PSS-10, and take the first gentle step today.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <a
                    href="/register"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-yellow-400 px-6 text-[15px] font-bold text-ink shadow-[0_14px_30px_-14px_rgba(245,158,11,0.85)] transition hover:-translate-y-0.5 hover:bg-yellow-300"
                  >
                    Book a Session <ArrowRight className="h-4 w-4" aria-hidden />
                  </a>
                  <a
                    href="#how-it-works"
                    className="inline-flex h-11 items-center justify-center rounded-full border border-ink/15 bg-white px-6 text-[15px] font-semibold text-ink transition hover:-translate-y-0.5 hover:border-blue-400"
                  >
                    See how it works
                  </a>
                </div>
                <p className="mt-5 text-sm font-medium text-ink-muted">
                  Free for all DOrSU students • Anonymous by default • Online or in-person
                </p>
              </div>
            </div>
          </AnimatedSection>

          {/* Built-with strip */}
          <AnimatedSection delay={0.1} className="mt-8">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] px-6 py-6 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-100/40">
                Built with — capstone tech stack
              </p>
              <ul className="mt-4 flex flex-wrap items-center justify-center gap-2.5" aria-label="Technologies used">
                {stack.map((t) => (
                  <li
                    key={t}
                    className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 text-sm font-bold text-blue-100/75"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </AnimatedSection>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 bg-[#050C16]/60 backdrop-blur" aria-label="Footer">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
            <div>
              <Logo
                subtitle="DOrSU Guidance & Counseling"
                subtitleClassName="text-blue-200/50"
              />
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-blue-100/50">
                A capstone project for Davao Oriental State University&apos;s
                Guidance and Counseling Office — making student wellbeing
                accessible, private, and data-informed.
              </p>
              <p className="mt-3 flex items-start gap-1.5 text-sm text-blue-100/50">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Guang-guang, Dahican, City of Mati, Davao Oriental
              </p>
            </div>
            <nav aria-label="Explore">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-100/40">
                Explore
              </p>
              <ul className="mt-3 space-y-2 text-[15px] font-medium">
                {[
                  ["The Problem", "#problem"],
                  ["Our Solution", "#solution"],
                  ["Key Features", "#features"],
                  ["How It Works", "#how-it-works"],
                  ["Analytics", "#analytics"],
                ].map(([label, href]) => (
                  <li key={href}>
                    <a
                      href={href}
                      className="text-blue-100/65 transition hover:text-white hover:underline"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Trust and roles">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-100/40">
                Trust &amp; roles
              </p>
              <ul className="mt-3 space-y-2 text-[15px] font-medium">
                {[
                  ["For Students & Counselors", "#roles"],
                  ["Safety & Privacy", "#safety"],
                  ["Book a Session", "#cta"],
                  ["Back to top", "#top"],
                ].map(([label, href]) => (
                  <li key={label}>
                    <a
                      href={href}
                      className="text-blue-100/65 transition hover:text-white hover:underline"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-[13px] text-blue-100/40 sm:flex-row">
            <p>© 2026 DOrSU Guidance and Counseling Office • Capstone project demo</p>
            <p>Data Privacy Act (RA 10173) aware • Crafted with care in Mati City</p>
          </div>
        </div>
      </footer>
    </>
  );
}
