import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { AuthUser } from '../types/auth';
import { calendarDaysBetween, monthKey, startOfMonth } from '../utils/dates';
import { invoiceBalance } from '../utils/invoice-calc';
import type { ReportQuery } from '../validators/settings.validators';
import { caseScope, hearingScope, invoiceScope } from './access.service';
import { monthBuckets } from './dashboard.service';
import { getSettings } from './settings.service';

const round = (value: number) => Math.round(value * 100) / 100;

function monthsBetween(from: Date, to: Date): number {
  const [fy, fm] = monthKey(from).split('-').map(Number);
  const [ty, tm] = monthKey(to).split('-').map(Number);
  return Math.min(36, Math.max(1, (ty - fy) * 12 + (tm - fm) + 1));
}

export async function getReports(user: AuthUser, query: ReportQuery) {
  const now = new Date();
  const to = query.to ?? now;
  const from = query.from ?? startOfMonth(now, -11);
  const settings = await getSettings();

  const lawyerFilter = user.role === 'ADMIN' && query.lawyerId ? { lawyerId: query.lawyerId } : {};
  const cases: Prisma.CaseWhereInput = { AND: [caseScope(user), lawyerFilter] };
  const casesInRange: Prisma.CaseWhereInput = {
    AND: [cases, { openingDate: { gte: from, lte: to } }],
  };
  const hearings: Prisma.HearingWhereInput = {
    AND: [hearingScope(user), { case: lawyerFilter }, { date: { gte: from, lte: to } }],
  };
  const invoices: Prisma.InvoiceWhereInput = {
    AND: [
      invoiceScope(user),
      query.lawyerId && user.role === 'ADMIN' ? { client: { lawyerId: query.lawyerId } } : {},
      { issueDate: { gte: from, lte: to } },
    ],
  };

  const [
    byStatus,
    byType,
    byPriority,
    openedCases,
    closedCases,
    hearingsByStatus,
    hearingDates,
    invoiceRows,
    invoicesByStatus,
    topClients,
  ] = await Promise.all([
    prisma.case.groupBy({ by: ['status'], where: cases, _count: { _all: true } }),
    prisma.case.groupBy({ by: ['caseType'], where: cases, _count: { _all: true } }),
    prisma.case.groupBy({ by: ['priority'], where: cases, _count: { _all: true } }),
    prisma.case.findMany({ where: casesInRange, select: { openingDate: true } }),
    prisma.case.findMany({
      where: { AND: [cases, { closingDate: { gte: from, lte: to } }] },
      select: { openingDate: true, closingDate: true },
    }),
    prisma.hearing.groupBy({ by: ['status'], where: hearings, _count: { _all: true } }),
    prisma.hearing.findMany({ where: hearings, select: { date: true } }),
    prisma.invoice.findMany({
      where: { AND: [invoices, { status: { not: 'CANCELLED' } }] },
      select: { issueDate: true, total: true, amountPaid: true, status: true },
    }),
    prisma.invoice.groupBy({
      by: ['status'],
      where: invoices,
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.invoice.groupBy({
      by: ['clientId'],
      where: { AND: [invoices, { status: { not: 'CANCELLED' } }] },
      _sum: { total: true, amountPaid: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 5,
    }),
  ]);

  const buckets = monthBuckets(startOfMonth(from), monthsBetween(from, to));
  const monthly = new Map(
    buckets.map((month) => [
      month,
      { month, opened: 0, closed: 0, hearings: 0, invoiced: 0, paid: 0 },
    ]),
  );
  const bump = (date: Date | null, field: 'opened' | 'closed' | 'hearings', amount = 1) => {
    const bucket = date ? monthly.get(monthKey(date)) : undefined;
    if (bucket) bucket[field] += amount;
  };
  openedCases.forEach((item) => bump(item.openingDate, 'opened'));
  closedCases.forEach((item) => bump(item.closingDate, 'closed'));
  hearingDates.forEach((item) => bump(item.date, 'hearings'));
  for (const invoice of invoiceRows) {
    const bucket = monthly.get(monthKey(invoice.issueDate));
    if (bucket) {
      bucket.invoiced += Number(invoice.total);
      bucket.paid += Number(invoice.amountPaid);
    }
  }

  const invoiced = invoiceRows.reduce((sum, row) => sum + Number(row.total), 0);
  const collected = invoiceRows.reduce((sum, row) => sum + Number(row.amountPaid), 0);
  const overdue = invoiceRows
    .filter((row) => row.status === 'OVERDUE')
    .reduce((sum, row) => sum + invoiceBalance(Number(row.total), Number(row.amountPaid)), 0);
  const durations = closedCases
    .filter((item) => item.closingDate)
    .map((item) => calendarDaysBetween(item.openingDate, item.closingDate as Date));

  const clientNames = await prisma.client.findMany({
    where: { id: { in: topClients.map((row) => row.clientId) } },
    select: { id: true, firstName: true, lastName: true },
  });

  const lawyers =
    user.role === 'ADMIN'
      ? await prisma.user.findMany({
          where: { role: { in: ['LAWYER', 'ADMIN'] }, isActive: true, cases: { some: {} } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            _count: {
              select: {
                cases: { where: { status: { in: ['OPEN', 'IN_PROGRESS', 'PENDING'] } } },
              },
            },
          },
        })
      : [];

  return {
    range: { from, to },
    currency: settings.currency,
    cases: {
      byStatus: byStatus.map((row) => ({ status: row.status, count: row._count._all })),
      byType: byType.map((row) => ({ type: row.caseType, count: row._count._all })),
      byPriority: byPriority.map((row) => ({ priority: row.priority, count: row._count._all })),
      openedInRange: openedCases.length,
      closedInRange: closedCases.length,
      averageDurationDays: durations.length
        ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
        : null,
    },
    hearings: {
      total: hearingDates.length,
      byStatus: hearingsByStatus.map((row) => ({ status: row.status, count: row._count._all })),
    },
    finance: {
      invoiced: round(invoiced),
      collected: round(collected),
      outstanding: invoiceBalance(invoiced, collected),
      overdue: round(overdue),
      collectionRate: invoiced > 0 ? Math.round((collected / invoiced) * 1000) / 10 : 0,
      byStatus: invoicesByStatus.map((row) => ({
        status: row.status,
        count: row._count._all,
        total: round(Number(row._sum.total ?? 0)),
      })),
      topClients: topClients.map((row) => {
        const client = clientNames.find((item) => item.id === row.clientId);
        return {
          clientId: row.clientId,
          name: client ? `${client.firstName} ${client.lastName}` : '—',
          invoiced: round(Number(row._sum.total ?? 0)),
          paid: round(Number(row._sum.amountPaid ?? 0)),
        };
      }),
    },
    monthly: [...monthly.values()].map((row) => ({
      ...row,
      invoiced: round(row.invoiced),
      paid: round(row.paid),
    })),
    lawyers: lawyers.map((lawyer) => ({
      id: lawyer.id,
      name: `${lawyer.firstName} ${lawyer.lastName}`,
      activeCases: lawyer._count.cases,
    })),
  };
}
