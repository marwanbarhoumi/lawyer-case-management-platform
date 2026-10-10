import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const apiURL =
  process.env.E2E_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
const isCI = Boolean(process.env.CI);

/**
 * End-to-end tests run against a real backend seeded with `npm run db:seed`.
 * Already-running servers are reused; otherwise the production builds are started.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 1 : 0,
  forbidOnly: isCI,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    locale: 'fr-FR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run start',
      cwd: '../backend',
      url: `${apiURL}/health`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: `npx next start -p ${new URL(baseURL).port || '3000'}`,
      url: baseURL,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
