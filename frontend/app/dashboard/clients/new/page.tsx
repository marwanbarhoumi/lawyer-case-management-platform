'use client';

import { useTranslations } from 'next-intl';
import { RoleGate } from '@/components/auth/role-gate';
import { ClientForm } from '@/components/clients/client-form';
import { PageHeader } from '@/components/shared/page-header';

export default function NewClientPage() {
  const t = useTranslations('clients');
  return (
    <RoleGate roles={['ADMIN', 'LAWYER']}>
      <div className="mx-auto max-w-3xl">
        <PageHeader title={t('newTitle')} />
        <ClientForm />
      </div>
    </RoleGate>
  );
}
