import { ArrowRight, MapPin } from "lucide-react";
import { JourneyPanel } from "../shell";
import { AnimatedSection } from "@/components/AnimatedSection";
import { Button } from "@/components/ui/button";
import { ChekieMark } from "@/components/Logo";

const stack = ["Next.js", "Tailwind CSS", "shadcn/ui", "Supabase", "Vercel"];

export function CtaPanel() {
  return (
    <JourneyPanel id="j-cta" width="w-[100vw]">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-10 h-80 w-80 -translate-x-1/2 rounded-full bg-peach-200/40 blur-[90px]" />
      </div>
      <div className="relative mx-auto max-w-3xl text-center">
        <AnimatedSection>
            <ChekieMark
              size={56}
              label="Chekie, the panda mascot"
              className="mx-auto"
            />
          <h2 className="mx-auto mt-4 max-w-2xl text-balance font-display text-3xl font-semibold xl:text-[2.6rem]">
            You deserve support that meets you{" "}
            <span className="text-sage-600">where you are.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-ink-muted">
            Book privately, check in with PSS-10, and take the first gentle
            step today. Free for all DOrSU students • Anonymous by default.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a href="#top" data-journey-link>
              <Button size="lg">
                Book a Session <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </a>
            <a href="#features" data-journey-link>
              <Button variant="secondary" size="lg">
                Revisit features
              </Button>
            </a>
          </div>
        </AnimatedSection>
        <AnimatedSection delay={0.1} className="mt-6">
          <ul className="flex flex-wrap items-center justify-center gap-2" aria-label="Technologies used">
            {stack.map((t) => (
              <li
                key={t}
                className="rounded-full border border-sage-200 bg-white/80 px-3.5 py-1 text-[13px] font-bold text-ink-soft"
              >
                {t}
              </li>
            ))}
          </ul>
          <div className="mx-auto mt-5 flex max-w-2xl flex-col items-center justify-between gap-2 border-t border-sage-200/70 pt-4 text-[12px] text-ink-muted sm:flex-row">
            <p className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              DOrSU Guidance and Counseling Office • Mati City
            </p>
            <p>© 2026 DOrSU • Capstone demo • RA 10173 aware</p>
          </div>
        </AnimatedSection>
      </div>
    </JourneyPanel>
  );
}
