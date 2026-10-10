import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middleware/auth';
import * as documentService from '../services/document.service';
import { sendNoContent, sendPaginated, sendSuccess } from '../utils/response';
import { booleanQuery, idParamSchema } from '../validators/common';
import {
  documentListQuerySchema,
  updateDocumentSchema,
  uploadDocumentSchema,
} from '../validators/document.validators';

/** Types the browser may render inline; anything else is always downloaded. */
const INLINE_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
]);

export async function list(req: Request, res: Response) {
  const { items, meta } = await documentService.listDocuments(
    currentUser(req),
    documentListQuerySchema.parse(req.query),
  );
  sendPaginated(res, items, meta);
}

export async function get(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  sendSuccess(res, await documentService.getDocument(currentUser(req), id));
}

export async function upload(req: Request, res: Response) {
  const input = uploadDocumentSchema.parse(req.body ?? {});
  sendSuccess(res, await documentService.uploadDocument(currentUser(req), req.file, input), 201);
}

export async function download(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const { inline } = z.object({ inline: booleanQuery }).parse(req.query);
  const { document, stream, size } = await documentService.openDocumentFile(currentUser(req), id);
  const disposition = inline && INLINE_TYPES.has(document.mimeType) ? 'inline' : 'attachment';

  res.setHeader('Content-Type', document.mimeType);
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename*=UTF-8''${encodeURIComponent(document.name)}`,
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  );
  res.setHeader('Cache-Control', 'private, no-store');
  if (size !== undefined) res.setHeader('Content-Length', String(size));
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

export async function update(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = updateDocumentSchema.parse(req.body);
  sendSuccess(res, await documentService.updateDocument(currentUser(req), id, input));
}

export async function remove(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  await documentService.deleteDocument(currentUser(req), id);
  sendNoContent(res);
}
