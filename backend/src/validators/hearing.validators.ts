import { z } from 'zod';
import { HearingStatus, HearingType } from '@prisma/client';
import { csvEnum, listQuerySchema } from '../utils/pagination';
import { optionalText } from './common';

const statusValues = Object.values(HearingStatus) as [HearingStatus, ...HearingStatus[]];

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must use the HH:mm format');

export const createHearingSchema = z.object({
  caseId: z.uuid('Invalid case'),
  /** Full ISO instant of the hearing (date and time). */
  date: z.coerce.date({ message: 'Invalid date' }),
  time: timeSchema,
  location: optionalText(300),
  court: optionalText(200),
  type: z.enum(HearingType).default('OTHER'),
  notes: optionalText(5000),
  status: z.enum(HearingStatus).default('SCHEDULED'),
});

export const updateHearingSchema = createHearingSchema
  .omit({ caseId: true })
  .partial()
  .extend({
    type: z.enum(HearingType).optional(),
    status: z.enum(HearingStatus).optional(),
  });

export const completeHearingSchema = z.object({
  notes: optionalText(5000),
});

export const hearingListQuerySchema = listQuerySchema(
  ['date', 'createdAt'] as const,
  'date',
).extend({
  caseId: z.uuid().optional(),
  clientId: z.uuid().optional(),
  status: csvEnum(statusValues),
  court: z.string().trim().max(200).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  range: z.enum(['today', 'tomorrow', 'week', 'upcoming', 'overdue']).optional(),
});

export type CreateHearingInput = z.infer<typeof createHearingSchema>;
export type UpdateHearingInput = z.infer<typeof updateHearingSchema>;
export type HearingListQuery = z.infer<typeof hearingListQuerySchema>;
