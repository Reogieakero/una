"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { registerStudentSchema, type RegisterStudentInput } from "@dorsu/shared-schemas";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthDivider, GoogleButton } from "@/components/auth/GoogleButton";
import { STEPS, Stepper } from "@/components/auth/stepper";
import { StepName } from "@/components/auth/steps/step-name";
import { StepSchool } from "@/components/auth/steps/step-school";
import { StepPassword } from "@/components/auth/steps/step-password";

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
          <StepName register={register} error={formState.errors.fullName?.message} onNext={() => void next()} />
        )}

        {/* ── Step 2: university ── */}
        {step === 1 && (
          <StepSchool
            register={register}
            errors={formState.errors}
            yearLevel={yearLevel ?? ""}
            onYearChange={(v) =>
              setValue("yearLevel", v, {
                shouldValidate: true,
                shouldDirty: true,
                shouldTouch: true,
              })
            }
          />
        )}

        {/* ── Step 3: password ── */}
        {step === 2 && (
          <StepPassword
            register={register}
            getValues={getValues}
            passwordError={formState.errors.password?.message}
            confirm={confirm}
            onConfirmChange={setConfirm}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword((v) => !v)}
          />
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
