import Image from "next/image";
import { Check, Smartphone, LayoutDashboard } from "lucide-react";
import { JourneyPanel, JourneyHeading } from "../shell";
import { AnimatedSection, Eyebrow } from "@/components/AnimatedSection";
import { Badge } from "@/components/ui/badge";

const bullets = [
  "One calm place to book, reschedule, or cancel",
  "PSS-10 check-in before every session",
  "Anonymous by default, with real people ready",
];

export function SolutionPanel() {
  return (
    <JourneyPanel id="j-solution" width="w-[105vw]">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/3 top-1/4 h-72 w-72 rounded-full bg-sage-100/70 blur-[80px]" />
      </div>
      <div className="relative mx-auto flex max-w-none items-center gap-[4vw]">
        <AnimatedSection className="w-[34vw] max-w-[460px] shrink-0">
          <JourneyHeading
            eyebrow={<Eyebrow>Our solution</Eyebrow>}
            title={
              <>
                A gentle bridge to the{" "}
                <span className="text-sage-600">Guidance Office.</span>
              </>
            }
            copy="A friendly mobile app for students, plus a powerful web dashboard for counselors and the Guidance Head."
          />
          <ul className="mt-5 space-y-2.5">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-[14px] font-medium text-ink-soft">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sage-600 text-white">
                  <Check className="h-3 w-3" aria-hidden />
                </span>
                {b}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge>
              <Smartphone className="h-3.5 w-3.5" aria-hidden /> Student app
            </Badge>
            <Badge variant="lavender">
              <LayoutDashboard className="h-3.5 w-3.5" aria-hidden /> Counselor dashboard
            </Badge>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.1} className="w-[42vw] max-w-[560px] shrink-0">
          <div className="overflow-hidden rounded-[2rem] border-4 border-white bg-white shadow-soft">
            <Image
              src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80"
              alt="DOrSU students studying together outdoors on campus, supporting one another"
              width={1000}
              height={560}
              loading="lazy"
              className="aspect-[16/8] w-full object-cover"
            />
            <div className="p-4">
              <div className="flex items-center justify-between">
                <p className="font-display text-[15px] font-semibold">Book a session</p>
                <span className="rounded-full bg-sage-100 px-3 py-1 text-[11px] font-bold text-sage-700">
                  3 slots open this week
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[13px]">
                {[
                  { d: "Thu", t: "2:00 PM", active: true },
                  { d: "Fri", t: "10:30 AM", active: false },
                  { d: "Mon", t: "9:00 AM", active: false },
                ].map((s) => (
                  <div
                    key={s.d + s.t}
                    className={`rounded-2xl border px-2 py-2 font-semibold ${
                      s.active
                        ? "border-sage-600 bg-sage-600 text-white shadow-soft"
                        : "border-sage-200 bg-cream text-ink-soft"
                    }`}
                  >
                    <span className="block text-[10px] font-bold uppercase tracking-wide opacity-80">{s.d}</span>
                    {s.t}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </JourneyPanel>
  );
}
