import { z } from "zod";

/**
 * PSS-10 (Perceived Stress Scale, 10-item). Each answer 0..4 in question order.
 * Reverse-scored items (4,5,7,8 → indexes 3,4,6,7) are handled in
 * `pss10-scoring.ts`, not here — this schema only validates shape.
 */
export const PSS10_QUESTIONS = [
  "In the last month, how often have you been upset because of something that happened unexpectedly?",
  "In the last month, how often have you felt that you were unable to control the important things in your life?",
  "In the last month, how often have you felt nervous and stressed?",
  "In the last month, how often have you felt confident about your ability to handle your personal problems?",
  "In the last month, how often have you felt that things were going your way?",
  "In the last month, how often have you found that you could not cope with all the things that you had to do?",
  "In the last month, how often have you been able to control irritations in your life?",
  "In the last month, how often have you felt that you were on top of things?",
  "In the last month, how often have you been angered because of things that were outside of your control?",
  "In the last month, how often have you felt difficulties were piling up so high that you could not overcome them?",
] as const;

export const pss10AnswerSchema = z.number().int().min(0).max(4);

export const pss10SubmitSchema = z.object({
  answers: z
    .array(pss10AnswerSchema)
    .length(10, "Answer all 10 questions"),
  appointmentId: z.string().uuid().optional(),
});
export type Pss10SubmitInput = z.infer<typeof pss10SubmitSchema>;
