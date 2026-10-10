'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsService } from '@/services/resources';

export const notificationKeys = {
  all: ['notifications'] as const,
  unread: ['notifications', 'unread-count'] as const,
  list: (params: object) => ['notifications', 'list', params] as const,
};

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: notificationsService.unreadCount,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useNotificationsList(
  params: { page?: number; pageSize?: number; unreadOnly?: boolean; type?: string[] },
  enabled = true,
) {
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () => notificationsService.list(params),
    enabled,
  });
}

export function useNotificationMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: notificationKeys.all });
  return {
    markRead: useMutation({ mutationFn: notificationsService.markRead, onSuccess: invalidate }),
    markAllRead: useMutation({
      mutationFn: notificationsService.markAllRead,
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: notificationsService.remove, onSuccess: invalidate }),
  };
}
