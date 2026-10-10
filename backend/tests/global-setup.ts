import { execSync } from 'node:child_process';
import './setup-env';

/** Applies migrations to the dedicated test database before the suite runs. */
export default function globalSetup(): void {
  execSync('npx prisma migrate deploy', {
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  });
}
