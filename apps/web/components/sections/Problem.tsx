"use client";

import { Clock3, DoorOpen, LineChart, Megaphone } from "lucide-react";
import { AnimatedSection, Eyebrow, Stagger, StaggerItem } from "@/components/AnimatedSection";

const pains = [
  {
    icon: Clock3,
    tint: "bg-yellow-400/15 text-yellow-300",
    title: "Long waits, manual booking",
    body: "Appointments run through Facebook messages, QR codes, and walk-ins — easy to miss, hard to reschedule, and stressful when you already feel overwhelmed.",
  },
  {
    icon: DoorOpen,
    tint: "bg-blue-500/15 text-blue-300",
    title: "Stigma at the office door",
    body: "Many students hesitate to walk into the Guidance Office and be seen. Without a private way to reach out, small worries grow into crises.",
  },
  {
    icon: Megaphone,
    tint: "bg-blue-400/15 text-blue-200",
    title: "Low awareness of support",
    body: "Wellness events and announcements get buried in feeds. Students don't know when, where, or how to ask for help — so most never do.",
  },
  {
    icon: LineChart,
    tint: "bg-yellow-400/15 text-yellow-200",
    title: "No data, no early action",
    body: "With paper logs and scattered chats, counselors can't see stress trends, peak periods, or common concerns — decisions come too late.",
  },
];

export function Problem() {
  return (
    <section id="problem" aria-labelledby="problem-heading" className="relative py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <AnimatedSection className="mx-auto max-w-2xl text-center">
          <Eyebrow>Why this matters</Eyebrow>
          <h2
            id="problem-heading"
            className="mt-5 text-balance text-3xl font-semibold tracking-[-0.03em] text-white sm:text-[2.6rem]"
          >
            Students are struggling —{" "}
            <span className="font-serif font-normal italic text-yellow-300">
              reaching help shouldn&apos;t be hard too.
            </span>
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-blue-100/55">
            Stress, anxiety, and academic pressure are rising at DOrSU. But the
            path to counseling still depends on who you message, which QR code
            you scan, or whether you&apos;re brave enough to walk in.
          </p>
        </AnimatedSection>

        <Stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" delay={0.1}>
          {pains.map(({ icon: Icon, tint, title, body }) => (
            <StaggerItem key={title}>
              <article className="group h-full rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1.5 hover:border-blue-400/30 hover:bg-white/[0.07]">
                <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${tint}`}>
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <h3 className="mt-4 font-display text-[17px] font-semibold leading-snug text-white">
                  {title}
                </h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-blue-100/55">
                  {body}
                </p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
