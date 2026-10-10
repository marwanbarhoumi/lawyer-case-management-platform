import { z } from 'zod';
import { CasePriority, CaseStatus, CaseType } from '@prisma/client';
import { csvEnum, listQuerySchema } from '../utils/pagination';
import { optionalDateInput, optionalText, requiredText } from './common';

const statusValues = Object.values(CaseStatus) as [CaseStatus, ...CaseStatus[]];
const priorityValues = Object.values(CasePriority) as [CasePriority, ...CasePriority[]];
const typeValues = Object.values(CaseType) as [CaseType, ...CaseType[]];

export const createCaseSchema = z.object({
  title: requiredText(200),
  referenceNumber: z
    .string()
    .trim()
    .max(50)
    .regex(/^[A-Za-z0-9/_.-]*$/, 'Invalid reference format')
    .optional()
    .transform((value) => (value ? value.toUpperCase() : undefined)),
  description: optionalText(10000),
  caseType: z.enum(CaseType).default('CIVIL'),
  status: z.enum(CaseStatus).default('OPEN'),
  priority: z.enum(CasePriority).default('MEDIUM'),
  clientId: z.uuid('Invalid client'),
  lawyerId: z.uuid('Invalid lawyer').optional(),
  court: optionalText(200),
  judge: optionalText(200),
  opposingParty: optionalText(300),
  openingDate: optionalDateInput,
  assistantIds: z.array(z.uuid()).max(20).optional(),
});

export const updateCaseSchema = createCaseSchema
  .omit({ referenceNumber: true })
  .partial()
  .extend({
    caseType: z.enum(CaseType).optional(),
    status: z.enum(CaseStatus).optional(),
    priority: z.enum(CasePriority).optional(),
    closingDate: optionalDateInput,
  });

export const caseListQuerySchema = listQuerySchema(
  [
    'createdAt',
    'openingDate',
    'referenceNumber',
    'priority',
    'status',
    'title',
    'updatedAt',
  ] as const,
  'createdAt',
).extend({
  status: csvEnum(statusValues),
  priority: csvEnum(priorityValues),
  caseType: csvEnum(typeValues),
  clientId: z.uuid().optional(),
  lawyerId: z.uuid().optional(),
  court: z.string().trim().max(200).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
export type CaseListQuery = z.infer<typeof caseListQuerySchema>;
