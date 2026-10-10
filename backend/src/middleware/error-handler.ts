import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { logger } from '../config/logger';
import { ApiError } from '../utils/api-error';

interface ErrorBody {
  success: false;
  message: string;
  errorCode: string;
  details?: unknown;
}

function fromPrisma(error: Prisma.PrismaClientKnownRequestError): ApiError {
  switch (error.code) {
    case 'P2002': {
      const target = (error.meta?.target as string[] | string | undefined) ?? 'field';
      return ApiError.conflict(
        `A record with this ${Array.isArray(target) ? target.join(', ') : target} already exists`,
        'DUPLICATE_RESOURCE',
      );
    }
    case 'P2025':
      return ApiError.notFound('Resource not found');
    case 'P2003':
      return ApiError.conflict(
        'This operation conflicts with related records',
        'RELATED_RECORDS_CONFLICT',
      );
    default:
      return new ApiError(500, 'Database error', 'DATABASE_ERROR');
  }
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route ${req.method} ${req.path} not found`, 'ROUTE_NOT_FOUND'));
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  let apiError: ApiError;

  if (err instanceof ApiError) {
    apiError = err;
  } else if (err instanceof ZodError) {
    apiError = ApiError.badRequest(
      'Validation failed',
      'VALIDATION_ERROR',
      err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    apiError = fromPrisma(err);
  } else if (err instanceof MulterError) {
    apiError =
      err.code === 'LIMIT_FILE_SIZE'
        ? new ApiError(413, 'File is too large', 'FILE_TOO_LARGE')
        : ApiError.badRequest(err.message, 'UPLOAD_ERROR');
  } else if (err instanceof SyntaxError && 'body' in err) {
    apiError = ApiError.badRequest('Malformed JSON body', 'INVALID_JSON');
  } else {
    apiError = new ApiError(500, 'Internal server error', 'INTERNAL_ERROR');
  }

  if (apiError.statusCode >= 500) {
    logger.error('Unhandled error', { method: req.method, path: req.path, error: err });
  }

  const body: ErrorBody = {
    success: false,
    message: apiError.message,
    errorCode: apiError.errorCode,
  };
  if (apiError.details !== undefined) body.details = apiError.details;
  res.status(apiError.statusCode).json(body);
}
