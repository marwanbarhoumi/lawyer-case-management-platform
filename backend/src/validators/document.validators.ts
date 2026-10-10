import { z } from 'zod';
import { DocumentType } from '@prisma/client';
import { csvEnum, listQuerySchema } from '../utils/pagination';

const typeValues = Object.values(DocumentType) as [DocumentType, ...DocumentType[]];

export const uploadDocumentSchema = z
  .object({
    name: z.string().trim().max(200).optional(),
    type: z.enum(DocumentType).default('OTHER'),
    caseId: z
      .uuid()
      .optional()
      .or(z.literal('').transform(() => undefined)),
    clientId: z
      .uuid()
      .optional()
      .or(z.literal('').transform(() => undefined)),
  })
  .refine((value) => value.caseId || value.clientId, {
    message: 'A document must be linked to a case or a client',
    path: ['caseId'],
  });

export const updateDocumentSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  type: z.enum(DocumentType).optional(),
});

export const documentListQuerySchema = listQuerySchema(
  ['createdAt', 'name', 'size'] as const,
  'createdAt',
).extend({
  type: csvEnum(typeValues),
  caseId: z.uuid().optional(),
  clientId: z.uuid().optional(),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type DocumentListQuery = z.infer<typeof documentListQuerySchema>;
