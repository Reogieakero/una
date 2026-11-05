"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { selfSignupSchema, type SelfSignupInput } from "@dorsu/shared-schemas";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button, FieldError, Input } from "@/components/ui/primitives";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthDivider, GoogleButton } from "@/components/auth/GoogleButton";

/**
 * Generic public signup. Email + password only; the role (Student, Faculty, or
 * Guidance Counselor) is chosen on /register/role right after the account is
 * created. Staff accounts then wait for guidance-head approval and fill in
 * their real details on /complete-profile before entering the workspace.
 */
export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [confirm, setConfirm] = useState("");
  const { register, handleSubmit, formState } = useForm<SelfSignupInput>({
    resolver: zodResolver(selfSignupSchema),
    mode: "onTouched",
  });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    if (confirm !== v.password) {
      setError("Those passwords don't match. Please try again.");
      return;
    }

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
    router.push("/register/role");
  });

  return (
    <AuthShell
      variant="register"
      title="Create your account"
      subtitle={
        <>
          Start with your email, then choose how you&apos;ll use Chekie. Already have
          an account?{" "}
          <Link href="/login" className="font-bold text-primary-600 hover:underline">
            Sign in
          </Link>
          .
        </>
      }
      footer={
        <p className="rounded-2xl bg-blue-50 px-4 py-3 text-center text-[13px] leading-relaxed text-blue-900 ring-1 ring-blue-100">
          Students get the mobile app. Faculty and guidance counselors can self-register
          with Google or email — a guidance head approves the account before first use.
        </p>
      }
    >
      <GoogleButton mode="signup" />
      <AuthDivider label="or sign up with email" />

      <form className="space-y-4" method="post" onSubmit={onSubmit}>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
            Email
          </label>
          <div className="relative group">
            <Mail
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint transition-colors group-focus-within:text-yellow-600"
              aria-hidden
            />
            <Input
              id="email"
              type="email"
              placeholder="you@dorsu.edu.ph"
              autoComplete="email"
              className="h-10 rounded-lg border-ink/10 bg-white pl-10 text-sm focus:border-yellow-500 focus:ring-yellow-400/25"
              {...register("email")}
            />
          </div>
          <FieldError message={formState.errors.email?.message} />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
            Password
          </label>
          <div className="relative group">
            <Lock
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint transition-colors group-focus-within:text-yellow-600"
              aria-hidden
            />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
              className="h-10 rounded-lg border-ink/10 bg-white pl-10 pr-10 text-sm focus:border-yellow-500 focus:ring-yellow-400/25"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-muted transition hover:bg-yellow-50 hover:text-ink group-focus-within:ring-2 group-focus-within:ring-yellow-400/40"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <FieldError message={formState.errors.password?.message} />
        </div>

        <div>
          <label
            htmlFor="confirm-password"
            className="mb-1.5 block text-[13px] font-semibold text-ink-soft"
          >
            Confirm password
          </label>
          <Input
            id="confirm-password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="new-password"
            className="h-10 rounded-lg border-ink/10 bg-white text-sm focus:border-yellow-500 focus:ring-yellow-400/25"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-3 text-[12px] font-semibold leading-snug text-red-800"
          >
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="accent"
          className="h-11 w-full rounded-lg bg-yellow-400 text-[15px] font-bold text-ink shadow-[0_14px_30px_-14px_rgba(245,158,11,0.85)] hover:bg-yellow-300 focus-visible:ring-yellow-400"
          size="lg"
          disabled={formState.isSubmitting}
        >
          {formState.isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Creating account…
            </>
          ) : (
            "Continue"
          )}
        </Button>

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
