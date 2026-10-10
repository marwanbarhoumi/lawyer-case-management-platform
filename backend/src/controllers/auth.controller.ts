import type { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env';
import { currentUser } from '../middleware/auth';
import * as authService from '../services/auth.service';
import { verifyAccessToken } from '../utils/jwt';
import { sendSuccess } from '../utils/response';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '../validators/auth.validators';

export const REFRESH_COOKIE = 'lm_refresh';

/**
 * The refresh token lives in an httpOnly cookie scoped to /api/auth. In production the
 * frontend (Vercel) and API (Render) are on different sites, so the cookie must be
 * `SameSite=None; Secure` (and partitioned for browsers blocking third-party cookies).
 */
function cookieOptions(expires?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'none' : 'lax',
    partitioned: env.isProduction,
    path: '/api/auth',
    ...(expires ? { expires } : {}),
  };
}

function context(req: Request): authService.ClientContext {
  return { userAgent: req.get('user-agent'), ipAddress: req.ip };
}

function respondWithSession(res: Response, result: authService.AuthResult, status = 200) {
  res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions(result.refreshExpiresAt));
  sendSuccess(res, { user: result.user, accessToken: result.accessToken }, status);
}

function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' ? value : undefined;
}

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  respondWithSession(res, await authService.register(input, context(req)), 201);
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  respondWithSession(res, await authService.login(input, context(req)));
}

export async function refresh(req: Request, res: Response) {
  try {
    respondWithSession(res, await authService.refresh(readRefreshCookie(req)));
  } catch (error) {
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
    throw error;
  }
}

/** Logout works with either credential: the bearer access token or the refresh cookie. */
export async function logout(req: Request, res: Response) {
  const header = req.headers.authorization;
  const fromAccessToken = header?.startsWith('Bearer ')
    ? verifyAccessToken(header.slice(7))?.sid
    : undefined;
  const sessionId =
    fromAccessToken ?? authService.sessionIdFromRefreshToken(readRefreshCookie(req));
  await authService.logout(sessionId);
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
  sendSuccess(res, { loggedOut: true });
}

export async function me(req: Request, res: Response) {
  sendSuccess(res, await authService.getProfile(currentUser(req).id));
}

export async function updateProfile(req: Request, res: Response) {
  const input = updateProfileSchema.parse(req.body);
  sendSuccess(res, await authService.updateProfile(currentUser(req).id, input));
}

export async function changePassword(req: Request, res: Response) {
  const user = currentUser(req);
  await authService.changePassword(user.id, user.sessionId, changePasswordSchema.parse(req.body));
  sendSuccess(res, { updated: true });
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = forgotPasswordSchema.parse(req.body);
  await authService.requestPasswordReset(email);
  sendSuccess(res, { sent: true });
}

export async function resetPassword(req: Request, res: Response) {
  const { token, password } = resetPasswordSchema.parse(req.body);
  await authService.resetPassword(token, password);
  sendSuccess(res, { reset: true });
}
