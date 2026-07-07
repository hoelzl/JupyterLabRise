// Capture a notebook's slides under a given stack (old classic RISE / new fork).
// Both stacks converge on a reveal.js page exposing a global `Reveal`, so the
// slide-walking + screenshot logic is shared; only "enter slideshow" differs.
import { chromium, Browser, Page } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { StackName, ServerHandle } from './servers.js';
import { TOKEN, Viewport } from './config.js';

// Chrome we hide on BOTH stacks so diffs focus on slide *content*, not reveal/RISE UI.
const HIDE_CHROME = `
  .reveal .controls, .reveal .progress, .reveal .slide-number,
  .reveal .playback, .reveal .speaker-notes,
  #help-b, #exit-b, .reveal .help-button, .reveal .exit-button,
  .rise-enter-fullscreen, .rise-help, .rise-exit { display: none !important; }
  * { caret-color: transparent !important; }
`;

function encodePath(relPath: string): string {
  return relPath.split(/[\\/]/).map(encodeURIComponent).join('/');
}

async function enterSlideshow(
  page: Page,
  stack: StackName,
  baseUrl: string,
  relPath: string
): Promise<void> {
  const enc = encodePath(relPath);
  if (stack === 'old') {
    const url = `${baseUrl}/notebooks/${enc}?token=${TOKEN}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#notebook-container', { timeout: 60000 });
    await page.waitForTimeout(3000); // let the RISE nbextension register
    await page.keyboard.press('Alt+r');
  } else {
    const url = `${baseUrl}/rise/${enc}?token=${TOKEN}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  }
  await page.waitForSelector('.reveal .slides section', { timeout: 60000 });
  await page.waitForFunction(() => typeof (window as any).Reveal !== 'undefined', undefined, {
    timeout: 60000
  });
  await page.addStyleTag({ content: HIDE_CHROME });
  await page.waitForTimeout(1500);
}

export interface SlideShot {
  key: string; // `${h}-${v}`
  h: number;
  v: number;
  file: string; // absolute path
}

export interface CaptureResult {
  stack: StackName;
  relPath: string;
  outDir: string;
  slides: SlideShot[];
}

/** Walk the reveal slide grid, fully revealing fragments, one screenshot per (h,v). */
async function walk(page: Page, outDir: string): Promise<SlideShot[]> {
  const slides: SlideShot[] = [];
  const seen = new Set<string>();
  const MAX = 400;

  await page.evaluate(() => (window as any).Reveal.slide(0, 0));
  await page.waitForTimeout(300);

  for (let i = 0; i < MAX; i++) {
    // Reveal every fragment on the current slide so we screenshot its final state.
    await page.evaluate(() => {
      const R = (window as any).Reveal;
      let guard = 0;
      while (R.availableFragments && R.availableFragments().next && guard++ < 200) {
        R.nextFragment();
      }
    });
    await page.waitForTimeout(200);

    const idx = (await page.evaluate(() => (window as any).Reveal.getIndices())) as {
      h: number;
      v: number;
    };
    const key = `${idx.h}-${idx.v}`;
    if (!seen.has(key)) {
      seen.add(key);
      const file = resolve(outDir, `slide-${String(idx.h).padStart(3, '0')}-${String(idx.v).padStart(2, '0')}.png`);
      await page.screenshot({ path: file });
      slides.push({ key, h: idx.h, v: idx.v, file });
    }

    const isLast = await page.evaluate(() => (window as any).Reveal.isLastSlide());
    if (isLast) break;
    await page.evaluate(() => (window as any).Reveal.next());
    await page.waitForTimeout(250);
  }
  return slides;
}

export async function captureNotebook(
  server: ServerHandle,
  relPath: string,
  outDir: string,
  viewport: Viewport
): Promise<CaptureResult> {
  mkdirSync(outDir, { recursive: true });
  const browser: Browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    await enterSlideshow(page, server.stack, server.baseUrl, relPath);
    const slides = await walk(page, outDir);
    const result: CaptureResult = { stack: server.stack, relPath, outDir, slides };
    writeFileSync(resolve(outDir, 'manifest.json'), JSON.stringify(result, null, 2));
    return result;
  } finally {
    await browser.close();
  }
}
