// Acceptance / visual-regression suite.
//
// For every notebook recorded in config/baseline.json, re-render it under the NEW
// fork stack and assert each slide's pixel mismatch vs the golden stays at or
// below its accepted baseline threshold (plus a small epsilon for rendering
// nondeterminism). Exits non-zero if any slide regresses, so it can gate CI or a
// pre-push hook. Goldens are proprietary and local-only; a notebook whose goldens
// are missing is reported as SKIPPED, not failed.
//
// Run: scripts/test.ps1  (or: npx tsx src/acceptance.ts [--deck ID] [--eps 0.01])
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { getDeck, PATHS } from './config.js';
import { startServer } from './servers.js';
import { captureNotebook } from './capture.js';
import { compareNotebook } from './compare.js';

interface BaselineDoc {
  decks: Record<string, Record<string, Record<string, number>>>;
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const k = argv[i].slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      out[k] = v;
    }
  }
  return out;
}

interface SlideResult {
  deck: string;
  nb: string;
  slide: string;
  mismatch: number;
  threshold: number;
  pass: boolean;
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const eps = args.eps ? parseFloat(args.eps) : 0.01;
  const doc = JSON.parse(
    readFileSync(resolve(PATHS.config, 'baseline.json'), 'utf8')
  ) as BaselineDoc;

  const deckIds = args.deck ? [args.deck] : Object.keys(doc.decks);
  if (deckIds.length === 0) {
    console.log('No baselines recorded yet — nothing to test.');
    return;
  }

  const results: SlideResult[] = [];
  const skipped: string[] = [];

  for (const deckId of deckIds) {
    const deck = getDeck(deckId);
    const notebooks = doc.decks[deckId] ?? {};
    const nbKeys = Object.keys(notebooks);
    // Which of these have goldens on disk?
    const renderable = nbKeys.filter((k) =>
      existsSync(resolve(PATHS.goldens, deckId, k))
    );
    for (const k of nbKeys) {
      if (!renderable.includes(k)) skipped.push(`${deckId} :: ${k} (no goldens)`);
    }
    if (renderable.length === 0) continue;

    const tmp = mkdtempSync(resolve(tmpdir(), 'rise-accept-'));
    const server = await startServer('new', deck.path);
    try {
      for (const nbKey of renderable) {
        const rel = `${nbKey}.ipynb`;
        const outDir = resolve(tmp, deckId, nbKey);
        await captureNotebook(server, rel, outDir, deck.viewport);
        const goldenDir = resolve(PATHS.goldens, deckId, nbKey);
        const diff = compareNotebook(goldenDir, outDir, resolve(tmp, 'diff', nbKey), nbKey);
        const thresholds = notebooks[nbKey];
        for (const s of diff.slides) {
          const threshold = thresholds[s.key] ?? 0;
          const pass = s.mismatch <= threshold + eps;
          results.push({ deck: deckId, nb: nbKey, slide: s.key, mismatch: s.mismatch, threshold, pass });
        }
      }
    } finally {
      server.stop();
      rmSync(tmp, { recursive: true, force: true });
    }
  }

  // Report.
  const failed = results.filter((r) => !r.pass);
  for (const r of results) {
    if (!r.pass) {
      const bound = (r.threshold + eps) * 100;
      console.log(
        `  FAIL ${r.nb} [${r.slide}]  ${(r.mismatch * 100).toFixed(2)}% > ${bound.toFixed(2)}% (baseline ${(r.threshold * 100).toFixed(2)}% + ${(eps * 100).toFixed(1)}pp eps)`
      );
    }
  }
  for (const s of skipped) console.log(`  SKIP ${s}`);

  const pass = results.length - failed.length;
  console.log(
    `\n[acceptance] ${pass}/${results.length} slides within baseline` +
      (skipped.length ? `, ${skipped.length} notebook(s) skipped (no goldens)` : '')
  );
  if (failed.length) {
    console.log(`[acceptance] FAILED: ${failed.length} slide(s) regressed.`);
    process.exit(1);
  }
  console.log('[acceptance] PASSED.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
