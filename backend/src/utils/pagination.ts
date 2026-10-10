import { z } from 'zod';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/** Builds a pagination + sorting schema restricted to whitelisted sort fields. */
export function listQuerySchema<const T extends readonly [string, ...string[]]>(
  sortFields: T,
  defaultSort: T[number],
) {
  return paginationSchema.extend({
    sortBy: z.enum(sortFields).default(defaultSort as never),
  });
}

export function toSkipTake(page: number, pageSize: number) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function buildMeta(page: number, pageSize: number, total: number): PaginationMeta {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Accepts `?status=A,B` or repeated `?status=A&status=B`. */
export function csvEnum<T extends readonly [string, ...string[]]>(values: T) {
  return z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((raw) => {
      if (raw === undefined) return undefined;
      const list = (Array.isArray(raw) ? raw : raw.split(','))
        .map((item) => item.trim())
        .filter(Boolean);
      return list.length ? list : undefined;
    })
    .pipe(z.array(z.enum(values)).optional());
}
