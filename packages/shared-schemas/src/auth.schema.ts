import { z } from "zod";

/** Shared auth validation — imported by web + mobile forms, never redefined per-app. */
export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerStudentSchema = z.object({
  fullName: z.string().min(2, "Full name is required").max(120),
  email: z.string().email("Enter a valid university email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
      "Use upper and lower case letters and a number",
    ),
  studentNo: z
    .string()
    .min(4, "Student number is required")
    .max(32)
    .regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and dashes only"),
  program: z.string().min(2, "Program is required").max(120),
  yearLevel: z.string().min(1, "Year level is required").max(32),
});
export type RegisterStudentInput = z.infer<typeof registerStudentSchema>;

export const registerStaffSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, "Include upper and lower case letters and a number"),
  role: z.enum(["counselor", "faculty", "guidance_head"]),
  employeeNo: z.string().max(32).optional(),
  department: z.string().max(120).optional(),
  specialization: z.string().max(120).optional(),
});
export type RegisterStaffInput = z.infer<typeof registerStaffSchema>;

/**
 * Public self-signup (email or Google). Only the credentials are collected up
 * front — the role is chosen on /register/role afterwards, and staff complete
 * their details once a guidance head approves the account.
 */
export const selfSignupSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
      "Use upper and lower case letters and a number",
    ),
});
export type SelfSignupInput = z.infer<typeof selfSignupSchema>;

/**
 * Roles a first-time web user may choose for themselves. The staff portal is
 * for counselors and faculty only; students register in the mobile app.
 */
export const oauthProfileSchema = z.object({
  role: z.enum(["faculty", "counselor"], {
    errorMap: () => ({ message: "Choose faculty or guidance counselor." }),
  }),
});
export type OAuthProfileInput = z.infer<typeof oauthProfileSchema>;

/**
 * Details a self-registered counselor/faculty fills in after the guidance head
 * approves them. Students use the mobile profile instead.
 */
export const completeStaffProfileSchema = z.object({
  fullName: z.string().min(2, "Full name is required").max(120),
  employeeNo: z
    .string()
    .max(32)
    .regex(/^[A-Za-z0-9-]*$/, "Letters, numbers and dashes only")
    .optional()
    .or(z.literal("")),
  department: z.string().max(120).optional().or(z.literal("")),
  specialization: z.string().max(120).optional().or(z.literal("")),
});
export type CompleteStaffProfileInput = z.infer<typeof completeStaffProfileSchema>;

export const resetPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const updatePasswordSchema = z
  .object({
    password: z.string().min(8).max(72),
    confirmPassword: z.string().min(8).max(72),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
