import type { CaseStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { AuthUser } from '../types/auth';
import { ApiError } from '../utils/api-error';
import { buildMeta, toSkipTake } from '../utils/pagination';
import { contains, searchTokens } from '../utils/search';
import { withUniqueSequence } from '../utils/sequence';
import type {
  CaseListQuery,
  CreateCaseInput,
  UpdateCaseInput,
} from '../validators/case.validators';
import {
  assertActiveUserWithRole,
  assertCaseAccess,
  assertCaseManager,
  assertClientAccess,
  caseScope,
  caseStakeholders,
} from './access.service';
import { activityInclude, logActivity } from './activity.service';
import { removeStoredFiles } from './document.service';
import { notifyUsers } from './notification.service';

const personSelect = { select: { id: true, firstName: true, lastName: true } } as const;

const caseListInclude = (now: Date) =>
  ({
    client: personSelect,
    lawyer: personSelect,
    hearings: {
      where: { status: 'SCHEDULED', date: { gte: now } },
      orderBy: { date: 'asc' },
      take: 1,
      select: { id: true, date: true, time: true, court: true },
    },
    _count: { select: { hearings: true, documents: true } },
  }) satisfies Prisma.CaseInclude;

const caseDetailInclude = {
  client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
  lawyer: { select: { id: true, firstName: true, lastName: true, email: true } },
  assignments: {
    select: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
  },
  _count: { select: { hearings: true, documents: true, contracts: true, invoices: true } },
} satisfies Prisma.CaseInclude;

type CaseDetail = Prisma.CaseGetPayload<{ include: typeof caseDetailInclude }>;

function formatCase(record: CaseDetail) {
  const { assignments, ...rest } = record;
  return { ...rest, assistants: assignments.map((assignment) => assignment.user) };
}

export async function listCases(user: AuthUser, query: CaseListQuery) {
  const filters: Prisma.CaseWhereInput[] = [caseScope(user)];
  if (query.status) filters.push({ status: { in: query.status } });
  if (query.priority) filters.push({ priority: { in: query.priority } });
  if (query.caseType) filters.push({ caseType: { in: query.caseType } });
  if (query.clientId) filters.push({ clientId: query.clientId });
  if (query.lawyerId) filters.push({ lawyerId: query.lawyerId });
  if (query.court) filters.push({ court: contains(query.court) });
  if (query.from || query.to) filters.push({ openingDate: { gte: query.from, lte: query.to } });
  for (const token of searchTokens(query.search)) {
    filters.push({
      OR: [
        { referenceNumber: contains(token) },
        { title: contains(token) },
        { opposingParty: contains(token) },
        { court: contains(token) },
        { client: { OR: [{ firstName: contains(token) }, { lastName: contains(token) }] } },
        { lawyer: { OR: [{ firstName: contains(token) }, { lastName: contains(token) }] } },
      ],
    });
  }
  const where: Prisma.CaseWhereInput = { AND: filters };

  const [items, total] = await Promise.all([
    prisma.case.findMany({
      where,
      include: caseListInclude(new Date()),
      orderBy: { [query.sortBy]: query.sortOrder },
      ...toSkipTake(query.page, query.pageSize),
    }),
    prisma.case.count({ where }),
  ]);

  return {
    items: items.map(({ hearings, ...rest }) => ({ ...rest, nextHearing: hearings[0] ?? null })),
    meta: buildMeta(query.page, query.pageSize, total),
  };
}

export async function getCase(user: AuthUser, id: string) {
  await assertCaseAccess(user, id);
  const record = await prisma.case.findUniqueOrThrow({ where: { id }, include: caseDetailInclude });
  return formatCase(record);
}

export async function getCaseTimeline(user: AuthUser, id: string, limit = 100) {
  await assertCaseAccess(user, id);
  return prisma.activityLog.findMany({
    where: { caseId: id },
    include: activityInclude,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

async function validateAssistants(ids: string[] | undefined): Promise<string[] | undefined> {
  if (!ids) return undefined;
  const unique = [...new Set(ids)];
  await Promise.all(
    unique.map((id) => assertActiveUserWithRole(id, ['ASSISTANT', 'LAWYER'], 'assignee')),
  );
  return unique;
}

function closingDateFor(
  status: CaseStatus | undefined,
  current: Date | null,
  provided?: Date | null,
) {
  if (provided !== undefined) return provided;
  if (!status) return undefined;
  if (status === 'CLOSED' || status === 'ARCHIVED') return current ?? new Date();
  return null;
}

export async function createCase(user: AuthUser, input: CreateCaseInput) {
  const client = await assertClientAccess(user, input.clientId);
  if (client.isArchived) throw ApiError.badRequest('This client is archived', 'CLIENT_ARCHIVED');

  const lawyerId = input.lawyerId ?? user.id;
  if (lawyerId !== user.id || user.role === 'ADMIN') {
    await assertActiveUserWithRole(lawyerId, ['LAWYER', 'ADMIN'], 'lawyer');
  }
  const assistantIds = await validateAssistants(input.assistantIds);
  const { assistantIds: _ignored, referenceNumber, openingDate, ...data } = input;

  const create = (reference: string) =>
    prisma.case.create({
      data: {
        ...data,
        referenceNumber: reference,
        lawyerId,
        openingDate: openingDate ?? new Date(),
        closingDate: closingDateFor(data.status, null),
        assignments: assistantIds
          ? { create: assistantIds.filter((id) => id !== lawyerId).map((userId) => ({ userId })) }
          : undefined,
      },
      include: caseDetailInclude,
    });

  const record = referenceNumber
    ? await create(referenceNumber)
    : await withUniqueSequence(
        async (prefix) =>
          (
            await prisma.case.findFirst({
              where: { referenceNumber: { startsWith: prefix } },
              orderBy: { referenceNumber: 'desc' },
              select: { referenceNumber: true },
            })
          )?.referenceNumber ?? null,
        'CASE',
        create,
      );

  await logActivity({
    userId: user.id,
    action: 'case.created',
    entity: 'CASE',
    entityId: record.id,
    caseId: record.id,
    clientId: record.clientId,
    metadata: { referenceNumber: record.referenceNumber, title: record.title },
  });
  await notifyUsers(
    [record.lawyerId, ...record.assignments.map((assignment) => assignment.user.id)],
    {
      type: 'CASE_UPDATED',
      title: 'New case assigned',
      message: `Case ${record.referenceNumber} — ${record.title}`,
      relatedEntity: 'CASE',
      relatedEntityId: record.id,
      data: { event: 'assigned', reference: record.referenceNumber, title: record.title },
    },
    user.id,
  );
  return formatCase(record);
}

export async function updateCase(user: AuthUser, id: string, input: UpdateCaseInput) {
  const existing = await assertCaseAccess(user, id);
  assertCaseManager(user, existing);

  if (input.clientId && input.clientId !== existing.clientId) {
    await assertClientAccess(user, input.clientId);
  }
  if (input.lawyerId && input.lawyerId !== existing.lawyerId) {
    await assertActiveUserWithRole(input.lawyerId, ['LAWYER', 'ADMIN'], 'lawyer');
  }
  const assistantIds = await validateAssistants(input.assistantIds);
  const current = await prisma.case.findUniqueOrThrow({
    where: { id },
    select: { closingDate: true },
  });
  const { assistantIds: _ignored, closingDate, openingDate, ...data } = input;
  const lawyerId = input.lawyerId ?? existing.lawyerId;

  const record = await prisma.case.update({
    where: { id },
    data: {
      ...data,
      ...(openingDate ? { openingDate } : {}),
      closingDate: closingDateFor(input.status, current.closingDate, closingDate),
      assignments: assistantIds
        ? {
            deleteMany: {},
            create: assistantIds
              .filter((userId) => userId !== lawyerId)
              .map((userId) => ({ userId })),
          }
        : undefined,
    },
    include: caseDetailInclude,
  });

  const statusChanged = input.status !== undefined && input.status !== existing.status;
  await logActivity({
    userId: user.id,
    action: statusChanged ? 'case.status_changed' : 'case.updated',
    entity: 'CASE',
    entityId: id,
    caseId: id,
    clientId: record.clientId,
    metadata: statusChanged
      ? { from: existing.status, to: record.status }
      : { fields: Object.keys(input) },
  });
  await notifyUsers(
    await caseStakeholders(id),
    {
      type: 'CASE_UPDATED',
      title: 'Case updated',
      message: `Case ${record.referenceNumber} — ${record.title} was updated`,
      relatedEntity: 'CASE',
      relatedEntityId: id,
      data: {
        event: statusChanged ? 'status' : 'updated',
        reference: record.referenceNumber,
        title: record.title,
        status: record.status,
      },
    },
    user.id,
  );
  return formatCase(record);
}

export function closeCase(user: AuthUser, id: string) {
  return updateCase(user, id, { status: 'CLOSED', closingDate: undefined });
}

export function reopenCase(user: AuthUser, id: string) {
  return updateCase(user, id, { status: 'IN_PROGRESS', closingDate: null });
}

export async function deleteCase(user: AuthUser, id: string) {
  const existing = await assertCaseAccess(user, id);
  assertCaseManager(user, existing);
  const documents = await prisma.document.findMany({
    where: { caseId: id },
    select: { fileUrl: true },
  });
  const record = await prisma.case.delete({ where: { id } });
  await removeStoredFiles(documents.map((document) => document.fileUrl));
  await logActivity({
    userId: user.id,
    action: 'case.deleted',
    entity: 'CASE',
    entityId: id,
    clientId: record.clientId,
    metadata: { referenceNumber: record.referenceNumber, title: record.title },
  });
}
