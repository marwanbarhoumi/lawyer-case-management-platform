'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Eye, FileSignature, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { RoleGate } from '@/components/auth/role-gate';
import { ContractExpiry } from '@/components/contracts/contract-expiry';
import { ContractForm } from '@/components/contracts/contract-form';
import {
  DocumentPreviewDialog,
  type PreviewableDocument,
} from '@/components/documents/document-preview-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { ErrorState, PageSkeleton } from '@/components/shared/states';
import { ContractStatusBadge } from '@/components/shared/status-badges';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useErrorToast } from '@/hooks/use-error-message';
import { useFormat } from '@/hooks/use-format';
import { saveBlob } from '@/lib/files';
import { formatFileSize, fullName } from '@/lib/utils';
import { contractsService, documentsService } from '@/services/resources';

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 text-sm">{children || '—'}</dd>
    </div>
  );
}

function ContractDetail() {
  const t = useTranslations('contracts');
  const common = useTranslations('common');
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const format = useFormat();
  const queryClient = useQueryClient();
  const showError = useErrorToast();
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState<PreviewableDocument | null>(null);
  const {
    data: contract,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['contracts', id],
    queryFn: () => contractsService.get(id),
  });

  const remove = useMutation({
    mutationFn: () => contractsService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast.success(common('deleted'));
      router.replace('/dashboard/contracts');
    },
    onError: showError,
  });

  if (isLoading) return <PageSkeleton />;
  if (error || !contract) return <ErrorState error={error} onRetry={() => refetch()} />;

  const document = contract.document;
  const download = async () => {
    if (!document) return;
    try {
      saveBlob(await documentsService.file(document.id), document.name);
    } catch (downloadError) {
      showError(downloadError);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {contract.title}
            <ContractStatusBadge status={contract.status} />
          </span>
        }
        description={<ContractExpiry contract={contract} />}
        actions={
          !editing && (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> {common('edit')}
              </Button>
              <ConfirmDialog
                title={t('deleteTitle')}
                description={t('deleteDescription')}
                confirmLabel={common('delete')}
                onConfirm={() => remove.mutateAsync()}
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    aria-label={common('delete')}
                  >
                    <Trash2 />
                  </Button>
                }
              />
            </>
          )
        }
      />
      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('editTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ContractForm
              contract={contract}
              onSaved={() => {
                setEditing(false);
                refetch();
              }}
              onCancel={() => setEditing(false)}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{common('details')}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-5 sm:grid-cols-2">
                <Detail label={t('client')}>
                  <Link
                    href={`/dashboard/clients/${contract.client.id}`}
                    className="text-navy font-medium hover:underline"
                  >
                    {fullName(contract.client)}
                  </Link>
                </Detail>
                <Detail label={t('case')}>
                  {contract.case && (
                    <Link href={`/dashboard/cases/${contract.case.id}`} className="hover:underline">
                      {contract.case.referenceNumber} — {contract.case.title}
                    </Link>
                  )}
                </Detail>
                <Detail label={t('startDate')}>{format.date(contract.startDate)}</Detail>
                <Detail label={t('endDate')}>
                  {contract.endDate ? format.date(contract.endDate) : t('noEndDate')}
                </Detail>
                <Detail label={t('value')}>
                  {contract.value ? format.money(contract.value) : null}
                </Detail>
              </dl>
              {contract.description && (
                <div className="bg-muted/60 mt-6 rounded-lg p-4">
                  <p className="text-muted-foreground mb-1 text-xs font-medium">
                    {t('description')}
                  </p>
                  <p className="text-sm whitespace-pre-line">{contract.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSignature className="text-gold size-4" aria-hidden />
                {t('document')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {document ? (
                <div className="space-y-3">
                  <div>
                    <p className="truncate text-sm font-medium">{document.name}</p>
                    <p className="text-muted-foreground text-xs">{formatFileSize(document.size)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPreview(document)}>
                      <Eye /> {common('preview')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={download}>
                      <Download /> {common('download')}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">{t('attachHint')}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      <DocumentPreviewDialog
        document={preview}
        onOpenChange={(open) => !open && setPreview(null)}
        onDownload={download}
      />
    </div>
  );
}

export default function ContractDetailPage() {
  return (
    <RoleGate roles={['ADMIN', 'LAWYER']}>
      <ContractDetail />
    </RoleGate>
  );
}
