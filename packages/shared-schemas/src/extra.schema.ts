import { z } from "zod";

/** Shared post-session feedback validation (students rate completed appointments). */
export const feedbackSchema = z.object({
  appointmentId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().nullable(),
});
export type FeedbackInput = z.infer<typeof feedbackSchema>;

/** Shared session-note validation (counselors only). */
export const sessionNoteSchema = z.object({
  appointmentId: z.string().uuid(),
  content: z.string().min(10, "Note needs at least 10 characters").max(10000),
  isPrivate: z.boolean().default(true),
});
export type SessionNoteInput = z.infer<typeof sessionNoteSchema>;

/** Shared break-glass validation — justification is mandatory, enforced here + service. */
export const breakGlassSchema = z.object({
  studentId: z.string().uuid(),
  justification: z
    .string()
    .trim()
    .min(20, "Justification must be at least 20 characters")
    .max(2000),
});
export type BreakGlassInput = z.infer<typeof breakGlassSchema>;

/** Shared announcement validation (guidance head). */
export const announcementSchema = z.object({
  title: z.string().min(4).max(200),
  body: z.string().min(10).max(10000),
  audience: z
    .array(z.enum(["student", "counselor", "guidance_head", "faculty"]))
    .nullable()
    .optional(),
});
export type AnnouncementInput = z.infer<typeof announcementSchema>;
