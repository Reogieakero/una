import { Check, GraduationCap, Lock, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

export const STEPS = [
  { id: 0, title: "Your name", desc: "What should we call you?", icon: UserRound, fields: ["fullName"] as const },
  {
    id: 1,
    title: "School info",
    desc: "Your student details",
    icon: GraduationCap,
    fields: ["email", "studentNo", "yearLevel", "program"] as const,
  },
  { id: 2, title: "Password", desc: "Keep it secret", icon: Lock, fields: ["password"] as const },
] as const;

/** 3-step registration progress header. */
export function Stepper({ step }: { step: number }) {
  const progress = step === 0 ? "0%" : step === 1 ? "50%" : "100%";
  return (
    <div className="relative">
      {/* track + progress — pinned to icon center (h-9 = 36px → center 18px) */}
      <div
        aria-hidden
        className="absolute left-[16.6%] right-[16.6%] top-[18px] h-0.5 rounded-full bg-ink/10"
      />
      <div
        aria-hidden
        className="absolute left-[16.6%] top-[18px] h-0.5 rounded-full bg-primary-600 transition-all"
        style={{ width: `calc(${progress} * 0.668)` }}
      />
      <ol className="relative grid grid-cols-3" aria-label="Registration steps">
        {STEPS.map((s, i) => {
          const done = i < step;
          const current = i === step;
          const Icon = done ? Check : s.icon;
          return (
            <li
              key={s.id}
              aria-current={current ? "step" : undefined}
              className="flex min-w-0 flex-col items-center px-1 text-center"
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border-2 bg-white transition-all",
                  done && "border-primary-600 bg-primary-600 text-white",
                  current &&
                    "border-primary-600 text-primary-700 shadow-soft ring-4 ring-primary-100",
                  !done && !current && "border-ink/15 text-ink-faint"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="mt-2 leading-tight">
                <span
                  className={cn(
                    "block text-[13px] font-bold",
                    current || done ? "text-ink" : "text-ink-faint"
                  )}
                >
                  {i + 1}. {s.title}
                </span>
                <span className="mt-0.5 block text-[11px] font-medium text-ink-muted">
                  {s.desc}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
