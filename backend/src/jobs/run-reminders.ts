/**
 * Standalone entry point for scheduled reminders.
 * Scheduler command (GitHub Actions `reminders.yml`): `npm run job:reminders` (after `npm run build`).
 */
import { prisma } from '../config/prisma';
import { runReminderJob } from '../services/reminder.service';

runReminderJob()
  .then((result) => {
    console.log(JSON.stringify({ level: 'info', message: 'Reminder job finished', ...result }));
    process.exitCode = 0;
  })
  .catch((error: unknown) => {
    console.error(
      JSON.stringify({ level: 'error', message: 'Reminder job failed', error: String(error) }),
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
