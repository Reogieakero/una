import { JourneyPanel } from "../shell";
import { AnimatedSection, Eyebrow, Stagger, StaggerItem } from "@/components/AnimatedSection";
import { features, type Feature } from "@/lib/content";

function MiniFeature({ f, i }: { f: Feature; i: number }) {
  const Icon = f.icon;
  return (
    <article
      aria-label={`Feature ${i + 1}: ${f.title}`}
      className="flex h-[250px] w-[240px] shrink-0 flex-col rounded-3xl border border-white/60 bg-white/90 p-5 shadow-card"
    >
      <div className="flex items-center justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${f.tint}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <span className="font-display text-xs font-semibold text-ink-faint">
          {String(i + 1).padStart(2, "0")}
        </span>
      </div>
      <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
        {f.tag}
      </p>
      <h3 className="mt-0.5 font-display text-[15px] font-semibold leading-snug">{f.title}</h3>
      <p className="mt-1.5 line-clamp-3 text-[12px] leading-relaxed text-ink-muted">{f.body}</p>
    </article>
  );
}

export function FeaturesPanel() {
  return (
    <JourneyPanel id="j-features" width="w-[115vw]">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,#EFF6F0_50%,transparent_100%)]" />
      <div className="relative">
        <AnimatedSection className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Everything in one safe place</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-semibold xl:text-4xl">
              Key features, <span className="text-sage-600">designed with care.</span>
            </h2>
          </div>
          <p className="max-w-sm text-[14px] text-ink-muted">
            Ten gentle tools that remove friction for students and give
            counselors time back.
          </p>
        </AnimatedSection>
        <Stagger className="mt-6 grid grid-cols-5 gap-4" delay={0.05}>
          {features.map((f, i) => (
            <StaggerItem key={f.title}>
              <MiniFeature f={f} i={i} />
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </JourneyPanel>
  );
}
