import { z } from "zod";

export const registerSchema = z.object({
  username: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers and underscores only"),
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(72),
});

export const loginSchema = z.object({
  emailOrUsername: z.string().trim().min(1),
  password: z.string().min(1),
});

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8).max(72),
});

export const updateProfileSchema = z.object({
  username: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/).optional(),
});

export const requestEmailChangeSchema = z.object({
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
});

export const verifyEmailChangeSchema = z.object({ token: z.string().min(40).max(200) });

export const googleAuthSchema = z.object({ credential: z.string().min(10), }); 
export const requestEmailCodeSchema = z.object({ email: z.string().trim().email().transform((email) => email.toLowerCase()) });
export const verifyEmailCodeSchema = z.object({
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
  code: z.string().regex(/^\d{6}$/),
});
