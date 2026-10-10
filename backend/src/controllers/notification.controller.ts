import type { Request, Response } from 'express';
import { currentUser } from '../middleware/auth';
import * as notificationService from '../services/notification.service';
import { sendNoContent, sendSuccess } from '../utils/response';
import { idParamSchema } from '../validators/common';
import { notificationListQuerySchema } from '../validators/notification.validators';

export async function list(req: Request, res: Response) {
  const { items, meta } = await notificationService.listNotifications(
    currentUser(req),
    notificationListQuerySchema.parse(req.query),
  );
  res.json({ success: true, data: items, meta });
}

export async function unreadCount(req: Request, res: Response) {
  sendSuccess(res, { count: await notificationService.unreadCount(currentUser(req)) });
}

export async function markRead(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  sendSuccess(res, await notificationService.markAsRead(currentUser(req), id));
}

export async function markAllRead(req: Request, res: Response) {
  sendSuccess(res, { updated: await notificationService.markAllAsRead(currentUser(req)) });
}

export async function remove(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  await notificationService.deleteNotification(currentUser(req), id);
  sendNoContent(res);
}
