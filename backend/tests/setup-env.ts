import os from 'node:os';
import path from 'node:path';
import 'dotenv/config';

/** The suite wipes its database, so it never runs on DATABASE_URL itself: the default is `<database>_test`. */
function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  if (!process.env.DATABASE_URL) {
    throw new Error('Set TEST_DATABASE_URL (or DATABASE_URL in backend/.env) to run the tests.');
  }
  const url = new URL(process.env.DATABASE_URL);
  if (!url.pathname.endsWith('_test')) url.pathname = `${url.pathname}_test`;
  return url.toString();
}

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = testDatabaseUrl();
process.env.JWT_SECRET = 'test_access_secret_that_is_long_enough_1234567890';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_that_is_long_enough_1234567890';
process.env.APP_TIMEZONE = 'UTC';
process.env.ALLOW_REGISTRATION = 'true';
process.env.UPLOAD_PROVIDER = 'local';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), 'legal-management-test-uploads');
process.env.MAX_UPLOAD_MB = '1';
process.env.ENABLE_IN_PROCESS_SCHEDULER = 'false';
process.env.CORS_ORIGIN = 'http://localhost:3000';
