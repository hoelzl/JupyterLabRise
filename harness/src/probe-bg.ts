// Check background-color of each slideshow layer, to confirm the fullscreen
// black-border cause (transparent .reveal -> black ::backdrop shows in margins).
//   npx tsx src/probe-bg.ts [deckId] [nbRel]
import { chromium } from 'playwright';
import { startServer } from './servers.js';
import { getDeck, TOKEN } from './config.js';

function encodePath(relPath: string): string {
  return relPath.split(/[\\/]/).map(encodeURIComponent).join('/');
}

async function main() {
  const deck = getDeck(process.argv[2] ?? 'machine-learning-azav-de');
  const nb = process.argv[3] ?? (deck.sample?.[0] as string);
  const server = await startServer('new', deck.path);
  const browser = await chromium.launch({ headless: true });
  try {
    const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await p.goto(`${server.baseUrl}/rise/${encodePath(nb)}?token=${TOKEN}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForSelector('.reveal .slides section', { timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(2500);
    const r = await p.evaluate(() => {
      const out: Record<string, string> = {};
      for (const [k, sel] of [['html', 'html'], ['body', 'body'], ['reveal', '.reveal'], ['viewport', '.reveal-viewport'], ['slides', '.reveal .slides'], ['present', '.reveal section.present']] as const) {
        const el = document.querySelector(sel);
        out[k] = el ? getComputedStyle(el as HTMLElement).backgroundColor : 'MISSING';
      }
      out['--r-background-color'] = getComputedStyle(document.documentElement).getPropertyValue('--r-background-color').trim();
      return out;
    });
    console.log(JSON.stringify(r, null, 2));
  } finally {
    await browser.close();
    server.stop();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
