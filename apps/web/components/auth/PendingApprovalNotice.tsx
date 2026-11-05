import { Clock } from "lucide-react";

/**
 * Shared waiting-for-approval card. Shown inline on /login after a pending
 * password sign-in and on /pending-approval for Google sign-ins. No actions:
 * the account becomes usable on the next navigation once the head approves it.
 */
export function PendingApprovalNotice({ role }: { role: "faculty" | "counselor" }) {
  const isCounselor = role === "counselor";
  return (
    <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-yellow-100 text-yellow-700">
          <Clock className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-ink">The guidance head needs to approve you.</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
            {isCounselor
              ? "You'll get the counseling workspace — appointments, sessions, referrals, and student check-ins — as soon as your account is approved."
              : "You'll get the full faculty workspace — referrals, students, and reports — as soon as your account is approved."}{" "}
            You&apos;ll add your real name and staff details on the next screen. No need to
            create another account.
          </p>
        </div>
      </div>
    </div>
  );
}
