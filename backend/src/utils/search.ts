/** Splits a free-text search into tokens (each token must match at least one field). */
export function searchTokens(search: string | undefined): string[] {
  if (!search) return [];
  return search
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 5);
}

export const contains = (value: string) => ({ contains: value, mode: 'insensitive' as const });
