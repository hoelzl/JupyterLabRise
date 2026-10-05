// Does Shift+Enter on the last code cell of a slide stay on that slide?
// Runs the slideshow, focuses a cell, presses Shift+Enter in edit and in
// command mode, and reports the visible slide + active cell before/after.
//   npx tsx src/probe-smartexec.ts <dir-with-t.ipynb>
import { chromium, Page } from 'playwright';
import { startServer } from './servers.js';
import { TOKEN } from './config.js';

async function state(page: Page): Promise<string> {
  return page.evaluate(() => {
    const present = document.querySelector('section.present section.present, section.present');
    const active = document.querySelector('.jp-Cell.jp-mod-active .cm-content');
    const nb = document.querySelector('.jp-Notebook');
    const mode = nb?.classList.contains('jp-mod-editMode') ? 'edit' : 'command';
    const focus = document.activeElement?.className?.toString().slice(0, 60);
    return `slide=${present?.id} active=${JSON.stringify(active?.textContent)} mode=${mode} focus=${focus}`;
  });
}

async function main() {
  const dir = process.argv[2];
  const server = await startServer('new', dir);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    page.on('console', msg => {
      const t = msg.text();
      if (/RISE|smart|key ?binding|Cannot execute/i.test(t)) console.log(`  [console] ${t.slice(0, 200)}`);
    });
    await page.goto(`${server.baseUrl}/rise/t.ipynb?token=${TOKEN}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('section.present', { timeout: 60000 });
    await page.waitForTimeout(5000);
    console.log('start      ', await state(page));

    // Edit mode on "2+2" (last cell of slide A), then Shift+Enter.
    await page.locator('.jp-CodeCell .cm-content', { hasText: '2+2' }).click();
    await page.waitForTimeout(800);
    console.log('edit 2+2   ', await state(page));
    await page.keyboard.press('Shift+Enter');
    await page.waitForTimeout(2500);
    console.log('after S-E  ', await state(page));

    // Command mode on "2+2", then Shift+Enter.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    console.log('command    ', await state(page));
    await page.keyboard.press('Shift+Enter');
    await page.waitForTimeout(2500);
    console.log('after S-E  ', await state(page));
  } finally {
    await browser.close();
    server.stop();
  }
}
main().catch(e => {
  console.error(e);
  process.exit(1);
});
