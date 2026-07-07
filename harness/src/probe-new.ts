// Debug probe: how does the new fork's /rise/ page expose reveal + slides?
import { chromium } from 'playwright';
import { startServer } from './servers.js';
import { getDeck, TOKEN } from './config.js';

const deck = getDeck('machine-learning-azav-de');
const rel = deck.sample![0];
const enc = rel.split(/[\\/]/).map(encodeURIComponent).join('/');

const server = await startServer('new', deck.path);
try {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0, 200)));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 200)));
  const url = `${server.baseUrl}/rise/${enc}?token=${TOKEN}`;
  console.log('goto', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  const info = await page.evaluate(() => {
    const win = window as any;
    const revealKeys = Object.keys(win).filter((k) => /reveal/i.test(k));
    return {
      title: document.title,
      hasReveal: typeof win.Reveal,
      revealKeys,
      revealSections: document.querySelectorAll('.reveal .slides section').length,
      iframes: document.querySelectorAll('iframe').length,
      bodyClass: document.body.className,
      topHTML: document.body.innerHTML.slice(0, 400)
    };
  });
  console.log('INFO', JSON.stringify(info, null, 2));
  // If there's an iframe, inspect inside it.
  const frames = page.frames();
  console.log('frames:', frames.length);
  for (const f of frames) {
    try {
      const fi = await f.evaluate(() => ({
        url: location.href.slice(0, 120),
        hasReveal: typeof (window as any).Reveal,
        sections: document.querySelectorAll('.reveal .slides section').length
      }));
      console.log('  frame', JSON.stringify(fi));
    } catch (e) {
      console.log('  frame eval failed', (e as Error).message.slice(0, 80));
    }
  }
  await page.screenshot({ path: 'C:/Users/tc/Programming/Python/Projects/JupyterLabRise/envs/new/probe.png' });
  await browser.close();
} finally {
  server.stop();
}
