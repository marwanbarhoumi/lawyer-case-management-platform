'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { RoleGate } from '@/components/auth/role-gate';
import { CaseForm } from '@/components/cases/case-form';
import { PageHeader } from '@/components/shared/page-header';
import { ErrorState, PageSkeleton } from '@/components/shared/states';
import { casesService } from '@/services/resources';

export default function EditCasePage() {
  const t = useTranslations('cases');
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['cases', id],
    queryFn: () => casesService.get(id),
  });

  return (
    <RoleGate roles={['ADMIN', 'LAWYER']}>
      {isLoading ? (
        <PageSkeleton />
      ) : error || !data ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <div className="mx-auto max-w-4xl">
          <PageHeader
            title={t('editTitle')}
            description={`${data.referenceNumber} — ${data.title}`}
          />
          <CaseForm initial={data} />
        </div>
      )}
    </RoleGate>
  );
}
