import path from 'node:path';
import multer from 'multer';
import { env } from '../config/env';
import { ApiError } from '../utils/api-error';

/** Allowed MIME types mapped to the file extensions accepted for each. */
export const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/plain': ['.txt'],
};

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadBytes, files: 1, fields: 20 },
  fileFilter: (_req, file, callback) => {
    const extensions = ALLOWED_FILE_TYPES[file.mimetype];
    const extension = path.extname(file.originalname).toLowerCase();
    if (!extensions || !extensions.includes(extension)) {
      callback(ApiError.badRequest('This file type is not allowed', 'INVALID_FILE_TYPE'));
      return;
    }
    callback(null, true);
  },
});

const startsWith = (buffer: Buffer, signature: number[], offset = 0) =>
  signature.every((byte, index) => buffer[offset + index] === byte);

/**
 * Verifies that the file content matches its declared MIME type (magic numbers),
 * preventing renamed executables or scripts from being stored.
 */
export function contentMatchesMimeType(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length === 0) return false;
  switch (mimeType) {
    case 'application/pdf':
      return startsWith(buffer, [0x25, 0x50, 0x44, 0x46]);
    case 'image/jpeg':
      return startsWith(buffer, [0xff, 0xd8, 0xff]);
    case 'image/png':
      return startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/webp':
      return (
        startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
        startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)
      );
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]);
    case 'application/msword':
    case 'application/vnd.ms-excel':
      return startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    case 'text/plain':
      return !buffer.subarray(0, 8192).includes(0x00);
    default:
      return false;
  }
}

/** Keeps a safe display name: strips paths and control characters. */
export function sanitizeFileName(name: string): string {
  const base = [...path.basename(name)]
    .map((char) =>
      char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 || '<>:"/\\|?*'.includes(char)
        ? '_'
        : char,
    )
    .join('')
    .trim();
  return base.slice(0, 200) || 'document';
}
