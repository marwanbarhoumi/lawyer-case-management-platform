import type { Response } from 'express';
import type { PaginationMeta } from './pagination';

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({ success: true, data });
}

export function sendPaginated<T>(res: Response, data: T[], meta: PaginationMeta): void {
  res.status(200).json({ success: true, data, meta });
}

export function sendNoContent(res: Response): void {
  res.status(204).end();
}
