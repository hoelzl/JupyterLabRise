// Capture a notebook's slides under a given stack (old classic RISE / new fork).
// Both stacks converge on a reveal.js page exposing a global `Reveal`, so the
// slide-walking + screenshot logic is shared; only "enter slideshow" differs.
import { chromium, Browser, Page } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { StackName, ServerHandle } from './servers.js';
import { TOKEN, Viewport } from './config.js';

// Chrome we hide on BOTH stacks so diffs focus on slide *content*, not reveal/RISE UI.
// We also kill reveal's slide transitions: the new fork defaults to transition
// 'linear', so screenshotting shortly after advancing would catch a slide
// mid-animation (semi-transparent, offset). Forcing transitions off makes the
// capture deterministic and matches the old stack (which runs transition:none).
const HIDE_CHROME = `
  .reveal .controls, .reveal .progress, .reveal .slide-number,
  .reveal .playback, .reveal .speaker-notes,
  #help-b, #exit-b, .reveal .help-button, .reveal .exit-button,
  .rise-enter-fullscreen, .rise-help, .rise-exit { display: none !important; }
  * { caret-color: transparent !important; }
  .reveal .slides, .reveal .slides section, .reveal .slides section * {
    transition: none !important;
    animation: none !important;
  }
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
  // Both stacks converge on a reveal.js deck. Wait for it to finish initializing
  // (reveal adds `.ready` to `.reveal`), then hide chrome. We drive it via
  // keyboard + DOM state (the new fork does not expose a global `Reveal`).
  await page.waitForSelector('.reveal .slides section', { timeout: 60000 });
  await page
    .waitForSelector('.reveal.ready', { timeout: 30000 })
    .catch(() => {/* some builds omit .ready; DOM classes still work */});
  await page.addStyleTag({ content: HIDE_CHROME });
  await page.waitForTimeout(1500);
}

// Read current slide indices + remaining hidden fragments straight from the reveal DOM.
// Works on both old RISE and the new fork.
interface RevealState {
  h: number;
  v: number;
  hiddenFragments: number;
}
async function readState(page: Page): Promise<RevealState> {
  return page.evaluate(() => {
    const root = document.querySelector('.reveal .slides');
    if (!root) return { h: 0, v: 0, hiddenFragments: 0 };
    const hs = Array.from(root.children).filter((e) => e.tagName === 'SECTION') as HTMLElement[];
    let h = hs.findIndex((s) => s.classList.contains('present'));
    if (h < 0) h = 0;
    const cur = hs[h];
    let v = 0;
    let slideEl: HTMLElement = cur;
    if (cur) {
      const vs = Array.from(cur.children).filter((e) => e.tagName === 'SECTION') as HTMLElement[];
      if (vs.length) {
        v = vs.findIndex((s) => s.classList.contains('present'));
        if (v < 0) v = 0;
        slideEl = vs[v];
      }
    }
    const hiddenFragments = slideEl
      ? slideEl.querySelectorAll('.fragment:not(.visible)').length
      : 0;
    return { h, v, hiddenFragments };
  });
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

/** Walk the reveal slide grid via keyboard, fully revealing fragments, one shot per (h,v). */
async function walk(page: Page, outDir: string): Promise<SlideShot[]> {
  const slides: SlideShot[] = [];
  const seen = new Set<string>();
  const MAX = 400;

  // Reveal starts on the first slide (0,0) after load — no navigation needed.
  await page.waitForTimeout(300);

  for (let i = 0; i < MAX; i++) {
    // Reveal every fragment on the current slide (Space advances one fragment at a time).
    let guard = 0;
    while ((await readState(page)).hiddenFragments > 0 && guard++ < 200) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(120);
    }

    const before = await readState(page);
    const key = `${before.h}-${before.v}`;
    if (!seen.has(key)) {
      seen.add(key);
      const file = resolve(
        outDir,
        `slide-${String(before.h).padStart(3, '0')}-${String(before.v).padStart(2, '0')}.png`
      );
      await page.screenshot({ path: file });
      slides.push({ key, h: before.h, v: before.v, file });
    }

    // Advance to the next slide (fragments are all shown, so Space moves on).
    await page.keyboard.press('Space');
    // Settle: cover the fork's auto_select_timeout (450ms) which re-selects a
    // cell and can shift scroll/layout after the slide change.
    await page.waitForTimeout(600);
    const after = await readState(page);
    // No movement and nothing new to reveal => we're at the end.
    if (after.h === before.h && after.v === before.v && after.hiddenFragments === 0) break;
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
