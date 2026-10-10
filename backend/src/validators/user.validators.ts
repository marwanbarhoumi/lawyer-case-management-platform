import { z } from 'zod';
import { Role } from '@prisma/client';
import { listQuerySchema, csvEnum } from '../utils/pagination';
import { booleanQuery, passwordSchema, phoneSchema, requiredText } from './common';

const roleValues = Object.values(Role) as [Role, ...Role[]];

export const createUserSchema = z.object({
  firstName: requiredText(100),
  lastName: requiredText(100),
  email: z
    .email('Invalid email')
    .max(200)
    .transform((value) => value.toLowerCase()),
  password: passwordSchema,
  phone: phoneSchema,
  role: z.enum(Role),
  isActive: z.boolean().default(true),
});

export const updateUserSchema = z.object({
  firstName: requiredText(100).optional(),
  lastName: requiredText(100).optional(),
  email: z
    .email('Invalid email')
    .max(200)
    .transform((value) => value.toLowerCase())
    .optional(),
  phone: phoneSchema.optional(),
  role: z.enum(Role).optional(),
  isActive: z.boolean().optional(),
  password: passwordSchema.optional(),
});

export const userListQuerySchema = listQuerySchema(
  ['createdAt', 'lastName', 'email', 'role'] as const,
  'createdAt',
).extend({
  role: csvEnum(roleValues),
  isActive: booleanQuery,
});

export const userLookupQuerySchema = z.object({
  role: csvEnum(roleValues),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserListQuery = z.infer<typeof userListQuerySchema>;
