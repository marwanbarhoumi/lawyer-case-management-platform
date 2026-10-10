import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/prisma';
import { startScheduler } from './jobs/scheduler';

if (env.isProduction) {
  const missing = ['APP_URL', 'CORS_ORIGIN'].filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing production configuration (frontend URL): ${missing.join(', ')}`);
  }
}

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info('API listening', { port: env.PORT, env: env.NODE_ENV, storage: env.UPLOAD_PROVIDER });
});

const scheduler = startScheduler();

function shutdown(signal: string) {
  logger.info('Shutting down', { signal });
  void scheduler?.stop();
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { error: reason });
});
