import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { AuthUser } from '../types/auth';
import { ApiError } from '../utils/api-error';
import { buildMeta, toSkipTake } from '../utils/pagination';
import { contains, searchTokens } from '../utils/search';
import type {
  ClientListQuery,
  CreateClientInput,
  UpdateClientInput,
} from '../validators/client.validators';
import {
  assertActiveUserWithRole,
  assertClientAccess,
  caseScope,
  clientScope,
  invoiceScope,
} from './access.service';
import { activityInclude, logActivity } from './activity.service';

const lawyerSelect = { select: { id: true, firstName: true, lastName: true } } as const;

export async function listClients(user: AuthUser, query: ClientListQuery) {
  const filters: Prisma.ClientWhereInput[] = [clientScope(user)];
  if (query.archived !== 'all') filters.push({ isArchived: query.archived === 'true' });
  if (query.lawyerId) filters.push({ lawyerId: query.lawyerId });
  for (const token of searchTokens(query.search)) {
    filters.push({
      OR: [
        { firstName: contains(token) },
        { lastName: contains(token) },
        { email: contains(token) },
        { phone: contains(token) },
        { nationalId: contains(token) },
      ],
    });
  }
  const where: Prisma.ClientWhereInput = { AND: filters };

  const [items, total] = await Promise.all([
    prisma.client.findMany({
      where,
      include: {
        lawyer: lawyerSelect,
        _count: { select: { cases: { where: caseScope(user) } } },
      },
      orderBy: { [query.sortBy]: query.sortOrder },
      ...toSkipTake(query.page, query.pageSize),
    }),
    prisma.client.count({ where }),
  ]);
  return { items, meta: buildMeta(query.page, query.pageSize, total) };
}

/** Client profile with aggregated figures (cases, hearings, payments). */
export async function getClient(user: AuthUser, id: string) {
  await assertClientAccess(user, id);
  const now = new Date();
  const [client, activeCases, upcomingHearings, invoiceTotals] = await Promise.all([
    prisma.client.findUniqueOrThrow({
      where: { id },
      include: {
        lawyer: lawyerSelect,
        _count: {
          select: {
            cases: { where: caseScope(user) },
            documents: true,
            contracts: true,
            invoices: true,
          },
        },
      },
    }),
    prisma.case.count({
      where: {
        AND: [caseScope(user), { clientId: id, status: { notIn: ['CLOSED', 'ARCHIVED'] } }],
      },
    }),
    prisma.hearing.count({
      where: {
        case: { AND: [caseScope(user), { clientId: id }] },
        status: 'SCHEDULED',
        date: { gte: now },
      },
    }),
    user.role === 'ASSISTANT'
      ? null
      : prisma.invoice.aggregate({
          where: { AND: [invoiceScope(user), { clientId: id, status: { not: 'CANCELLED' } }] },
          _sum: { total: true, amountPaid: true },
        }),
  ]);

  const totalInvoiced = Number(invoiceTotals?._sum.total ?? 0);
  const totalPaid = Number(invoiceTotals?._sum.amountPaid ?? 0);
  return {
    ...client,
    summary: {
      activeCases,
      upcomingHearings,
      totalInvoiced,
      totalPaid,
      balance: Math.round((totalInvoiced - totalPaid) * 100) / 100,
    },
  };
}

export async function getClientTimeline(user: AuthUser, id: string, limit = 50) {
  await assertClientAccess(user, id);
  return prisma.activityLog.findMany({
    where: { clientId: id },
    include: activityInclude,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

async function resolveOwner(user: AuthUser, requested: string | null | undefined) {
  if (user.role !== 'ADMIN') return user.id;
  if (!requested) return null;
  await assertActiveUserWithRole(requested, ['LAWYER', 'ADMIN'], 'lawyer');
  return requested;
}

export async function createClient(user: AuthUser, input: CreateClientInput) {
  const { lawyerId, ...data } = input;
  const client = await prisma.client.create({
    data: { ...data, lawyerId: await resolveOwner(user, lawyerId) },
    include: { lawyer: lawyerSelect },
  });
  await logActivity({
    userId: user.id,
    action: 'client.created',
    entity: 'CLIENT',
    entityId: client.id,
    clientId: client.id,
    metadata: { name: `${client.firstName} ${client.lastName}` },
  });
  return client;
}

export async function updateClient(user: AuthUser, id: string, input: UpdateClientInput) {
  await assertClientAccess(user, id);
  const { lawyerId, ...data } = input;
  const ownerUpdate =
    user.role === 'ADMIN' && lawyerId !== undefined
      ? { lawyerId: await resolveOwner(user, lawyerId) }
      : {};
  const client = await prisma.client.update({
    where: { id },
    data: { ...data, ...ownerUpdate },
    include: { lawyer: lawyerSelect },
  });
  await logActivity({
    userId: user.id,
    action: 'client.updated',
    entity: 'CLIENT',
    entityId: id,
    clientId: id,
    metadata: { fields: Object.keys(input) },
  });
  return client;
}

function assertClientManager(user: AuthUser, client: { lawyerId: string | null }) {
  if (user.role === 'ADMIN') return;
  if (user.role === 'LAWYER' && client.lawyerId === user.id) return;
  throw ApiError.forbidden(
    'Only the responsible lawyer can archive this client',
    'CLIENT_FORBIDDEN',
  );
}

export async function archiveClient(user: AuthUser, id: string) {
  const client = await assertClientAccess(user, id);
  assertClientManager(user, client);
  const updated = await prisma.client.update({
    where: { id },
    data: { isArchived: true, archivedAt: new Date() },
  });
  await logActivity({
    userId: user.id,
    action: 'client.archived',
    entity: 'CLIENT',
    entityId: id,
    clientId: id,
  });
  return updated;
}

export async function restoreClient(user: AuthUser, id: string) {
  const client = await assertClientAccess(user, id);
  assertClientManager(user, client);
  const updated = await prisma.client.update({
    where: { id },
    data: { isArchived: false, archivedAt: null },
  });
  await logActivity({
    userId: user.id,
    action: 'client.restored',
    entity: 'CLIENT',
    entityId: id,
    clientId: id,
  });
  return updated;
}

/** Permanent deletion (admin only) is refused while cases or invoices reference the client. */
export async function deleteClientPermanently(user: AuthUser, id: string) {
  if (user.role !== 'ADMIN') throw ApiError.forbidden();
  await assertClientAccess(user, id);
  const [cases, invoices] = await Promise.all([
    prisma.case.count({ where: { clientId: id } }),
    prisma.invoice.count({ where: { clientId: id } }),
  ]);
  if (cases > 0 || invoices > 0) {
    throw ApiError.conflict(
      'This client has cases or invoices and can only be archived',
      'CLIENT_HAS_RELATED_RECORDS',
    );
  }
  await prisma.client.delete({ where: { id } });
  await logActivity({ userId: user.id, action: 'client.deleted', entity: 'CLIENT', entityId: id });
}
