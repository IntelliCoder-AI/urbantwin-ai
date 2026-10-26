import { test, expect } from '@playwright/test';
test('complete traffic lab journey', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Your city. A little more intelligent.' }),
  ).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByLabel('Playback speed', { exact: true }).selectOption('16');
  await expect(page.locator('.time-code')).not.toContainText('00:00');
  await expect(page.locator('.trend-chart .recharts-area-curve')).toHaveCount(2);
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  const time = await page.locator('.time-code').textContent();
  await page.waitForTimeout(700);
  expect(await page.locator('.time-code').textContent()).toBe(time);
  await page.getByRole('button', { name: 'Toggle congestion overlay' }).click();
  await expect(page.getByRole('button', { name: 'Toggle congestion overlay' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.getByRole('button', { name: 'Reset camera' }).click();
  await page.screenshot({
    path: `docs/screenshots/overview-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Control center', exact: true }).click();
  await page.getByLabel('Network', { exact: true }).selectOption('1');
  await page.getByLabel('Random seed', { exact: true }).fill('123');
  await page.getByRole('button', { name: 'Apply seed' }).click();
  await expect(page.locator('.junction-panel .tiny').first()).toContainText('01 / 1');
  await page.getByLabel('Traffic scenario', { exact: true }).selectOption('incident');
  await page.getByRole('button', { name: 'Counterfactual lab', exact: false }).first().click();
  await expect(page.getByRole('heading', { name: 'A fair test of a better idea.' })).toBeVisible();
  await page.getByRole('button', { name: 'Run 5-seed evaluation' }).click();
  await expect(page.locator('.batch-results tbody tr')).toHaveCount(5);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download full batch' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('urbantwin-five-seeds.json');
  await page.getByRole('button', { name: 'AI insights', exact: true }).click();
  await page.getByRole('button', { name: 'Which approach waits longest?' }).click();
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(page.locator('.assistant-answer')).toContainText(
    /highest mean wait|No accumulated approach waiting/,
  );
  await page.getByRole('button', { name: 'Methodology', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Recorded SUMO evaluation' })).toBeVisible();
  await page.getByRole('button', { name: 'City overview', exact: true }).click();
  await page.getByLabel('Simulation source').selectOption('sumo');
  await expect(page.locator('.map-caption strong')).toHaveText('SUMO trace replay');
  await page.getByRole('button', { name: 'Play simulation', exact: true }).click();
  await expect(page.locator('.time-code')).not.toContainText('00:00');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
});
