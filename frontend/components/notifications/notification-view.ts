'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useFormat } from '@/hooks/use-format';
import type { NotificationItem } from '@/types/api';

/** Builds a localised title / message / link from the structured notification data. */
export function useNotificationView() {
  const t = useTranslations('notifications');
  const enums = useTranslations('enums');
  const format = useFormat();

  return useCallback(
    (notification: NotificationItem) => {
      const data = notification.data ?? {};
      const str = (key: string) =>
        data[key] === null || data[key] === undefined ? '' : String(data[key]);
      let title = notification.title;
      let message = notification.message;

      switch (notification.type) {
        case 'HEARING_REMINDER':
          if (data.stage) {
            title = t('titles.HEARING_REMINDER', { stage: str('stage'), days: str('daysUntil') });
            message = [
              `${str('reference')} — ${str('caseTitle')}`,
              data.date ? `${format.date(str('date'))} · ${str('time')}` : '',
              str('court'),
            ]
              .filter(Boolean)
              .join(' · ');
          }
          break;
        case 'CONTRACT_EXPIRING':
          title = t('titles.CONTRACT_EXPIRING');
          if (data.endDate) {
            message = `${str('title')} — ${str('clientName')} · ${t('endsOn', { date: format.date(str('endDate')) })}`;
          }
          break;
        case 'INVOICE_DUE':
        case 'INVOICE_OVERDUE':
          title = t(`titles.${notification.type}`);
          if (data.dueDate) {
            message = [
              `${str('invoiceNumber')} — ${str('clientName')}`,
              t('dueOn', { date: format.date(str('dueDate')) }),
              t('balance', { amount: format.money(Number(data.balance ?? 0)) }),
            ].join(' · ');
          }
          break;
        case 'CASE_UPDATED':
          title = t('titles.CASE_UPDATED', { event: str('event') || 'updated' });
          if (data.reference) {
            const status = str('status');
            message = `${str('reference')} — ${str('title')}${
              data.event === 'status' && status
                ? ` · ${enums(`caseStatus.${status}` as 'caseStatus.OPEN')}`
                : ''
            }${data.event === 'hearing_scheduled' && data.date ? ` · ${format.date(str('date'))} ${str('time')}` : ''}`;
          }
          break;
        case 'DOCUMENT_UPLOADED':
          title = t('titles.DOCUMENT_UPLOADED');
          if (data.name) message = [str('name'), str('reference')].filter(Boolean).join(' — ');
          break;
      }

      return { title, message, href: notificationHref(notification) };
    },
    [t, enums, format],
  );
}

export function notificationHref(notification: NotificationItem): string | null {
  const id = notification.relatedEntityId;
  if (!id) return null;
  switch (notification.relatedEntity) {
    case 'HEARING':
      return `/dashboard/hearings/${id}`;
    case 'CASE':
      return `/dashboard/cases/${id}`;
    case 'CLIENT':
      return `/dashboard/clients/${id}`;
    case 'CONTRACT':
      return `/dashboard/contracts/${id}`;
    case 'INVOICE':
      return `/dashboard/invoices/${id}`;
    case 'DOCUMENT': {
      const caseId = notification.data?.caseId;
      return caseId ? `/dashboard/cases/${caseId}` : '/dashboard/documents';
    }
    default:
      return null;
  }
}
