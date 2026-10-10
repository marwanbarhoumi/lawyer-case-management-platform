import type { InvoiceStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { AuthUser } from '../types/auth';
import { ApiError } from '../utils/api-error';
import { addDays, startOfDay } from '../utils/dates';
import { calculateInvoiceTotals, invoiceBalance } from '../utils/invoice-calc';
import { buildMeta, toSkipTake } from '../utils/pagination';
import { contains, searchTokens } from '../utils/search';
import { withUniqueSequence } from '../utils/sequence';
import type {
  CreateInvoiceInput,
  InvoiceListQuery,
  PayInvoiceInput,
  UpdateInvoiceInput,
} from '../validators/invoice.validators';
import { assertCaseAccess, assertClientAccess, invoiceScope } from './access.service';
import { logActivity } from './activity.service';
import { getSettings } from './settings.service';

const invoiceListInclude = {
  client: { select: { id: true, firstName: true, lastName: true } },
  case: { select: { id: true, referenceNumber: true, title: true } },
} satisfies Prisma.InvoiceInclude;

const invoiceDetailInclude = {
  client: {
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, address: true },
  },
  case: { select: { id: true, referenceNumber: true, title: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  items: { orderBy: { position: 'asc' } },
} satisfies Prisma.InvoiceInclude;

const MONEY_FIELDS = ['amount', 'taxRate', 'tax', 'total', 'amountPaid'] as const;

type MoneyFields = (typeof MONEY_FIELDS)[number];
type WithNumbers<T> = Omit<T, MoneyFields> & Record<MoneyFields, number> & { balance: number };

/** Converts Prisma Decimals to plain numbers and adds the outstanding balance. */
function presentInvoice<T extends Record<MoneyFields, Prisma.Decimal> & { items?: unknown }>(
  invoice: T,
): WithNumbers<T> {
  const numbers = Object.fromEntries(
    MONEY_FIELDS.map((field) => [field, Number(invoice[field])]),
  ) as Record<MoneyFields, number>;
  const output = {
    ...invoice,
    ...numbers,
    balance: invoiceBalance(numbers.total, numbers.amountPaid),
  } as WithNumbers<T>;
  if (Array.isArray(invoice.items)) {
    (output as { items: unknown }).items = (
      invoice.items as Array<{
        quantity: Prisma.Decimal;
        unitPrice: Prisma.Decimal;
        total: Prisma.Decimal;
      }>
    ).map((item) => ({
      ...item,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
    }));
  }
  return output;
}

export async function listInvoices(user: AuthUser, query: InvoiceListQuery) {
  const filters: Prisma.InvoiceWhereInput[] = [invoiceScope(user)];
  if (query.status) filters.push({ status: { in: query.status } });
  if (query.clientId) filters.push({ clientId: query.clientId });
  if (query.caseId) filters.push({ caseId: query.caseId });
  if (query.from || query.to) filters.push({ issueDate: { gte: query.from, lte: query.to } });
  for (const token of searchTokens(query.search)) {
    filters.push({
      OR: [
        { invoiceNumber: contains(token) },
        { case: { referenceNumber: contains(token) } },
        { client: { OR: [{ firstName: contains(token) }, { lastName: contains(token) }] } },
      ],
    });
  }
  const where: Prisma.InvoiceWhereInput = { AND: filters };
  const [items, total, totals] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: invoiceListInclude,
      orderBy: { [query.sortBy]: query.sortOrder },
      ...toSkipTake(query.page, query.pageSize),
    }),
    prisma.invoice.count({ where }),
    prisma.invoice.aggregate({
      where: { AND: [...filters, { status: { not: 'CANCELLED' } }] },
      _sum: { total: true, amountPaid: true },
    }),
  ]);
  return {
    items: items.map(presentInvoice),
    meta: {
      ...buildMeta(query.page, query.pageSize, total),
      sumTotal: Number(totals._sum.total ?? 0),
      sumPaid: Number(totals._sum.amountPaid ?? 0),
    },
  };
}

