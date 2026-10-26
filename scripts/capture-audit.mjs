import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
const browser = await chromium.launch({
  executablePath: existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined,
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
await page.goto(`${process.env.BASE_URL || 'http://127.0.0.1:4173'}/control-center`);
await page.getByLabel('Playback speed', { exact: true }).selectOption('16');
await page.waitForFunction(
  () => Number(document.querySelector('.time-code')?.textContent?.slice(3, 5)) >= 10,
);
await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
await page.getByLabel('Random seed', { exact: true }).fill('-1');
await page.locator('.settings').screenshot({ path: 'docs/screenshots/seed-validation.png' });
await page.getByRole('button', { name: 'AI insights', exact: true }).click();
await page
  .getByLabel('Ask traffic assistant')
  .fill('Which intersection is most congested in rush hour and why?');
await page.getByRole('button', { name: 'Ask', exact: true }).click();
await page.locator('.assistant').screenshot({ path: 'docs/screenshots/assistant-evidence.png' });
await page.getByRole('button', { name: 'Methodology', exact: true }).click();
await page
  .getByRole('region', { name: 'SUMO-only evaluation' })
  .screenshot({ path: 'docs/screenshots/sumo-evidence.png' });
await browser.close();
console.log(JSON.stringify({ consoleAndPageErrors: errors }));
if (errors.length) process.exitCode = 1;
