import { z } from "zod";

/** Shared referral validation — faculty/personnel submit, counselors triage. */
export const referralPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export const referralStatusSchema = z.enum([
  "pending",
  "acknowledged",
  "in_progress",
  "resolved",
  "escalated",
]);

export const createReferralSchema = z.object({
  studentId: z.string().uuid("Select a student"),
  reason: z.string().min(10, "Give at least 10 characters of context").max(2000),
  priority: referralPrioritySchema.default("medium"),
  assignedCounselorId: z.string().uuid().optional(),
});
export type CreateReferralInput = z.infer<typeof createReferralSchema>;

export const updateReferralSchema = z.object({
  referralId: z.string().uuid(),
  status: referralStatusSchema,
  assignedCounselorId: z.string().uuid().nullable().optional(),
  actionNote: z.string().max(2000).optional(),
});
export type UpdateReferralInput = z.infer<typeof updateReferralSchema>;
