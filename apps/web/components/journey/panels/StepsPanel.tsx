import { JourneyPanel } from "../shell";
import { AnimatedSection, Eyebrow, Stagger, StaggerItem } from "@/components/AnimatedSection";
import { steps, type Step } from "@/lib/content";

function MiniStep({ s, i }: { s: Step; i: number }) {
  const Icon = s.icon;
  return (
    <article className="relative flex h-[320px] w-[250px] shrink-0 flex-col rounded-[1.75rem] border border-white/60 bg-white/92 p-5 pt-8 shadow-card">
      <span
        aria-hidden
        className="absolute -top-4 left-6 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 font-display text-[15px] font-bold text-white shadow-soft"
      >
        {i + 1}
      </span>
      <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-white ${s.tint}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">{s.step}</p>
      <h3 className="mt-0.5 font-display text-[17px] font-semibold leading-snug">{s.title}</h3>
      <p className="mt-1.5 line-clamp-3 text-[12.5px] leading-relaxed text-ink-muted">{s.body}</p>
      <p className="mt-auto rounded-xl bg-cream-dark px-3 py-2 text-[11.5px] font-bold text-ink-soft">
        {s.meta}
      </p>
    </article>
  );
}

export function StepsPanel() {
  return (
    <JourneyPanel id="j-steps" width="w-[110vw]">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent,#EFEAF8_50%,transparent)] opacity-70" />
      <div className="relative">
        <AnimatedSection className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>A calmer path to help</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-semibold xl:text-4xl">
              How it works <span className="text-blue-600">for a student.</span>
            </h2>
          </div>
          <p className="max-w-sm text-[14px] text-ink-muted">
            Five small steps — each one lowers the courage it takes to ask for support.
          </p>
        </AnimatedSection>
        <div className="mt-8">
          <Stagger className="relative flex gap-5 pt-2" delay={0.05}>
            {steps.map((s, i) => (
              <StaggerItem key={s.title}>
                <MiniStep s={s} i={i} />
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>
    </JourneyPanel>
  );
}
