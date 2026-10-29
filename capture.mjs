import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const url = process.env.CAPTURE_URL;
const output = process.env.CAPTURE_DIR;
if (!url || !output) {
  console.error('CAPTURE_URL and CAPTURE_DIR are required.');
  process.exit(1);
}

const browserRoot = join(process.env.HOME || '', '.local/share/omgithub-playwright');
const require = createRequire(join(browserRoot, 'package.json'));
const { chromium } = require('playwright');
const config = JSON.parse(readFileSync(join(browserRoot, process.platform === 'darwin' ? 'metal.json' : 'linux.json'), 'utf8'));
if (process.platform === 'linux' && !process.env.DISPLAY) {
  process.env.DISPLAY = ':' + readFileSync(join(browserRoot, 'display'), 'utf8').trim();
}

const transient = (error) => {
  error.exitCode = 75;
  return error;
};

let browser;
try {
  mkdirSync(output, { recursive: true });
  browser = await chromium.launch({ ...config.browser.launchOptions, timeout: 30000 }).catch(transient);
  const views = [
    ['desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
    ['mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }]
  ];
  for (const [name, options] of views) {
    const context = await browser.newContext(options).catch(transient);
    const page = await context.newPage().catch(transient);
    page.setDefaultTimeout(30000);
    page.on('pageerror', (error) => console.error(`${name} page error: ${error.message}`));
    const response = await page.goto(url, { waitUntil: 'load', timeout: 45000 }).catch(transient);
    if (!response || !response.ok()) {
      const status = response ? response.status() : 0;
      throw Object.assign(new Error(`HTTP ${status} loading ${url}`), { exitCode: [0, 408, 429, 500, 502, 503, 504].includes(status) ? 75 : 1 });
    }
    await page.locator('body').waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.fonts.status === 'loaded');
    await page.waitForTimeout(500);
    const start = page.locator('#startBtn');
    if (await start.isVisible()) {
      await start.click({ force: true, timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(250);
      if (await start.isVisible()) {
        await page.evaluate(() => document.getElementById('startBtn').click());
      }
    }
    await page.locator('#titleScreen').waitFor({ state: 'hidden', timeout: 5000 });
    await page.waitForTimeout(1400);
    const canvas = page.locator('#game');
    if (!await canvas.isVisible()) throw new Error('Game canvas is not visible.');
    const size = await canvas.evaluate((element) => ({ width: element.width, height: element.height }));
    if (size.width < 100 || size.height < 100) throw new Error(`Canvas has invalid size ${size.width}x${size.height}.`);
    await page.screenshot({ path: join(output, `final-${name}.png`), timeout: 30000 }).catch((error) => {
      if (error.name === 'TimeoutError' || !browser.isConnected()) throw transient(error);
      throw error;
    });
    await context.close().catch(transient);
    console.log(`Captured ${name} view to ${join(output, `final-${name}.png`)}`);
  }
} catch (error) {
  console.error(error);
  process.exitCode = error.exitCode || 1;
} finally {
  await browser?.close().catch((error) => {
    console.error(error);
    process.exitCode ||= 75;
  });
}
