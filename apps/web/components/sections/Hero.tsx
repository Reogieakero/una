"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, CalendarCheck, EyeOff, ShieldCheck } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const TRUST = [
  { icon: EyeOff, text: "Anonymous by default" },
  { icon: ShieldCheck, text: "RA 10173 compliant" },
  { icon: CalendarCheck, text: "No more walk-in lines" },
];

export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section
      id="top"
      aria-labelledby="hero-heading"
      className="relative overflow-hidden pb-20 pt-32 sm:pt-36 lg:pb-28 lg:pt-44"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
        {/* Copy */}
        <div>
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={0}
            className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-100/45"
          >
            <span className="h-px w-6 bg-yellow-400/70" aria-hidden />
            Davao Oriental State University · Guidance &amp; Counseling
          </motion.p>

          <motion.h1
            id="hero-heading"
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={1}
            className="mt-6 max-w-xl text-balance font-display text-[2.6rem] font-semibold leading-[1.06] tracking-[-0.035em] text-white sm:text-6xl lg:text-[4rem]"
          >
            Counseling that feels{" "}
            <span className="whitespace-nowrap font-serif font-normal italic text-yellow-300">
              safe to start.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={2}
            className="mt-6 max-w-xl text-[16px] leading-7 text-blue-100/60"
          >
            The Digital Counseling and Appointment System lets DOrSU students
            book sessions in minutes, check in with a PSS-10 stress assessment,
            and talk to a counselor — privately, with analytics that help the
            Guidance Office care for every student earlier.
          </motion.p>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={3}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <a
              href="#cta"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-yellow-400 px-6 text-[15px] font-bold text-ink shadow-[0_14px_30px_-14px_rgba(245,158,11,0.85)] transition hover:-translate-y-0.5 hover:bg-yellow-300"
            >
              <CalendarCheck className="h-4 w-4" aria-hidden />
              Book a Session
            </a>
            <a
              href="/login"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-6 text-[15px] font-semibold text-white backdrop-blur transition hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.08]"
            >
              Login
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </a>
          </motion.div>

          <motion.dl
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={4}
            className="mt-9 flex flex-wrap gap-x-7 gap-y-3 text-sm"
          >
            {TRUST.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-blue-100/70">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
                  <Icon className="h-4 w-4 text-yellow-300" aria-hidden />
                </span>
                <dt className="sr-only">{text}</dt>
                <dd className="font-semibold">{text}</dd>
              </div>
            ))}
          </motion.dl>
        </div>

        {/* Visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto w-full max-w-[520px]"
        >
          <div
            aria-hidden
            className="absolute -inset-6 -z-10 rounded-[3rem] bg-[radial-gradient(circle_at_30%_20%,rgba(96,165,250,0.35)_0%,transparent_55%),radial-gradient(circle_at_80%_70%,rgba(251,191,36,0.16)_0%,transparent_55%)] opacity-70 blur-2xl animate-breathe"
          />
          <motion.div
            animate={reduce ? {} : { y: [0, -12, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-2 shadow-[0_28px_80px_-24px_rgba(0,0,0,0.85)] backdrop-blur"
          >
            <div className="relative overflow-hidden rounded-[1.6rem]">
              <Image
                src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80"
                alt="Two DOrSU students walking together on campus, smiling and talking"
                width={1040}
                height={780}
                priority
                className="aspect-[4/3.4] w-full object-cover"
              />
              <div className="absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#050C16]/80 p-3.5 shadow-card backdrop-blur-xl">
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-60" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-yellow-400" />
                </span>
                <p className="text-sm font-semibold leading-snug text-white">
                  “I booked in 2 minutes — no need to walk in and explain
                  myself at the door.”
                  <span className="block text-xs font-medium text-blue-100/55">
                    2nd-year student, anonymous check-in
                  </span>
                </p>
              </div>
            </div>
          </motion.div>

          {/* floating cards */}
          <motion.div
            animate={reduce ? {} : { y: [0, -10, 0], rotate: [-1, 1, -1] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -left-4 top-8 hidden rounded-2xl border border-white/10 bg-[#07101D]/90 p-3.5 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:block lg:-left-10"
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-yellow-300/80">
              PSS-10 check-in
            </p>
            <p className="font-display text-2xl font-semibold text-white">
              Moderate{" "}
              <span className="text-sm font-medium text-blue-100/50">• 18/40</span>
            </p>
            <div className="mt-2 h-2 w-36 overflow-hidden rounded-full bg-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "45%" }}
                transition={{ duration: 1.2, delay: 0.8 }}
                className="h-full rounded-full bg-blue-500"
              />
            </div>
          </motion.div>

          <motion.div
            animate={reduce ? {} : { y: [0, 10, 0] }}
            transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
            className="absolute -right-3 bottom-24 hidden rounded-2xl border border-white/10 bg-[#07101D]/90 p-3.5 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:block lg:-right-8"
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-300/80">
              Next session
            </p>
            <p className="text-sm font-bold text-white">
              Thu, 2:00 PM • Google Meet
            </p>
            <p className="text-xs font-medium text-blue-100/50">
              with Counselor M. • Confirmed
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
