'use client';

import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { RoleGate } from '@/components/auth/role-gate';
import { CaseForm } from '@/components/cases/case-form';
import { PageHeader } from '@/components/shared/page-header';
import { PageSkeleton } from '@/components/shared/states';
import { clientsService } from '@/services/resources';

export default function NewCasePage() {
  const t = useTranslations('cases');
  const clientId = useSearchParams().get('clientId');
  const { data: client, isLoading } = useQuery({
    queryKey: ['clients', clientId],
    queryFn: () => clientsService.get(clientId as string),
    enabled: Boolean(clientId),
  });

  return (
    <RoleGate roles={['ADMIN', 'LAWYER']}>
      <div className="mx-auto max-w-4xl">
        <PageHeader title={t('newTitle')} />
        {clientId && isLoading ? <PageSkeleton /> : <CaseForm initialClient={client} />}
      </div>
    </RoleGate>
  );
}
