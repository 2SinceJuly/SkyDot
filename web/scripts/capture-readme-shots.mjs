import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:5196';
const OUT = process.env.OUT || 'docs/screenshots';
const USER = process.env.SKY_USER;
const PASS = process.env.SKY_PASS;
const CHROME =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
});

async function shot(page, name) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('captured', name);
}

// ---------- desktop ----------
const desktop = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: 'zh-CN',
});
const page = await desktop.newPage();

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await shot(page, 'desktop-light-login');

await page.evaluate(() => document.documentElement.classList.add('dark'));
await shot(page, 'desktop-dark-login');
await page.evaluate(() => document.documentElement.classList.remove('dark'));

await page.fill('#login-username', USER);
await page.fill('#login-password', PASS);
await page.evaluate(() =>
  [...document.querySelectorAll('button')]
    .find((b) => b.textContent.trim() === '登录')
    ?.click(),
);
await page.waitForTimeout(3000);

await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle' });
// 展开「试试这些话题」，让截图呈现真实可用的入口而不是空白页
await page.evaluate(() => {
  const d = document.querySelector('[data-hc-empty-state] details');
  if (d && !d.open) d.open = true;
});
await shot(page, 'desktop-light-chat');

await page.evaluate(() => document.documentElement.classList.add('dark'));
await shot(page, 'desktop-dark-chat');
await page.evaluate(() => document.documentElement.classList.remove('dark'));

await page.goto(`${BASE}/settings?tab=preferences`, {
  waitUntil: 'networkidle',
});
await shot(page, 'desktop-light-preferences');

// ---------- mobile ----------
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: 'zh-CN',
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const mp = await mobile.newPage();
await mp.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await shot(mp, 'mobile-light-login');

await browser.close();
console.log('done');
