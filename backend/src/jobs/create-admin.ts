/**
 * Creates the first administrator of an empty (production) database without touching existing data:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_FIRST_NAME=... ADMIN_LAST_NAME=... npm run admin:create
 * Inputs are read from the environment so the password never appears in shell arguments.
 */
import { ZodError } from 'zod';
import { prisma } from '../config/prisma';
import { hashPassword } from '../utils/crypto';
import { registerSchema } from '../validators/auth.validators';

const VARIABLES: Record<string, string> = {
  email: 'ADMIN_EMAIL',
  password: 'ADMIN_PASSWORD',
  firstName: 'ADMIN_FIRST_NAME',
  lastName: 'ADMIN_LAST_NAME',
};

async function createAdmin(): Promise<string> {
  const input = registerSchema.parse(
    Object.fromEntries(
      Object.entries(VARIABLES).map(([field, name]) => [field, process.env[name]]),
    ),
  );

  if (await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } })) {
    throw new Error('An account with this email already exists; nothing was changed.');
  }

  await prisma.user.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: 'ADMIN',
    },
  });
  return input.email;
}

createAdmin()
  .then((email) => {
    console.log(JSON.stringify({ level: 'info', message: 'Administrator created', email }));
    process.exitCode = 0;
  })
  .catch((error: unknown) => {
    const reason =
      error instanceof ZodError
        ? error.issues.map((issue) => `${VARIABLES[String(issue.path[0])]}: ${issue.message}`)
        : String(error);
    console.error(JSON.stringify({ level: 'error', message: 'Administrator not created', reason }));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
