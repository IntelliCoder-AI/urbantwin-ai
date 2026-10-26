import { test, expect } from '@playwright/test';

test('deep links, history and unknown routes retain application navigation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/insights');
  await expect(
    page.getByRole('heading', { name: 'Your traffic intelligence assistant' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Methodology', exact: true }).click();
  await expect(page).toHaveURL(/\/methodology$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/insights$/);
  await page.goForward();
  await expect(page.getByRole('region', { name: 'SUMO-only evaluation' })).toContainText(
    'SUMO ONLY',
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Recorded SUMO evaluation' })).toBeVisible();
  await page.goto('/does-not-exist');
  await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await page.getByRole('button', { name: 'Return to city overview' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('footer').getByRole('link', { name: 'GitHub source' })).toHaveAttribute(
    'href',
    'https://github.com/IntelliCoder-AI/urbantwin-ai',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
});

test('seed edits are validated before applying and both views offer 2x speed', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/control-center');
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  const seed = page.getByLabel('Random seed', { exact: true });
  const timestamp = await page.locator('.time-code').textContent();
  for (const invalid of ['abc', '-1', '1.5', '', '1000000']) {
    await seed.fill(invalid);
    await expect(seed).toHaveValue(invalid);
    await expect(seed).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('alert')).toContainText('The applied seed has not changed');
    await expect(page.getByRole('button', { name: 'Apply seed' })).toBeDisabled();
    await expect(page.locator('.scenario-bar .seed')).toHaveText('SEED 42');
    await expect(page.locator('.time-code')).toHaveText(timestamp!);
  }
  await seed.fill('123');
  await expect(page.locator('.scenario-bar .seed')).toHaveText('SEED 42');
  await page.getByRole('button', { name: 'Apply seed' }).click();
  await expect(page.locator('.scenario-bar .seed')).toHaveText('SEED 123');
  await expect(page.locator('.time-code')).toHaveText('00:00 / 10:00');
  await expect(
    page.getByRole('heading', { name: 'Fixed controller parameters · read-only' }),
  ).toBeVisible();
  const speeds = await page
    .getByLabel('Playback speed', { exact: true })
    .locator('option')
    .evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value));
  await page.getByRole('button', { name: 'Counterfactual lab', exact: true }).click();
  const labSpeed = page.getByLabel('Lab playback speed');
  expect(
    await labSpeed
      .locator('option')
      .evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value)),
  ).toEqual(speeds);
  await labSpeed.selectOption('2');
  expect(errors).toEqual([]);
});

test('Ask answers junction intent, declines pizza and describes its evidence', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByLabel('Playback speed', { exact: true }).selectOption('16');
  await page.waitForFunction(
    () => Number(document.querySelector('.time-code')?.textContent?.slice(3, 5)) >= 10,
  );
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  await page.getByRole('button', { name: 'AI insights', exact: true }).click();
  const input = page.getByLabel('Ask traffic assistant');
  await input.fill('Which intersection is most congested in rush hour and why?');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(page.locator('.assistant-answer')).toContainText('highest approaching demand');
  await expect(page.locator('.assistant-answer')).toContainText('live browser model, rush hour');
  await input.fill('best pizza recipe in Naples?');
  await input.press('Enter');
  await expect(page.locator('.assistant-answer')).toContainText(
    'I can only answer questions about this simulation',
  );
  await expect(page.locator('.assistant-answer')).not.toContainText('mean waiting');
  await expect(page.locator('.assistant-answer')).toHaveAttribute('aria-live', 'polite');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
});
