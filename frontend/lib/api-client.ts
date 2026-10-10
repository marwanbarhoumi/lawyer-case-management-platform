import type { Paginated, User } from '@/types/api';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000').replace(
  /\/$/,
  '',
);

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errorCode: string,
    public readonly details?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface SessionPayload {
  user: User;
  accessToken: string;
}

type QueryValue = string | number | boolean | undefined | null | string[];

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
  /** Internal: prevents infinite refresh loops. */
  retried?: boolean;
}

let accessToken: string | null = null;
let refreshPromise: Promise<SessionPayload | null> | null = null;
const unauthorizedListeners = new Set<() => void>();

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** Subscribe to "session definitively lost" events (refresh failed). */
export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  // An empty API_URL means same-origin (the `/api` proxy); resolve it against the page origin.
  const url = new URL(`${API_URL}${path}`, globalThis.location?.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  return url.toString();
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as {
      message?: string;
      errorCode?: string;
      details?: Array<{ path: string; message: string }>;
    };
    return new ApiError(
      response.status,
      body.message ?? response.statusText,
      body.errorCode ?? 'ERROR',
      body.details,
    );
  } catch {
    return new ApiError(response.status, response.statusText || 'Network error', 'ERROR');
  }
}

/**
 * Exchanges the httpOnly refresh cookie for a new access token. Concurrent callers
 * share the same in-flight request so the refresh token is rotated only once.
 */
export function refreshSession(): Promise<SessionPayload | null> {
  refreshPromise ??= (async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        setAccessToken(null);
        return null;
      }
      const body = (await response.json()) as { data: SessionPayload };
      setAccessToken(body.data.accessToken);
      return body.data;
    } catch {
      return null;
    } finally {
      setTimeout(() => {
        refreshPromise = null;
      }, 0);
    }
  })();
  return refreshPromise;
}

async function rawRequest(
  path: string,
  options: RequestOptions,
  init: RequestInit,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(buildUrl(path, options.query), {
    ...init,
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    signal: options.signal,
  });

  if (response.status === 401 && !options.retried && !path.startsWith('/api/auth/')) {
    const session = await refreshSession();
    if (session) return rawRequest(path, { ...options, retried: true }, init);
    unauthorizedListeners.forEach((listener) => listener());
  }
  return response;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const isForm = options.body instanceof FormData;
  const response = await rawRequest(path, options, {
    headers:
      isForm || options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: isForm
      ? (options.body as FormData)
      : options.body === undefined
        ? undefined
        : JSON.stringify(options.body),
  });
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  async get<T>(path: string, query?: Record<string, QueryValue>, signal?: AbortSignal): Promise<T> {
    return (await request<{ data: T }>(path, { query, signal })).data;
  },
  async list<T, M = Paginated<T>['meta']>(
    path: string,
    query?: Record<string, QueryValue>,
    signal?: AbortSignal,
  ) {
    const body = await request<{ data: T[]; meta: M }>(path, { query, signal });
    return { data: body.data, meta: body.meta };
  },
  async post<T>(path: string, body?: unknown): Promise<T> {
    return (await request<{ data: T }>(path, { method: 'POST', body })).data;
  },
  async put<T>(path: string, body?: unknown): Promise<T> {
    return (await request<{ data: T }>(path, { method: 'PUT', body })).data;
  },
  async patch<T>(path: string, body?: unknown): Promise<T> {
    return (await request<{ data: T }>(path, { method: 'PATCH', body })).data;
  },
  async delete(path: string, query?: Record<string, QueryValue>): Promise<void> {
    await request<unknown>(path, { method: 'DELETE', query });
  },
  /** Authenticated binary download (documents are never publicly reachable). */
  async blob(path: string, query?: Record<string, QueryValue>): Promise<Blob> {
    const response = await rawRequest(path, { query }, {});
    if (!response.ok) throw await parseError(response);
    return response.blob();
  },
};
