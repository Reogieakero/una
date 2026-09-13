"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createAppointmentSchema, type CreateAppointmentInput } from "@dorsu/shared-schemas";
import { Button, FieldError, Input, Textarea } from "@/components/ui/primitives";

/**
 * Booking form — validation schema imported from shared-schemas; the PSS-10
 * gate itself is enforced in booking-service.bookAppointment, not here.
 */
export function AppointmentForm({
  pss10Id,
  onSubmit,
  pending,
}: {
  pss10Id?: string;
  onSubmit: (v: CreateAppointmentInput) => Promise<void> | void;
  pending?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateAppointmentInput>({
    resolver: zodResolver(createAppointmentSchema),
    defaultValues: { mode: "in_person", isAnonymous: false, pss10Id },
  });

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label className="text-sm font-semibold">Date & time</label>
        <Input type="datetime-local" {...register("scheduledAt")} />
        <FieldError message={errors.scheduledAt?.message} />
      </div>
      <div>
        <label className="text-sm font-semibold">Mode</label>
        <select className="w-full rounded-2xl border border-ink/15 px-4 py-2.5 text-sm" {...register("mode")}>
          <option value="in_person">In person</option>
          <option value="online">Online</option>
        </select>
        <FieldError message={errors.mode?.message} />
      </div>
      <div>
        <label className="text-sm font-semibold">What would you like support with?</label>
        <Textarea rows={4} placeholder="Share as much as you are comfortable with…" {...register("concern")} />
        <FieldError message={errors.concern?.message} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register("isAnonymous")} /> Request anonymous handling
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Booking…" : "Request appointment"}
      </Button>
      {!pss10Id && (
        <p className="text-xs text-ink-muted">
          Booking requires a PSS-10 check-in from the last 30 days — complete one first.
        </p>
      )}
    </form>
  );
}
