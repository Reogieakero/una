"use client";

import { Clock3, DoorOpen, LineChart, Megaphone } from "lucide-react";
import { AnimatedSection, Eyebrow, Stagger, StaggerItem } from "@/components/AnimatedSection";

const pains = [
  {
    icon: Clock3,
    tint: "bg-peach-50 text-peach-600",
    title: "Long waits, manual booking",
    body: "Appointments run through Facebook messages, QR codes, and walk-ins — easy to miss, hard to reschedule, and stressful when you already feel overwhelmed.",
  },
  {
    icon: DoorOpen,
    tint: "bg-lav-100 text-lav-500",
    title: "Stigma at the office door",
    body: "Many students hesitate to walk into the Guidance Office and be seen. Without a private way to reach out, small worries grow into crises.",
  },
  {
    icon: Megaphone,
    tint: "bg-skysoft-100 text-skysoft-400",
    title: "Low awareness of support",
    body: "Wellness events and announcements get buried in feeds. Students don't know when, where, or how to ask for help — so most never do.",
  },
  {
    icon: LineChart,
    tint: "bg-sage-100 text-sage-600",
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
          <h2 id="problem-heading" className="mt-4 text-3xl font-semibold sm:text-[2.6rem]">
            Students are struggling —{" "}
            <span className="text-sage-600">reaching help shouldn&apos;t be hard too.</span>
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-ink-muted">
            Stress, anxiety, and academic pressure are rising at DOrSU. But the
            path to counseling still depends on who you message, which QR code
            you scan, or whether you&apos;re brave enough to walk in.
          </p>
        </AnimatedSection>

        <Stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" delay={0.1}>
          {pains.map(({ icon: Icon, tint, title, body }) => (
            <StaggerItem key={title}>
              <article className="group h-full rounded-3xl border border-white/60 bg-white/85 p-6 shadow-card backdrop-blur transition-all duration-300 hover:-translate-y-1.5 hover:shadow-soft">
                <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${tint}`}>
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <h3 className="mt-4 font-display text-[17px] font-semibold leading-snug">{title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink-muted">{body}</p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
