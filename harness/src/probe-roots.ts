// Why are there 3 FAST design-token roots under RISE (vs 1 in plain Lab)?
// Dump each jp-ThemedContainer / design-system provider node + ancestry, to see
// if reveal duplicated/nested them (a structural cause of the token-tree cycle).
//   npx tsx src/probe-roots.ts [deckId] [nbRel]
import { chromium } from 'playwright';
import { startServer } from './servers.js';
import { getDeck, TOKEN } from './config.js';

function encodePath(relPath: string): string {
  return relPath.split(/[\\/]/).map(encodeURIComponent).join('/');
}

async function dump(baseUrl: string, deck: any, nbRel: string, rise: boolean) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: deck.viewport ?? { width: 1920, height: 1080 },
      deviceScaleFactor: 1
    });
    const url = rise
      ? `${baseUrl}/rise/${encodePath(nbRel)}?token=${TOKEN}`
      : `${baseUrl}/lab/tree/${encodePath(nbRel)}?token=${TOKEN}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('.jp-Notebook, .reveal .slides section', { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(rise ? 4000 : 6000);
    const res = await page.evaluate(() => {
      const sel = '.jp-ThemedContainer, jp-design-system-provider, [data-jp-theme-name]';
      const nodes = Array.from(document.querySelectorAll(sel));
      const rows: any[] = [];
      for (const el of nodes) {
        const chain: string[] = [];
        let n: Element | null = el.parentElement;
        let depth = 0;
        while (n && n.tagName !== 'HTML' && depth++ < 15) {
          const cls = (n.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 2).join('.');
          chain.push(n.tagName.toLowerCase() + (cls ? '.' + cls : ''));
          n = n.parentElement;
        }
        rows.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.getAttribute('class') || '').slice(0, 60),
          theme: el.getAttribute('data-jp-theme-name') || '',
          childCount: el.childElementCount,
          parents: chain.join(' < ')
        });
      }
      return rows;
    });
    return res;
  } finally {
    await browser.close();
  }
}

async function main() {
  const deckId = process.argv[2] ?? 'machine-learning-azav-de';
  const deck = getDeck(deckId);
  const nbRel = process.argv[3] ?? (deck.sample?.[0] as string);
  const server = await startServer('new', deck.path);
  try {
    console.log('=== PLAIN /lab/tree design-token roots ===');
    console.log(JSON.stringify(await dump(server.baseUrl, deck, nbRel, false), null, 2));
    console.log('\n=== RISE /rise design-token roots ===');
    console.log(JSON.stringify(await dump(server.baseUrl, deck, nbRel, true), null, 2));
  } finally {
    server.stop();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
