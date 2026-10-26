import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('completed run restarts and exports a fresh matched experiment', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByLabel('Playback speed', { exact: true }).selectOption('16');
  await expect(page.locator('.time-code')).toHaveText('10:00 / 10:00', { timeout: 100000 });
  await page.getByRole('button', { name: 'AI insights', exact: true }).click();
  await page
    .getByRole('button', {
      name: 'Which intersection had the most waiting over the run?',
      exact: true,
    })
    .click();
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(page.locator('.assistant-answer')).toContainText('completed-run ranking');
  await expect(page.locator('.assistant-answer')).toContainText('vehicle-seconds');
  await page
    .getByRole('button', { name: 'Which intersection is most congested right now?', exact: true })
    .click();
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(page.locator('.assistant-answer')).toContainText('no current congestion leader');
  await page.getByRole('button', { name: 'City overview', exact: true }).click();
  // The old interval has stopped at this point. Restart must install a new timer.
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Restart simulation', exact: true }).click();
  await expect(page.locator('.time-code')).not.toContainText('10:00 / 10:00');
  await expect(page.locator('.time-code')).not.toContainText('00:00 /');
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export results', exact: true }).click();
  const file = await pending;
  const result = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(result.engine).toBe('UrbanTwin browser model v1');
  expect(result.time).toBeGreaterThan(0);
  expect(result.time).toBeLessThan(600);
  expect(result.fixed.time).toBe(result.adaptive.time);
  expect(result.junctionWaiting.unit).toBe('vehicle-seconds');
  expect(result.junctionWaiting.fixed).toHaveLength(4);
  expect(result.junctionWaiting.adaptive).toHaveLength(4);
  expect(errors).toEqual([]);
});

test('scenario, demand, selection, replay and assistant controls remain consistent', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  await page.getByLabel('Selected intersection').selectOption('3');
  await expect(page.locator('.junction-panel .tiny').first()).toContainText('04 / 4');
  await page.getByRole('button', { name: 'Fixed-time', exact: true }).click();
  await page.getByRole('button', { name: 'Adaptive', exact: true }).click();
  await page.getByRole('button', { name: 'Control center', exact: true }).click();
  await page.getByRole('slider').fill('1.7');
  await expect(page.getByText('Traffic demand · 1.7×')).toBeVisible();
  await page.getByRole('button', { name: 'AI insights', exact: true }).click();
  await page.getByRole('button', { name: 'Which approach waits longest?' }).click();
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(page.locator('.assistant-answer')).toBeVisible();
  await page.getByLabel('Traffic scenario', { exact: true }).selectOption('normal');
  await expect(page.locator('.assistant-answer')).toHaveCount(0);
  await page.getByLabel('Simulation source').selectOption('sumo');
  for (const scenario of ['normal', 'rush', 'incident']) {
    await page.getByLabel('Traffic scenario', { exact: true }).selectOption(scenario);
    await expect(page.getByText('Loading recorded SUMO experiment…')).toHaveCount(0);
    await page.getByRole('button', { name: 'Control center', exact: true }).click();
    await expect(page.getByLabel('Network', { exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'City overview', exact: true }).click();
    await expect(page.locator('.map-caption strong')).toHaveText('SUMO trace replay');
    await page.getByRole('button', { name: 'Play simulation', exact: true }).click();
    await expect(page.locator('.time-code')).not.toContainText('00:00 /');
    await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  }
  // A failed trace must provide a usable live fallback, not an empty frozen scene.
  await page.route('**/data/sumo-normal-42.json', (route) =>
    route.fulfill({ status: 503, body: '' }),
  );
  await page.getByLabel('Traffic scenario', { exact: true }).selectOption('normal');
  await expect(page.getByLabel('Simulation source')).toHaveValue('browser');
  await expect(page.locator('.notice')).toContainText('SUMO replay is unavailable');
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await expect(page.locator('.notice')).toHaveCount(0);
  expect(errors).toEqual([]);
});
