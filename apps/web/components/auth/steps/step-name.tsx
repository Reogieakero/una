import { UserRound } from "lucide-react";
import type { UseFormRegister } from "react-hook-form";
import type { RegisterStudentInput } from "@dorsu/shared-schemas";
import { FieldError, Input } from "@/components/ui/primitives";

/** Step 1 — full name. Enter advances (validated by the page). */
export function StepName({
  register,
  error,
  onNext,
}: {
  register: UseFormRegister<RegisterStudentInput>;
  error?: string;
  onNext: () => void;
}) {
  return (
    <div>
      <label htmlFor="fullName" className="mb-1.5 block text-[13px] font-bold text-ink-soft">
        Full name
      </label>
      <div className="relative">
        <UserRound
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
          aria-hidden
        />
        <Input
          id="fullName"
          placeholder="Juan A. Dela Cruz"
          autoComplete="name"
          autoFocus
          className="pl-11"
          {...register("fullName")}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onNext();
            }
          }}
        />
      </div>
      <FieldError message={error} />
      <p className="mt-2 text-xs leading-relaxed text-ink-muted">
        Please write your real full name. Your counselor will see it when you book,
        but in chats you can still stay hidden as Client-XXXX.
      </p>
    </div>
  );
}
