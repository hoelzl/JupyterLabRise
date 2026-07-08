// Reproduce the grey vertical bar: mimic the real portrait->fullscreen path
// (start narrow, resize up), navigate to the Tipps slide, and find any element
// that has a scrollbar / overflow at the bar's location.
//   npx tsx src/probe-greybar.ts
import { chromium } from 'playwright';
import { startServer } from './servers.js';
import { getDeck, TOKEN } from './config.js';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

function encodePath(relPath: string): string {
  return relPath.split(/[\\/]/).map(encodeURIComponent).join('/');
}

async function main() {
  const deck = getDeck('machine-learning-azav-de');
  const nb = 'Woche 01 Einführung, LLMs und Python-Setup/01 Präsenz - Kursübersicht.ipynb';
  const outDir = resolve(process.cwd(), '..', 'scratch-layout');
  mkdirSync(outDir, { recursive: true });
  const server = await startServer('new', deck.path);
  const browser = await chromium.launch({ headless: true });
  try {
    // Start NARROW (portrait-ish) to trigger the initial cramped layout.
    const p = await browser.newPage({ viewport: { width: 900, height: 1400 }, deviceScaleFactor: 1 });
    await p.goto(`${server.baseUrl}/rise/${encodePath(nb)}?token=${TOKEN}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForSelector('.reveal .slides section', { timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(2500);
    // Now grow to 4K (container-resize path -> my ResizeObserver + reveal resize).
    await p.setViewportSize({ width: 3840, height: 2160 });
    await p.waitForTimeout(1500);
    // Navigate towards the Tipps slide (several slides in).
    for (let i = 0; i < 11; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(350); }
    await p.waitForTimeout(800);

    const info = await p.evaluate(() => {
      const bad: any[] = [];
      const all = Array.from(document.querySelectorAll('.reveal *')) as HTMLElement[];
      for (const el of all) {
        const cs = getComputedStyle(el);
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) continue;
        const vScroll = el.scrollHeight - el.clientHeight > 2 && (cs.overflowY === 'auto' || cs.overflowY === 'scroll');
        const hScroll = el.scrollWidth - el.clientWidth > 2 && (cs.overflowX === 'auto' || cs.overflowX === 'scroll');
        const hasBorderR = cs.borderRightWidth !== '0px' && cs.borderRightStyle !== 'none';
        if (vScroll || hScroll || (hasBorderR && b.height > 500)) {
          bad.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.getAttribute('class') || '').slice(0, 50),
            rect: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) },
            vScroll, hScroll,
            borderRight: hasBorderR ? `${cs.borderRightWidth} ${cs.borderRightColor}` : '',
            overflow: `${cs.overflowX}/${cs.overflowY}`
          });
        }
      }
      const present = document.querySelector('.reveal section.present') as HTMLElement | null;
      const pr = present?.getBoundingClientRect();
      return { bad, present: pr ? { x: Math.round(pr.x), w: Math.round(pr.width), h: Math.round(pr.height) } : null };
    });
    console.log('present slide:', JSON.stringify(info.present));
    console.log(`suspects (scrollbar / tall right-border) = ${info.bad.length}`);
    console.log(JSON.stringify(info.bad, null, 2));
    await p.screenshot({ path: resolve(outDir, 'greybar.png') });
    console.log('screenshot -> greybar.png');
  } finally {
    await browser.close();
    server.stop();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
