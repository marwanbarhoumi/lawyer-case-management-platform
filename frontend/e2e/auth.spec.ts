import { expect, test } from '@playwright/test';
import { ACCOUNTS, fr, login, SEED_PASSWORD, setFrenchLocale } from './helpers';

test.describe('authentication', () => {
  test('rejects invalid credentials', async ({ page }) => {
    await setFrenchLocale(page);
    await page.goto('/login');
    await page.getByLabel(fr.auth.email).fill(ACCOUNTS.lawyer);
    await page.getByLabel(fr.auth.password).fill('wrong-password');
    await page.getByRole('button', { name: fr.auth.login }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('redirects anonymous visitors to the login page and back after login', async ({ page }) => {
    await setFrenchLocale(page);
    await page.goto('/dashboard/cases');
    await expect(page).toHaveURL(/\/login\?next=/);
    await page.getByLabel(fr.auth.email).fill(ACCOUNTS.lawyer);
    await page.getByLabel(fr.auth.password).fill(SEED_PASSWORD);
    await page.getByRole('button', { name: fr.auth.login }).click();
    await expect(page).toHaveURL(/\/dashboard\/cases$/);
  });

  test('logs in and shows the dashboard', async ({ page }) => {
    await login(page);
    await expect(page.getByText(fr.dashboard.stats.activeCases)).toBeVisible();
    await expect(page.getByText(fr.dashboard.stats.upcomingHearings)).toBeVisible();
    await expect(page.getByRole('navigation').getByText(fr.nav.hearings)).toBeVisible();
  });

  test('hides finance navigation from assistants', async ({ page }) => {
    await login(page, ACCOUNTS.assistant);
    await expect(page.getByRole('navigation').getByText(fr.nav.cases)).toBeVisible();
    await expect(page.getByRole('navigation').getByText(fr.nav.invoices)).toHaveCount(0);
  });
});
