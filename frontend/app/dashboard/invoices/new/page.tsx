'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { RoleGate } from '@/components/auth/role-gate';
import { InvoiceForm } from '@/components/invoices/invoice-form';
import { PageHeader } from '@/components/shared/page-header';
import { PageSkeleton } from '@/components/shared/states';
import { useSettings } from '@/hooks/use-format';
import { casesService, clientsService } from '@/services/resources';

export default function NewInvoicePage() {
  const t = useTranslations('invoices');
  const router = useRouter();
  const params = useSearchParams();
  const clientId = params.get('clientId');
  const caseId = params.get('caseId');
  const settings = useSettings();
  const clientQuery = useQuery({
    queryKey: ['clients', clientId],
    queryFn: () => clientsService.get(clientId as string),
    enabled: Boolean(clientId),
  });
  const caseQuery = useQuery({
    queryKey: ['cases', caseId],
    queryFn: () => casesService.get(caseId as string),
    enabled: Boolean(caseId),
  });
  const loading =
    settings.isLoading || (clientId && clientQuery.isLoading) || (caseId && caseQuery.isLoading);
  const linkedCase = caseQuery.data;

  return (
    <RoleGate roles={['ADMIN', 'LAWYER']}>
      <div className="mx-auto max-w-5xl">
        <PageHeader title={t('newTitle')} />
        {loading ? (
          <PageSkeleton />
        ) : (
          <InvoiceForm
            initialClient={clientQuery.data ?? linkedCase?.client}
            initialCase={
              linkedCase
                ? {
                    id: linkedCase.id,
                    label: `${linkedCase.referenceNumber} — ${linkedCase.title}`,
                  }
                : undefined
            }
            onSaved={(invoice) => router.push(`/dashboard/invoices/${invoice.id}`)}
            onCancel={() => router.back()}
          />
        )}
      </div>
    </RoleGate>
  );
}
