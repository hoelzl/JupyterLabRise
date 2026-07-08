// Measure CLASSIC RISE layout at 3840x2160 (the target for the fork), same
// metrics as probe-layout.ts, plus a screenshot.
//   npx tsx src/probe-layout-old.ts [deckId] [nbRel]
import { chromium } from 'playwright';
import { startServer } from './servers.js';
import { getDeck, TOKEN } from './config.js';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

function encodePath(relPath: string): string {
  return relPath.split(/[\\/]/).map(encodeURIComponent).join('/');
}

async function measure(page: any) {
  return page.evaluate(() => {
    const rects: Record<string, any> = {};
    for (const [k, sel] of [
      ['reveal', '.reveal'],
      ['viewport', '.reveal-viewport, .reveal'],
      ['slides', '.reveal .slides'],
      ['present', '.reveal .slides section.present']
    ] as const) {
      const el = document.querySelector(sel);
      if (!el) { rects[k] = null; continue; }
      const b = (el as HTMLElement).getBoundingClientRect();
      rects[k] = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
    }
    const slides = document.querySelector('.reveal .slides') as HTMLElement | null;
    const slidesCS = slides ? getComputedStyle(slides) : null;
    return {
      win: { w: window.innerWidth, h: window.innerHeight },
      ...rects,
      slidesTransform: slidesCS?.transform,
      cssVars: {
        slideWidth: slidesCS?.getPropertyValue('--slide-width').trim(),
        slideHeight: slidesCS?.getPropertyValue('--slide-height').trim()
      }
    };
  });
}

async function main() {
  const deckId = process.argv[2] ?? 'machine-learning-azav-de';
  const deck = getDeck(deckId);
  const nbRel = process.argv[3] ?? (deck.sample?.[0] as string);
  const outDir = resolve(process.cwd(), '..', 'scratch-layout');
  mkdirSync(outDir, { recursive: true });
  const server = await startServer('old', deck.path);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 3840, height: 2160 }, deviceScaleFactor: 1 });
    const url = `${server.baseUrl}/notebooks/${encodePath(nbRel)}?token=${TOKEN}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#notebook-container', { timeout: 60000 });
    await page.waitForTimeout(3000);
    await page.keyboard.press('Alt+r');
    await page.waitForSelector('.reveal .slides section', { timeout: 60000 });
    await page.waitForTimeout(2500);
    const m = await measure(page);
    console.log('=== CLASSIC RISE @ 3840x2160 ===');
    console.log(JSON.stringify(m, null, 2));
    await page.screenshot({ path: resolve(outDir, 'classic-4k.png') });
    console.log(`[probe] screenshot -> ${resolve(outDir, 'classic-4k.png')}`);
  } finally {
    await browser.close();
    server.stop();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
