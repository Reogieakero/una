import { z } from "zod";

/** Shared appointment validation — single source for web + mobile booking forms. */
export const appointmentModeSchema = z.enum(["in_person", "online"]);
export const appointmentStatusSchema = z.enum([
  "pending",
  "assigned",
  "confirmed",
  "completed",
  "cancelled",
  "rejected",
  "no_show",
]);

export const createAppointmentSchema = z.object({
  counselorId: z.string().uuid("Choose a counselor").nullable().optional(),
  scheduledAt: z.coerce.date({ required_error: "Choose a date and time" }),
  mode: appointmentModeSchema,
  concern: z
    .string()
    .min(10, "Describe your concern in at least 10 characters")
    .max(2000),
  isAnonymous: z.boolean().default(false),
  /** Client-computed PSS-10 id proving the gate was passed; verified server-side. */
  pss10Id: z.string().uuid().optional(),
  /**
   * Idempotency key: client-generated UUID v4 per booking intent. The client
   * MUST reuse the same key across retries/timeouts of one user action and
   * generate a fresh key per new action — retries then collapse to one row
   * via UNIQUE(appointments.idempotency_key).
   */
  idempotencyKey: z.string().uuid().optional(),
});
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const updateAppointmentStatusSchema = z.object({
  appointmentId: z.string().uuid(),
  status: appointmentStatusSchema,
  counselorId: z.string().uuid().optional(),
});
export type UpdateAppointmentStatusInput = z.infer<
  typeof updateAppointmentStatusSchema
>;

export const availabilitySchema = z
  .object({
    counselorId: z.string().uuid(),
    weekday: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use HH:MM"),
    endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use HH:MM"),
    isRecurring: z.boolean().default(true),
  })
  .refine((v) => v.startTime < v.endTime, {
    message: "Start time must be before end time",
    path: ["endTime"],
  });
export type AvailabilityInput = z.infer<typeof availabilitySchema>;
