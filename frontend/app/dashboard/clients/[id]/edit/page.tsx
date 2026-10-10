'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { RoleGate } from '@/components/auth/role-gate';
import { ClientForm } from '@/components/clients/client-form';
import { PageHeader } from '@/components/shared/page-header';
import { ErrorState, PageSkeleton } from '@/components/shared/states';
import { fullName } from '@/lib/utils';
import { clientsService } from '@/services/resources';

export default function EditClientPage() {
  const t = useTranslations('clients');
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['clients', id],
    queryFn: () => clientsService.get(id),
  });

  return (
    <RoleGate roles={['ADMIN', 'LAWYER']}>
      {isLoading ? (
        <PageSkeleton />
      ) : error || !data ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <div className="mx-auto max-w-3xl">
          <PageHeader title={t('editTitle')} description={fullName(data)} />
          <ClientForm client={data} />
        </div>
      )}
    </RoleGate>
  );
}
