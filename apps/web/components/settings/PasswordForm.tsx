"use client";

import { Check, Eye, EyeOff, X } from "lucide-react";
import { Button, Input } from "@/components/ui/primitives";

/**
 * Security tab — change-password and change-email forms.
 * Extracted verbatim from app/(staff)/settings/page.tsx (same JSX/classes).
 * All state, validation, and Supabase mutations stay in the page.
 */
export function PasswordForm({
  newPw,
  confirmPw,
  showPw,
  showConfirm,
  pwDone,
  pwRules,
  pwMatch,
  saving,
  email,
  newEmail,
  onNewPw,
  onConfirmPw,
  onShowPw,
  onShowConfirm,
  onPwBlur,
  onNewEmail,
  onChangePassword,
  onChangeEmail,
}: {
  newPw: string;
  confirmPw: string;
  showPw: boolean;
  showConfirm: boolean;
  pwDone: boolean;
  pwRules: { label: string; ok: boolean }[];
  pwMatch: boolean | null;
  saving: string | null;
  email: string;
  newEmail: string;
  onNewPw: (v: string) => void;
  onConfirmPw: (v: string) => void;
  onShowPw: () => void;
  onShowConfirm: () => void;
  onPwBlur: () => void;
  onNewEmail: (v: string) => void;
  onChangePassword: (e: React.FormEvent) => void;
  onChangeEmail: (e: React.FormEvent) => void;
}) {
  return (
    <div className="space-y-4" role="tabpanel">
      <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <h2 className="font-display text-base font-bold text-ink">Change password</h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">Takes effect immediately on next login.</p>
        <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={onChangePassword}>
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-muted" htmlFor="sec-password">New password</label>
            <div className="relative">
              <Input
                id="sec-password"
                type={showPw ? "text" : "password"}
                placeholder="8+ chars, upper, lower & number"
                autoComplete="new-password"
                className="pr-11"
                value={newPw}
                onChange={(e) => onNewPw(e.target.value)}
                onBlur={onPwBlur}
              />
              <button
                type="button"
                onClick={onShowPw}
                aria-label={showPw ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-muted transition hover:bg-cream-dark hover:text-ink"
              >
                {showPw ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              </button>
            </div>
            {pwDone && (
              <ul className="mt-1.5 space-y-1" aria-label="Password requirements">
                {pwRules.map((r) => (
                  <li key={r.label} className={`flex items-center gap-1.5 text-xs font-semibold ${r.ok ? "text-green-700" : "text-ink-faint"}`}>
                    {r.ok ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
                    {r.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-muted" htmlFor="sec-confirm">Confirm new password</label>
            <div className="relative">
              <Input
                id="sec-confirm"
                type={showConfirm ? "text" : "password"}
                placeholder="Repeat the password"
                autoComplete="new-password"
                className="pr-11"
                value={confirmPw}
                onChange={(e) => onConfirmPw(e.target.value)}
              />
              <button
                type="button"
                onClick={onShowConfirm}
                aria-label={showConfirm ? "Hide confirmation" : "Show confirmation"}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-muted transition hover:bg-cream-dark hover:text-ink"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              </button>
            </div>
            {pwMatch !== null && (
              <p className={`mt-1.5 flex items-center gap-1.5 text-xs font-semibold ${pwMatch ? "text-green-700" : "text-red-600"}`}>
                {pwMatch ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
                {pwMatch ? "Passwords match" : "Passwords don't match"}
              </p>
            )}
          </div>
          <div className="flex justify-end md:col-span-2">
            <Button size="sm" disabled={saving === "password"}>
              {saving === "password" ? "Saving…" : "Change password"}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <h2 className="font-display text-base font-bold text-ink">Change email</h2>
        <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">
          Supabase sends a confirmation to <span className="font-bold text-ink">both</span> the old and
          the new address — approve both and the switch completes. Current:{" "}
          <span className="font-bold text-ink">{email || "—"}</span>
        </p>
        <form className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onChangeEmail}>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-bold text-ink-muted" htmlFor="sec-email">New email</label>
            <Input id="sec-email" type="email" value={newEmail} onChange={(e) => onNewEmail(e.target.value)} autoComplete="email" />
          </div>
          <Button size="sm" disabled={saving === "email"} className="shrink-0">
            {saving === "email" ? "Sending…" : "Send confirmation"}
          </Button>
        </form>
      </section>
    </div>
  );
}
