"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarCheck, EyeOff, LogIn, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section
      id="top"
      aria-labelledby="hero-heading"
      className="relative overflow-hidden pb-16 pt-32 sm:pt-36 lg:pb-24 lg:pt-44"
    >
      {/* soft gradient background */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#EFF6FF_0%,#DBEAFE_38%,#BFDBFE_72%,#EFF6FF_100%)]" />
        <div className="absolute -left-24 top-24 h-96 w-96 rounded-full bg-blue-200/50 blur-[90px]" />
        <div className="absolute -right-24 top-64 h-[28rem] w-[28rem] rounded-full bg-blue-200/50 blur-[100px]" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-blue-100/80 blur-[80px]" />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        {/* Copy */}
        <div>
          <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0}>
            <Badge variant="yellow" className="bg-white/80 shadow-sm">
              Davao Oriental State University • Guidance & Counseling Office
            </Badge>
          </motion.div>

          <motion.h1
            id="hero-heading"
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={1}
            className="mt-5 max-w-xl text-balance font-display text-[2.6rem] font-semibold leading-[1.08] sm:text-6xl lg:text-[4.2rem]"
          >
            Counseling that feels{" "}
            <span className="relative whitespace-nowrap text-blue-600">
              safe to start
              <svg
                aria-hidden
                viewBox="0 0 220 14"
                className="absolute -bottom-2 left-0 w-full text-yellow-300"
                fill="none"
              >
                <path
                  d="M3 10C60 3 160 3 217 9"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            , easy to reach.
          </motion.h1>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={2}
            className="mt-6 max-w-xl text-lg leading-relaxed text-ink-muted"
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
            <a href="#cta">
              <Button size="lg">
                <CalendarCheck className="h-5 w-5" aria-hidden />
                Book a Session
              </Button>
            </a>
            <a href="/login">
              <Button variant="secondary" size="lg">
                <LogIn className="h-4 w-4" aria-hidden />
                Login
              </Button>
            </a>
          </motion.div>

          <motion.dl
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={4}
            className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm"
          >
            {[
              { icon: EyeOff, text: "Anonymous by default" },
              { icon: ShieldCheck, text: "RA 10173 compliant" },
              { icon: CalendarCheck, text: "No more walk-in lines" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-ink-soft">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">
                  <Icon className="h-4 w-4 text-blue-600" aria-hidden />
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
          {/* breathing glow */}
          <div
            aria-hidden
            className="absolute -inset-6 -z-10 rounded-[3rem] bg-[radial-gradient(circle_at_30%_20%,#BFDBFE_0%,transparent_55%),radial-gradient(circle_at_80%_70%,#DBEAFE_0%,transparent_55%)] opacity-70 blur-2xl animate-breathe"
          />
          <motion.div
            animate={reduce ? {} : { y: [0, -12, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="relative overflow-hidden rounded-[2rem] border-4 border-white bg-white shadow-soft"
          >
            <Image
              src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80"
              alt="Two DOrSU students walking together on campus, smiling and talking"
              width={1040}
              height={780}
              priority
              className="aspect-[4/3.4] w-full object-cover"
            />
            <div className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-2xl bg-white/92 p-3.5 shadow-card backdrop-blur">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-500" />
              </span>
              <p className="text-sm font-semibold leading-snug text-ink">
                “I booked in 2 minutes — no need to walk in and explain myself
                at the door.”
                <span className="block text-xs font-medium text-ink-muted">
                  2nd-year student, anonymous check-in
                </span>
              </p>
            </div>
          </motion.div>

          {/* floating cards */}
          <motion.div
            animate={reduce ? {} : { y: [0, -10, 0], rotate: [-1, 1, -1] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -left-4 top-8 hidden rounded-2xl border border-white/60 bg-white/95 p-3.5 shadow-card backdrop-blur sm:block lg:-left-10"
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
              PSS-10 check-in
            </p>
            <p className="font-display text-2xl font-semibold">
              Moderate <span className="text-sm font-medium text-ink-muted">• 18/40</span>
            </p>
            <div className="mt-2 h-2 w-36 overflow-hidden rounded-full bg-blue-100">
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
            className="absolute -right-3 bottom-24 hidden rounded-2xl border border-white/60 bg-white/95 p-3.5 shadow-card backdrop-blur sm:block lg:-right-8"
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-500">
              Next session
            </p>
            <p className="text-sm font-bold">Thu, 2:00 PM • Google Meet</p>
            <p className="text-xs font-medium text-ink-muted">with Counselor M. • Confirmed</p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
