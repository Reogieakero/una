"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarCheck, EyeOff, MessageCircleHeart, ShieldCheck } from "lucide-react";
import { ChekieMark } from "@/components/Logo";
import { cn } from "@/lib/utils";

export type AuthShellVariant = "login" | "register" | "reset" | "update";

const COPY: Record<
  AuthShellVariant,
  { eyebrow: string; headline: ReactNode; description: string }
> = {
  login: {
    eyebrow: "DOrSU Guidance & Counseling • Chekie",
    headline: (
      <>
        Welcome back to a{" "}
        <span className="relative whitespace-nowrap text-yellow-300">
          safe space
          <svg
            aria-hidden
            viewBox="0 0 220 14"
            className="absolute -bottom-1.5 left-0 w-full"
            fill="none"
          >
            <path
              d="M3 10C60 3 160 3 217 9"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
            />
          </svg>
        </span>{" "}
        to talk.
      </>
    ),
    description:
      "Chekie is DOrSU's friendly counseling helper — book a talk in minutes, do a quick stress check-in, and chat privately with a counselor. You stay hidden until you choose to share your name — a real person is always on the other side.",
  },
  register: {
    eyebrow: "Join Chekie • Students",
    headline: (
      <>
        Create your{" "}
        <span className="relative whitespace-nowrap text-yellow-300">
          calm account
          <svg
            aria-hidden
            viewBox="0 0 220 14"
            className="absolute -bottom-1.5 left-0 w-full"
            fill="none"
          >
            <path
              d="M3 10C60 3 160 3 217 9"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
            />
          </svg>
        </span>{" "}
        in under a minute.
      </>
    ),
    description:
      "With one free student account you can book a counseling session, do a quick stress check-in, and message a counselor. Made only for DOrSU students — private and free.",
  },
  reset: {
    eyebrow: "Forgot password",
    headline: (
      <>
        Let&apos;s get you{" "}
        <span className="relative whitespace-nowrap text-yellow-300">
          back inside
          <svg
            aria-hidden
            viewBox="0 0 220 14"
            className="absolute -bottom-1.5 left-0 w-full"
            fill="none"
          >
            <path
              d="M3 10C60 3 160 3 217 9"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
            />
          </svg>
        </span>
        .
      </>
    ),
    description:
      "Type in your DOrSU school email and we'll send you a link to make a new password. The link only works once and expires soon — you can ask for a new one if needed.",
  },
  update: {
    eyebrow: "Almost done",
    headline: (
      <>
        Choose a{" "}
        <span className="relative whitespace-nowrap text-yellow-300">
          new password
          <svg
            aria-hidden
            viewBox="0 0 220 14"
            className="absolute -bottom-1.5 left-0 w-full"
            fill="none"
          >
            <path
              d="M3 10C60 3 160 3 217 9"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
            />
          </svg>
        </span>
        .
      </>
    ),
    description:
      "Pick a new password with at least 8 characters. Don't reuse an old one. After saving, we'll take you straight back to your account.",
  },
};

const HIGHLIGHTS = [
  {
    icon: CalendarCheck,
    title: "Easy booking",
    text: "No long lines. Just pick a time that works for you.",
  },
  {
    icon: EyeOff,
    title: "Stay private if you want",
    text: "You show as Client-XXXX until you decide to share your name.",
  },
  {
    icon: MessageCircleHeart,
    title: "Talk to a real counselor",
    text: "Private messages with friendly Guidance staff.",
  },
  {
    icon: ShieldCheck,
    title: "Safe and private",
    text: "Only your counselor can see what you share.",
  },
];

