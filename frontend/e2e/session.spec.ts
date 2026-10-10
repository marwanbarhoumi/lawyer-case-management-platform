import { expect, test } from '@playwright/test';
import ar from '../messages/ar.json';
import { fr, login, setLocale } from './helpers';

test.describe('session and localisation', () => {
  test('keeps the session after a full page reload (refresh cookie)', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard/hearings');
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard\/hearings$/);
    await expect(page.getByRole('link', { name: fr.nav.hearings })).toBeVisible();
  });

  test('logs out and protects the dashboard afterwards', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Karim Benali' }).click();
    await page.getByRole('menuitem', { name: fr.nav.logout }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/dashboard/clients');
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test('renders French left-to-right', async ({ page }) => {
    await setLocale(page, 'fr');
    await page.goto('/login');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.getByRole('heading', { name: fr.auth.loginTitle })).toBeVisible();
  });

  test('renders Arabic right-to-left', async ({ page }) => {
    await setLocale(page, 'ar');
    await page.goto('/login');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.getByRole('heading', { name: ar.auth.loginTitle })).toBeVisible();
    await expect(page.getByLabel(ar.auth.email)).toBeVisible();
  });
});
