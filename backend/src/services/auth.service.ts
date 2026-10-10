import type { Prisma } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/api-error';
import { hashPassword, randomToken, sha256, verifyPassword } from '../utils/crypto';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { addDays } from '../utils/dates';
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
} from '../validators/auth.validators';
import { logActivity } from './activity.service';
import { sendMail } from './mail.service';

export const publicUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  role: true,
  avatar: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

export interface ClientContext {
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
// Hash compared against for unknown emails so login timing does not reveal registered accounts.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword(randomToken(16)));

async function createSession(user: PublicUser, context: ClientContext): Promise<AuthResult> {
  const expiresAt = addDays(new Date(), env.REFRESH_TOKEN_TTL_DAYS);
  const session = await prisma.userSession.create({
    data: {
      userId: user.id,
      refreshTokenHash: 'pending',
      userAgent: context.userAgent?.slice(0, 300),
      ipAddress: context.ipAddress?.slice(0, 64),
      expiresAt,
    },
  });
  const refreshToken = signRefreshToken({ sub: user.id, sid: session.id });
  await prisma.userSession.update({
    where: { id: session.id },
    data: { refreshTokenHash: sha256(refreshToken) },
  });
  const accessToken = signAccessToken({ sub: user.id, role: user.role, sid: session.id });
  return { user, accessToken, refreshToken, refreshExpiresAt: expiresAt };
}

export async function register(input: RegisterInput, context: ClientContext): Promise<AuthResult> {
  if (!env.ALLOW_REGISTRATION) {
    throw ApiError.forbidden('Registration is disabled', 'REGISTRATION_DISABLED');
  }
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing)
    throw ApiError.conflict('An account with this email already exists', 'EMAIL_IN_USE');

  const user = await prisma.user.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      passwordHash: await hashPassword(input.password),
      role: 'LAWYER',
    },
    select: publicUserSelect,
  });
  await logActivity({
    userId: user.id,
    action: 'user.registered',
    entity: 'USER',
    entityId: user.id,
  });
  return createSession(user, context);
}

export async function login(input: LoginInput, context: ClientContext): Promise<AuthResult> {
  const record = await prisma.user.findUnique({ where: { email: input.email } });
  const valid = await verifyPassword(
    input.password,
    record?.passwordHash ?? (await getDummyHash()),
  );
  if (!record || !valid) {
    throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }
  if (!record.isActive) {
    throw ApiError.forbidden('This account has been disabled', 'ACCOUNT_DISABLED');
  }
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: record.id },
    select: publicUserSelect,
  });
  await logActivity({ userId: user.id, action: 'user.login', entity: 'USER', entityId: user.id });
  return createSession(user, context);
}

/**
 * Concurrent refreshes with the same token (several tabs loading at once, a reload while a
 * refresh is in flight) share one rotation for a short time instead of tripping reuse detection.
 * Process-local: with several API instances, a concurrent request may still revoke the session.
 */
const ROTATION_GRACE_MS = 30_000;
const recentRotations = new Map<
  string,
  { sessionId: string; token: Promise<string | null>; expiresAt: number }
>();

function recentRotation(presentedHash: string, sessionId: string) {
  const now = Date.now();
  for (const [key, entry] of recentRotations) {
    if (entry.expiresAt <= now) recentRotations.delete(key);
  }
  const entry = recentRotations.get(presentedHash);
  return entry && entry.sessionId === sessionId ? entry : undefined;
}

/** Resolves to the new refresh token, or null when the session no longer accepts the presented one. */
function rotateRefreshToken(
  presentedHash: string,
  session: { id: string; userId: string },
): Promise<string | null> {
  const pending = recentRotation(presentedHash, session.id);
  if (pending) return pending.token;
  const token = (async () => {
    const next = signRefreshToken({ sub: session.userId, sid: session.id });
    const { count } = await prisma.userSession.updateMany({
      where: { id: session.id, refreshTokenHash: presentedHash, revokedAt: null },
      data: { refreshTokenHash: sha256(next) },
    });
    return count === 1 ? next : null;
  })();
  recentRotations.set(presentedHash, {
    sessionId: session.id,
    token,
    expiresAt: Date.now() + ROTATION_GRACE_MS,
  });
  return token;
}

