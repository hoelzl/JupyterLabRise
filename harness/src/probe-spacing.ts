// Debug probe: dump the vertical rhythm (per-block y/height/margins/line-height)
// of a target slide in either stack, so heading→list / list→list / paragraph
// spacing can be compared numerically between old RISE and the fork.
//   npx tsx src/probe-spacing.ts old|new [nbRel] [headingNeedle]
import { chromium } from 'playwright';
import { startServer } from './servers.js';
import { getDeck, TOKEN } from './config.js';

const deck = getDeck('evaluation');
const stack = (process.argv[2] as 'old' | 'new') ?? 'new';
const rel = process.argv[3] ?? '06 Copilot Kontext geben.ipynb';
const needle = process.argv[4] ?? 'vier Elementen';
const enc = rel.split(/[\\/]/).map(encodeURIComponent).join('/');

const server = await startServer(stack, deck.path);
try {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  if (stack === 'old') {
    await page.goto(`${server.baseUrl}/notebooks/${enc}?token=${TOKEN}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#notebook-container', { timeout: 60000 });
    await page.waitForTimeout(3000);
    await page.keyboard.press('Alt+r');
  } else {
    await page.goto(`${server.baseUrl}/rise/${enc}?token=${TOKEN}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  }
  await page.waitForSelector('.reveal .slides section', { timeout: 60000 });
  await page.waitForTimeout(4000);

  // Advance (Space) until the present section contains the heading needle.
  let found = false;
  for (let i = 0; i < 20; i++) {
    const has = await page.evaluate((n) => {
      const pres = document.querySelector('.reveal .slides section.present');
      return !!pres && (pres.textContent ?? '').includes(n);
    }, needle);
    if (has) { found = true; break; }
    await page.keyboard.press('Space');
    await page.waitForTimeout(600);
  }
  await page.waitForTimeout(600);

  const data = await page.evaluate((foundFlag) => {
    const pres = document.querySelector('.reveal .slides section.present') as HTMLElement | null;
    if (!pres) return { error: 'no present section', found: foundFlag };
    const rows: unknown[] = [];
    // Every rendered markdown container in the present slide, and each direct child.
    const containers = pres.querySelectorAll('.jp-RenderedHTMLCommon, .rendered_html');
    containers.forEach((cont, ci) => {
      const cr = cont.getBoundingClientRect();
      rows.push({ kind: 'CONTAINER', ci, y: Math.round(cr.y), h: Math.round(cr.height) });
      Array.from(cont.children).forEach((ch) => {
        const r = ch.getBoundingClientRect();
        const cs = getComputedStyle(ch);
        rows.push({
          kind: ch.tagName,
          ci,
          text: (ch.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 34),
          y: Math.round(r.y),
          h: Math.round(r.height),
          mt: cs.marginTop,
          mb: cs.marginBottom,
          lh: cs.lineHeight,
          fs: cs.fontSize
        });
        // first list item line-height / margin, for lists
        if (ch.tagName === 'UL' || ch.tagName === 'OL') {
          const li = ch.querySelector('li');
          if (li) {
            const lcs = getComputedStyle(li);
            rows.push({ kind: '  li', ci, lh: lcs.lineHeight, mt: lcs.marginTop, mb: lcs.marginBottom, fs: lcs.fontSize });
          }
        }
      });
    });
    return { found: foundFlag, presRect: { y: Math.round(pres.getBoundingClientRect().y), h: Math.round(pres.getBoundingClientRect().height) }, rows };
  }, found);
  console.log(`### stack=${stack} nb="${rel}" needle="${needle}"`);
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
} finally {
  server.stop();
}
