import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { calendarDay, calendarDaysBetween, startOfDay } from '../utils/dates';
import { createNotifications, type NotificationInput } from './notification.service';
import { getSettings } from './settings.service';

export type ReminderStage = '7d' | '3d' | '1d' | '0d';

/** Days before the hearing at which each reminder is sent. */
export const REMINDER_STAGES: ReadonlyArray<{ stage: ReminderStage; days: number }> = [
  { stage: '7d', days: 7 },
  { stage: '3d', days: 3 },
  { stage: '1d', days: 1 },
  { stage: '0d', days: 0 },
];

/**
 * Returns the reminder stage that applies `daysUntil` days before a hearing:
 * the closest stage not yet passed. A hearing created 2 days ahead therefore
 * immediately gets the "3 days" reminder, then "1 day" and "same day".
 */
export function reminderStageFor(daysUntil: number): ReminderStage | null {
  if (daysUntil < 0 || daysUntil > 7) return null;
  if (daysUntil === 0) return '0d';
  if (daysUntil <= 1) return '1d';
  if (daysUntil <= 3) return '3d';
  return '7d';
}

const hearingReminderInclude = {
  case: {
    select: {
      id: true,
      referenceNumber: true,
      title: true,
      court: true,
      lawyerId: true,
      assignments: { select: { userId: true } },
    },
  },
} satisfies Prisma.HearingInclude;

type HearingWithCase = Prisma.HearingGetPayload<{ include: typeof hearingReminderInclude }>;

function buildHearingReminders(hearing: HearingWithCase, now: Date): NotificationInput[] {
  const daysUntil = calendarDaysBetween(now, hearing.date);
  const stage = reminderStageFor(daysUntil);
  if (!stage) return [];
  const recipients = new Set([
    hearing.case.lawyerId,
    ...hearing.case.assignments.map((a) => a.userId),
  ]);
  const day = calendarDay(hearing.date);
  const court = hearing.court ?? hearing.case.court ?? '';
  const when = daysUntil === 0 ? 'today' : `in ${daysUntil} day(s)`;

  return [...recipients].map((userId) => ({
    userId,
    type: 'HEARING_REMINDER',
    title: `Hearing ${when}`,
    message: `${hearing.case.referenceNumber} — ${hearing.case.title}: ${day} ${hearing.time}${court ? ` (${court})` : ''}`,
    relatedEntity: 'HEARING',
    relatedEntityId: hearing.id,
    data: {
      stage,
      daysUntil,
      date: hearing.date.toISOString(),
      time: hearing.time,
      court,
      reference: hearing.case.referenceNumber,
      caseTitle: hearing.case.title,
      caseId: hearing.case.id,
    },
    dedupeKey: `hearing:${hearing.id}:${day}:${stage}:${userId}`,
  }));
}

async function markFinalReminders(hearings: HearingWithCase[], now: Date) {
  const sameDay = hearings.filter((hearing) => calendarDaysBetween(now, hearing.date) === 0);
  if (sameDay.length) {
    await prisma.hearing.updateMany({
      where: { id: { in: sameDay.map((hearing) => hearing.id) } },
      data: { reminderSent: true },
    });
  }
}

/** Sends due reminders for upcoming hearings (today .. +7 days). */
export async function processHearingReminders(now = new Date()): Promise<number> {
  const hearings = await prisma.hearing.findMany({
    where: {
      status: 'SCHEDULED',
      reminderSent: false,
      date: { gte: startOfDay(now), lt: startOfDay(now, 8) },
    },
    include: hearingReminderInclude,
  });
  const created = await createNotifications(
    hearings.flatMap((hearing) => buildHearingReminders(hearing, now)),
  );
  await markFinalReminders(hearings, now);
  return created;
}

/** Immediately evaluates reminders for one hearing (after create/update). */
export async function processHearingReminder(hearingId: string, now = new Date()): Promise<number> {
  const hearing = await prisma.hearing.findUnique({
    where: { id: hearingId },
    include: hearingReminderInclude,
  });
  if (!hearing || hearing.status !== 'SCHEDULED' || hearing.reminderSent) return 0;
  const created = await createNotifications(buildHearingReminders(hearing, now));
  await markFinalReminders([hearing], now);
  return created;
}

