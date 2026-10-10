import type { Prisma, Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { AuthUser } from '../types/auth';
import { ApiError } from '../utils/api-error';

/**
 * Row-level access rules (enforced server-side for every query):
 * - ADMIN sees everything.
 * - LAWYER sees cases they lead or are assigned to, and clients they own or that have such cases.
 * - ASSISTANT sees only cases they are assigned to and the clients of those cases.
 */
type Actor = Pick<AuthUser, 'id' | 'role'>;

export function caseScope(user: Actor): Prisma.CaseWhereInput {
  if (user.role === 'ADMIN') return {};
  if (user.role === 'LAWYER') {
    return { OR: [{ lawyerId: user.id }, { assignments: { some: { userId: user.id } } }] };
  }
  return { assignments: { some: { userId: user.id } } };
}

export function clientScope(user: Actor): Prisma.ClientWhereInput {
  if (user.role === 'ADMIN') return {};
  if (user.role === 'LAWYER') {
    return { OR: [{ lawyerId: user.id }, { cases: { some: caseScope(user) } }] };
  }
  return { cases: { some: caseScope(user) } };
}

export function hearingScope(user: Actor): Prisma.HearingWhereInput {
  return user.role === 'ADMIN' ? {} : { case: caseScope(user) };
}

export function documentScope(user: Actor): Prisma.DocumentWhereInput {
  if (user.role === 'ADMIN') return {};
  return {
    OR: [{ case: caseScope(user) }, { caseId: null, client: clientScope(user) }],
  };
}

export function contractScope(user: Actor): Prisma.ContractWhereInput {
  return user.role === 'ADMIN' ? {} : { client: clientScope(user) };
}

export function invoiceScope(user: Actor): Prisma.InvoiceWhereInput {
  return user.role === 'ADMIN' ? {} : { client: clientScope(user) };
}

/** Throws 404 when the case does not exist and 403 when the user may not access it. */
export async function assertCaseAccess(user: Actor, caseId: string) {
  const record = await prisma.case.findUnique({
    where: { id: caseId },
    select: { id: true, lawyerId: true, clientId: true, status: true },
  });
  if (!record) throw ApiError.notFound('Case not found', 'CASE_NOT_FOUND');
  const allowed = await prisma.case.count({ where: { AND: [{ id: caseId }, caseScope(user)] } });
  if (!allowed) throw ApiError.forbidden('You do not have access to this case', 'CASE_FORBIDDEN');
  return record;
}

/** Only admins and the case's lead lawyer can modify the case itself. */
export function assertCaseManager(user: Actor, record: { lawyerId: string }) {
  if (user.role === 'ADMIN') return;
  if (user.role === 'LAWYER' && record.lawyerId === user.id) return;
  throw ApiError.forbidden('Only the responsible lawyer can modify this case', 'CASE_FORBIDDEN');
}

export async function assertClientAccess(user: Actor, clientId: string) {
  const record = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, lawyerId: true, isArchived: true },
  });
  if (!record) throw ApiError.notFound('Client not found', 'CLIENT_NOT_FOUND');
  const allowed = await prisma.client.count({
    where: { AND: [{ id: clientId }, clientScope(user)] },
  });
  if (!allowed)
    throw ApiError.forbidden('You do not have access to this client', 'CLIENT_FORBIDDEN');
  return record;
}

/** Ensures the user exists, is active and has one of the given roles. */
export async function assertActiveUserWithRole(userId: string, roles: Role[], label: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true },
  });
  if (!user || !user.isActive || !roles.includes(user.role)) {
    throw ApiError.badRequest(`Invalid ${label}`, 'INVALID_ASSIGNEE');
  }
  return user;
}

/** Returns the users that must be informed about activity on a case (lead lawyer + assignees). */
export async function caseStakeholders(caseId: string): Promise<string[]> {
  const record = await prisma.case.findUnique({
    where: { id: caseId },
    select: { lawyerId: true, assignments: { select: { userId: true } } },
  });
  if (!record) return [];
  return [...new Set([record.lawyerId, ...record.assignments.map((item) => item.userId)])];
}
