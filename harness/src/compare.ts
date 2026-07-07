// Per-slide visual diff between two capture dirs (golden = old, candidate = new).
// Aligns by slide key (h-v), pixelmatch → mismatch ratio + diff PNG.
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';

export interface SlideDiff {
  key: string;
  goldenFile?: string;
  candidateFile?: string;
  diffFile?: string;
  width: number;
  height: number;
  diffPixels: number;
  totalPixels: number;
  mismatch: number; // 0 = identical, 1 = fully different
  status: 'ok' | 'missing-golden' | 'missing-candidate';
}

export interface NotebookDiff {
  relKey: string; // notebook identity (dir name)
  slides: SlideDiff[];
  meanMismatch: number;
  worstMismatch: number;
}

function loadPng(file: string): PNG {
  return PNG.sync.read(readFileSync(file));
}

/** Draw src onto a white canvas of (w,h) at top-left; returns RGBA buffer. */
function padTo(png: PNG, w: number, h: number): Buffer {
  if (png.width === w && png.height === h) return png.data;
  const out = new PNG({ width: w, height: h });
  out.data.fill(255); // white background
  PNG.bitblt(png, out, 0, 0, Math.min(png.width, w), Math.min(png.height, h), 0, 0);
  return out.data;
}

function listSlideKeys(dir: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!existsSync(dir)) return map;
  for (const f of readdirSync(dir)) {
    const m = /^slide-(\d+)-(\d+)\.png$/.exec(f);
    if (m) map.set(`${parseInt(m[1], 10)}-${parseInt(m[2], 10)}`, resolve(dir, f));
  }
  return map;
}

export function compareNotebook(
  goldenDir: string,
  candidateDir: string,
  diffDir: string,
  relKey: string
): NotebookDiff {
  mkdirSync(diffDir, { recursive: true });
  const golden = listSlideKeys(goldenDir);
  const candidate = listSlideKeys(candidateDir);
  const keys = [...new Set([...golden.keys(), ...candidate.keys()])].sort((a, b) => {
    const [ah, av] = a.split('-').map(Number);
    const [bh, bv] = b.split('-').map(Number);
    return ah - bh || av - bv;
  });

  const slides: SlideDiff[] = [];
  for (const key of keys) {
    const gf = golden.get(key);
    const cf = candidate.get(key);
    if (!gf) {
      slides.push({ key, candidateFile: cf, width: 0, height: 0, diffPixels: 0, totalPixels: 0, mismatch: 1, status: 'missing-golden' });
      continue;
    }
    if (!cf) {
      slides.push({ key, goldenFile: gf, width: 0, height: 0, diffPixels: 0, totalPixels: 0, mismatch: 1, status: 'missing-candidate' });
      continue;
    }
    const g = loadPng(gf);
    const c = loadPng(cf);
    const w = Math.max(g.width, c.width);
    const h = Math.max(g.height, c.height);
    const gd = padTo(g, w, h);
    const cd = padTo(c, w, h);
    const diff = new PNG({ width: w, height: h });
    const diffPixels = pixelmatch(gd, cd, diff.data, w, h, { threshold: 0.1, includeAA: false });
    const diffFile = resolve(diffDir, `diff-${key}.png`);
    writeFileSync(diffFile, PNG.sync.write(diff));
    const total = w * h;
    slides.push({
      key, goldenFile: gf, candidateFile: cf, diffFile,
      width: w, height: h, diffPixels, totalPixels: total,
      mismatch: diffPixels / total, status: 'ok'
    });
  }

  const scored = slides.map((s) => s.mismatch);
  const meanMismatch = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : 0;
  const worstMismatch = scored.length ? Math.max(...scored) : 0;
  return { relKey, slides, meanMismatch, worstMismatch };
}

export { basename };
