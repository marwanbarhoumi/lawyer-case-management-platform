import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import type { AuthUser } from '../types/auth';
import { ApiError } from '../utils/api-error';
import { startOfDay } from '../utils/dates';
import { buildMeta, toSkipTake } from '../utils/pagination';
import { contains, searchTokens } from '../utils/search';
import type {
  CreateHearingInput,
  HearingListQuery,
  UpdateHearingInput,
} from '../validators/hearing.validators';
import { assertCaseAccess, caseStakeholders, hearingScope } from './access.service';
import { logActivity } from './activity.service';
import { notifyUsers } from './notification.service';
import { processHearingReminder } from './reminder.service';

const hearingInclude = {
  case: {
    select: {
      id: true,
      referenceNumber: true,
      title: true,
      status: true,
      court: true,
      client: { select: { id: true, firstName: true, lastName: true } },
      lawyer: { select: { id: true, firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.HearingInclude;

export type HearingRange = NonNullable<HearingListQuery['range']>;

/** Translates a named range (today, overdue...) into a Prisma filter. */
export function hearingRangeFilter(
  range: HearingRange,
  now = new Date(),
): Prisma.HearingWhereInput {
  switch (range) {
    case 'today':
      return { date: { gte: startOfDay(now), lt: startOfDay(now, 1) } };
    case 'tomorrow':
      return { date: { gte: startOfDay(now, 1), lt: startOfDay(now, 2) } };
    case 'week':
      return { date: { gte: startOfDay(now), lt: startOfDay(now, 8) } };
    case 'upcoming':
      return { status: 'SCHEDULED', date: { gte: now } };
    case 'overdue':
      return { status: 'SCHEDULED', date: { lt: startOfDay(now) } };
  }
}

export async function listHearings(user: AuthUser, query: HearingListQuery) {
  const filters: Prisma.HearingWhereInput[] = [hearingScope(user)];
  if (query.range) filters.push(hearingRangeFilter(query.range));
  if (query.caseId) filters.push({ caseId: query.caseId });
  if (query.clientId) filters.push({ case: { clientId: query.clientId } });
  if (query.status) filters.push({ status: { in: query.status } });
  if (query.court) filters.push({ court: contains(query.court) });
  if (query.from || query.to) filters.push({ date: { gte: query.from, lte: query.to } });
  for (const token of searchTokens(query.search)) {
    filters.push({
      OR: [
        { court: contains(token) },
        { location: contains(token) },
        { notes: contains(token) },
        { case: { referenceNumber: contains(token) } },
        { case: { title: contains(token) } },
        {
          case: { client: { OR: [{ firstName: contains(token) }, { lastName: contains(token) }] } },
        },
      ],
    });
  }
  const where: Prisma.HearingWhereInput = { AND: filters };
  const [items, total] = await Promise.all([
    prisma.hearing.findMany({
      where,
      include: hearingInclude,
      orderBy: { [query.sortBy]: query.sortOrder },
      ...toSkipTake(query.page, query.pageSize),
    }),
    prisma.hearing.count({ where }),
  ]);
  return { items, meta: buildMeta(query.page, query.pageSize, total) };
}

async function findAccessibleHearing(user: AuthUser, id: string) {
  const hearing = await prisma.hearing.findUnique({ where: { id }, include: hearingInclude });
  if (!hearing) throw ApiError.notFound('Hearing not found', 'HEARING_NOT_FOUND');
  await assertCaseAccess(user, hearing.caseId);
  return hearing;
}

export function getHearing(user: AuthUser, id: string) {
  return findAccessibleHearing(user, id);
}

async function triggerReminder(hearingId: string) {
  try {
    await processHearingReminder(hearingId);
  } catch (error) {
    logger.error('Failed to evaluate hearing reminder', { hearingId, error });
  }
}

export async function createHearing(user: AuthUser, input: CreateHearingInput) {
  const caseRecord = await assertCaseAccess(user, input.caseId);
  if (caseRecord.status === 'CLOSED' || caseRecord.status === 'ARCHIVED') {
    throw ApiError.badRequest('Cannot schedule a hearing on a closed case', 'CASE_CLOSED');
  }
  const caseInfo = await prisma.case.findUniqueOrThrow({
    where: { id: input.caseId },
    select: { court: true, clientId: true },
  });
  const hearing = await prisma.hearing.create({
    data: { ...input, court: input.court ?? caseInfo.court },
    include: hearingInclude,
  });
  await logActivity({
    userId: user.id,
    action: 'hearing.created',
    entity: 'HEARING',
    entityId: hearing.id,
    caseId: hearing.caseId,
    clientId: caseInfo.clientId,
    metadata: { date: hearing.date.toISOString(), time: hearing.time, court: hearing.court },
  });
  await notifyUsers(
    await caseStakeholders(hearing.caseId),
    {
      type: 'CASE_UPDATED',
      title: 'Hearing scheduled',
      message: `${hearing.case.referenceNumber}: hearing on ${hearing.date.toISOString().slice(0, 10)} ${hearing.time}`,
      relatedEntity: 'HEARING',
      relatedEntityId: hearing.id,
      data: {
        event: 'hearing_scheduled',
        reference: hearing.case.referenceNumber,
        title: hearing.case.title,
        date: hearing.date.toISOString(),
        time: hearing.time,
      },
    },
    user.id,
  );
  await triggerReminder(hearing.id);
  return hearing;
}

export async function updateHearing(user: AuthUser, id: string, input: UpdateHearingInput) {
  const existing = await findAccessibleHearing(user, id);
  const rescheduled =
    (input.date !== undefined && input.date.getTime() !== existing.date.getTime()) ||
    (input.time !== undefined && input.time !== existing.time);

  const hearing = await prisma.hearing.update({
    where: { id },
    data: { ...input, ...(rescheduled ? { reminderSent: false } : {}) },
    include: hearingInclude,
  });
  await logActivity({
    userId: user.id,
    action: rescheduled ? 'hearing.rescheduled' : 'hearing.updated',
    entity: 'HEARING',
    entityId: id,
    caseId: hearing.caseId,
    clientId: hearing.case.client.id,
    metadata: rescheduled
      ? { from: existing.date.toISOString(), to: hearing.date.toISOString(), time: hearing.time }
      : { fields: Object.keys(input), status: hearing.status },
  });
  if (rescheduled) await triggerReminder(id);
  return hearing;
}

export async function completeHearing(
  user: AuthUser,
  id: string,
  notes: string | null | undefined,
) {
  const existing = await findAccessibleHearing(user, id);
  if (existing.status === 'CANCELLED') {
    throw ApiError.badRequest('A cancelled hearing cannot be completed', 'HEARING_CANCELLED');
  }
  const hearing = await prisma.hearing.update({
    where: { id },
    data: { status: 'COMPLETED', ...(notes ? { notes } : {}) },
    include: hearingInclude,
  });
  await logActivity({
    userId: user.id,
    action: 'hearing.completed',
    entity: 'HEARING',
    entityId: id,
    caseId: hearing.caseId,
    clientId: hearing.case.client.id,
    metadata: { date: hearing.date.toISOString() },
  });
  return hearing;
}

export async function deleteHearing(user: AuthUser, id: string) {
  const existing = await findAccessibleHearing(user, id);
  await prisma.hearing.delete({ where: { id } });
  await logActivity({
    userId: user.id,
    action: 'hearing.deleted',
    entity: 'HEARING',
    entityId: id,
    caseId: existing.caseId,
    clientId: existing.case.client.id,
    metadata: { date: existing.date.toISOString(), time: existing.time },
  });
}
