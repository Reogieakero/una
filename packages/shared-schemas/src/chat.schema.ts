import { z } from "zod";

/** Shared chat validation — thread creation + message send. */
export const createThreadSchema = z.object({
  counselorId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
});
export type CreateThreadInput = z.infer<typeof createThreadSchema>;

export const sendMessageSchema = z.object({
  threadId: z.string().uuid(),
  body: z.string().trim().min(1, "Message cannot be empty").max(4000),
  /**
   * Idempotency key: client-generated UUID v4 per message (used as the row
   * PK). Reuse across retries of one send; a re-send hits the PK and the
   * service returns the existing row instead of duplicating.
   */
  messageId: z.string().uuid().optional(),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

/** Staff DM — office coordination outside student threads. */
export const staffMessageSchema = z.object({
  recipientProfileId: z.string().uuid("Choose who to message."),
  body: z.string().trim().min(1, "Message cannot be empty").max(2000),
});
export type StaffMessageInput = z.infer<typeof staffMessageSchema>;
