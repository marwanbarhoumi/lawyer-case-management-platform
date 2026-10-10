import type { Request, Response } from 'express';
import { currentUser } from '../middleware/auth';
import { getDashboardStats } from '../services/dashboard.service';
import { runReminderJob } from '../services/reminder.service';
import { getReports } from '../services/report.service';
import { getSettings, updateSettings } from '../services/settings.service';
import { sendSuccess } from '../utils/response';
import { reportQuerySchema, updateSettingsSchema } from '../validators/settings.validators';

export async function dashboard(req: Request, res: Response) {
  sendSuccess(res, await getDashboardStats(currentUser(req)));
}

export async function reports(req: Request, res: Response) {
  sendSuccess(res, await getReports(currentUser(req), reportQuerySchema.parse(req.query)));
}

export async function readSettings(_req: Request, res: Response) {
  const settings = await getSettings();
  sendSuccess(res, { ...settings, defaultTaxRate: Number(settings.defaultTaxRate) });
}

export async function writeSettings(req: Request, res: Response) {
  const settings = await updateSettings(currentUser(req), updateSettingsSchema.parse(req.body));
  sendSuccess(res, { ...settings, defaultTaxRate: Number(settings.defaultTaxRate) });
}

export async function triggerReminders(_req: Request, res: Response) {
  sendSuccess(res, await runReminderJob());
}
