// Ctrl+Shift+ArrowDown/Up are next/previous slide in the slideshow (synonyms
// of Space / Shift+Space) and must not move cells (notebook:move-cell-*).
// Presses them in command and edit mode, then the default shortcuts of the
// other structure commands (insert, delete, cut/paste, merge, split, change
// cell type), and reports the visible slide, the cell order and whether the
// "structure changed" dialog appeared.
//   npx tsx src/probe-slidenav.ts <dir-with-t.ipynb>
import { chromium, Page } from 'playwright';
import { startServer } from './servers.js';
import { TOKEN } from './config.js';

async function state(page: Page): Promise<string> {
  return page.evaluate(() => {
    const present = document.querySelector('section.present section.present, section.present');
    const heading = present?.querySelector('h1')?.textContent ?? '';
    const fragments = present?.querySelectorAll('.fragment.visible').length ?? 0;
    const nb = document.querySelector('.jp-Notebook');
    const mode = nb?.classList.contains('jp-mod-editMode') ? 'edit' : 'command';
    const order = Array.from(document.querySelectorAll('.jp-Cell'))
      .map(c => (c.querySelector('.cm-content, .jp-RenderedMarkdown')?.textContent ?? '').trim().slice(0, 12))
      .join('|');
    const dialog = document.querySelector('.jp-Dialog-header')?.textContent ?? '';
    return `slide=${JSON.stringify(heading)} frags=${fragments} mode=${mode} dialog=${JSON.stringify(dialog)}\n             order=${order}`;
  });
}

async function press(page: Page, key: string, label: string) {
  await page.keyboard.press(key);
  await page.waitForTimeout(1200);
  console.log(label.padEnd(12), await state(page));
}

async function main() {
  const dir = process.argv[2];
  const server = await startServer('new', dir);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    page.on('console', msg => {
      const t = msg.text();
      if (/RISE|key ?binding|Cannot execute|Error/i.test(t) && !/RangeError/.test(t)) console.log(`  [console] ${t.slice(0, 200)}`);
    });
    await page.goto(`${server.baseUrl}/rise/t.ipynb?token=${TOKEN}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('section.present', { timeout: 60000 });
    await page.waitForTimeout(5000);
    console.log('start'.padEnd(12), await state(page));

    // Command mode on "1+1".
    await page.locator('.jp-CodeCell .cm-content', { hasText: '1+1' }).click();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    console.log('command'.padEnd(12), await state(page));
    await press(page, 'Control+Shift+ArrowDown', 'C-S-Down');
    await press(page, 'Control+Shift+ArrowDown', 'C-S-Down');
    await press(page, 'Control+Shift+ArrowDown', 'C-S-Down');
    await press(page, 'Control+Shift+ArrowUp', 'C-S-Up');
    await press(page, 'Control+Shift+ArrowUp', 'C-S-Up');

    // Edit mode on the first code cell of the visible slide.
    await page.locator('section.present .jp-CodeCell .cm-content').first().click();
    await page.waitForTimeout(500);
    console.log('edit'.padEnd(12), await state(page));
    await press(page, 'Control+Shift+ArrowDown', 'C-S-Down');
    await press(page, 'Control+Shift+ArrowUp', 'C-S-Up');
    await press(page, 'Control+Shift+Minus', 'split');

    // Command mode: structure shortcuts must all be no-ops.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    for (const key of ['a', 'b', 'x', 'c', 'Shift+v', 'v', 'd', 'd', 'm', 'r', 'y', '1', 'Shift+m', 'Alt+Enter']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(1000);
    console.log('structure'.padEnd(12), await state(page));
  } finally {
    await browser.close();
    server.stop();
  }
}
main().catch(e => {
  console.error(e);
  process.exit(1);
});