async function findAccessibleInvoice(user: AuthUser, id: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: invoiceDetailInclude });
  if (!invoice) throw ApiError.notFound('Invoice not found', 'INVOICE_NOT_FOUND');
  await assertClientAccess(user, invoice.clientId);
  return invoice;
}

export async function getInvoice(user: AuthUser, id: string) {
  return presentInvoice(await findAccessibleInvoice(user, id));
}

async function assertCaseOfClient(
  user: AuthUser,
  caseId: string | null | undefined,
  clientId: string,
) {
  if (!caseId) return;
  const caseRecord = await assertCaseAccess(user, caseId);
  if (caseRecord.clientId !== clientId) {
    throw ApiError.badRequest('The case does not belong to this client', 'CASE_CLIENT_MISMATCH');
  }
}

export async function createInvoice(user: AuthUser, input: CreateInvoiceInput) {
  await assertClientAccess(user, input.clientId);
  await assertCaseOfClient(user, input.caseId, input.clientId);
  const settings = await getSettings();
  const taxRate = input.taxRate ?? Number(settings.defaultTaxRate);
  const totals = calculateInvoiceTotals(input.items, taxRate);
  const issueDate = input.issueDate ?? new Date();
  const dueDate = input.dueDate ?? addDays(issueDate, settings.invoiceDueDays);
  if (dueDate < startOfDay(issueDate)) {
    throw ApiError.badRequest('Due date must be after the issue date', 'INVALID_DUE_DATE');
  }

  const invoice = await withUniqueSequence(
    async (prefix) =>
      (
        await prisma.invoice.findFirst({
          where: { invoiceNumber: { startsWith: prefix } },
          orderBy: { invoiceNumber: 'desc' },
          select: { invoiceNumber: true },
        })
      )?.invoiceNumber ?? null,
    'INV',
    (invoiceNumber) =>
      prisma.invoice.create({
        data: {
          invoiceNumber,
          clientId: input.clientId,
          caseId: input.caseId ?? null,
          createdById: user.id,
          amount: totals.subtotal,
          taxRate,
          tax: totals.tax,
          total: totals.total,
          status: input.status,
          issueDate,
          dueDate,
          notes: input.notes,
          items: { create: totals.items },
        },
        include: invoiceDetailInclude,
      }),
  );

  await logActivity({
    userId: user.id,
    action: 'invoice.created',
    entity: 'INVOICE',
    entityId: invoice.id,
    caseId: invoice.caseId,
    clientId: invoice.clientId,
    metadata: { invoiceNumber: invoice.invoiceNumber, total: totals.total },
  });
  return presentInvoice(invoice);
}

const EDITABLE_STATUSES: InvoiceStatus[] = ['DRAFT', 'SENT', 'OVERDUE'];

export async function updateInvoice(user: AuthUser, id: string, input: UpdateInvoiceInput) {
  const existing = await findAccessibleInvoice(user, id);
  if (!EDITABLE_STATUSES.includes(existing.status) || Number(existing.amountPaid) > 0) {
    throw ApiError.badRequest('This invoice can no longer be modified', 'INVOICE_LOCKED');
  }
  await assertCaseOfClient(user, input.caseId, existing.clientId);

  const taxRate = input.taxRate ?? Number(existing.taxRate);
  const items =
    input.items ??
    existing.items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    }));
  const totals = calculateInvoiceTotals(items, taxRate);
  const issueDate = input.issueDate ?? existing.issueDate;
  const dueDate = input.dueDate ?? existing.dueDate;
  if (dueDate < startOfDay(issueDate)) {
    throw ApiError.badRequest('Due date must be after the issue date', 'INVALID_DUE_DATE');
  }

  let status: InvoiceStatus = input.status ?? existing.status;
  if (status === 'OVERDUE' && dueDate >= startOfDay(new Date())) status = 'SENT';

  const invoice = await prisma.invoice.update({
    where: { id },
    data: {
      caseId: input.caseId === undefined ? undefined : input.caseId,
      notes: input.notes === undefined ? undefined : input.notes,
      issueDate,
      dueDate,
      status,
      taxRate,
      amount: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      ...(input.items ? { items: { deleteMany: {}, create: totals.items } } : {}),
    },
    include: invoiceDetailInclude,
  });
  await logActivity({
    userId: user.id,
    action: 'invoice.updated',
    entity: 'INVOICE',
    entityId: id,
    caseId: invoice.caseId,
    clientId: invoice.clientId,
    metadata: { invoiceNumber: invoice.invoiceNumber, total: totals.total, status },
  });
  return presentInvoice(invoice);
}

