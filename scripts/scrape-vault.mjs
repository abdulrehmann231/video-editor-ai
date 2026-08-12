import { chromium } from 'playwright-core';
import fs from 'node:fs';

const EXEC = '/home/daytona/project/node_modules/.remotion/chrome-headless-shell/linux64/chrome-headless-shell-linux64/chrome-headless-shell';
const URL = 'https://luis-alcantara.notion.site/Editing-Inspiration-Vault-41d0e9221a6d400ea236594084cf989c';
const OUT = '/tmp/vault';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process', '--no-zygote'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 2000 } });
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
console.log('loaded');
await page.waitForTimeout(4000);

// Scroll to force lazy loading of the gallery
let prev = 0, stable = 0;
for (let i = 0; i < 30; i++) {
  await page.mouse.wheel(0, 2400);
  await page.waitForTimeout(400);
  const h = await page.evaluate(() => document.body.scrollHeight);
  if (h === prev) { stable++; if (stable > 4) break; } else stable = 0;
  prev = h;
  if (i % 5 === 0) console.log('scroll', i, 'h=', h);
}
await page.waitForTimeout(1500);

// Collect all media (img/video) with src + nearest text
const media = await page.evaluate(() => {
  const out = [];
  const imgs = Array.from(document.querySelectorAll('img'));
  for (const im of imgs) {
    const src = im.currentSrc || im.src;
    if (!src || src.startsWith('data:')) continue;
    out.push({ type: 'img', src, alt: im.alt || '', w: im.naturalWidth, h: im.naturalHeight });
  }
  for (const v of Array.from(document.querySelectorAll('video'))) {
    out.push({ type: 'video', src: v.currentSrc || v.src || (v.querySelector('source')?.src) });
  }
  return out;
});

// Also grab any gallery card titles
const titles = await page.evaluate(() =>
  Array.from(document.querySelectorAll('[class*="collection"] [class*="title"], .notion-collection-item, [role="button"]'))
    .map(e => e.textContent?.trim()).filter(Boolean).slice(0, 400)
);

fs.writeFileSync(`${OUT}/media.json`, JSON.stringify(media, null, 2));
fs.writeFileSync(`${OUT}/titles.json`, JSON.stringify(titles, null, 2));
await page.screenshot({ path: `${OUT}/fullpage.png`, fullPage: false });
console.log('media count:', media.length);
console.log('gif/video count:', media.filter(m => m.type==='video' || /\.gif/i.test(m.src)).length);
await browser.close();
