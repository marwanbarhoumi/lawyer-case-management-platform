import type { Prisma, Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { AuthUser } from '../types/auth';
import { ApiError } from '../utils/api-error';
import { hashPassword } from '../utils/crypto';
import { buildMeta, toSkipTake } from '../utils/pagination';
import type {
  CreateUserInput,
  UpdateUserInput,
  UserListQuery,
} from '../validators/user.validators';
import { logActivity } from './activity.service';
import { publicUserSelect } from './auth.service';

export async function listUsers(query: UserListQuery) {
  const where: Prisma.UserWhereInput = {
    ...(query.role ? { role: { in: query.role } } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.search
      ? {
          OR: [
            { firstName: { contains: query.search, mode: 'insensitive' } },
            { lastName: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        ...publicUserSelect,
        _count: { select: { cases: true, clients: true, caseAssignments: true } },
      },
      orderBy: { [query.sortBy]: query.sortOrder },
      ...toSkipTake(query.page, query.pageSize),
    }),
    prisma.user.count({ where }),
  ]);
  return { items, meta: buildMeta(query.page, query.pageSize, total) };
}

/** Lightweight list used to populate assignment dropdowns. */
export async function lookupUsers(roles?: Role[]) {
  return prisma.user.findMany({
    where: { isActive: true, ...(roles ? { role: { in: roles } } : {}) },
    select: { id: true, firstName: true, lastName: true, role: true, email: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });
}

export async function getUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: publicUserSelect });
  if (!user) throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
  return user;
}

export async function createUser(actor: AuthUser, input: CreateUserInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing)
    throw ApiError.conflict('An account with this email already exists', 'EMAIL_IN_USE');
  const { password, ...data } = input;
  const user = await prisma.user.create({
    data: { ...data, passwordHash: await hashPassword(password) },
    select: publicUserSelect,
  });
  await logActivity({
    userId: actor.id,
    action: 'user.created',
    entity: 'USER',
    entityId: user.id,
    metadata: { role: user.role },
  });
  return user;
}

export async function updateUser(actor: AuthUser, id: string, input: UpdateUserInput) {
  const target = await getUser(id);
  if (actor.id === id && (input.isActive === false || (input.role && input.role !== 'ADMIN'))) {
    throw ApiError.badRequest('You cannot deactivate or demote your own account', 'SELF_LOCKOUT');
  }
  if (input.email && input.email !== target.email) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing)
      throw ApiError.conflict('An account with this email already exists', 'EMAIL_IN_USE');
  }
  const { password, ...data } = input;
  const user = await prisma.user.update({
    where: { id },
    data: { ...data, ...(password ? { passwordHash: await hashPassword(password) } : {}) },
    select: publicUserSelect,
  });
  if (input.isActive === false || password) {
    await prisma.userSession.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  await logActivity({
    userId: actor.id,
    action: 'user.updated',
    entity: 'USER',
    entityId: id,
    metadata: { fields: Object.keys(data), passwordReset: Boolean(password) },
  });
  return user;
}
