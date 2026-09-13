"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PSS10_QUESTIONS, pss10SubmitSchema, type Pss10SubmitInput } from "@dorsu/shared-schemas";
import { Button, Card, FieldError } from "@/components/ui/primitives";

/**
 * PSS-10 check-in form — schema imported from shared-schemas, scoring lives in
 * shared-services. Neither web nor mobile reimplements questions or bands.
 */
export function Pss10Form({
  onSubmit,
  pending,
}: {
  onSubmit: (answers: number[]) => Promise<void> | void;
  pending?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Pss10SubmitInput>({
    resolver: zodResolver(pss10SubmitSchema),
    defaultValues: { answers: Array(10).fill(2) as number[] },
  });

  return (
    <Card>
      <h2 className="font-display text-xl font-bold">Stress check-in (PSS-10)</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Last month, how often have you felt the following? 0 = Never … 4 = Very often.
      </p>
      <form
        className="mt-4 space-y-4"
        onSubmit={handleSubmit((v) => onSubmit(v.answers))}
      >
        {PSS10_QUESTIONS.map((q, i) => (
          <fieldset key={i} className="rounded-2xl border border-ink/10 p-3">
            <legend className="px-1 text-sm font-semibold">
              {i + 1}. {q}
            </legend>
            <div className="flex gap-2">
              {[0, 1, 2, 3, 4].map((n) => (
                <label
                  key={n}
                  className="flex flex-1 cursor-pointer flex-col items-center rounded-xl border border-ink/10 py-2 text-xs has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50"
                >
                  <input
                    type="radio"
                    value={n}
                    className="sr-only"
                    {...register(`answers.${i as 0}`, { valueAsNumber: true })}
                  />
                  <span className="font-display text-base font-bold">{n}</span>
                  <span className="text-ink-muted">
                    {["Never", "Almost", "Sometimes", "Fairly", "Very"][n]}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <FieldError message={errors.answers?.message} />
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Submit check-in"}
        </Button>
      </form>
    </Card>
  );
}
