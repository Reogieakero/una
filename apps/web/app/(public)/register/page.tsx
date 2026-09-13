"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  BookOpen,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  GraduationCap,
  Hash,
  Loader2,
  Lock,
  Mail,
  UserRound,
} from "lucide-react";
import { registerStudentSchema, type RegisterStudentInput } from "@dorsu/shared-schemas";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button, FieldError, Input } from "@/components/ui/primitives";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthDivider, GoogleButton } from "@/components/auth/GoogleButton";
import { cn } from "@/lib/utils";

const STEPS = [
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

function Stepper({ step }: { step: number }) {
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

const YEAR_OPTIONS = [
  { value: "1", label: "1st Year" },
  { value: "2", label: "2nd Year" },
  { value: "3", label: "3rd Year" },
  { value: "4", label: "4th Year" },
] as const;

/** Custom shadcn-style dropdown (designed panel — not the native OS menu). */
function YearLevelSelect({
  value,
  onChange,
  hasError,
}: {
  value: string;
  onChange: (v: string) => void;
  hasError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = YEAR_OPTIONS.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  return (
    <div ref={ref} className="relative">
      <GraduationCap
        className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-ink-faint"
        aria-hidden
      />
      <button
        type="button"
        id="yearLevel"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full rounded-2xl border bg-white py-2.5 pl-11 pr-10 text-left text-sm transition",
          "focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200",
          hasError ? "border-red-300" : "border-ink/15",
          selected ? "font-semibold text-ink" : "text-ink-faint"
        )}
      >
        {selected ? selected.label : "Choose your year"}
      </button>
      <ChevronDown
        aria-hidden
        className={cn(
          "pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted transition-transform",
          open && "rotate-180"
        )}
      />
      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-ink/10 bg-white p-1.5 shadow-card">
          <ul role="listbox" aria-labelledby="yearLevel" className="space-y-0.5">
            {YEAR_OPTIONS.map((o) => {
              const active = o.value === value;
              return (
                <li key={o.value} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition",
                      active
                        ? "bg-primary-600 text-white shadow-soft"
                        : "text-ink hover:bg-cream"
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                          active ? "bg-white/20 text-white" : "bg-blue-50 text-primary-700"
                        )}
                      >
                        {o.value}
                      </span>
                      {o.label}
                    </span>
                    {active && <Check className="h-4 w-4" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Student self-registration (3-step). Staff accounts are provisioned by guidance
 * head/admin — never via an open role picker. Profiles/role rows are written
 * server-side because RLS allows no direct client insert into `profiles`.
 */
export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [confirm, setConfirm] = useState("");
  const { register, handleSubmit, trigger, formState, getValues, setValue, watch } =
    useForm<RegisterStudentInput>({
      resolver: zodResolver(registerStudentSchema),
      mode: "onTouched",
    });
  const yearLevel = watch("yearLevel");

  const next = async () => {
    setError(null);
    const fields = [...STEPS[step].fields];
    // Local confirm-password check lives on the last step.
    if (step === STEPS.length - 1 && confirm !== getValues("password")) {
      setError("Those passwords don't match. Please try again.");
      return;
    }
    const ok = await trigger(fields as never, { shouldFocus: true });
    if (ok) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const onSubmit = handleSubmit(async (v) => {
    if (confirm !== v.password) return setError("Those passwords don't match. Please try again.");
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    });
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) return setError(body?.error ?? "Registration failed. Please try again.");
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: v.email,
      password: v.password,
    });
    if (signInError) {
      router.push("/login");
      return;
    }
    router.push("/");
  });

  return (
    <AuthShell
      variant="register"
      title="Create your student account"
      subtitle={
        <>
          Book a counseling session and do a quick stress check-in. Already have an
          account?{" "}
          <Link href="/login" className="font-bold text-primary-600 hover:underline">
            Log in
          </Link>
          .
        </>
      }
      footer={
        <p className="rounded-2xl bg-blue-50 px-4 py-3 text-center text-[13px] leading-relaxed text-blue-900 ring-1 ring-blue-100">
          Teachers and staff can&apos;t sign up here — please ask the Guidance office for
          your account. This page is for students only.
        </p>
      }
    >
      <GoogleButton mode="signup" />
      <AuthDivider label="or sign up with email" />

      <Stepper step={step} />

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        {/* ── Step 1: name ── */}
        {step === 0 && (
          <div>
            <label htmlFor="fullName" className="mb-1.5 block text-[13px] font-bold text-ink-soft">
              Full name
            </label>
            <div className="relative">
              <UserRound
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
                aria-hidden
              />
              <Input
                id="fullName"
                placeholder="Juan A. Dela Cruz"
                autoComplete="name"
                autoFocus
                className="pl-11"
                {...register("fullName")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    next();
                  }
                }}
              />
            </div>
            <FieldError message={formState.errors.fullName?.message} />
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              Please write your real full name. Your counselor will see it when you book,
              but in chats you can still stay hidden as Client-XXXX.
            </p>
          </div>
        )}

        {/* ── Step 2: university ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-[13px] font-bold text-ink-soft">
                School email
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
                  aria-hidden
                />
                <Input
                  id="email"
                  placeholder="you@dorsu.edu.ph"
                  autoComplete="email"
                  autoFocus
                  className="pl-11"
                  {...register("email")}
                />
              </div>
              <FieldError message={formState.errors.email?.message} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="studentNo" className="mb-1.5 block text-[13px] font-bold text-ink-soft">
                  Student ID number
                </label>
                <div className="relative">
                  <Hash
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
                    aria-hidden
                  />
                  <Input id="studentNo" placeholder="Ex: 2021-00001" className="pl-11" {...register("studentNo")} />
                </div>
                <FieldError message={formState.errors.studentNo?.message} />
              </div>
              <div>
                <span id="yearLevel-label" className="mb-1.5 block text-[13px] font-bold text-ink-soft">
                  What year are you in?
                </span>
                <YearLevelSelect
                  value={yearLevel ?? ""}
                  hasError={!!formState.errors.yearLevel}
                  onChange={(v) =>
                    setValue("yearLevel", v, {
                      shouldValidate: true,
                      shouldDirty: true,
                      shouldTouch: true,
                    })
                  }
                />
                <FieldError message={formState.errors.yearLevel?.message} />
              </div>
            </div>
            <div>
              <label htmlFor="program" className="mb-1.5 block text-[13px] font-bold text-ink-soft">
                Your course
              </label>
              <div className="relative">
                <BookOpen
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
                  aria-hidden
                />
                <Input
                  id="program"
                  placeholder="Ex: BS Psychology"
                  className="pl-11"
                  {...register("program")}
                />
              </div>
              <FieldError message={formState.errors.program?.message} />
            </div>
          </div>
        )}

        {/* ── Step 3: password ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-cream px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
              You&apos;re almost done,{" "}
              <span className="font-bold text-ink">{getValues("fullName") || "friend"}</span>
              {getValues("email") ? (
                <>
                  {" "}• <span className="font-semibold">{getValues("email")}</span>
                </>
              ) : null}
              ! Last step: make a password you&apos;ll remember.
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-[13px] font-bold text-ink-soft">
                Make a password
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
                  aria-hidden
                />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Choose at least 8 characters"
                  autoComplete="new-password"
                  autoFocus
                  className="pl-11 pr-11"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-muted transition hover:bg-cream-dark hover:text-ink"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <FieldError message={formState.errors.password?.message} />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="mb-1.5 block text-[13px] font-bold text-ink-soft">
                Type the password again
              </label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Repeat your password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              {confirm && confirm !== getValues("password") && (
                <p className="mt-1 text-xs font-semibold text-red-600">Those passwords don&apos;t match. Please try again.</p>
              )}
            </div>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold leading-snug text-red-700"
          >
            {error}
          </p>
        )}

        {/* nav buttons */}
        <div className="flex items-center gap-3 pt-1">
          {step > 0 && (
            <Button type="button" variant="outline" size="lg" onClick={back} className="shrink-0">
              Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" size="lg" onClick={next} className="w-full">
              Continue
            </Button>
          ) : (
            <Button type="submit" size="lg" disabled={formState.isSubmitting} className="w-full">
              {formState.isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Creating account…
                </>
              ) : (
                "Create account"
              )}
            </Button>
          )}
        </div>

        <p className="text-center text-sm text-ink-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-primary-600 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
