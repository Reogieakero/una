"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { loginSchema, type LoginInput } from "@dorsu/shared-schemas";
import { createClient } from "@/lib/supabase/client";
import { homeForRole } from "@/lib/auth/home";
import { useRouter } from "next/navigation";
import { Button, FieldError, Input } from "@/components/ui/primitives";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthDivider, GoogleButton } from "@/components/auth/GoogleButton";

/** Staff/student login — schema from shared-schemas, session via Supabase Auth. */
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

/** Shown after an admin deactivates the account mid-session (see guard.ts). */
function DeactivatedNotice() {
  const params = useSearchParams();
  if (params.get("deactivated") !== "1") return null;
  return (
    <p
      role="alert"
      className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold leading-snug text-red-700"
    >
      Your account has been deactivated. Please visit the Guidance office for help.
    </p>
  );
}

function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  return (
    <AuthShell
      variant="login"
      title="Welcome back"
      subtitle={
        <>
          Log in to book sessions, check how you&apos;re feeling, and message your counselor.{" "}
          <span className="font-semibold text-ink">New student?</span>{" "}
          <Link href="/register" className="font-bold text-primary-600 hover:underline">
            Create an account
          </Link>
          .
        </>
      }
      footer={
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-cream px-4 py-3 text-[13px]">
          <Link
            href="/reset-password"
            className="font-bold text-primary-700 hover:underline"
          >
            Forgot password?
          </Link>
          <span className="h-4 w-px bg-ink/15" aria-hidden />
          <Link href="/register" className="font-bold text-primary-700 hover:underline">
            New here? Sign up
          </Link>
        </div>
      }
    >
      <GoogleButton mode="signin" />
      <AuthDivider label="or log in with email" />

      <form
        className="space-y-4"
        onSubmit={handleSubmit(async (v) => {
          setError(null);
          const supabase = createClient();
          const { data, error: signInError } = await supabase.auth.signInWithPassword(v);
          if (signInError) return setError(signInError.message);
          const { data: profile } = await supabase
            .from("profiles")
            .select("role, is_active")
            .eq("id", data.user.id)
            .single();
          if (!profile) {
            await supabase.auth.signOut();
            return setError("We found your login but no student record. Please visit the Guidance office so we can help.");
          }
          if ((profile as { is_active?: boolean | null }).is_active === false) {
            await supabase.auth.signOut();
            return setError("Your account has been deactivated. Please visit the Guidance office for help.");
          }
          router.push(homeForRole(profile.role));
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

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="block text-[13px] font-bold text-ink-soft">
              Password
            </label>
            <Link
              href="/reset-password"
              className="text-xs font-bold text-primary-600 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
              aria-hidden
            />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              autoComplete="current-password"
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

        {error && (
          <p
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold leading-snug text-red-700"
          >
            {error}
          </p>
        )}
        <DeactivatedNotice />

        <Button className="w-full" size="lg" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Logging in…
            </>
          ) : (
            "Log in"
          )}
        </Button>

        <p className="text-center text-xs leading-relaxed text-ink-muted">
          Are you a teacher or staff? Please ask the Guidance office for your account. This
          sign-up is for students.
        </p>
      </form>
    </AuthShell>
  );
}
