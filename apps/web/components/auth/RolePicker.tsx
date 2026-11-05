"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Briefcase, HeartHandshake, Loader2 } from "lucide-react";
import { oauthProfileSchema, type OAuthProfileInput } from "@dorsu/shared-schemas";
import { cn } from "@/lib/utils";

const OPTIONS: {
  role: OAuthProfileInput["role"];
  title: string;
  description: string;
  note?: string;
  icon: typeof Briefcase;
}[] = [
  {
    role: "faculty",
    title: "Faculty",
    description:
      "Refer a student to the Guidance office and follow up on your referrals.",
    note: "Faculty accounts need guidance-head approval before you can sign in.",
    icon: Briefcase,
  },
  {
    role: "counselor",
    title: "Guidance Counselor",
    description:
      "Manage appointments, sessions, referrals, and student check-ins in the staff workspace.",
    note: "Counselor accounts need guidance-head approval before you can sign in.",
    icon: HeartHandshake,
  },
];

/**
 * Post-signup role picker for the staff portal (Google or email). The profile
 * is created here (server-side) rather than during signup. Both roles start
 * pending guidance-head approval; students use the mobile app instead.
 */
export function RolePicker() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<OAuthProfileInput["role"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = async (role: OAuthProfileInput["role"]) => {
    if (submitting) return;
    setError(null);
    setSubmitting(role);
    try {
      const parsed = oauthProfileSchema.safeParse({ role });
      if (!parsed.success) throw new Error("Choose a role.");
      const res = await fetch("/api/auth/oauth-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await res.json().catch(() => null)) as
        | { error?: string; redirectTo?: string }
        | null;
      if (body?.redirectTo && (!res.ok || res.status === 409)) {
        router.replace(body.redirectTo);
        return;
      }
      if (!res.ok) throw new Error(body?.error ?? "Couldn't finish setting up your account.");
      router.replace(body?.redirectTo ?? "/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't finish setting up your account.");
      setSubmitting(null);
    }
  };

  return (
    <div className="space-y-3">
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const busy = submitting === option.role;
        return (
          <button
            key={option.role}
            type="button"
            disabled={submitting !== null}
            onClick={() => void choose(option.role)}
            className={cn(
              "group flex w-full items-start gap-3 rounded-2xl border-2 border-ink/10 bg-white px-4 py-3.5 text-left transition",
              "hover:border-yellow-400 hover:bg-yellow-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/50",
              "disabled:pointer-events-none disabled:opacity-60",
              busy && "border-yellow-400 bg-yellow-50/60",
            )}
          >
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Icon className="h-4 w-4" aria-hidden />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="font-display text-[15px] font-bold text-ink">{option.title}</span>
                <ArrowRight
                  aria-hidden
                  className="h-4 w-4 shrink-0 text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-ink"
                />
              </span>
              <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-muted">
                {option.description}
              </span>
              {option.note && (
                <span className="mt-1.5 block text-[11px] font-semibold leading-snug text-yellow-700">
                  {option.note}
                </span>
              )}
            </span>
          </button>
        );
      })}

      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold leading-snug text-red-700"
        >
          {error}
        </p>
      )}

      <p className="pt-1 text-center text-[11px] leading-relaxed text-ink-faint">
        Choose carefully — your role can&apos;t be changed here. Ask the Guidance office
        if you picked the wrong one.
      </p>
    </div>
  );
}
