'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { NotificationIcon } from '@/components/notifications/notification-icon';
import { useNotificationView } from '@/components/notifications/notification-view';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { useFormat } from '@/hooks/use-format';
import {
  useNotificationMutations,
  useNotificationsList,
  useUnreadCount,
} from '@/hooks/use-notifications';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const t = useTranslations('notifications');
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const format = useFormat();
  const view = useNotificationView();
  const { data: unread } = useUnreadCount();
  const { data, isLoading } = useNotificationsList({ pageSize: 8 }, open);
  const { markRead, markAllRead } = useNotificationMutations();
  const count = unread?.count ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`${t('title')} — ${t('unreadCount', { count })}`}
        >
          <Bell />
          {count > 0 && (
            <span className="bg-destructive absolute -end-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] max-w-[calc(100vw-1rem)] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="font-semibold">{t('title')}</p>
            <p className="text-muted-foreground text-xs">{t('unreadCount', { count })}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={count === 0 || markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            <CheckCheck />
            <span className="sr-only sm:not-sr-only">{t('markAllRead')}</span>
          </Button>
        </div>
        <ul className="max-h-96 overflow-y-auto">
          {isLoading &&
            Array.from({ length: 3 }, (_, index) => (
              <li key={index} className="flex gap-3 px-4 py-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </li>
            ))}
          {data?.data.length === 0 && (
            <li className="text-muted-foreground px-4 py-8 text-center text-sm">{t('empty')}</li>
          )}
          {data?.data.map((notification) => {
            const { title, message, href } = view(notification);
            return (
              <li key={notification.id}>
                <button
                  type="button"
                  className={cn(
                    'hover:bg-muted focus-visible:bg-muted flex w-full gap-3 px-4 py-3 text-start transition-colors focus-visible:outline-none',
                    !notification.isRead && 'bg-accent/40',
                  )}
                  onClick={() => {
                    if (!notification.isRead) markRead.mutate(notification.id);
                    setOpen(false);
                    if (href) router.push(href);
                  }}
                >
                  <NotificationIcon type={notification.type} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {title}
                      {!notification.isRead && (
                        <span className="bg-gold size-1.5 rounded-full" aria-hidden />
                      )}
                    </span>
                    <span className="text-muted-foreground mt-0.5 line-clamp-2 block text-xs">
                      {message}
                    </span>
                    <span className="text-muted-foreground/80 mt-1 block text-[11px]">
                      {format.relative(notification.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="border-t p-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setOpen(false)}
          >
            <Link href="/dashboard/notifications">{t('viewAll')}</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
