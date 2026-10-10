import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { contentMatchesMimeType, sanitizeFileName } from '../middleware/upload';
import { storage } from '../storage';
import type { AuthUser } from '../types/auth';
import { ApiError } from '../utils/api-error';
import { buildMeta, toSkipTake } from '../utils/pagination';
import { contains, searchTokens } from '../utils/search';
import type {
  DocumentListQuery,
  UpdateDocumentInput,
  UploadDocumentInput,
} from '../validators/document.validators';
import {
  assertCaseAccess,
  assertClientAccess,
  caseStakeholders,
  documentScope,
} from './access.service';
import { logActivity } from './activity.service';
import { notifyUsers } from './notification.service';

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const documentInclude = {
  case: { select: { id: true, referenceNumber: true, title: true } },
  client: { select: { id: true, firstName: true, lastName: true } },
  uploader: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.DocumentInclude;

type DocumentRecord = Prisma.DocumentGetPayload<{ include: typeof documentInclude }>;

/** Never expose the storage key; clients download through the authenticated endpoint. */
function present(document: DocumentRecord) {
  const { fileUrl: _storageKey, ...rest } = document;
  return { ...rest, downloadUrl: `/api/documents/${document.id}/download` };
}

export async function removeStoredFiles(keys: string[]): Promise<void> {
  await Promise.all(
    keys.map(async (key) => {
      try {
        await storage.remove(key);
      } catch (error) {
        logger.warn('Failed to remove stored file', { key, error });
      }
    }),
  );
}

export async function listDocuments(user: AuthUser, query: DocumentListQuery) {
  const filters: Prisma.DocumentWhereInput[] = [documentScope(user)];
  if (query.type) filters.push({ type: { in: query.type } });
  if (query.caseId) filters.push({ caseId: query.caseId });
  if (query.clientId) filters.push({ clientId: query.clientId });
  for (const token of searchTokens(query.search)) {
    filters.push({
      OR: [
        { name: contains(token) },
        { case: { referenceNumber: contains(token) } },
        { client: { OR: [{ firstName: contains(token) }, { lastName: contains(token) }] } },
      ],
    });
  }
  const where: Prisma.DocumentWhereInput = { AND: filters };
  const [items, total] = await Promise.all([
    prisma.document.findMany({
      where,
      include: documentInclude,
      orderBy: { [query.sortBy]: query.sortOrder },
      ...toSkipTake(query.page, query.pageSize),
    }),
    prisma.document.count({ where }),
  ]);
  return { items: items.map(present), meta: buildMeta(query.page, query.pageSize, total) };
}

async function findAccessibleDocument(user: AuthUser, id: string) {
  const document = await prisma.document.findUnique({ where: { id }, include: documentInclude });
  if (!document) throw ApiError.notFound('Document not found', 'DOCUMENT_NOT_FOUND');
  if (document.caseId) await assertCaseAccess(user, document.caseId);
  else if (document.clientId) await assertClientAccess(user, document.clientId);
  else if (user.role !== 'ADMIN') throw ApiError.forbidden();
  return document;
}

export async function getDocument(user: AuthUser, id: string) {
  return present(await findAccessibleDocument(user, id));
}

/** Resolves the case/client the document belongs to, enforcing access to both. */
async function resolveOwnership(user: AuthUser, input: UploadDocumentInput) {
  if (input.caseId) {
    const caseRecord = await assertCaseAccess(user, input.caseId);
    if (input.clientId && input.clientId !== caseRecord.clientId) {
      throw ApiError.badRequest('The case does not belong to this client', 'CASE_CLIENT_MISMATCH');
    }
    return { caseId: caseRecord.id, clientId: caseRecord.clientId };
  }
  const client = await assertClientAccess(user, input.clientId as string);
  return { caseId: null, clientId: client.id };
}

export async function uploadDocument(
  user: AuthUser,
  file: UploadedFile | undefined,
  input: UploadDocumentInput,
) {
  if (!file) throw ApiError.badRequest('A file is required', 'FILE_REQUIRED');
  if (!contentMatchesMimeType(file.buffer, file.mimetype)) {
    throw ApiError.badRequest('File content does not match its type', 'INVALID_FILE_CONTENT');
  }
  const ownership = await resolveOwnership(user, input);
  const extension = path.extname(file.originalname).toLowerCase();
  const key = `documents/${new Date().getFullYear()}/${randomUUID()}${extension}`;
  await storage.save(key, file.buffer, file.mimetype);

  let document: DocumentRecord;
  try {
    document = await prisma.document.create({
      data: {
        ...ownership,
        name: sanitizeFileName(input.name || file.originalname),
        type: input.type,
        fileUrl: key,
        mimeType: file.mimetype,
        size: file.size,
        uploadedBy: user.id,
      },
      include: documentInclude,
    });
  } catch (error) {
    await removeStoredFiles([key]);
    throw error;
  }

  await logActivity({
    userId: user.id,
    action: 'document.uploaded',
    entity: 'DOCUMENT',
    entityId: document.id,
    caseId: document.caseId,
    clientId: document.clientId,
    metadata: { name: document.name, type: document.type, size: document.size },
  });

  const recipients = document.caseId
    ? await caseStakeholders(document.caseId)
    : [
        (await prisma.client.findUnique({ where: { id: document.clientId as string } }))?.lawyerId,
      ].filter((id): id is string => Boolean(id));
  await notifyUsers(
    recipients,
    {
      type: 'DOCUMENT_UPLOADED',
      title: 'New document',
      message: `${document.name}${document.case ? ` — ${document.case.referenceNumber}` : ''}`,
      relatedEntity: 'DOCUMENT',
      relatedEntityId: document.id,
      data: {
        name: document.name,
        reference: document.case?.referenceNumber ?? null,
        caseId: document.caseId,
        clientId: document.clientId,
      },
    },
    user.id,
  );
  return present(document);
}

export async function openDocumentFile(user: AuthUser, id: string) {
  const document = await findAccessibleDocument(user, id);
  try {
    const file = await storage.read(document.fileUrl);
    return { document, ...file };
  } catch (error) {
    logger.warn('Stored file is missing', { documentId: id, error });
    throw ApiError.notFound('The file is no longer available', 'FILE_NOT_FOUND');
  }
}

export async function updateDocument(user: AuthUser, id: string, input: UpdateDocumentInput) {
  await findAccessibleDocument(user, id);
  const document = await prisma.document.update({
    where: { id },
    data: { ...input, ...(input.name ? { name: sanitizeFileName(input.name) } : {}) },
    include: documentInclude,
  });
  await logActivity({
    userId: user.id,
    action: 'document.updated',
    entity: 'DOCUMENT',
    entityId: id,
    caseId: document.caseId,
    clientId: document.clientId,
    metadata: { name: document.name, type: document.type },
  });
  return present(document);
}

export async function deleteDocument(user: AuthUser, id: string) {
  const document = await findAccessibleDocument(user, id);
  if (user.role === 'ASSISTANT' && document.uploadedBy !== user.id) {
    throw ApiError.forbidden(
      'Assistants can only delete documents they uploaded',
      'DOCUMENT_FORBIDDEN',
    );
  }
  await prisma.document.delete({ where: { id } });
  await removeStoredFiles([document.fileUrl]);
  await logActivity({
    userId: user.id,
    action: 'document.deleted',
    entity: 'DOCUMENT',
    entityId: id,
    caseId: document.caseId,
    clientId: document.clientId,
    metadata: { name: document.name },
  });
}
