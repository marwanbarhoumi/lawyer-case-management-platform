import type { Role } from '@prisma/client';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { hashPassword } from '../src/utils/crypto';

export const app = createApp();
export const PASSWORD = 'Password123';

let passwordHash: string | null = null;

export async function resetDatabase(): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${tables.map((table) => `"${table.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`,
    );
  }
}

let counter = 0;

export async function createUser(
  role: Role,
  overrides: { email?: string; isActive?: boolean } = {},
) {
  passwordHash ??= await hashPassword(PASSWORD);
  counter += 1;
  return prisma.user.create({
    data: {
      firstName: `${role.toLowerCase()}${counter}`,
      lastName: 'Test',
      email: overrides.email ?? `${role.toLowerCase()}${counter}-${Date.now()}@test.local`,
      role,
      passwordHash,
      isActive: overrides.isActive ?? true,
    },
  });
}

export async function login(email: string, password = PASSWORD) {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  if (response.status !== 200)
    throw new Error(`Login failed: ${response.status} ${JSON.stringify(response.body)}`);
  return {
    token: response.body.data.accessToken as string,
    cookie: response.headers['set-cookie'] as unknown as string[],
  };
}

/** Creates a user of the given role and returns it with a bearer header ready for supertest. */
export async function actor(role: Role) {
  const user = await createUser(role);
  const { token } = await login(user.email);
  return { user, auth: { Authorization: `Bearer ${token}` } };
}

export async function createClientFor(lawyerId: string | null, name = 'Client') {
  counter += 1;
  return prisma.client.create({
    data: {
      firstName: name,
      lastName: `Number${counter}`,
      email: `client${counter}@test.local`,
      phone: `06000${counter}`,
      lawyerId,
    },
  });
}

export async function createCaseFor(
  lawyerId: string,
  clientId: string,
  assistantIds: string[] = [],
) {
  counter += 1;
  return prisma.case.create({
    data: {
      referenceNumber: `TEST-${counter}-${Date.now()}`,
      title: `Case ${counter}`,
      clientId,
      lawyerId,
      court: 'Tribunal de Commerce',
      assignments: { create: assistantIds.map((userId) => ({ userId })) },
    },
  });
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