export function AuthShell({
  variant,
  title,
  subtitle,
  children,
  footer,
}: {
  variant: AuthShellVariant;
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const copy = COPY[variant];
  return (
    <div className="min-h-screen bg-cream">
      {/* soft page backdrop */}
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#EFF6FF_0%,#FDFBF3_55%,#FFF7ED_100%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-stretch gap-8 px-4 py-8 sm:px-6">
        {/* ── Left brand panel ─────────────────────────────── */}
        <aside className="relative hidden w-[54%] shrink-0 overflow-hidden rounded-[2rem] bg-[#0B2A4A] text-white shadow-soft lg:flex lg:flex-col xl:w-[56%]">
          {/* glows + grain */}
          <div aria-hidden className="absolute inset-0">
            <div className="absolute inset-0 bg-[linear-gradient(160deg,#123E6B_0%,#0B2A4A_45%,#071E36_100%)]" />
            <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-blue-500/30 blur-[90px]" />
            <div className="absolute -bottom-24 -right-16 h-96 w-96 rounded-full bg-sky-400/20 blur-[100px]" />
            <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-blue-300/10 blur-[70px]" />
            <div
              className="absolute inset-0 opacity-[0.5]"
              style={{
                backgroundImage: "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            />
          </div>

          <div className="relative flex flex-1 flex-col p-10 xl:p-12">
            {/* brand lockup */}
            <Link href="/" className="flex items-center gap-3" aria-label="Chekie — back to home">
              <ChekieMark size={52} label="Chekie panda mascot" className="ring-white/30" />
              <span className="leading-tight">
                <span className="block font-display text-xl font-semibold tracking-tight">
                  Chekie
                </span>
                <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-blue-200">
                  DOrSU Counseling
                </span>
              </span>
            </Link>

            <p className="mt-8 inline-flex w-fit items-center rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-100 backdrop-blur">
              {copy.eyebrow}
            </p>
            <h1 className="mt-4 max-w-lg font-display text-[2.2rem] font-semibold leading-[1.1] tracking-tight text-white xl:text-[2.75rem]">
              {copy.headline}
            </h1>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-blue-100/90 xl:text-base">
              {copy.description}
            </p>

            <ul className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
              {HIGHLIGHTS.map(({ icon: Icon, title: t, text }) => (
                <li
                  key={t}
                  className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-sm"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                    <Icon className="h-[18px] w-[18px] text-yellow-300" aria-hidden />
                  </span>
                  <p className="mt-3 text-sm font-bold leading-snug">{t}</p>
                  <p className="mt-1 text-[13px] leading-snug text-blue-100/80">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* ── Right form panel ─────────────────────────────── */}
        <main className="flex min-w-0 flex-1 items-center justify-center">
          <div className="w-full max-w-[520px]">
            {/* mobile brand row */}
            <div className="mb-5 flex items-center justify-between lg:hidden">
              <Link href="/" className="flex items-center gap-2" aria-label="Chekie — back to home">
                <ChekieMark size={40} label="Chekie panda mascot" />
                <span className="leading-tight">
                  <span className="block font-display text-[17px] font-semibold">Chekie</span>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
                    DOrSU Counseling
                  </span>
                </span>
              </Link>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3.5 py-2 text-xs font-bold text-ink-soft shadow-sm transition hover:border-primary-300 hover:text-ink"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Home
              </Link>
            </div>

            <div
              className={cn(
                "rounded-[1.75rem] border border-ink/10 bg-white p-6 shadow-card sm:p-8"
              )}
            >
              <div className="hidden items-center justify-between lg:flex">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink-muted transition hover:text-primary-700"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  Back to home
                </Link>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-700 ring-1 ring-blue-100">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                  Safe and private
                </span>
              </div>

              <h2 className="mt-3 font-display text-[1.7rem] font-semibold tracking-tight sm:text-3xl">
                {title}
              </h2>
              <div className="mt-1.5 text-[14px] leading-relaxed text-ink-muted">{subtitle}</div>

              <div className="mt-6">{children}</div>

              {footer && <div className="mt-6">{footer}</div>}

              <p className="mt-6 border-t border-ink/10 pt-4 text-center text-xs leading-relaxed text-ink-faint">
                Your information is kept private and safe. By continuing, you agree to our{" "}
                <Link href="/#safety" className="font-semibold text-primary-600 hover:underline">
                  privacy and safety rules
                </Link>
                .
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
