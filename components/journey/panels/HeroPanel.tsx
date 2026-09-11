import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowDown, CalendarCheck, EyeOff, ShieldCheck } from "lucide-react";
import { JourneyPanel } from "../shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function HeroPanel() {
  return (
    <JourneyPanel id="j-top" width="w-[100vw]">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-24 h-96 w-96 rounded-full bg-sage-200/50 blur-[90px]" />
        <div className="absolute -right-24 top-64 h-[28rem] w-[28rem] rounded-full bg-lav-200/50 blur-[100px]" />
      </div>
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <Badge variant="peach" className="bg-white/80 shadow-sm">
              Davao Oriental State University • Guidance & Counseling Office
            </Badge>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 max-w-xl text-balance font-display text-4xl font-semibold leading-[1.08] xl:text-[3.4rem]"
          >
            Counseling that feels{" "}
            <span className="whitespace-nowrap text-sage-600">safe to start</span>
            , easy to reach.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 max-w-xl text-[16px] leading-relaxed text-ink-muted"
          >
            The Digital Counseling and Appointment System lets DOrSU students
            book sessions in minutes, check in with a PSS-10 stress assessment,
            and talk to a counselor — privately, with analytics that help the
            Guidance Office care earlier.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 flex flex-wrap items-center gap-3"
          >
            <a href="#cta" data-journey-link>
              <Button size="lg">
                <CalendarCheck className="h-5 w-5" aria-hidden />
                Book a Session
              </Button>
            </a>
            <span className="inline-flex items-center gap-2 text-sm font-bold text-ink-muted" aria-hidden>
              Scroll to explore <ArrowDown className="h-4 w-4 animate-bounce" />
            </span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.36 }}
            className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[13px] font-semibold text-ink-soft"
          >
            {[
              { icon: EyeOff, text: "Anonymous by default" },
              { icon: ShieldCheck, text: "RA 10173 compliant" },
              { icon: CalendarCheck, text: "No more walk-in lines" },
            ].map(({ icon: Icon, text }) => (
              <span key={text} className="inline-flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm">
                  <Icon className="h-3.5 w-3.5 text-sage-600" aria-hidden />
                </span>
                {text}
              </span>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto w-full max-w-[480px]"
        >
          <div className="relative overflow-hidden rounded-[2rem] border-4 border-white bg-white shadow-soft">
            <Image
              src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80"
              alt="Two DOrSU students walking together on campus, smiling and talking"
              width={960}
              height={720}
              className="aspect-[4/3] w-full object-cover"
            />
            <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-white/92 p-3 shadow-card backdrop-blur">
              <p className="text-[13px] font-semibold leading-snug text-ink">
                “I booked in 2 minutes — no need to walk in and explain myself
                at the door.”
              </p>
            </div>
          </div>
          <div className="absolute -left-6 top-6 hidden rounded-2xl border border-white/60 bg-white/95 p-3 shadow-card backdrop-blur lg:block">
            <p className="text-[10px] font-bold uppercase tracking-wider text-sage-600">
              PSS-10 check-in
            </p>
            <p className="font-display text-xl font-semibold">Moderate</p>
          </div>
        </motion.div>
      </div>
    </JourneyPanel>
  );
}
