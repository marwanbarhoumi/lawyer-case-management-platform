import { expect, test } from '@playwright/test';
import { expectCreated, fr, idFromUrl, login, uniqueSuffix } from './helpers';

test.describe.serial('client, case, hearing and invoice workflow', () => {
  const suffix = uniqueSuffix();
  const lastName = `E2E ${suffix}`;
  const caseTitle = `Litige commercial ${suffix}`;
  let clientId = '';
  let caseId = '';

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('creates a client', async ({ page }) => {
    await page.goto('/dashboard/clients/new');
    await page.getByLabel(fr.clients.firstName, { exact: true }).fill('Yasmine');
    await page.getByLabel(fr.clients.lastName, { exact: true }).fill(lastName);
    await page.getByRole('button', { name: fr.common.save }).click();
    await expectCreated(page);
    await page.waitForURL(/\/dashboard\/clients\/(?!new)[^/]+$/);
    clientId = idFromUrl(page);
    await expect(page.getByRole('heading', { name: new RegExp(lastName) })).toBeVisible();
  });

  test('opens a case for the client', async ({ page }) => {
    test.skip(!clientId, 'client creation failed');
    await page.goto(`/dashboard/cases/new?clientId=${clientId}`);
    await expect(page.getByRole('main').getByRole('combobox').first()).toContainText(lastName);
    await page.getByLabel(fr.cases.caseTitle, { exact: true }).fill(caseTitle);
    await page.getByRole('button', { name: fr.common.save }).click();
    await expectCreated(page);
    await page.waitForURL(/\/dashboard\/cases\/(?!new)[^/]+$/);
    caseId = idFromUrl(page);
    await expect(page.getByRole('heading', { name: caseTitle })).toBeVisible();
  });

  test('schedules a hearing for the case', async ({ page }) => {
    test.skip(!caseId, 'case creation failed');
    await page.goto(`/dashboard/hearings/new?caseId=${caseId}`);
    await expect(page.getByRole('main').getByRole('combobox').first()).toContainText(caseTitle);
    await page.getByLabel(fr.hearings.time, { exact: true }).fill('10:30');
    await page.getByRole('button', { name: fr.common.save }).click();
    await expectCreated(page);
    await page.waitForURL(/\/dashboard\/hearings\/(?!new)[^/]+$/);
    await expect(page.getByText(caseTitle).first()).toBeVisible();
  });

  test('issues an invoice for the case', async ({ page }) => {
    test.skip(!caseId, 'case creation failed');
    await page.goto(`/dashboard/invoices/new?caseId=${caseId}`);
    await page
      .getByLabel(fr.invoices.description, { exact: true })
      .fill('Honoraires de plaidoirie');
    await page.getByLabel(fr.invoices.quantity, { exact: true }).fill('2');
    await page.getByLabel(fr.invoices.unitPrice, { exact: true }).fill('1500');
    await page.getByRole('button', { name: fr.invoices.saveAndSend }).click();
    await expectCreated(page);
    await page.waitForURL(/\/dashboard\/invoices\/(?!new)[^/]+$/);
    await expect(page.getByText('Honoraires de plaidoirie')).toBeVisible();
    await expect(page.getByText(fr.enums.invoiceStatus.SENT).first()).toBeVisible();
  });
});
