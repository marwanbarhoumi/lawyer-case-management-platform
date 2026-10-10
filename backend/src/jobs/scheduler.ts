import cron, { type ScheduledTask } from 'node-cron';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { runReminderJob } from '../services/reminder.service';

/**
 * Optional in-process scheduler (Docker / single instance). Reminders are idempotent
 * thanks to notification dedupe keys, so running it alongside the Render Cron Job
 * or on several instances never produces duplicates.
 */
export function startScheduler(): ScheduledTask | null {
  if (!env.ENABLE_IN_PROCESS_SCHEDULER) return null;
  if (!cron.validate(env.REMINDER_CRON)) {
    logger.error('Invalid REMINDER_CRON expression, scheduler disabled', {
      cron: env.REMINDER_CRON,
    });
    return null;
  }
  const run = async () => {
    try {
      await runReminderJob();
    } catch (error) {
      logger.error('Reminder job failed', { error });
    }
  };
  const task = cron.schedule(env.REMINDER_CRON, run, {
    timezone: env.APP_TIMEZONE,
    noOverlap: true,
  });
  logger.info('In-process reminder scheduler started', { cron: env.REMINDER_CRON });
  void run();
  return task;
}
