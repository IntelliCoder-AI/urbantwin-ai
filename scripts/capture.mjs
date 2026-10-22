import { chromium } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
const browser = await chromium.launch({
  headless: true,
  executablePath: existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined,
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
mkdirSync('docs/screenshots', { recursive: true });
for (const [name, viewport] of [
  ['desktop', { width: 1440, height: 1100 }],
  ['mobile', { width: 390, height: 844 }],
]) {
  const page = await browser.newPage({ viewport });
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:4173');
  await page.getByLabel('Playback speed', { exact: true }).selectOption('16');
  await page.waitForFunction(
    () => {
      const t = document.querySelector('.time-code')?.textContent || '';
      return Number(t.trim().slice(0, 2)) >= 1;
    },
    {},
    { timeout: 30000 },
  );
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `docs/screenshots/overview-${name}.png`, fullPage: true });
  if (name === 'desktop') {
    await page.getByRole('button', { name: 'Counterfactual lab', exact: true }).click();
    await page.getByRole('button', { name: 'Run 5-seed evaluation' }).click();
    await page.locator('.batch-results').waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'docs/screenshots/counterfactual-lab.png', fullPage: true });
    await page.getByRole('button', { name: 'Methodology', exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'docs/screenshots/methodology.png', fullPage: true });
  }
  await page.close();
}
await browser.close();
console.log('Captured desktop, mobile, counterfactual lab and methodology.');
