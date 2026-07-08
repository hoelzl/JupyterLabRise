// Diagnostic: reproduce and capture the `RangeError: Maximum call stack size
// exceeded` seen on the new fork's /rise/ pages. Starts the new server, opens a
// rise deck, records every pageerror + console.error (with full stack), steps a
// few slides to provoke it, then dumps deduped stacks.
//   npx tsx src/probe-rangeerror.ts [deckId] [nbRel]
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
  console.log(`[probe] deck=${deckId} nb=${nbRel}`);

  const server = await startServer('new', deck.path);
  const browser = await chromium.launch({ headless: true });

  // Collect errors with stacks; dedup by first two stack frames.
  const errors: { kind: string; text: string; stack: string }[] = [];
  const push = (kind: string, text: string, stack: string) => {
    errors.push({ kind, text, stack });
  };

  try {
    const page = await browser.newPage({
      viewport: deck.viewport ?? { width: 1920, height: 1080 },
      deviceScaleFactor: 1
    });

    page.on('pageerror', (err) => {
      push('pageerror', `${err.name}: ${err.message}`, err.stack ?? '');
    });
    page.on('console', async (msg) => {
      if (msg.type() !== 'error' && msg.type() !== 'warning') return;
      const loc = msg.location();
      let stack = `${loc.url}:${loc.lineNumber}:${loc.columnNumber}`;
      // For error events, try to pull the real Error.stack out of the logged args.
      if (msg.type() === 'error') {
        for (const arg of msg.args()) {
          try {
            const s = await arg.evaluate((v: any) =>
              v && v.stack ? String(v.stack) : null
            );
            if (s) { stack = s; break; }
          } catch { /* handle detached; ignore */ }
        }
      }
      push(`console.${msg.type()}`, msg.text(), stack);
    });

    const url = `${server.baseUrl}/rise/${encodePath(nbRel)}?token=${TOKEN}`;
    console.log(`[probe] goto ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('.reveal .slides section', { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // Step through ~15 slides to provoke recursion in slide-graph / layout code.
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(1500);

    // Also actively probe: capture the FIRST RangeError's stack straight from an
    // in-page handler (V8 gives the deepest frames before truncation).
    const inPage = await page.evaluate(() => {
      // @ts-ignore
      return (window as any).__lastRangeError ?? null;
    });
    if (inPage) push('in-page', 'captured __lastRangeError', String(inPage));
  } finally {
    await browser.close();
    server.stop();
  }

  console.log(`\n[probe] captured ${errors.length} error/warning events`);
  // Dedup by text + first frame.
  const seen = new Set<string>();
  let n = 0;
  for (const e of errors) {
    const firstFrame = (e.stack.split('\n').find((l) => l.includes('at ')) ?? e.stack.split('\n')[1] ?? '').trim();
    const dkey = `${e.text}||${firstFrame}`;
    if (seen.has(dkey)) continue;
    seen.add(dkey);
    n++;
    console.log(`\n===== [${e.kind}] (#${n}) =====`);
    console.log(e.text);
    console.log('----- stack -----');
    console.log(e.stack.split('\n').slice(0, 40).join('\n'));
  }
  console.log(`\n[probe] ${n} unique events (of ${errors.length} total)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
