'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { BellRing } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { HearingForm } from '@/components/hearings/hearing-form';
import { PageHeader } from '@/components/shared/page-header';
import { PageSkeleton } from '@/components/shared/states';
import { Card, CardContent } from '@/components/ui/card';
import { casesService } from '@/services/resources';

export default function NewHearingPage() {
  const t = useTranslations('hearings');
  const router = useRouter();
  const caseId = useSearchParams().get('caseId');
  const { data: linkedCase, isLoading } = useQuery({
    queryKey: ['cases', caseId],
    queryFn: () => casesService.get(caseId as string),
    enabled: Boolean(caseId),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('newTitle')} />
      <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <BellRing className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t('remindersText')}
      </p>
      {caseId && isLoading ? (
        <PageSkeleton />
      ) : (
        <Card>
          <CardContent>
            <HearingForm
              initialCase={
                linkedCase
                  ? {
                      id: linkedCase.id,
                      label: `${linkedCase.referenceNumber} — ${linkedCase.title}`,
                    }
                  : undefined
              }
              onSaved={(hearing) => router.push(`/dashboard/hearings/${hearing.id}`)}
              onCancel={() => router.back()}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
