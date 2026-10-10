import { z } from 'zod';
import { optionalEmail, optionalText, phoneSchema, requiredText } from './common';

export const updateSettingsSchema = z.object({
  firmName: requiredText(200).optional(),
  firmEmail: optionalEmail,
  firmPhone: phoneSchema.optional(),
  firmAddress: optionalText(300).optional(),
  taxIdentifier: optionalText(100).optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  defaultTaxRate: z.coerce.number().min(0).max(100).optional(),
  invoiceDueDays: z.coerce.number().int().min(0).max(365).optional(),
  contractExpiryWarningDays: z.coerce.number().int().min(1).max(365).optional(),
  invoiceDueWarningDays: z.coerce.number().int().min(0).max(60).optional(),
});

export const reportQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  lawyerId: z.uuid().optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type ReportQuery = z.infer<typeof reportQuerySchema>;