async function revokeForReuse(sessionId: string): Promise<never> {
  await prisma.userSession.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  throw ApiError.unauthorized('Refresh token reuse detected', 'REFRESH_TOKEN_REUSED');
}

/**
 * Rotates the refresh token. Presenting an already-rotated token outside the short
 * concurrency grace period is treated as token theft: the whole session is revoked.
 */
export async function refresh(refreshToken: string | undefined): Promise<AuthResult> {
  if (!refreshToken) throw ApiError.unauthorized('Missing refresh token', 'REFRESH_TOKEN_MISSING');
  const payload = verifyRefreshToken(refreshToken);
  if (!payload) throw ApiError.unauthorized('Invalid refresh token', 'REFRESH_TOKEN_INVALID');

  const session = await prisma.userSession.findUnique({ where: { id: payload.sid } });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt < new Date() ||
    session.userId !== payload.sub
  ) {
    throw ApiError.unauthorized('Session has ended', 'SESSION_REVOKED');
  }
  const presentedHash = sha256(refreshToken);
  if (session.refreshTokenHash !== presentedHash && !recentRotation(presentedHash, session.id)) {
    await revokeForReuse(session.id);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: publicUserSelect,
  });
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Account is disabled or does not exist', 'ACCOUNT_INACTIVE');
  }

  const newRefreshToken =
    (await rotateRefreshToken(presentedHash, session)) ?? (await revokeForReuse(session.id));
  return {
    user,
    accessToken: signAccessToken({ sub: user.id, role: user.role, sid: session.id }),
    refreshToken: newRefreshToken,
    refreshExpiresAt: session.expiresAt,
  };
}

export async function logout(sessionId: string | undefined): Promise<void> {
  if (!sessionId) return;
  await prisma.userSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Resolves the session id from a refresh token (used when the access token is gone). */
export function sessionIdFromRefreshToken(token: string | undefined): string | undefined {
  return token ? verifyRefreshToken(token)?.sid : undefined;
}

export async function getProfile(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  if (!user) throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
  return user;
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<PublicUser> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: input,
    select: publicUserSelect,
  });
  await logActivity({ userId, action: 'user.profile_updated', entity: 'USER', entityId: userId });
  return user;
}

/** Changes the password and revokes every other session of the user. */
export async function changePassword(
  userId: string,
  currentSessionId: string,
  input: ChangePasswordInput,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw ApiError.badRequest('Current password is incorrect', 'INVALID_CURRENT_PASSWORD');
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(input.newPassword) },
    }),
    prisma.userSession.updateMany({
      where: { userId, id: { not: currentSessionId }, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  await logActivity({ userId, action: 'user.password_changed', entity: 'USER', entityId: userId });
}

/**
 * Issues a single-use reset token (only its hash is stored) and emails a link.
 * Always resolves, so the endpoint never reveals whether an email is registered.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return;

  const token = randomToken(32);
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    },
  });
  const link = `${env.APP_URL.replace(/\/$/, '')}/reset-password?token=${token}`;
  await sendMail({
    to: user.email,
    subject: 'Password reset / Réinitialisation du mot de passe',
    text: `Use this link within 1 hour to reset your password:\n${link}\n\nUtilisez ce lien dans l'heure pour réinitialiser votre mot de passe :\n${link}`,
  });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: sha256(token) },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw ApiError.badRequest('This reset link is invalid or has expired', 'RESET_TOKEN_INVALID');
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(password) },
    }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.userSession.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  await logActivity({
    userId: record.userId,
    action: 'user.password_reset',
    entity: 'USER',
    entityId: record.userId,
  });
}
