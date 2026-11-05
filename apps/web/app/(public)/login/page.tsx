"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { loginSchema, type LoginInput } from "@dorsu/shared-schemas";
import { createClient } from "@/lib/supabase/client";
import { homeForRole } from "@/lib/auth/home";
import { useRouter } from "next/navigation";
import { Button, Checkbox, FieldError, Input } from "@/components/ui/primitives";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthDivider, GoogleButton } from "@/components/auth/GoogleButton";
import { PendingApprovalNotice } from "@/components/auth/PendingApprovalNotice";
import { readRememberPreference, writeRememberPreference } from "@/lib/supabase/remember";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse space-y-3" aria-hidden>
          <div className="h-10 rounded-lg bg-ink/5" />
          <div className="h-10 rounded-lg bg-ink/5" />
          <div className="h-11 rounded-lg bg-ink/10" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function DeactivatedNotice() {
  const params = useSearchParams();
  if (params.get("deactivated") !== "1") return null;
  return (
    <p
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-3 text-[12px] font-semibold leading-snug text-red-800 backdrop-blur-sm"
    >
      Your account has been deactivated. Please visit the Guidance office for help.
    </p>
  );
}

function RejectedNotice() {
  const params = useSearchParams();
  if (params.get("rejected") !== "1") return null;
  return (
    <p
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-3 text-[12px] font-semibold leading-snug text-red-800 backdrop-blur-sm"
    >
      That account request wasn&apos;t approved. Please visit the Guidance office for help.
    </p>
  );
}

function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  // Restore the last choice after hydration; the server cannot read it.
  useEffect(() => {
    setRemember(readRememberPreference());
  }, []);
  // Keeps the button in its loading state after the submit handler resolves,
  // until the destination route has compiled/rendered and this page unmounts.
  const [redirecting, setRedirecting] = useState(false);
  // Pending staff stay on /login and see the waiting card instead of being
  // bounced to a separate screen.
  const [pending, setPending] = useState<{
    role: "faculty" | "counselor";
    fullName: string | null;
  } | null>(null);
  // A native submit before hydration (Enter pressed early, JS still loading)
  // falls back to a GET and would append email/password to the URL. Strip
  // them immediately so credentials never linger in the address bar/history.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("password") && !url.searchParams.has("email")) {
      return;
    }
    url.searchParams.delete("password");
    url.searchParams.delete("email");
    const query = url.searchParams.toString();
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${query ? `?${query}` : ""}${url.hash}`
    );
  }, []);
  const { register, handleSubmit, formState } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });
  const busy = formState.isSubmitting || redirecting;

  if (pending) {
    const firstName = (pending.fullName ?? "").trim().split(/\s+/)[0] || "there";
    const roleLabel = pending.role === "counselor" ? "guidance counselor" : "faculty";
    return (
      <AuthShell
        variant="register"
        title="Waiting for approval"
        subtitle={`Thanks, ${firstName}. Your ${roleLabel} account is with the Guidance office.`}
      >
        <PendingApprovalNotice role={pending.role} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      variant="login"
      title="Welcome back"
      subtitle="Sign in to book a session or message your counselor."
      footer={
        <p className="text-center text-[13px] text-ink-muted">
          New to Chekie?{" "}
          <Link href="/register" className="font-semibold text-blue-600 hover:underline">
            Create an account
          </Link>
        </p>
      }
    >
      <GoogleButton
        mode="signin"
        className="h-10 rounded-lg border border-ink/10 shadow-none hover:border-ink/20 hover:bg-yellow-50"
      />
      <AuthDivider label="or" />

      <form
        className="space-y-4"
        method="post"
        onSubmit={handleSubmit(async (v) => {
          setError(null);
          // Persist the choice before sign-in so the cookie written by the
          // auth call already has the right lifetime.
          writeRememberPreference(remember);
          const supabase = createClient();
          const { data, error: signInError } = await supabase.auth.signInWithPassword(v);
          if (signInError) return setError(signInError.message);
          const { data: profile } = await supabase
            .from("profiles")
            .select("role, full_name, is_active, approval_status, profile_completed")
            .eq("id", data.user.id)
            .single();
          if (!profile) {
            // Signup is deferred: the auth user exists but the role picker was
            // never completed (closed tab, refresh, etc.). Send them back to it
            // instead of stranding a valid login.
            router.prefetch("/register/role");
            setRedirecting(true);
            router.push("/register/role");
            return;
          }
          if (profile.approval_status === "rejected") {
            await supabase.auth.signOut();
            return setError("That account request wasn't approved. Please visit the Guidance office for help.");
          }
          // Pending staff stay here and see the waiting card.
          if (profile.approval_status === "pending") {
            setPending({
              role: profile.role === "counselor" ? "counselor" : "faculty",
              fullName: profile.full_name ?? null,
            });
            return;
          }
          // Approved self-signups finish their real profile first (00076).
          if (
            (profile as { profile_completed?: boolean | null }).profile_completed === false &&
            (profile.role === "faculty" || profile.role === "counselor")
          ) {
            router.prefetch("/complete-profile");
            setRedirecting(true);
            router.push("/complete-profile");
            return;
          }
          if ((profile as { is_active?: boolean | null }).is_active === false) {
            await supabase.auth.signOut();
            return setError("Your account has been deactivated. Please visit the Guidance office for help.");
          }
          const destination = homeForRole(profile.role);
          router.prefetch(destination);
          setRedirecting(true);
          router.push(destination);
        })}
      >
        <div>
          <label htmlFor="email" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
            School email
          </label>
          <div className="relative group">
            <Mail
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint transition-colors group-focus-within:text-yellow-600"
              aria-hidden
            />
            <Input
              id="email"
              placeholder="you@dorsu.edu.ph"
              autoComplete="email"
              className="h-10 rounded-lg border-ink/10 bg-white pl-10 text-sm focus:border-yellow-500 focus:ring-yellow-400/25"
              {...register("email")}
            />
          </div>
          <FieldError message={formState.errors.email?.message} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="password" className="block text-[13px] font-semibold text-ink-soft">
              Password
            </label>
            <Link
              href="/reset-password"
              className="text-[12px] font-semibold text-blue-600 transition hover:text-blue-700 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative group">
            <Lock
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint transition-colors group-focus-within:text-yellow-600"
              aria-hidden
            />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
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

        <Checkbox
          id="remember-me"
          label="Remember me"
          checked={remember}
          onChange={(event) => {
            const next = event.target.checked;
            setRemember(next);
            writeRememberPreference(next);
          }}
        />

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-3 text-[12px] font-semibold leading-snug text-red-800 backdrop-blur-sm"
          >
            {error}
          </p>
        )}
        <DeactivatedNotice />
        <RejectedNotice />

        <Button
          variant="accent"
          className="h-11 w-full rounded-lg bg-yellow-400 text-[15px] font-bold text-ink shadow-[0_14px_30px_-14px_rgba(245,158,11,0.85)] hover:bg-yellow-300 focus-visible:ring-yellow-400"
          size="lg"
          disabled={busy}
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {redirecting ? "Opening your dashboard…" : "Signing in…"}
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
