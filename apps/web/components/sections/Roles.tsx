"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarCheck,
  MessagesSquare,
  ClipboardList,
  PartyPopper,
  LayoutDashboard,
  FileText,
  Video,
  Siren,
  BarChart3,
  Users,
  Send,
  Bell,
} from "lucide-react";
import { AnimatedSection, Eyebrow } from "@/components/AnimatedSection";
import { cn } from "@/lib/utils";

const roles = {
  students: {
    label: "Students",
    headline: "For students — help without the hurdle.",
    sub: "Everything happens from your phone, privately, on your schedule.",
    items: [
      { icon: CalendarCheck, title: "Book in minutes", body: "See open slots, pick online or in-person, reschedule with one tap." },
      { icon: ClipboardList, title: "PSS-10 check-ins", body: "A 3-minute stress check before each session — no awkward first explanation." },
      { icon: MessagesSquare, title: "Chat + Google Meet", body: "Message your counselor when you're nervous; join sessions from anywhere." },
      { icon: PartyPopper, title: "Wellness events", body: "Discover talks, group sessions, and activities — and get gentle reminders." },
    ],
  },
  counselors: {
    label: "Counselors",
    headline: "For counselors — less admin, more presence.",
    sub: "A calm workspace that keeps records tidy and sessions human.",
    items: [
      { icon: LayoutDashboard, title: "Schedules & records", body: "Day, week, and caseload views with session history at a glance." },
      { icon: FileText, title: "Session documentation", body: "Structured notes, PSS-10 history, and follow-up plans — searchable and secure." },
      { icon: Video, title: "Chat + Meet in one place", body: "Continue conversations and launch online sessions without switching apps." },
      { icon: Siren, title: "Break-Glass protocol", body: "Override anonymity only in critical situations — every access fully audit-logged." },
    ],
  },
  head: {
    label: "Head & Faculty",
    headline: "For Guidance Head & faculty — see sooner, act earlier.",
    sub: "Anonymous trends become decisions that protect the whole campus.",
    items: [
      { icon: BarChart3, title: "Stress trends & reports", body: "Common concerns, peak periods (midterms, finals), and program impact — exportable." },
      { icon: Users, title: "Caseload oversight", body: "Balance loads across counselors and spot bottlenecks before waitlists grow." },
      { icon: Send, title: "Faculty referrals", body: "Instructors can quietly flag students who seem withdrawn — routed with care." },
      { icon: Bell, title: "Event management", body: "Publish announcements and measure which wellness programs actually help." },
    ],
  },
} as const;

type RoleKey = keyof typeof roles;

export function Roles() {
  const [active, setActive] = useState<RoleKey>("students");
  const r = roles[active];

  return (
    <section id="roles" aria-labelledby="roles-heading" className="relative py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <AnimatedSection className="mx-auto max-w-2xl text-center">
          <Eyebrow>Made for every role</Eyebrow>
          <h2
            id="roles-heading"
            className="mt-5 text-balance text-3xl font-semibold tracking-[-0.03em] text-white sm:text-[2.6rem]"
          >
            One system,{" "}
            <span className="font-serif font-normal italic text-yellow-300">
              three kinds of relief.
            </span>
          </h2>
        </AnimatedSection>

        <AnimatedSection delay={0.1} className="mt-10">
          <div className="flex justify-center">
            <div
              role="tablist"
              aria-label="Choose a role"
              className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] p-1.5 shadow-sm backdrop-blur"
            >
              {(Object.keys(roles) as RoleKey[]).map((key) => (
                <button
                  key={key}
                  role="tab"
                  type="button"
                  aria-selected={active === key}
                  onClick={() => setActive(key)}
                  className={cn(
                    "inline-flex h-9 items-center rounded-full px-4 text-[13px] font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                    active === key
                      ? "bg-yellow-400 text-ink shadow-soft"
                      : "text-blue-100/60 hover:bg-white/[0.06] hover:text-white"
                  )}
                >
                  {roles[key].label}
                </button>
              ))}
            </div>
          </div>

          <motion.div
            key={active}
            role="tabpanel"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_70px_-40px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:p-10"
          >
            <div className="max-w-2xl">
              <h3 className="font-display text-2xl font-semibold text-white">
                {r.headline}
              </h3>
              <p className="mt-2 text-[16px] text-blue-100/55">{r.sub}</p>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {r.items.map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-blue-400/30 hover:bg-white/[0.06]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-200">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h4 className="mt-3 font-display text-[16px] font-semibold text-white">
                    {title}
                  </h4>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-blue-100/55">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatedSection>
      </div>
    </section>
  );
}
