// Deeper diagnostic for the FAST design-token RangeError. Audits: how many times
// it fires (init vs slide-change vs resize), which FAST custom elements exist in
// the slideshow DOM, and the palette/design-token CSS variable values.
//   npx tsx src/probe-fast.ts [deckId] [nbRel]
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
  const phases: Record<string, number> = {};
  let phase = 'init';

  try {
    const page = await browser.newPage({
      viewport: deck.viewport ?? { width: 1920, height: 1080 },
      deviceScaleFactor: 1
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error' && /Maximum call stack/.test(msg.text())) {
        errCount++;
        phases[phase] = (phases[phase] ?? 0) + 1;
      }
    });

    const url = `${server.baseUrl}/rise/${encodePath(nbRel)}?token=${TOKEN}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('.reveal .slides section', { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(4000);

    phase = 'slide-advance';
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(500);
    }

    phase = 'resize';
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.waitForTimeout(1500);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(1500);

    phase = 'audit';
    const audit = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const fastTags: Record<string, number> = {};
      for (const el of all) {
        const t = el.tagName.toLowerCase();
        if (t.includes('-') && (t.startsWith('jp-') || t.startsWith('jupyter-') || customElements.get(t))) {
          fastTags[t] = (fastTags[t] ?? 0) + 1;
        }
      }
      const cs = getComputedStyle(document.body);
      const vars: Record<string, string> = {};
      for (const name of [
        '--jp-layout-color0', '--jp-layout-color1', '--jp-brand-color1',
        '--jp-accent-color1', '--jp-border-color1', '--jp-ui-font-color1',
        '--jp-content-font-color1', '--jp-inverse-layout-color0',
        '--fill-color', '--neutral-palette-source', '--accent-palette-source'
      ]) {
        vars[name] = cs.getPropertyValue(name).trim();
      }
      // Is there a JupyterLab design-token root marker?
      const dtRoots = document.querySelectorAll('[data-jp-theme-name], .jp-ThemedContainer, jp-design-system-provider').length;
      return { fastTags, vars, dtRoots, totalEls: all.length };
    });

    console.log('\n=== FAST RangeError firing by phase ===');
    console.log(JSON.stringify(phases, null, 2));
    console.log(`total = ${errCount}`);
    console.log('\n=== FAST/jp- custom elements present in slideshow DOM ===');
    console.log(JSON.stringify(audit.fastTags, null, 2));
    console.log(`design-token roots = ${audit.dtRoots}, total elements = ${audit.totalEls}`);
    console.log('\n=== design-token CSS variables (on <body>) ===');
    console.log(JSON.stringify(audit.vars, null, 2));
  } finally {
    await browser.close();
    server.stop();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
