import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const rateLimitBody = {
  success: false,
  message: 'Too many requests, please try again later',
  errorCode: 'RATE_LIMITED',
};

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.isTest,
  message: rateLimitBody,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.isTest,
  message: rateLimitBody,
});

/** Session refresh runs on every page load, often for a whole office behind one IP. */
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.isTest,
  message: rateLimitBody,
});
