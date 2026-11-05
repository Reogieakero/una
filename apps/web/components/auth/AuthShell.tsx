"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ChekieMark } from "@/components/Logo";

export type AuthShellVariant = "login" | "register" | "reset" | "update";

const COPY: Record<
  AuthShellVariant,
  {
    eyebrow: string;
    headline: ReactNode;
    description: string;
    primary: { label: string; href: string };
  }
> = {
  login: {
    eyebrow: "DOrSU Guidance & Counseling",
    headline: (
      <>
        A quieter place to{" "}
        <span className="font-serif font-normal italic text-yellow-300">be heard.</span>
      </>
    ),
    description:
      "Book a session, check in on your week, or message your counselor. Free for DOrSU students.",
    primary: { label: "Create account", href: "/register" },
  },
  register: {
    eyebrow: "DOrSU Guidance & Counseling",
    headline: (
      <>
        Start with a{" "}
        <span className="font-serif font-normal italic text-yellow-300">single step.</span>
      </>
    ),
    description:
      "One student account for counseling bookings, check-ins, and messages with the Guidance office.",
    primary: { label: "Sign in", href: "/login" },
  },
  reset: {
    eyebrow: "Account recovery",
    headline: (
      <>
        Back to{" "}
        <span className="font-serif font-normal italic text-yellow-300">your account.</span>
      </>
    ),
    description:
      "Enter your DOrSU school email and we'll send you a link to set a new password.",
    primary: { label: "Back to sign in", href: "/login" },
  },
  update: {
    eyebrow: "Account recovery",
    headline: (
      <>
        Choose a{" "}
        <span className="font-serif font-normal italic text-yellow-300">new password.</span>
      </>
    ),
    description:
      "Use at least 8 characters and avoid reusing an old password. You'll be signed straight back in.",
    primary: { label: "Back to sign in", href: "/login" },
  },
};

function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(110%_80%_at_80%_10%,rgba(37,99,235,0.18),transparent_55%)]" />
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse 80% 70% at 50% 35%, black 20%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 70% at 50% 35%, black 20%, transparent 75%)",
        }}
      />
      <div className="absolute -top-56 right-[-10%] h-[640px] w-[640px] rounded-full bg-blue-500/15 blur-[160px]" />
      <div className="absolute bottom-[-30%] left-[-15%] h-[520px] w-[520px] rounded-full bg-yellow-400/[0.07] blur-[160px]" />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        fill="none"
      >
        <defs>
          <linearGradient id="auth-beam" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FBBF24" stopOpacity="0" />
            <stop offset="35%" stopColor="#FBBF24" stopOpacity="0.22" />
            <stop offset="70%" stopColor="#60A5FA" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#60A5FA" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M-110 800 C 320 690, 660 500, 1560 180"
          stroke="url(#auth-beam)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}

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
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#050C16] text-white">
      <Backdrop />

      {/* ── Top bar ───────────────────────────────────────────── */}
      <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="flex items-center gap-3" aria-label="Chekie — back to home">
          <ChekieMark size={36} label="Chekie panda mascot" className="ring-white/20" />
          <span className="leading-tight">
            <span className="block font-display text-[17px] font-semibold tracking-tight text-white">
              Chekie
            </span>
            <span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-blue-200/50">
              DOrSU Counseling
            </span>
          </span>
        </Link>

        <Link
          href={copy.primary.href}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/85 transition hover:text-white"
        >
          {copy.primary.label}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </header>

      {/* ── Hero + auth card ──────────────────────────────────── */}
      <main className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-6 py-6 lg:grid-cols-[1fr_420px] lg:gap-16 lg:py-4">
        <section className="order-2 max-w-xl lg:order-1">
          <p className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-100/45">
            <span className="h-px w-6 bg-yellow-400/70" aria-hidden />
            {copy.eyebrow}
          </p>

          <h1 className="mt-6 font-display text-[2.75rem] font-semibold leading-[1.04] tracking-[-0.035em] text-white sm:text-[3.5rem] xl:text-[4rem]">
            {copy.headline}
          </h1>

          <p className="mt-5 max-w-md text-[15px] leading-7 text-blue-100/60">
            {copy.description}
          </p>
        </section>

        <section className="order-1 w-full justify-self-start lg:order-2 lg:justify-self-end">
          {/* The card is a fixed light island: `data-auth-card` opts its
              contents out of the global dark-mode token remaps in globals.css. */}
          <div
            data-auth-card
            className="rounded-[1.5rem] border border-white/10 bg-[#F6F9FF] px-6 py-6 text-ink shadow-[0_28px_80px_-24px_rgba(0,0,0,0.85)] sm:px-8 sm:py-7"
          >
            <h2 className="font-display text-[1.55rem] font-semibold tracking-tight text-ink">
              {title}
            </h2>
            <div className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
              {subtitle}
            </div>

            <div className="mt-5">{children}</div>

            {footer && <div className="mt-5">{footer}</div>}
          </div>
        </section>
      </main>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="relative z-10 mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] px-6 py-3 text-[10px] font-medium uppercase tracking-[0.14em] text-blue-100/30">
        <span>© {new Date().getFullYear()} Chekie · DOrSU Guidance</span>
        <span className="flex items-center gap-4">
          <Link href="/#safety" className="transition hover:text-blue-100/60">
            Privacy
          </Link>
          <Link href="/" className="transition hover:text-blue-100/60">
            Home
          </Link>
        </span>
      </footer>
    </div>
  );
}
