import { expect, type Page } from '@playwright/test';
import fr from '../messages/fr.json';

export { fr };

export const SEED_PASSWORD = process.env.E2E_PASSWORD ?? 'Demo@2026';

export const ACCOUNTS = {
  admin: 'admin@example.com',
  lawyer: 'lawyer@example.com',
  assistant: 'assistant@example.com',
} as const;

/** Unique suffix so repeated runs never collide on unique columns. */
export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`.toUpperCase();
}

export async function setLocale(page: Page, locale: 'fr' | 'ar'): Promise<void> {
  const url = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:3000');
  await page
    .context()
    .addCookies([{ name: 'NEXT_LOCALE', value: locale, domain: url.hostname, path: '/' }]);
}

export async function setFrenchLocale(page: Page): Promise<void> {
  await setLocale(page, 'fr');
}

export async function login(page: Page, email: string = ACCOUNTS.lawyer): Promise<void> {
  await setFrenchLocale(page);
  await page.goto('/login');
  await page.getByLabel(fr.auth.email).fill(email);
  await page.getByLabel(fr.auth.password).fill(SEED_PASSWORD);
  await page.getByRole('button', { name: fr.auth.login }).click();
  await page.waitForURL('**/dashboard');
  await expect(page.getByText(fr.dashboard.stats.clients)).toBeVisible();
}

/** Every successful create shows the same toast; wait for it before reading the new URL. */
export async function expectCreated(page: Page): Promise<void> {
  await expect(page.getByText(fr.common.created)).toBeVisible();
}

export function idFromUrl(page: Page): string {
  const id = new URL(page.url()).pathname.split('/').pop();
  if (!id) throw new Error(`No id in ${page.url()}`);
  return id;
}
