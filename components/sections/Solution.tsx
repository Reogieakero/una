"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Check, Smartphone, LayoutDashboard } from "lucide-react";
import { AnimatedSection, Eyebrow } from "@/components/AnimatedSection";
import { Badge } from "@/components/ui/badge";

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
            <h2 id="solution-heading" className="mt-4 text-3xl font-semibold sm:text-[2.6rem]">
              A gentle bridge between students{" "}
              <span className="text-sage-600">and the Guidance Office.</span>
            </h2>
            <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-ink-muted">
              A cross-platform system: a friendly mobile app for students, and a
              powerful web dashboard for counselors and the Guidance Head. Book
              online or join via Google Meet, chat in real time, and let
              analytics quietly surface who might need care next.
            </p>
            <ul className="mt-6 space-y-3">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-3 text-[15.5px] font-medium text-ink-soft">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage-600 text-white">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-2">
              <Badge>
                <Smartphone className="h-3.5 w-3.5" aria-hidden /> Student mobile app
              </Badge>
              <Badge variant="lavender">
                <LayoutDashboard className="h-3.5 w-3.5" aria-hidden /> Counselor web dashboard
              </Badge>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.12}>
            <div className="relative">
              <div aria-hidden className="absolute -inset-5 -z-10 rounded-[2.5rem] bg-gradient-to-br from-sage-100 via-lav-100 to-peach-100 blur-2xl opacity-70" />
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="overflow-hidden rounded-[2rem] border-4 border-white bg-white shadow-soft"
              >
                <Image
                  src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80"
                  alt="DOrSU students studying together outdoors on campus, supporting one another"
                  width={1000}
                  height={700}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover"
                />
                {/* mock booking card */}
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="font-display text-base font-semibold">Book a session</p>
                    <span className="rounded-full bg-sage-100 px-3 py-1 text-xs font-bold text-sage-700">
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
                            ? "border-sage-600 bg-sage-600 text-white shadow-soft"
                            : "border-sage-200 bg-cream text-ink-soft"
                        }`}
                      >
                        <span className="block text-xs font-bold uppercase tracking-wide opacity-80">{s.d}</span>
                        {s.t}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2 rounded-2xl bg-lav-50 p-3 text-[13px] font-medium text-ink-soft">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-lav-400" aria-hidden />
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
