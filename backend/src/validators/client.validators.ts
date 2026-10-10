import { z } from 'zod';
import { listQuerySchema } from '../utils/pagination';
import { optionalEmail, optionalText, optionalUuid, phoneSchema, requiredText } from './common';

export const createClientSchema = z.object({
  firstName: requiredText(100),
  lastName: requiredText(100),
  email: optionalEmail,
  phone: phoneSchema,
  address: optionalText(300),
  nationalId: optionalText(50),
  notes: optionalText(5000),
  lawyerId: optionalUuid,
});

export const updateClientSchema = createClientSchema.partial();

export const clientListQuerySchema = listQuerySchema(
  ['createdAt', 'lastName', 'firstName', 'email'] as const,
  'createdAt',
).extend({
  lawyerId: z.uuid().optional(),
  archived: z.enum(['true', 'false', 'all']).default('false'),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ClientListQuery = z.infer<typeof clientListQuerySchema>;
