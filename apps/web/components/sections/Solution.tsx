"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Check, Smartphone, LayoutDashboard } from "lucide-react";
import { AnimatedSection, Eyebrow } from "@/components/AnimatedSection";

const bullets = [
  "One calm place to book, reschedule, or cancel — no Facebook threads",
  "PSS-10 check-in before every session, so counselors understand you faster",
  "Anonymous by default, with real people ready when you need them",
];

export function Solution() {
  return (
    <section
      id="solution"
      aria-labelledby="solution-heading"
      className="relative py-20 lg:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <AnimatedSection>
            <Eyebrow>Our solution</Eyebrow>
            <h2
              id="solution-heading"
              className="mt-5 text-balance text-3xl font-semibold tracking-[-0.03em] text-white sm:text-[2.6rem]"
            >
              A gentle bridge between students{" "}
              <span className="font-serif font-normal italic text-yellow-300">
                and the Guidance Office.
              </span>
            </h2>
            <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-blue-100/55">
              A cross-platform system: a friendly mobile app for students, and a
              powerful web dashboard for counselors and the Guidance Head. Book
              online or join via Google Meet, chat in real time, and let
              analytics quietly surface who might need care next.
            </p>
            <ul className="mt-6 space-y-3">
              {bullets.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-3 text-[15.5px] font-medium text-blue-100/75"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-ink">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-xs font-bold text-blue-100/75">
                <Smartphone className="h-3.5 w-3.5" aria-hidden /> Student mobile app
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-xs font-bold text-blue-100/75">
                <LayoutDashboard className="h-3.5 w-3.5" aria-hidden /> Counselor web dashboard
              </span>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.12}>
            <div className="relative">
              <div
                aria-hidden
                className="absolute -inset-5 -z-10 rounded-[2.5rem] bg-gradient-to-br from-blue-500/20 via-blue-400/10 to-yellow-400/10 blur-2xl"
              />
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-2 shadow-[0_28px_80px_-24px_rgba(0,0,0,0.85)] backdrop-blur-xl"
              >
                <div className="overflow-hidden rounded-[1.6rem]">
                  <Image
                    src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80"
                    alt="DOrSU students studying together outdoors on campus, supporting one another"
                    width={1000}
                    height={700}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover"
                  />
                </div>
                {/* mock booking card */}
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="font-display text-base font-semibold text-white">
                      Book a session
                    </p>
                    <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-bold text-blue-200">
                      3 slots open this week
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                    {[
                      { d: "Thu", t: "2:00 PM", active: true },
                      { d: "Fri", t: "10:30 AM", active: false },
                      { d: "Mon", t: "9:00 AM", active: false },
                    ].map((s) => (
                      <div
                        key={s.d + s.t}
                        className={`rounded-2xl border px-2 py-3 font-semibold ${
                          s.active
                            ? "border-yellow-400 bg-yellow-400 text-ink shadow-soft"
                            : "border-white/10 bg-white/[0.04] text-blue-100/70"
                        }`}
                      >
                        <span className="block text-xs font-bold uppercase tracking-wide opacity-80">
                          {s.d}
                        </span>
                        {s.t}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-[13px] font-medium text-blue-100/60">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-yellow-400" aria-hidden />
                    Online via Google Meet link — or in-person at the Guidance Office
                  </div>
                </div>
              </motion.div>
            </div>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}
