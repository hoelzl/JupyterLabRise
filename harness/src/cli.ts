// Orchestration CLI:
//   capture --stack old|new --deck ID [--limit N] [--nb "relpath.ipynb"]
//   compare --deck ID
//   loop    --deck ID [--limit N]
import { readdirSync, statSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { getDeck, PATHS } from './config.js';
import { startServer, StackName } from './servers.js';
import { captureNotebook } from './capture.js';
import { compareNotebook, NotebookDiff } from './compare.js';
import { writeReport } from './report.js';

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

function listNotebooks(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === '.ipynb_checkpoints') continue;
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (name.endsWith('.ipynb')) found.push(relative(root, full).replace(/\\/g, '/'));
    }
  };
  walk(root);
  return found.sort();
}

function nbKey(relPath: string): string {
  return relPath.replace(/\.ipynb$/, '');
}

function selectNotebooks(deckId: string, args: Record<string, string>): string[] {
  const deck = getDeck(deckId);
  let nbs: string[];
  if (args.nb) nbs = [args.nb];
  else if (deck.sample && deck.sample.length && args.all !== 'true') nbs = deck.sample;
  else nbs = listNotebooks(deck.path);
  if (args.limit) nbs = nbs.slice(0, parseInt(args.limit, 10));
  return nbs;
}

async function cmdCapture(args: Record<string, string>): Promise<void> {
  const stack = args.stack as StackName;
  if (stack !== 'old' && stack !== 'new') throw new Error('--stack must be old|new');
  const deck = getDeck(args.deck);
  const nbs = selectNotebooks(deck.id, args);
  const baseOut = stack === 'old' ? PATHS.goldens : PATHS.shots;

  console.log(`[capture:${stack}] deck=${deck.id} notebooks=${nbs.length}`);
  const server = await startServer(stack, deck.path);
  try {
    for (const rel of nbs) {
      const outDir = resolve(baseOut, deck.id, nbKey(rel));
      process.stdout.write(`  ${rel} ... `);
      try {
        const r = await captureNotebook(server, rel, outDir, deck.viewport);
        console.log(`${r.slides.length} slides`);
      } catch (e) {
        console.log(`FAILED: ${(e as Error).message}`);
      }
    }
  } finally {
    server.stop();
  }
}

function cmdCompare(args: Record<string, string>): NotebookDiff[] {
  const deck = getDeck(args.deck);
  const nbs = selectNotebooks(deck.id, args);
  const diffs: NotebookDiff[] = [];
  for (const rel of nbs) {
    const key = nbKey(rel);
    const goldenDir = resolve(PATHS.goldens, deck.id, key);
    const candDir = resolve(PATHS.shots, deck.id, key);
    const diffDir = resolve(PATHS.reports, deck.id, key);
    if (!existsSync(goldenDir)) {
      console.log(`  [skip] no goldens for ${rel}`);
      continue;
    }
    diffs.push(compareNotebook(goldenDir, candDir, diffDir, key));
  }
  const reportDir = resolve(PATHS.reports, deck.id);
  const out = writeReport(reportDir, deck.id, diffs);
  const all = diffs.flatMap((d) => d.slides);
  const mean = all.length ? all.reduce((a, s) => a + s.mismatch, 0) / all.length : 0;
  console.log(`[compare] ${diffs.length} notebook(s), ${all.length} slide(s), mean mismatch ${(mean * 100).toFixed(2)}%`);
  console.log(`[report] ${out}`);
  if (args.writeBaseline === 'true') writeBaseline(deck.id, diffs);
  return diffs;
}

// Persist accepted per-slide thresholds to config/baseline.json. Each threshold
// is the current mismatch plus headroom (×1.5 + 0.5pp) so the Phase 5 acceptance
// suite tolerates minor rendering nondeterminism but still catches regressions.
function writeBaseline(deckId: string, diffs: NotebookDiff[]): void {
  const file = resolve(PATHS.config, 'baseline.json');
  const doc = JSON.parse(readFileSync(file, 'utf8')) as {
    decks: Record<string, Record<string, Record<string, number>>>;
  };
  // Merge into any existing deck entry so per-notebook runs accumulate rather
  // than clobber each other.
  const deckEntry = doc.decks[deckId] ?? {};
  for (const nb of diffs) {
    const slideEntry: Record<string, number> = {};
    for (const s of nb.slides) {
      slideEntry[s.key] = Math.round((s.mismatch * 1.5 + 0.005) * 10000) / 10000;
    }
    deckEntry[nb.relKey] = slideEntry;
  }
  doc.decks[deckId] = deckEntry;
  writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
  const n = diffs.reduce((a, d) => a + d.slides.length, 0);
  console.log(`[baseline] wrote ${n} slide threshold(s) for '${deckId}' to ${file}`);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  switch (cmd) {
    case 'capture':
      await cmdCapture(args);
      break;
    case 'compare':
      cmdCompare(args);
      break;
    case 'loop':
      await cmdCapture({ ...args, stack: 'old' });
      await cmdCapture({ ...args, stack: 'new' });
      cmdCompare(args);
      break;
    default:
      console.log('usage: cli.ts <capture|compare|loop> --deck ID [--stack old|new] [--limit N] [--nb REL] [--all true]');
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
