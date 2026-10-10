import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/api-error';
import { verifyAccessToken } from '../utils/jwt';
import type { AuthUser } from '../types/auth';

/** Verifies the bearer access token and loads the (active) user from the database. */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw ApiError.unauthorized();
  }
  const payload = verifyAccessToken(header.slice(7));
  if (!payload) {
    throw ApiError.unauthorized('Invalid or expired access token', 'TOKEN_INVALID');
  }

  const [user, session] = await Promise.all([
    prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    }),
    prisma.userSession.findUnique({
      where: { id: payload.sid },
      select: { revokedAt: true, expiresAt: true },
    }),
  ]);

  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Account is disabled or does not exist', 'ACCOUNT_INACTIVE');
  }
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw ApiError.unauthorized('Session has ended', 'SESSION_REVOKED');
  }

  req.user = {
    id: user.id,
    role: user.role,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    sessionId: payload.sid,
  };
  next();
}

/** Restricts a route to the given roles. Must run after `authenticate`. */
export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw ApiError.unauthorized();
    if (!roles.includes(req.user.role)) throw ApiError.forbidden();
    next();
  };
}

export function currentUser(req: Request): AuthUser {
  if (!req.user) throw ApiError.unauthorized();
  return req.user;
}
