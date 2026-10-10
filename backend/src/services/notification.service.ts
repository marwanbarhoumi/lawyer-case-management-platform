import type { EntityType, NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import type { AuthUser } from '../types/auth';
import { ApiError } from '../utils/api-error';
import { buildMeta, toSkipTake } from '../utils/pagination';
import type { NotificationListQuery } from '../validators/notification.validators';

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntity?: EntityType;
  relatedEntityId?: string;
  data?: Prisma.InputJsonValue;
  /** When provided, a notification with the same key is never created twice. */
  dedupeKey?: string;
}

/**
 * Creates notifications, silently skipping those whose dedupeKey already exists.
 * The unique index on `dedupeKey` guarantees idempotency even if two scheduler
 * runs overlap. Returns the number of notifications actually created.
 */
export async function createNotifications(inputs: NotificationInput[]): Promise<number> {
  if (inputs.length === 0) return 0;
  const result = await prisma.notification.createMany({
    data: inputs.map((input) => ({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      relatedEntity: input.relatedEntity,
      relatedEntityId: input.relatedEntityId,
      data: input.data,
      dedupeKey: input.dedupeKey,
    })),
    skipDuplicates: true,
  });
  return result.count;
}

/** Fire-and-forget variant used for event notifications that must not block a request. */
export async function notifyUsers(
  userIds: string[],
  payload: Omit<NotificationInput, 'userId'>,
  excludeUserId?: string,
): Promise<void> {
  const recipients = [...new Set(userIds)].filter((id) => id !== excludeUserId);
  try {
    await createNotifications(recipients.map((userId) => ({ ...payload, userId })));
  } catch (error) {
    logger.error('Failed to create notifications', { type: payload.type, error });
  }
}

export async function listNotifications(user: AuthUser, query: NotificationListQuery) {
  const where: Prisma.NotificationWhereInput = {
    userId: user.id,
    ...(query.unreadOnly ? { isRead: false } : {}),
    ...(query.type ? { type: { in: query.type } } : {}),
  };
  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...toSkipTake(query.page, query.pageSize),
      omit: { dedupeKey: true },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
  ]);
  return { items, meta: { ...buildMeta(query.page, query.pageSize, total), unreadCount } };
}

export async function unreadCount(user: AuthUser): Promise<number> {
  return prisma.notification.count({ where: { userId: user.id, isRead: false } });
}

export async function markAsRead(user: AuthUser, id: string) {
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== user.id) {
    throw ApiError.notFound('Notification not found', 'NOTIFICATION_NOT_FOUND');
  }
  return prisma.notification.update({
    where: { id },
    data: { isRead: true },
    omit: { dedupeKey: true },
  });
}

export async function markAllAsRead(user: AuthUser): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  });
  return result.count;
}

export async function deleteNotification(user: AuthUser, id: string): Promise<void> {
  const result = await prisma.notification.deleteMany({ where: { id, userId: user.id } });
  if (result.count === 0)
    throw ApiError.notFound('Notification not found', 'NOTIFICATION_NOT_FOUND');
}
