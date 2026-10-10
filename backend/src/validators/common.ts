import { z } from 'zod';

export const idParamSchema = z.object({ id: z.uuid({ message: 'Invalid identifier' }) });

/** Keeps `undefined` (field not sent) but normalises empty values to `null` (field cleared). */
function emptyToNull<T>(value: T | null | undefined | ''): T | null | undefined {
  if (value === undefined) return undefined;
  if (value === '' || value === null) return null;
  return value;
}

/** Optional text input: trims, converts empty strings to null. */
export const optionalText = (max = 500) =>
  z.string().trim().max(max).nullish().transform(emptyToNull);

export const requiredText = (max = 200) => z.string().trim().min(1, 'Required').max(max);

export const booleanQuery = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));

export const optionalUuid = z
  .union([z.uuid(), z.literal(''), z.null()])
  .optional()
  .transform(emptyToNull);

export const dateInput = z.coerce.date({ message: 'Invalid date' });

export const optionalDateInput = z
  .union([z.literal(''), z.null(), z.coerce.date({ message: 'Invalid date' })])
  .optional()
  .transform(emptyToNull);

export const phoneSchema = z
  .string()
  .trim()
  .max(30)
  .regex(/^[+0-9 ().-]*$/, 'Invalid phone number')
  .nullish()
  .transform(emptyToNull);

export const optionalEmail = z
  .union([z.literal(''), z.null(), z.email('Invalid email').max(200)])
  .optional()
  .transform((value) => emptyToNull(value)?.toLowerCase() ?? emptyToNull(value));

export const passwordSchema = z
  .string()
  .min(8, 'Password must contain at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');
