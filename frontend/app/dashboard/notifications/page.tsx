'use client';

import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { NotificationIcon } from '@/components/notifications/notification-icon';
import { useNotificationView } from '@/components/notifications/notification-view';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Pagination } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState, ErrorState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useErrorToast } from '@/hooks/use-error-message';
import { useFormat } from '@/hooks/use-format';
import { useListState } from '@/hooks/use-list-state';
import { notificationKeys, useNotificationMutations } from '@/hooks/use-notifications';
import { cn } from '@/lib/utils';
import { notificationsService } from '@/services/resources';
import { NOTIFICATION_TYPES, type NotificationType } from '@/types/api';

const FILTERS = ['unread', 'type'] as const;

export default function NotificationsPage() {
  const t = useTranslations('notifications');
  const common = useTranslations('common');
  const enums = useTranslations('enums.notificationType');
  const format = useFormat();
  const view = useNotificationView();
  const showError = useErrorToast();
  const list = useListState({ sortBy: 'createdAt', pageSize: 20, filters: FILTERS });
  const unreadOnly = list.filters.unread === 'true';
  const type = list.filters.type as NotificationType | undefined;
  const params = {
    page: list.page,
    pageSize: list.pageSize,
    unreadOnly,
    type: type ? [type] : undefined,
  };
  const { markRead, markAllRead, remove } = useNotificationMutations();

  const query = useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () => notificationsService.list(params),
    placeholderData: keepPreviousData,
  });
  const unread = query.data?.meta.unreadCount ?? 0;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t('title')}
        description={`${t('subtitle')} — ${t('unreadCount', { count: unread })}`}
        actions={
          <Button
            variant="outline"
            disabled={unread === 0}
            loading={markAllRead.isPending}
            onClick={() =>
              markAllRead.mutate(undefined, {
                onSuccess: () => toast.success(t('allMarked')),
                onError: showError,
              })
            }
          >
            <CheckCheck /> {t('markAllRead')}
          </Button>
        }
      />
      <Card className="gap-0 py-0">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--navy)]"
              checked={unreadOnly}
              onChange={(event) =>
                list.setFilter('unread', event.target.checked ? 'true' : undefined)
              }
            />
            {t('unreadOnly')}
          </label>
          <NativeSelect
            aria-label={common('type')}
            className="sm:ms-auto sm:w-60"
            value={type ?? ''}
            onChange={(event) => list.setFilter('type', event.target.value || undefined)}
          >
            <option value="">
              {common('type')} — {common('all')}
            </option>
            {NOTIFICATION_TYPES.map((value) => (
              <option key={value} value={value}>
                {enums(value)}
              </option>
            ))}
          </NativeSelect>
        </div>

        {query.isLoading && (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        )}
        {query.error && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
        {query.data?.data.length === 0 && <EmptyState title={t('empty')} icon={Bell} />}
        <ul className="divide-y">
          {query.data?.data.map((notification) => {
            const { title, message, href } = view(notification);
            return (
              <li
                key={notification.id}
                className={cn('flex gap-3 px-4 py-4', !notification.isRead && 'bg-accent/30')}
              >
                <NotificationIcon type={notification.type} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {href ? (
                      <Link
                        href={href}
                        className="hover:underline"
                        onClick={() => !notification.isRead && markRead.mutate(notification.id)}
                      >
                        {title}
                      </Link>
                    ) : (
                      title
                    )}
                    {!notification.isRead && (
                      <span className="bg-gold size-2 rounded-full" aria-label={t('unreadOnly')} />
                    )}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-sm">{message}</p>
                  <time
                    dateTime={notification.createdAt}
                    className="text-muted-foreground mt-1 block text-xs"
                    title={format.dateTime(notification.createdAt)}
                  >
                    {format.relative(notification.createdAt)}
                  </time>
                </div>
                <div className="flex shrink-0 items-start gap-1">
                  {!notification.isRead && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t('markRead')}
                      title={t('markRead')}
                      onClick={() => markRead.mutate(notification.id, { onError: showError })}
                    >
                      <Check />
                    </Button>
                  )}
                  <ConfirmDialog
                    title={t('deleteTitle')}
                    confirmLabel={common('delete')}
                    onConfirm={() => remove.mutateAsync(notification.id, { onError: showError })}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={common('delete')}
                        title={common('delete')}
                      >
                        <Trash2 />
                      </Button>
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <Pagination
          meta={query.data?.meta}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
        />
      </Card>
    </div>
  );
}
