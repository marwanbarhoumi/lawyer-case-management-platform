import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { AuthUser } from '../types/auth';
import { monthKey, startOfDay, startOfMonth } from '../utils/dates';
import { invoiceBalance } from '../utils/invoice-calc';
import {
  caseScope,
  clientScope,
  contractScope,
  hearingScope,
  invoiceScope,
} from './access.service';
import { activityInclude } from './activity.service';
import { hearingRangeFilter } from './hearing.service';
import { getSettings } from './settings.service';

const ACTIVE_CASE_STATUSES = ['OPEN', 'IN_PROGRESS', 'PENDING'] as const;
const UNPAID_STATUSES = ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] as const;

const hearingWidgetInclude = {
  case: {
    select: {
      id: true,
      referenceNumber: true,
      title: true,
      client: { select: { id: true, firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.HearingInclude;

/** Activity visible to the user: their own actions plus actions on accessible cases/clients. */
export async function activityScope(user: AuthUser): Promise<Prisma.ActivityLogWhereInput> {
  if (user.role === 'ADMIN') return {};
  const [cases, clients] = await Promise.all([
    prisma.case.findMany({ where: caseScope(user), select: { id: true } }),
    prisma.client.findMany({ where: clientScope(user), select: { id: true } }),
  ]);
  return {
    OR: [
      { userId: user.id },
      { caseId: { in: cases.map((item) => item.id) } },
      { clientId: { in: clients.map((item) => item.id) } },
    ],
  };
}

/** Builds empty month buckets so charts always show a continuous range. */
export function monthBuckets(from: Date, count: number): string[] {
  return Array.from({ length: count }, (_, index) => monthKey(startOfMonth(from, index)));
}

export async function getDashboardStats(user: AuthUser) {
  const now = new Date();
  const canSeeFinance = user.role !== 'ASSISTANT';
  const settings = await getSettings();
  const hearingsWhere = (
    range: Parameters<typeof hearingRangeFilter>[0],
  ): Prisma.HearingWhereInput => ({
    AND: [hearingScope(user), hearingRangeFilter(range, now)],
  });
  const activeCaseWhere: Prisma.CaseWhereInput = {
    AND: [caseScope(user), { status: { in: [...ACTIVE_CASE_STATUSES] } }],
  };
  const unpaidWhere: Prisma.InvoiceWhereInput = {
    AND: [invoiceScope(user), { status: { in: [...UNPAID_STATUSES] } }],
  };
  const chartStart = startOfMonth(now, -5);

  const [
    totalClients,
    activeCases,
    upcomingHearingsCount,
    todayHearings,
    tomorrowHearings,
    upcomingHearings,
    overdueHearings,
    casesByStatus,
    casesByType,
    urgentCases,
    pendingInvoices,
    overdueInvoices,
    chartInvoices,
    invoiceStatusTotals,
    expiringContracts,
    recentActivity,
    unreadNotifications,
    latestNotifications,
  ] = await Promise.all([
    prisma.client.count({ where: { AND: [clientScope(user), { isArchived: false }] } }),
    prisma.case.count({ where: activeCaseWhere }),
    prisma.hearing.count({ where: hearingsWhere('upcoming') }),
    prisma.hearing.findMany({
      where: hearingsWhere('today'),
      include: hearingWidgetInclude,
      orderBy: { date: 'asc' },
    }),
    prisma.hearing.findMany({
      where: hearingsWhere('tomorrow'),
      include: hearingWidgetInclude,
      orderBy: { date: 'asc' },
    }),
    prisma.hearing.findMany({
      where: {
        AND: [hearingScope(user), { status: 'SCHEDULED', date: { gte: startOfDay(now, 2) } }],
      },
      include: hearingWidgetInclude,
      orderBy: { date: 'asc' },
      take: 6,
    }),
    prisma.hearing.findMany({
      where: hearingsWhere('overdue'),
      include: hearingWidgetInclude,
      orderBy: { date: 'desc' },
      take: 6,
    }),
    prisma.case.groupBy({ by: ['status'], where: caseScope(user), _count: { _all: true } }),
    prisma.case.groupBy({ by: ['caseType'], where: caseScope(user), _count: { _all: true } }),
    prisma.case.findMany({
      where: { AND: [activeCaseWhere, { priority: { in: ['URGENT', 'HIGH'] } }] },
      include: { client: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      take: 5,
    }),
    canSeeFinance
      ? prisma.invoice.aggregate({
          where: unpaidWhere,
          _count: { _all: true },
          _sum: { total: true, amountPaid: true },
        })
      : null,
    canSeeFinance
      ? prisma.invoice.findMany({
          where: { AND: [invoiceScope(user), { status: 'OVERDUE' }] },
          include: { client: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { dueDate: 'asc' },
          take: 5,
        })
      : [],
    canSeeFinance
      ? prisma.invoice.findMany({
          where: {
            AND: [
              invoiceScope(user),
              { issueDate: { gte: chartStart }, status: { not: 'CANCELLED' } },
            ],
          },
          select: { issueDate: true, total: true, amountPaid: true },
        })
      : [],
    canSeeFinance
      ? prisma.invoice.groupBy({
          by: ['status'],
          where: { AND: [invoiceScope(user), { status: { not: 'CANCELLED' } }] },
          _count: { _all: true },
          _sum: { total: true, amountPaid: true },
        })
      : [],
    canSeeFinance
      ? prisma.contract.findMany({
          where: {
            AND: [
              contractScope(user),
              {
                status: 'ACTIVE',
                endDate: {
                  gte: startOfDay(now),
                  lt: startOfDay(now, settings.contractExpiryWarningDays + 1),
                },
              },
            ],
          },
          include: { client: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { endDate: 'asc' },
          take: 5,
        })
      : [],
    activityScope(user).then((where) =>
      prisma.activityLog.findMany({
        where,
        include: activityInclude,
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    prisma.notification.findMany({
      where: { userId: user.id, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 5,
      omit: { dedupeKey: true },
    }),
  ]);

  const months = monthBuckets(chartStart, 6);
  const monthly = new Map(months.map((month) => [month, { month, invoiced: 0, paid: 0 }]));
  for (const invoice of chartInvoices) {
    const bucket = monthly.get(monthKey(invoice.issueDate));
    if (bucket) {
      bucket.invoiced += Number(invoice.total);
      bucket.paid += Number(invoice.amountPaid);
    }
  }

  const paidAmount = invoiceStatusTotals.reduce(
    (sum, row) => sum + Number(row._sum.amountPaid ?? 0),
    0,
  );
  const invoicedAmount = invoiceStatusTotals.reduce(
    (sum, row) => sum + Number(row._sum.total ?? 0),
    0,
  );

  return {
    totals: {
      clients: totalClients,
      activeCases,
      upcomingHearings: upcomingHearingsCount,
      pendingInvoices: pendingInvoices?._count._all ?? 0,
      pendingAmount: pendingInvoices
        ? invoiceBalance(
            Number(pendingInvoices._sum.total ?? 0),
            Number(pendingInvoices._sum.amountPaid ?? 0),
          )
        : 0,
    },
    hearings: {
      today: todayHearings,
      tomorrow: tomorrowHearings,
      upcoming: upcomingHearings,
      overdue: overdueHearings,
    },
    casesByStatus: casesByStatus.map((row) => ({ status: row.status, count: row._count._all })),
    casesByType: casesByType.map((row) => ({ type: row.caseType, count: row._count._all })),
    urgentCases,
    finance: canSeeFinance
      ? {
          currency: settings.currency,
          monthly: [...monthly.values()].map((row) => ({
            ...row,
            invoiced: Math.round(row.invoiced * 100) / 100,
            paid: Math.round(row.paid * 100) / 100,
          })),
          paidVsUnpaid: {
            paid: Math.round(paidAmount * 100) / 100,
            unpaid: invoiceBalance(invoicedAmount, paidAmount),
          },
          byStatus: invoiceStatusTotals.map((row) => ({
            status: row.status,
            count: row._count._all,
          })),
          overdueInvoices: overdueInvoices.map((invoice) => ({
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            client: invoice.client,
            dueDate: invoice.dueDate,
            total: Number(invoice.total),
            balance: invoiceBalance(Number(invoice.total), Number(invoice.amountPaid)),
          })),
          expiringContracts,
        }
      : null,
    recentActivity,
    notifications: { unread: unreadNotifications, latest: latestNotifications },
  };
}
