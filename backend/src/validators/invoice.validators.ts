import { z } from 'zod';
import { InvoiceStatus } from '@prisma/client';
import { csvEnum, listQuerySchema } from '../utils/pagination';
import { optionalDateInput, optionalText, optionalUuid, requiredText } from './common';

const statusValues = Object.values(InvoiceStatus) as [InvoiceStatus, ...InvoiceStatus[]];

export const invoiceItemSchema = z.object({
  description: requiredText(500),
  quantity: z.coerce.number().positive('Quantity must be positive').max(1_000_000),
  unitPrice: z.coerce.number().min(0, 'Unit price cannot be negative').max(1_000_000_000),
});

export const createInvoiceSchema = z.object({
  clientId: z.uuid('Invalid client'),
  caseId: optionalUuid,
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required').max(100),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  issueDate: optionalDateInput,
  dueDate: optionalDateInput,
  notes: optionalText(5000),
  status: z.enum(['DRAFT', 'SENT']).default('DRAFT'),
});

export const updateInvoiceSchema = createInvoiceSchema
  .omit({ clientId: true })
  .partial()
  .extend({ status: z.enum(['DRAFT', 'SENT']).optional() });

export const payInvoiceSchema = z.object({
  /** Amount received. Defaults to the remaining balance. */
  amount: z.coerce.number().positive().optional(),
  paidAt: optionalDateInput,
});

export const invoiceListQuerySchema = listQuerySchema(
  ['createdAt', 'issueDate', 'dueDate', 'total', 'invoiceNumber'] as const,
  'createdAt',
).extend({
  status: csvEnum(statusValues),
  clientId: z.uuid().optional(),
  caseId: z.uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type PayInvoiceInput = z.infer<typeof payInvoiceSchema>;
export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;
