// Reproduce + measure the live layout issues on /rise/ at the user's 3840x2160:
//  (1) aspect / black L-R borders, (2) portrait-first-until-navigation.
// Dumps reveal layout metrics on initial load and after one navigation, and
// screenshots both.
//   npx tsx src/probe-layout.ts [deckId] [nbRel]
import { chromium } from 'playwright';
import { startServer } from './servers.js';
import { getDeck, TOKEN } from './config.js';
import { resolve } from 'node:path';

function encodePath(relPath: string): string {
  return relPath.split(/[\\/]/).map(encodeURIComponent).join('/');
}

async function measure(page: any) {
  return page.evaluate(() => {
    const rects: Record<string, any> = {};
    for (const [k, sel] of [
      ['reveal', '.reveal'],
      ['viewport', '.reveal-viewport'],
      ['slides', '.reveal .slides'],
      ['present', '.reveal .slides section.present']
    ] as const) {
      const el = document.querySelector(sel);
      if (!el) { rects[k] = null; continue; }
      const b = (el as HTMLElement).getBoundingClientRect();
      rects[k] = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
    }
    const slides = document.querySelector('.reveal .slides') as HTMLElement | null;
    const viewport = document.querySelector('.reveal-viewport') as HTMLElement | null;
    const slidesCS = slides ? getComputedStyle(slides) : null;
    const vpCS = viewport ? getComputedStyle(viewport) : null;
    return {
      win: { w: window.innerWidth, h: window.innerHeight },
      ...rects,
      slidesTransform: slidesCS?.transform,
      slidesLeft: slidesCS?.left,
      slidesTop: slidesCS?.top,
      revealBg: vpCS?.backgroundColor,
      cssVars: {
        slideWidth: slidesCS?.getPropertyValue('--slide-width').trim(),
        slideHeight: slidesCS?.getPropertyValue('--slide-height').trim()
      },
      bodyClasses: document.body.className
    };
  });
}

async function main() {
  const deckId = process.argv[2] ?? 'machine-learning-azav-de';
  const deck = getDeck(deckId);
  const nbRel = process.argv[3] ?? (deck.sample?.[0] as string);
  const outDir = resolve(process.cwd(), '..', 'scratch-layout');
  const server = await startServer('new', deck.path);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 3840, height: 2160 }, deviceScaleFactor: 1 });
    const url = `${server.baseUrl}/rise/${encodePath(nbRel)}?token=${TOKEN}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('.reveal .slides section', { timeout: 60000 }).catch(() => {});

    // Measure ASAP (portrait-first window) at a few time points.
    for (const t of [300, 800, 1500, 3000]) {
      await page.waitForTimeout(t === 300 ? 300 : t - 0);
      const m = await measure(page);
      console.log(`\n--- t≈${t}ms (initial, no nav) ---`);
      console.log(JSON.stringify(m));
    }
    await page.screenshot({ path: resolve(outDir, 'initial.png') }).catch(async () => {
      const { mkdirSync } = await import('node:fs'); mkdirSync(outDir, { recursive: true });
      await page.screenshot({ path: resolve(outDir, 'initial.png') });
    });

    // Navigate once (Space) and re-measure — does portrait fix?
    await page.keyboard.press('Space');
    await page.waitForTimeout(1200);
    const m2 = await measure(page);
    console.log(`\n=== after 1x Space ===`);
    console.log(JSON.stringify(m2));
    await page.screenshot({ path: resolve(outDir, 'after-nav.png') });
    console.log(`\n[probe] screenshots -> ${outDir}`);
  } finally {
    await browser.close();
    server.stop();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
