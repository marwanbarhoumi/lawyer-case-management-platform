import { Prisma } from '@prisma/client';

/** Formats `PREFIX-YYYY-0001` style identifiers. */
export function formatSequence(prefix: string, year: number, value: number): string {
  return `${prefix}-${year}-${String(value).padStart(4, '0')}`;
}

/** Extracts the numeric suffix of the latest identifier (0 when none). */
export function nextSequenceValue(latest: string | null | undefined): number {
  if (!latest) return 1;
  const match = /-(\d+)$/.exec(latest);
  return match ? Number(match[1]) + 1 : 1;
}

/**
 * Runs `create` with an identifier, retrying with the next value when a concurrent
 * request grabbed the same one (unique constraint violation).
 */
export async function withUniqueSequence<T>(
  findLatest: (prefix: string) => Promise<string | null>,
  prefix: string,
  create: (identifier: string) => Promise<T>,
  attempts = 5,
): Promise<T> {
  const year = new Date().getFullYear();
  const scopedPrefix = `${prefix}-${year}-`;
  let value = nextSequenceValue(await findLatest(scopedPrefix));
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await create(formatSequence(prefix, year, value));
    } catch (error) {
      const isConflict =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
      if (!isConflict || attempt === attempts - 1) throw error;
      value += 1;
    }
  }
  throw new Error('Unable to allocate a unique identifier');
}
