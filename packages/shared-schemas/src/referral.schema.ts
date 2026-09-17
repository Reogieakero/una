import { z } from "zod";

/** Shared referral validation — faculty/personnel submit, counselors triage. */
export const referralPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);
/**
 * Official sheet Case Classification set (FM-DOrSU-GCTC-02) — keep in sync
 * with REFERRAL_CLASSIFICATIONS in @dorsu/shared-types.
 */
export const referralClassificationSchema = z.enum([
  "Behavioral",
  "Relational",
  "Financial",
  "Absenteeism",
  "Social Adjustment",
  "Academic-related",
  "Health",
  "Others",
]);
export const referralStatusSchema = z.enum([
  "pending",
  "assigned",
  "acknowledged",
  "in_progress",
  "confirmed",
  "resolved",
  "escalated",
  "rejected",
]);

export const createReferralSchema = z
  .object({
    studentId: z.string().uuid("Select a student").optional(),
    /** Walk-in identity typed off the paper form (no account yet). */
    studentNameText: z.string().trim().max(120).optional(),
    studentNoText: z.string().trim().max(40).optional(),
    reason: z.string().min(10, "Give at least 10 characters of context").max(2000),
    priority: referralPrioritySchema.default("medium"),
    studentGender: z.string().trim().max(30).optional(),
    studentAge: z.string().trim().max(10).optional(),
    relationToClient: z.string().trim().max(120).optional(),
    caseClassification: z
      .array(referralClassificationSchema)
      .min(1, "Select at least one case classification"),
    classificationOther: z.string().trim().max(200).optional(),
    assignedCounselorId: z.string().uuid().optional(),
  })
  .refine(
    (v) =>
      !v.caseClassification.includes("Others") ||
      (v.classificationOther ?? "").trim().length > 0,
    { message: "Specify the other concern", path: ["classificationOther"] }
  )
  .refine(
    (v) => !!v.studentId || (v.studentNameText ?? "").trim().length > 0,
    { message: "Select a student or type their name", path: ["studentId"] }
  );
export type CreateReferralInput = z.infer<typeof createReferralSchema>;

export const updateReferralSchema = z.object({
  referralId: z.string().uuid(),
  status: referralStatusSchema,
  assignedCounselorId: z.string().uuid().nullable().optional(),
  actionNote: z.string().max(2000).optional(),
});
export type UpdateReferralInput = z.infer<typeof updateReferralSchema>;
