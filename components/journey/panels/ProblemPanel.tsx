import { Clock3, DoorOpen, LineChart, Megaphone } from "lucide-react";
import { JourneyPanel, JourneyHeading } from "../shell";
import { AnimatedSection, Eyebrow, Stagger, StaggerItem } from "@/components/AnimatedSection";

const pains = [
  {
    icon: Clock3,
    tint: "bg-peach-50 text-peach-600",
    title: "Long waits, manual booking",
    body: "Appointments run through Facebook messages, QR codes, and walk-ins — easy to miss, hard to reschedule.",
  },
  {
    icon: DoorOpen,
    tint: "bg-lav-100 text-lav-500",
    title: "Stigma at the office door",
    body: "Many students hesitate to walk in and be seen. Small worries grow into crises.",
  },
  {
    icon: Megaphone,
    tint: "bg-skysoft-100 text-skysoft-400",
    title: "Low awareness of support",
    body: "Wellness events get buried in feeds. Students don't know how to ask for help.",
  },
  {
    icon: LineChart,
    tint: "bg-sage-100 text-sage-600",
    title: "No data, no early action",
    body: "Paper logs and scattered chats can't reveal stress trends or peak periods.",
  },
];

export function ProblemPanel() {
  return (
    <JourneyPanel id="j-problem" width="w-[128vw]">
      <div className="mx-auto flex max-w-none items-center gap-[4vw]">
        <AnimatedSection className="w-[30vw] max-w-[420px] shrink-0">
          <JourneyHeading
            eyebrow={<Eyebrow>Why this matters</Eyebrow>}
            title={
              <>
                Reaching help shouldn&apos;t be{" "}
                <span className="text-sage-600">hard too.</span>
              </>
            }
            copy="Stress, anxiety, and academic pressure are rising at DOrSU — but counseling still depends on who you message or whether you're brave enough to walk in."
          />
        </AnimatedSection>
        <Stagger className="grid flex-1 grid-cols-4 gap-4" delay={0.1}>
          {pains.map(({ icon: Icon, tint, title, body }) => (
            <StaggerItem key={title} className="h-full">
              <article className="flex h-[300px] flex-col rounded-3xl border border-white/60 bg-white/85 p-5 shadow-card backdrop-blur">
                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${tint}`}>
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-3 font-display text-[16px] font-semibold leading-snug">{title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{body}</p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </JourneyPanel>
  );
}