/** Records a (partial) payment. Without an amount, the full balance is settled. */
export async function payInvoice(user: AuthUser, id: string, input: PayInvoiceInput) {
  const existing = await findAccessibleInvoice(user, id);
  if (existing.status === 'CANCELLED' || existing.status === 'PAID') {
    throw ApiError.badRequest('This invoice cannot receive payments', 'INVOICE_NOT_PAYABLE');
  }
  const total = Number(existing.total);
  const balance = invoiceBalance(total, Number(existing.amountPaid));
  const amount = input.amount ?? balance;
  if (amount > balance + 0.001) {
    throw ApiError.badRequest('Payment exceeds the remaining balance', 'OVERPAYMENT');
  }
  const amountPaid = Math.round((Number(existing.amountPaid) + amount) * 100) / 100;
  const fullyPaid = invoiceBalance(total, amountPaid) === 0;

  const invoice = await prisma.invoice.update({
    where: { id },
    data: {
      amountPaid,
      status: fullyPaid ? 'PAID' : 'PARTIALLY_PAID',
      paidAt: fullyPaid ? (input.paidAt ?? new Date()) : null,
    },
    include: invoiceDetailInclude,
  });
  await logActivity({
    userId: user.id,
    action: fullyPaid ? 'invoice.paid' : 'invoice.partially_paid',
    entity: 'INVOICE',
    entityId: id,
    caseId: invoice.caseId,
    clientId: invoice.clientId,
    metadata: { invoiceNumber: invoice.invoiceNumber, amount, amountPaid },
  });
  return presentInvoice(invoice);
}

export async function cancelInvoice(user: AuthUser, id: string) {
  const existing = await findAccessibleInvoice(user, id);
  if (existing.status === 'PAID' || existing.status === 'CANCELLED') {
    throw ApiError.badRequest('This invoice cannot be cancelled', 'INVOICE_NOT_CANCELLABLE');
  }
  const invoice = await prisma.invoice.update({
    where: { id },
    data: { status: 'CANCELLED' },
    include: invoiceDetailInclude,
  });
  await logActivity({
    userId: user.id,
    action: 'invoice.cancelled',
    entity: 'INVOICE',
    entityId: id,
    caseId: invoice.caseId,
    clientId: invoice.clientId,
    metadata: { invoiceNumber: invoice.invoiceNumber },
  });
  return presentInvoice(invoice);
}

export async function deleteInvoice(user: AuthUser, id: string) {
  const existing = await findAccessibleInvoice(user, id);
  if (existing.status !== 'DRAFT') {
    throw ApiError.badRequest(
      'Only draft invoices can be deleted; cancel it instead',
      'INVOICE_NOT_DRAFT',
    );
  }
  await prisma.invoice.delete({ where: { id } });
  await logActivity({
    userId: user.id,
    action: 'invoice.deleted',
    entity: 'INVOICE',
    entityId: id,
    caseId: existing.caseId,
    clientId: existing.clientId,
    metadata: { invoiceNumber: existing.invoiceNumber },
  });
}
