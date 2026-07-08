// Debug probe: measure computed layout of the content slide (h=1) in the new fork,
// to find why headings render grey/small/centered and images overflow.
import { chromium } from 'playwright';
import { startServer } from './servers.js';
import { getDeck, TOKEN } from './config.js';

const deck = getDeck('machine-learning-azav-de');
// Optional: probe a specific notebook + advance N slides. argv: [stack] [steps] [nbRel]
const steps = process.argv[3] ? parseInt(process.argv[3], 10) : 1;
const rel = process.argv[4] ?? deck.sample![0];
const enc = rel.split(/[\\/]/).map(encodeURIComponent).join('/');

const stack = (process.argv[2] as 'old' | 'new') ?? 'new';
const server = await startServer(stack, deck.path);
try {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  if (stack === 'old') {
    await page.goto(`${server.baseUrl}/notebooks/${enc}?token=${TOKEN}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#notebook-container', { timeout: 60000 });
    await page.waitForTimeout(3000);
    await page.keyboard.press('Alt+r');
  } else {
    await page.goto(`${server.baseUrl}/rise/${enc}?token=${TOKEN}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  }
  await page.waitForSelector('.reveal .slides section', { timeout: 60000 });
  await page.waitForTimeout(4000);
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(800);

  const data = await page.evaluate(() => {
    const present = document.querySelector('.reveal .slides section.present') as HTMLElement | null;
    const scope: ParentNode = present ?? document;
    const targets: Array<[string, Element | null]> = [
      ['reveal', document.querySelector('.reveal')],
      ['slides', document.querySelector('.reveal .slides')],
      ['presentSection', present],
      ['cell', scope.querySelector('.jp-Cell, .cell')],
      ['mdcell', scope.querySelector('.jp-MarkdownCell, .text_cell')],
      ['rendered', scope.querySelector('.jp-RenderedHTMLCommon, .rendered_html')],
      ['h1', scope.querySelector('h1')],
      ['img', scope.querySelector('img')],
      ['codeLine', scope.querySelector('.CodeMirror-line, .cm-line, .jp-InputArea-editor .cm-content, .input_area pre')],
      ['inputArea', scope.querySelector('.jp-InputArea-editor, .input_area, .CodeMirror')],
      ['prompt', scope.querySelector('.jp-InputPrompt, .input_prompt, .prompt')]
    ];
    const out: Record<string, unknown> = {
      viewport: { w: window.innerWidth, h: window.innerHeight }
    };
    for (const [name, el] of targets) {
      if (!el) { out[name] = null; continue; }
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      out[name] = {
        tag: el.tagName,
        cls: (el as HTMLElement).className?.toString().slice(0, 80),
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        color: cs.color,
        textAlign: cs.textAlign,
        width: cs.width,
        maxWidth: cs.maxWidth,
        transform: cs.transform,
        margin: cs.margin,
        display: cs.display
      };
    }
    const h1 = Array.from(document.querySelectorAll('h1,h2,h3')).find(
      (e) => /Willkommen/.test(e.textContent ?? '')
    ) ?? scope.querySelector('h1,h2');
    const img = scope.querySelector('img') as HTMLImageElement | null;
    out.h1text = h1?.textContent?.slice(0, 40);
    out.imgNatural = img ? { w: img.naturalWidth, h: img.naturalHeight } : null;

    // Walk the h1's ancestor chain up to .reveal, reporting layout-relevant props.
    const chain: unknown[] = [];
    let node: Element | null = h1;
    let depth = 0;
    while (node && depth++ < 12) {
      const r = node.getBoundingClientRect();
      const cs = getComputedStyle(node);
      chain.push({
        tag: node.tagName,
        cls: (node as HTMLElement).className?.toString().slice(0, 60),
        w: Math.round(r.width),
        x: Math.round(r.x),
        color: cs.color,
        fontSize: cs.fontSize,
        textAlign: cs.textAlign,
        display: cs.display,
        justifyContent: cs.justifyContent,
        alignItems: cs.alignItems,
        margin: cs.margin
      });
      if (node.classList.contains('reveal')) break;
      node = node.parentElement;
    }
    out.h1chain = chain;
    return out;
  });
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
} finally {
  server.stop();
}
