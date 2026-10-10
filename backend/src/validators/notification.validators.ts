import { z } from 'zod';
import { NotificationType } from '@prisma/client';
import { csvEnum } from '../utils/pagination';
import { booleanQuery } from './common';

const typeValues = Object.values(NotificationType) as [NotificationType, ...NotificationType[]];

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: booleanQuery,
  type: csvEnum(typeValues),
});

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
