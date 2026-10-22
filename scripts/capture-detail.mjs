import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
await page.goto('http://127.0.0.1:4173');
await page.getByLabel('Playback speed', { exact: true }).selectOption('16');
await page.waitForTimeout(4000);
await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
await page.getByRole('button', { name: 'Control center', exact: true }).click();
await page.getByLabel('Network', { exact: true }).selectOption('1');
await page.getByRole('button', { name: 'City overview', exact: true }).click();
await page.getByRole('button', { name: 'Play simulation', exact: true }).click();
await page.waitForTimeout(4000);
await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
await page.getByRole('button', { name: 'Toggle congestion overlay' }).click();
const canvas = page.locator('canvas');
await canvas.hover();
for (let i = 0; i < 20; i++) {
  await page.mouse.wheel(0, -100);
  await page.waitForTimeout(70);
}
await page.waitForTimeout(1500);
await canvas.screenshot({ path: 'docs/screenshots/junction-detail.png' });
await browser.close();
