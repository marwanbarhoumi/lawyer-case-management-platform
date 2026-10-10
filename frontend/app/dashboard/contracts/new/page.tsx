'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { RoleGate } from '@/components/auth/role-gate';
import { ContractForm } from '@/components/contracts/contract-form';
import { PageHeader } from '@/components/shared/page-header';
import { PageSkeleton } from '@/components/shared/states';
import { Card, CardContent } from '@/components/ui/card';
import { casesService, clientsService } from '@/services/resources';

export default function NewContractPage() {
  const t = useTranslations('contracts');
  const router = useRouter();
  const params = useSearchParams();
  const clientId = params.get('clientId');
  const caseId = params.get('caseId');
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
  const loading = (clientId && clientQuery.isLoading) || (caseId && caseQuery.isLoading);
  const linkedCase = caseQuery.data;

  return (
    <RoleGate roles={['ADMIN', 'LAWYER']}>
      <div className="mx-auto max-w-3xl">
        <PageHeader title={t('newTitle')} />
        {loading ? (
          <PageSkeleton />
        ) : (
          <Card>
            <CardContent>
              <ContractForm
                initialClient={clientQuery.data ?? linkedCase?.client}
                initialCase={
                  linkedCase
                    ? {
                        id: linkedCase.id,
                        label: `${linkedCase.referenceNumber} — ${linkedCase.title}`,
                      }
                    : undefined
                }
                onSaved={(contract) => router.push(`/dashboard/contracts/${contract.id}`)}
                onCancel={() => router.back()}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </RoleGate>
  );
}
