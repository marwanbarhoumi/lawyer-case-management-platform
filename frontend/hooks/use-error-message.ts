'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api-client';

type ErrorKey = Parameters<ReturnType<typeof useTranslations<'errors'>>>[0];

/** Maps API error codes to translated, user-friendly messages. */
export function useErrorMessage() {
  const t = useTranslations('errors');
  return useCallback(
    (error: unknown): string => {
      if (error instanceof ApiError) {
        const key = error.errorCode as ErrorKey;
        if (t.has(key)) return t(key);
        if (error.status === 403) return t('FORBIDDEN');
        if (error.status === 404) return t('NOT_FOUND');
        return t('generic');
      }
      if (error instanceof TypeError) return t('network');
      return t('generic');
    },
    [t],
  );
}

/** Returns a handler that shows a translated error toast. */
export function useErrorToast() {
  const message = useErrorMessage();
  return useCallback((error: unknown) => toast.error(message(error)), [message]);
}
