'use client';

import { useTranslations } from 'next-intl';
import { useFormat, useSettings } from '@/hooks/use-format';
import { daysUntil } from '@/lib/dates';
import type { Contract } from '@/types/api';

/** "Expires in N days" / "Expired on …" helper text, highlighted inside the warning window. */
export function ContractExpiry({ contract }: { contract: Pick<Contract, 'endDate' | 'status'> }) {
  const t = useTranslations('contracts');
  const common = useTranslations('common');
  const format = useFormat();
  const { data: settings } = useSettings();
  if (!contract.endDate)
    return <span className="text-muted-foreground text-xs">{t('noEndDate')}</span>;

  const days = daysUntil(contract.endDate);
  if (days < 0 || contract.status === 'EXPIRED') {
    return (
      <span className="text-destructive text-xs">
        {t('expiredOn', { date: format.date(contract.endDate) })}
      </span>
    );
  }
  const warning = days <= (settings?.contractExpiryWarningDays ?? 30);
  return (
    <span
      className={
        warning && contract.status === 'ACTIVE'
          ? 'text-xs font-medium text-amber-700'
          : 'text-muted-foreground text-xs'
      }
    >
      {t('expiresIn', { when: common('inDays', { count: days }) })}
    </span>
  );
}