/** Flags contracts ending soon and marks ended ones as EXPIRED. */
export async function processContracts(now = new Date(), warningDays = 30) {
  const todayStart = startOfDay(now);
  const expired = await prisma.contract.updateMany({
    where: { status: 'ACTIVE', endDate: { lt: todayStart } },
    data: { status: 'EXPIRED' },
  });

  const expiring = await prisma.contract.findMany({
    where: { status: 'ACTIVE', endDate: { gte: todayStart, lt: startOfDay(now, warningDays + 1) } },
    include: {
      client: { select: { firstName: true, lastName: true, lawyerId: true } },
      case: { select: { lawyerId: true } },
    },
  });

  const notifications = expiring.flatMap((contract) => {
    const endDate = contract.endDate as Date;
    const recipients = new Set(
      [contract.client.lawyerId, contract.case?.lawyerId].filter((id): id is string => Boolean(id)),
    );
    const daysLeft = calendarDaysBetween(now, endDate);
    const clientName = `${contract.client.firstName} ${contract.client.lastName}`;
    return [...recipients].map<NotificationInput>((userId) => ({
      userId,
      type: 'CONTRACT_EXPIRING',
      title: 'Contract expiring soon',
      message: `${contract.title} (${clientName}) ends on ${calendarDay(endDate)}`,
      relatedEntity: 'CONTRACT',
      relatedEntityId: contract.id,
      data: { title: contract.title, clientName, endDate: endDate.toISOString(), daysLeft },
      dedupeKey: `contract:${contract.id}:expiring:${calendarDay(endDate)}:${userId}`,
    }));
  });

  return { expired: expired.count, alerts: await createNotifications(notifications) };
}

/** Marks overdue invoices and warns about invoices approaching their due date. */
export async function processInvoices(now = new Date(), warningDays = 3) {
  const todayStart = startOfDay(now);
  const include = {
    client: { select: { firstName: true, lastName: true, lawyerId: true } },
    case: { select: { lawyerId: true } },
  } satisfies Prisma.InvoiceInclude;

  const [overdue, dueSoon] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] }, dueDate: { lt: todayStart } },
      include,
    }),
    prisma.invoice.findMany({
      where: {
        status: { in: ['SENT', 'PARTIALLY_PAID'] },
        dueDate: { gte: todayStart, lt: startOfDay(now, warningDays + 1) },
      },
      include,
    }),
  ]);

  const toMarkOverdue = overdue.filter((invoice) => invoice.status !== 'OVERDUE');
  if (toMarkOverdue.length) {
    await prisma.invoice.updateMany({
      where: { id: { in: toMarkOverdue.map((invoice) => invoice.id) } },
      data: { status: 'OVERDUE' },
    });
  }

  const build = (
    invoice: (typeof overdue)[number],
    kind: 'due' | 'overdue',
  ): NotificationInput[] => {
    const recipients = new Set(
      [invoice.createdById, invoice.client.lawyerId, invoice.case?.lawyerId].filter(
        (id): id is string => Boolean(id),
      ),
    );
    const dueDay = calendarDay(invoice.dueDate);
    const clientName = `${invoice.client.firstName} ${invoice.client.lastName}`;
    const balance = Math.round((Number(invoice.total) - Number(invoice.amountPaid)) * 100) / 100;
    return [...recipients].map((userId) => ({
      userId,
      type: kind === 'due' ? 'INVOICE_DUE' : 'INVOICE_OVERDUE',
      title: kind === 'due' ? 'Invoice due soon' : 'Invoice overdue',
      message: `${invoice.invoiceNumber} (${clientName}) — due ${dueDay}, balance ${balance}`,
      relatedEntity: 'INVOICE',
      relatedEntityId: invoice.id,
      data: {
        invoiceNumber: invoice.invoiceNumber,
        clientName,
        dueDate: invoice.dueDate.toISOString(),
        balance,
      },
      dedupeKey: `invoice:${invoice.id}:${kind}:${dueDay}:${userId}`,
    }));
  };

  const alerts = await createNotifications([
    ...overdue.flatMap((invoice) => build(invoice, 'overdue')),
    ...dueSoon.flatMap((invoice) => build(invoice, 'due')),
  ]);
  return { overdue: toMarkOverdue.length, alerts };
}

export interface ReminderJobResult {
  hearingReminders: number;
  contractAlerts: number;
  contractsExpired: number;
  invoiceAlerts: number;
  invoicesOverdue: number;
  durationMs: number;
}

/** Entry point used by the in-process scheduler, the scheduled job and the admin trigger. */
export async function runReminderJob(now = new Date()): Promise<ReminderJobResult> {
  const started = Date.now();
  const settings = await getSettings();
  const hearingReminders = await processHearingReminders(now);
  const contracts = await processContracts(now, settings.contractExpiryWarningDays);
  const invoices = await processInvoices(now, settings.invoiceDueWarningDays);
  const result: ReminderJobResult = {
    hearingReminders,
    contractAlerts: contracts.alerts,
    contractsExpired: contracts.expired,
    invoiceAlerts: invoices.alerts,
    invoicesOverdue: invoices.overdue,
    durationMs: Date.now() - started,
  };
  logger.info('Reminder job completed', { ...result });
  return result;
}
