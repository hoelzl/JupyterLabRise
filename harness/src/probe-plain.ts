// Does the FAST design-token RangeError also fire in a PLAIN JupyterLab notebook
// (no RISE / no reveal)? If yes -> pure upstream/env bug. If no -> RISE embedding
// triggers it.
//   npx tsx src/probe-plain.ts [deckId] [nbRel]
import { chromium } from 'playwright';
import { startServer } from './servers.js';
import { getDeck, TOKEN } from './config.js';

function encodePath(relPath: string): string {
  return relPath.split(/[\\/]/).map(encodeURIComponent).join('/');
}

async function main() {
  const deckId = process.argv[2] ?? 'machine-learning-azav-de';
  const deck = getDeck(deckId);
  const nbRel = process.argv[3] ?? (deck.sample?.[0] as string);
  const server = await startServer('new', deck.path);
  const browser = await chromium.launch({ headless: true });
  let errCount = 0;
  try {
    const page = await browser.newPage({
      viewport: deck.viewport ?? { width: 1920, height: 1080 },
      deviceScaleFactor: 1
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error' && /Maximum call stack/.test(msg.text())) errCount++;
    });
    // Plain lab notebook view (NOT /rise/).
    const url = `${server.baseUrl}/lab/tree/${encodePath(nbRel)}?token=${TOKEN}`;
    console.log(`[probe-plain] goto ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Wait for the notebook toolbar (jp-button) to mount.
    await page.waitForSelector('jp-button, .jp-Toolbar', { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(6000);
    const nButtons = await page.evaluate(() => document.querySelectorAll('jp-button').length);
    console.log(`[probe-plain] jp-button count = ${nButtons}`);
    console.log(`[probe-plain] Maximum-call-stack errors in PLAIN notebook = ${errCount}`);
  } finally {
    await browser.close();
    server.stop();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
