'use client';

import { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ErrorState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { canPreview } from '@/lib/files';
import { formatFileSize } from '@/lib/utils';
import { documentsService } from '@/services/resources';
import type { DocumentItem } from '@/types/api';

/**
 * Previews a document through an authenticated request (blob URL):
 * files are never exposed through public links.
 */
export type PreviewableDocument = Pick<DocumentItem, 'id' | 'name' | 'mimeType' | 'size'>;

export function DocumentPreviewDialog<T extends PreviewableDocument>({
  document,
  onOpenChange,
  onDownload,
}: {
  document: T | null;
  onOpenChange: (open: boolean) => void;
  onDownload: (document: T) => void;
}) {
  const t = useTranslations('documents');
  const common = useTranslations('common');
  const [state, setState] = useState<{
    url: string | null;
    text: string | null;
    error: unknown;
    loading: boolean;
  }>({
    url: null,
    text: null,
    error: null,
    loading: false,
  });
  const kind = document ? canPreview(document.mimeType) : null;

  useEffect(() => {
    if (!document || !kind) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    setState({ url: null, text: null, error: null, loading: true });
    documentsService
      .file(document.id, true)
      .then(async (blob) => {
        if (cancelled) return;
        if (kind === 'text') {
          setState({ url: null, text: await blob.text(), error: null, loading: false });
        } else {
          objectUrl = URL.createObjectURL(blob);
          setState({ url: objectUrl, text: null, error: null, loading: false });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ url: null, text: null, error, loading: false });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [document, kind]);

  return (
    <Dialog open={Boolean(document)} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] flex-col sm:max-w-4xl">
        <DialogHeader className="pe-8">
          <DialogTitle className="truncate">{document?.name}</DialogTitle>
          <DialogDescription>{document ? formatFileSize(document.size) : ''}</DialogDescription>
        </DialogHeader>
        <div className="bg-muted/40 flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-lg border">
          {!kind && (
            <p className="text-muted-foreground max-w-sm p-6 text-center text-sm">
              {t('previewUnavailable')}
            </p>
          )}
          {kind && state.loading && (
            <Loader2
              className="text-muted-foreground size-6 animate-spin"
              aria-label={common('loading')}
            />
          )}
          {kind && state.error !== null && <ErrorState error={state.error} />}
          {kind === 'pdf' && state.url && (
            <iframe
              src={state.url}
              title={document?.name}
              className="size-full rounded-lg bg-white"
            />
          )}
          {kind === 'image' && state.url && (
            // eslint-disable-next-line @next/next/no-img-element -- blob URL of an authenticated download
            <img
              src={state.url}
              alt={document?.name ?? ''}
              className="max-h-full max-w-full object-contain"
            />
          )}
          {kind === 'text' && state.text !== null && (
            <pre
              className="size-full overflow-auto bg-white p-4 text-start text-sm whitespace-pre-wrap"
              dir="auto"
            >
              {state.text}
            </pre>
          )}
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => document && onDownload(document)}>
            <Download /> {common('download')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
