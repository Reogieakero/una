import { JourneyPanel, JourneyHeading } from "../shell";
import { AnimatedSection, Eyebrow, Stagger, StaggerItem } from "@/components/AnimatedSection";
import { safetyItems } from "@/lib/content";

export function SafetyPanel() {
  return (
    <JourneyPanel id="j-safety" width="w-[100vw]">
      <div className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-[2.5rem] border border-white/60 bg-gradient-to-br from-sage-50 via-white to-lav-50 p-8 shadow-soft">
          <AnimatedSection className="max-w-2xl">
            <JourneyHeading
              eyebrow={<Eyebrow>Safety & privacy</Eyebrow>}
              title={
                <>
                  Your story stays yours.{" "}
                  <span className="text-sage-600">Built that way.</span>
                </>
              }
              copy="Anonymity is the starting point — and when safety truly requires an exception, the process is strict, transparent, and reviewable."
            />
          </AnimatedSection>
          <Stagger className="mt-6 grid grid-cols-2 gap-4" delay={0.08}>
            {safetyItems.map(({ icon: Icon, tint, title, body }) => (
              <StaggerItem key={title} className="h-full">
                <article className="flex h-full gap-3.5 rounded-3xl border border-white bg-white/90 p-5 shadow-card">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white ${tint}`}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block font-display text-[15px] font-semibold">{title}</span>
                    <span className="mt-1 block text-[13px] leading-relaxed text-ink-muted">{body}</span>
                  </span>
                </article>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>
    </JourneyPanel>
  );
}
