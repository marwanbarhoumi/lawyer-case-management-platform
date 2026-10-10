'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  Eye,
  FileImage,
  FileSpreadsheet,
  FileText,
  File as FileIcon,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { z } from 'zod';
import { useAuth } from '@/components/providers/auth-provider';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable, type Column } from '@/components/shared/data-table';
import { FormField } from '@/components/shared/form-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input, NativeSelect } from '@/components/ui/input';
import { useErrorToast } from '@/hooks/use-error-message';
import { useFormat } from '@/hooks/use-format';
import { saveBlob } from '@/lib/files';
import { formatFileSize, fullName } from '@/lib/utils';
import { requiredString } from '@/lib/validation';
import { documentsService } from '@/services/resources';
import { DOCUMENT_TYPES, type DocumentItem } from '@/types/api';
import { DocumentPreviewDialog } from './document-preview-dialog';

function MimeIcon({ mimeType }: { mimeType: string }) {
  const Icon = mimeType.startsWith('image/')
    ? FileImage
    : mimeType.includes('sheet') || mimeType.includes('excel')
      ? FileSpreadsheet
      : mimeType === 'application/pdf' || mimeType.includes('word') || mimeType === 'text/plain'
        ? FileText
        : FileIcon;
  return (
    <span className="bg-secondary text-navy flex size-9 shrink-0 items-center justify-center rounded-md">
      <Icon className="size-4" aria-hidden />
    </span>
  );
}

const renameSchema = z.object({ name: requiredString(200), type: z.enum(DOCUMENT_TYPES) });
type RenameValues = z.infer<typeof renameSchema>;

function RenameDialog({
  document,
  onClose,
}: {
  document: DocumentItem | null;
  onClose: () => void;
}) {
  const t = useTranslations('documents');
  const common = useTranslations('common');
  const enums = useTranslations('enums.documentType');
  const queryClient = useQueryClient();
  const showError = useErrorToast();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RenameValues>({
    resolver: zodResolver(renameSchema),
    values: document ? { name: document.name, type: document.type } : undefined,
  });
  const mutation = useMutation({
    mutationFn: (values: RenameValues) => documentsService.update(document?.id ?? '', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success(common('saved'));
      onClose();
    },
    onError: showError,
  });

  return (
    <Dialog open={Boolean(document)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('renameTitle')}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="grid gap-4"
          noValidate
        >
          <FormField label={t('name')} error={errors.name}>
            <Input {...register('name')} />
          </FormField>
          <FormField label={t('category')} error={errors.type}>
            <NativeSelect {...register('type')}>
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {enums(type)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {common('cancel')}
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {common('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DocumentsTableProps {
  data: DocumentItem[] | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  showLink?: boolean;
  empty?: { title: string; description?: string; action?: React.ReactNode };
}

export function DocumentsTable({
  data,
  isLoading,
  error,
  onRetry,
  sortBy,
  sortOrder,
  onSort,
  showLink = true,
  empty,
}: DocumentsTableProps) {
  const t = useTranslations('documents');
  const common = useTranslations('common');
  const enums = useTranslations('enums.documentType');
  const format = useFormat();
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const showError = useErrorToast();
  const [preview, setPreview] = useState<DocumentItem | null>(null);
  const [editing, setEditing] = useState<DocumentItem | null>(null);

  const download = async (document: DocumentItem) => {
    try {
      saveBlob(await documentsService.file(document.id), document.name);
    } catch (downloadError) {
      showError(downloadError);
    }
  };

  const remove = useMutation({
    mutationFn: documentsService.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success(common('deleted'));
    },
    onError: showError,
  });

  const canDelete = (document: DocumentItem) =>
    hasRole('ADMIN', 'LAWYER') || document.uploadedBy === user?.id;

  const columns: Column<DocumentItem>[] = [
    {
      key: 'name',
      header: common('name'),
      sortKey: 'name',
      cell: (document) => (
        <div className="flex min-w-0 items-center gap-3">
          <MimeIcon mimeType={document.mimeType} />
          <div className="min-w-0">
            <button
              type="button"
              className="text-navy block max-w-xs truncate text-start font-medium hover:underline"
              onClick={() => setPreview(document)}
            >
              {document.name}
            </button>
            <p className="text-muted-foreground text-xs">{formatFileSize(document.size)}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: t('category'),
      hideBelow: 'sm',
      cell: (document) => <Badge variant="secondary">{enums(document.type)}</Badge>,
    },
  ];
  if (showLink) {
    columns.push({
      key: 'link',
      header: t('linkTo'),
      hideBelow: 'md',
      cell: (document) =>
        document.case ? (
          <Link href={`/dashboard/cases/${document.case.id}`} className="text-sm hover:underline">
            {document.case.referenceNumber}
          </Link>
        ) : document.client ? (
          <Link
            href={`/dashboard/clients/${document.client.id}`}
            className="text-sm hover:underline"
          >
            {fullName(document.client)}
          </Link>
        ) : (
          '—'
        ),
    });
  }
  columns.push(
    {
      key: 'uploader',
      header: t('uploadedBy'),
      hideBelow: 'lg',
      cell: (document) => (document.uploader ? fullName(document.uploader) : '—'),
    },
    {
      key: 'createdAt',
      header: t('uploadedAt'),
      sortKey: 'createdAt',
      hideBelow: 'md',
      cell: (document) => format.date(document.createdAt),
    },
    {
      key: 'actions',
      header: common('actions'),
      className: 'text-end',
      cell: (document) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`${common('preview')} — ${document.name}`}
            onClick={() => setPreview(document)}
          >
            <Eye />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`${common('download')} — ${document.name}`}
            onClick={() => download(document)}
          >
            <Download />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`${common('rename')} — ${document.name}`}
            onClick={() => setEditing(document)}
          >
            <Pencil />
          </Button>
          {canDelete(document) && (
            <ConfirmDialog
              title={t('deleteTitle')}
              description={t('deleteDescription')}
              confirmLabel={common('delete')}
              onConfirm={() => remove.mutateAsync(document.id)}
              trigger={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive"
                  aria-label={`${common('delete')} — ${document.name}`}
                >
                  <Trash2 />
                </Button>
              }
            />
          )}
        </div>
      ),
    },
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        rowKey={(document) => document.id}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={onSort}
        empty={empty}
      />
      <DocumentPreviewDialog
        document={preview}
        onOpenChange={(open) => !open && setPreview(null)}
        onDownload={download}
      />
      <RenameDialog document={editing} onClose={() => setEditing(null)} />
    </>
  );
}
