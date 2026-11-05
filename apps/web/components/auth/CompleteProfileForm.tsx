"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import {
  completeStaffProfileSchema,
  type CompleteStaffProfileInput,
} from "@dorsu/shared-schemas";
import { Button, FieldError, Input } from "@/components/ui/primitives";

/**
 * Post-approval details for self-registered staff (00076). The role and
 * approval are fixed server-side; this only fills the real name and the
 * role-specific record.
 */
export function CompleteProfileForm({
  role,
  defaultValues,
}: {
  role: "faculty" | "counselor";
  defaultValues: CompleteStaffProfileInput;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<CompleteStaffProfileInput>({
    resolver: zodResolver(completeStaffProfileSchema),
    defaultValues,
  });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    const res = await fetch("/api/auth/complete-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    });
    const body = (await res.json().catch(() => null)) as
      | { error?: string; redirectTo?: string }
      | null;
    if (!res.ok) return setError(body?.error ?? "Couldn't save your profile. Please try again.");
    router.replace(body?.redirectTo ?? "/dashboard");
    router.refresh();
  });

  const inputClass =
    "h-10 rounded-lg border-ink/10 bg-white text-sm focus:border-yellow-500 focus:ring-yellow-400/25";

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <label htmlFor="full-name" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
          Full name
        </label>
        <Input
          id="full-name"
          placeholder="Juan A. Dela Cruz"
          autoComplete="name"
          className={inputClass}
          {...register("fullName")}
        />
        <FieldError message={formState.errors.fullName?.message} />
      </div>

      <div>
        <label htmlFor="employee-no" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
          Employee number <span className="font-normal text-ink-faint">(optional)</span>
        </label>
        <Input
          id="employee-no"
          placeholder="e.g. DORSU-1234"
          className={inputClass}
          {...register("employeeNo")}
        />
        <FieldError message={formState.errors.employeeNo?.message} />
      </div>

      {role === "faculty" ? (
        <div>
          <label htmlFor="department" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
            Department <span className="font-normal text-ink-faint">(optional)</span>
          </label>
          <Input
            id="department"
            placeholder="e.g. College of Education"
            className={inputClass}
            {...register("department")}
          />
          <FieldError message={formState.errors.department?.message} />
        </div>
      ) : (
        <div>
          <label
            htmlFor="specialization"
            className="mb-1.5 block text-[13px] font-semibold text-ink-soft"
          >
            Specialization <span className="font-normal text-ink-faint">(optional)</span>
          </label>
          <Input
            id="specialization"
            placeholder="e.g. Adolescent counseling"
            className={inputClass}
            {...register("specialization")}
          />
          <FieldError message={formState.errors.specialization?.message} />
        </div>
      )}

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
            Saving…
          </>
        ) : (
          "Finish setup"
        )}
      </Button>
    </form>
  );
}
