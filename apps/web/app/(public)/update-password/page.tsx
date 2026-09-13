"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Eye, EyeOff, Loader2 } from "lucide-react";
import { updatePasswordSchema, type UpdatePasswordInput } from "@dorsu/shared-schemas";
import { createClient } from "@/lib/supabase/client";
import { homeForRole } from "@/lib/auth/home";
import { useRouter } from "next/navigation";
import { Button, FieldError, Input } from "@/components/ui/primitives";
import { AuthShell } from "@/components/auth/AuthShell";

/** Set a new password after a recovery link (session comes from /auth/confirm). */
export default function UpdatePasswordPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState(false);
  const [sessionState, setSessionState] = useState<"checking" | "ok" | "missing">("checking");
  const { register, handleSubmit, formState } = useForm<UpdatePasswordInput>({
    resolver: zodResolver(updatePasswordSchema),
  });

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setSessionState(data.user ? "ok" : "missing"));
  }, []);

  if (sessionState === "checking") {
    return (
      <AuthShell
        variant="update"
        title="Checking your link…"
        subtitle="Hold on while we check your password reset link."
      >
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-cream px-4 py-6 text-sm font-semibold text-ink-muted">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Checking your link…
        </div>
      </AuthShell>
    );
  }

  if (sessionState === "missing") {
    return (
      <AuthShell
        variant="update"
        title="This link doesn't work anymore"
        subtitle="Password links only work once and expire fast. Let's send you a new one."
      >
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-white">
            <AlertTriangle className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-3 text-sm font-medium leading-relaxed text-amber-900">
            This link was already used or is too old.
          </p>
          <Button className="mt-4 w-full" size="lg" onClick={() => router.push("/reset-password")}>
            Send me a new link
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      variant="update"
      title="Make a new password"
      subtitle="Pick a new password with at least 8 letters or numbers. After saving, we'll log you back in."
    >
      <form
        className="space-y-4"
        onSubmit={handleSubmit(async (v) => {
          setError(null);
          const supabase = createClient();
          const { error: updateError } = await supabase.auth.updateUser({ password: v.password });
          if (updateError) return setError(updateError.message);
          const {
            data: { user },
          } = await supabase.auth.getUser();
          const { data: profile } = user
            ? await supabase.from("profiles").select("role").eq("id", user.id).single()
            : { data: null };
          router.push(homeForRole(profile?.role));
        })}
      >
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="block text-[13px] font-bold text-ink-soft">
              New password
            </label>
            <button
              type="button"
              onClick={() => setShowPasswords((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-bold text-primary-600 hover:underline"
            >
              {showPasswords ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showPasswords ? "Hide" : "Show"}
            </button>
          </div>
          <Input
            id="password"
            type={showPasswords ? "text" : "password"}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            {...register("password")}
          />
          <FieldError message={formState.errors.password?.message} />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="mb-1.5 block text-[13px] font-bold text-ink-soft">
            Type the new password again
          </label>
          <Input
            id="confirmPassword"
            type={showPasswords ? "text" : "password"}
            placeholder="Repeat your new password"
            autoComplete="new-password"
            {...register("confirmPassword")}
          />
          <FieldError message={formState.errors.confirmPassword?.message} />
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
              Updating…
            </>
          ) : (
            "Update password"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
