"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { resetPasswordSchema, type ResetPasswordInput } from "@dorsu/shared-schemas";
import { createClient } from "@/lib/supabase/client";
import { Button, FieldError, Input } from "@/components/ui/primitives";
import { AuthShell } from "@/components/auth/AuthShell";

export default function ResetPasswordPage() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  });

  return (
    <AuthShell
      variant="reset"
      title="Forgot your password?"
      subtitle="Don't worry! Type your school email below and we'll send you a link to make a new password."
      footer={
        <p className="text-center text-sm text-ink-muted">
          Remembered it?{" "}
          <Link href="/login" className="font-bold text-primary-600 hover:underline">
            Back to log in
          </Link>
        </p>
      }
    >
      {done ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-white">
            <CheckCircle2 className="h-6 w-6" aria-hidden />
          </span>
          <h3 className="mt-3 font-display text-lg font-semibold">Check your email</h3>
          <p className="mt-1 text-sm leading-relaxed text-green-900">
            If you have an account with that email, we sent you a link. Open it soon —
            it only works once and expires quickly.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
          >
            Back to log in
          </Link>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={handleSubmit(async (v) => {
            setError(null);
            // The link lands on /auth/confirm, which swaps the code for a
            // session and forwards to /update-password.
            const { error: resetError } = await createClient().auth.resetPasswordForEmail(v.email, {
              redirectTo: `${window.location.origin}/auth/confirm?next=/update-password`,
            });
            if (resetError) return setError(resetError.message);
            setDone(true);
          })}
        >
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
                className="pl-11"
                {...register("email")}
              />
            </div>
            <FieldError message={formState.errors.email?.message} />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold leading-snug text-red-700"
            >
              {error}
            </p>
          )}

          <Button className="w-full" size="lg" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Sending…
              </>
            ) : (
              "Send me the link"
            )}
          </Button>

          <p className="rounded-2xl bg-cream px-4 py-3 text-center text-[13px] leading-relaxed text-ink-muted">
            Can&apos;t find it? Look in your Spam or Promotions folder after a minute.
          </p>
        </form>
      )}
    </AuthShell>
  );
}
