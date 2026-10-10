import { z } from 'zod';
import { optionalText, passwordSchema, phoneSchema, requiredText } from './common';

export const registerSchema = z.object({
  firstName: requiredText(100),
  lastName: requiredText(100),
  email: z
    .email('Invalid email')
    .max(200)
    .transform((value) => value.toLowerCase()),
  password: passwordSchema,
  phone: phoneSchema,
});

export const loginSchema = z.object({
  email: z.email('Invalid email').transform((value) => value.toLowerCase()),
  password: z.string().min(1, 'Required').max(128),
});

export const updateProfileSchema = z.object({
  firstName: requiredText(100),
  lastName: requiredText(100),
  phone: phoneSchema,
  avatar: optionalText(500),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  email: z.email('Invalid email').transform((value) => value.toLowerCase()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(128),
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
