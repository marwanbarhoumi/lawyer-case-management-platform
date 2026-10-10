import { z } from 'zod';

/**
 * Frontend validation schemas. Error messages are translation keys from the
 * `validation` namespace, rendered by <FormField>. The API validates again.
 */
export const requiredString = (max = 200) =>
  z.string().trim().min(1, 'required').max(max, 'maxLength');
export const optionalString = (max = 500) => z.string().trim().max(max, 'maxLength');

export const emailSchema = z.string().trim().min(1, 'required').pipe(z.email('email'));
export const optionalEmail = z.union([z.literal(''), z.email('email')]);
export const phoneSchema = z
  .string()
  .trim()
  .max(30, 'maxLength')
  .regex(/^[+0-9 ().-]*$/, 'phone');

export const passwordSchema = z
  .string()
  .min(8, 'passwordMin')
  .regex(/[A-Za-z]/, 'passwordLetter')
  .regex(/[0-9]/, 'passwordNumber');

export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time');
export const dateSchema = z.string().min(1, 'required');

/** Converts empty form strings to null for optional API fields. */
export const nullable = (value: string | undefined | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};
