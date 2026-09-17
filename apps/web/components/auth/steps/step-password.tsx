import { Eye, EyeOff, Lock } from "lucide-react";
import type { UseFormGetValues, UseFormRegister } from "react-hook-form";
import type { RegisterStudentInput } from "@dorsu/shared-schemas";
import { FieldError, Input } from "@/components/ui/primitives";

/** Step 3 — password + local confirm check (schema validates password). */
export function StepPassword({
  register,
  getValues,
  passwordError,
  confirm,
  onConfirmChange,
  showPassword,
  onTogglePassword,
}: {
  register: UseFormRegister<RegisterStudentInput>;
  getValues: UseFormGetValues<RegisterStudentInput>;
  passwordError?: string;
  confirm: string;
  onConfirmChange: (v: string) => void;
  showPassword: boolean;
  onTogglePassword: () => void;
}) {
  return (
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
            onClick={onTogglePassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-muted transition hover:bg-cream-dark hover:text-ink"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <FieldError message={passwordError} />
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
          onChange={(e) => onConfirmChange(e.target.value)}
        />
        {confirm && confirm !== getValues("password") && (
          <p className="mt-1 text-xs font-semibold text-red-600">Those passwords don&apos;t match. Please try again.</p>
        )}
      </div>
    </div>
  );
}
