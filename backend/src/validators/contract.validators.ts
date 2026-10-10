import { z } from 'zod';
import { ContractStatus } from '@prisma/client';
import { csvEnum, listQuerySchema } from '../utils/pagination';
import { dateInput, optionalDateInput, optionalText, optionalUuid, requiredText } from './common';

const statusValues = Object.values(ContractStatus) as [ContractStatus, ...ContractStatus[]];

const moneySchema = z.coerce.number().min(0).max(9_999_999_999);

const contractBase = z.object({
  clientId: z.uuid('Invalid client'),
  caseId: optionalUuid,
  documentId: optionalUuid,
  title: requiredText(200),
  description: optionalText(10000),
  startDate: dateInput,
  endDate: optionalDateInput,
  status: z.enum(ContractStatus).default('ACTIVE'),
  value: z
    .union([moneySchema, z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' ? null : v)),
});

const endAfterStart = (value: { startDate?: Date; endDate?: Date | null }) =>
  !value.startDate || !value.endDate || value.endDate >= value.startDate;

export const createContractSchema = contractBase.refine(endAfterStart, {
  message: 'End date must be after the start date',
  path: ['endDate'],
});

export const updateContractSchema = contractBase
  .partial()
  .extend({ status: z.enum(ContractStatus).optional() })
  .refine(endAfterStart, { message: 'End date must be after the start date', path: ['endDate'] });

export const contractListQuerySchema = listQuerySchema(
  ['createdAt', 'startDate', 'endDate', 'title'] as const,
  'createdAt',
).extend({
  status: csvEnum(statusValues),
  clientId: z.uuid().optional(),
  caseId: z.uuid().optional(),
  view: z.enum(['active', 'expired', 'expiring']).optional(),
});

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type UpdateContractInput = z.infer<typeof updateContractSchema>;
export type ContractListQuery = z.infer<typeof contractListQuerySchema>;
