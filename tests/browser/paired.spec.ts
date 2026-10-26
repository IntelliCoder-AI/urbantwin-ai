import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('paired playback remains synchronized and both exports contain reproducible results', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/lab');
  await page.getByLabel('Lab playback speed').selectOption('16');
  await expect(page.locator('.mini-time').first()).not.toContainText('00:00');
  await page.getByRole('button', { name: 'Pause both', exact: true }).click();
  const clock = await page.locator('.mini-time').first().textContent();
  await expect(page.locator('.mini-time').last()).toHaveText(clock!);
  await page.waitForTimeout(300);
  await expect(page.locator('.mini-time').first()).toHaveText(clock!);
  const singleDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export results', exact: true }).click();
  const single = JSON.parse(await readFile((await (await singleDownload).path())!, 'utf8'));
  expect(single.time).toBeGreaterThan(0);
  expect(single.fixed.time).toBe(single.adaptive.time);
  expect(single.junctionWaiting.fixed).toHaveLength(4);
  expect(single.junctionWaiting.adaptive).toHaveLength(4);
  await page.getByRole('button', { name: 'Run 5-seed evaluation' }).click();
  await expect(page.locator('.batch-results tbody tr')).toHaveCount(5);
  const batchDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download full batch' }).click();
  const batch = JSON.parse(await readFile((await (await batchDownload).path())!, 'utf8'));
  expect(batch.engine).toBe('browser');
  expect(batch.runs.map((run: { seed: number }) => run.seed)).toEqual([11, 22, 33, 44, 55]);
  for (const run of batch.runs) {
    expect(run.fixed.metrics.time).toBe(600);
    expect(run.adaptive.metrics.time).toBe(600);
    expect(run.fixed.metrics.arrived).toBe(run.adaptive.metrics.arrived);
    expect(run.fixed.metrics.waiting).toBeGreaterThan(0);
    expect(run.adaptive.metrics.waiting).toBeGreaterThan(0);
  }
  expect(errors).toEqual([]);
});
