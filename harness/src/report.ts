// Build a worst-first HTML report (old | new | diff) for a deck's comparison.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { NotebookDiff } from './compare.js';

function rel(from: string, to?: string): string {
  if (!to) return '';
  return relative(from, to).replace(/\\/g, '/');
}

function pct(x: number): string {
  return (x * 100).toFixed(2) + '%';
}

export function writeReport(reportDir: string, deckId: string, notebooks: NotebookDiff[]): string {
  mkdirSync(reportDir, { recursive: true });

  // Flatten to per-slide rows, sorted worst-first.
  interface Row {
    nb: string;
    key: string;
    mismatch: number;
    status: string;
    golden?: string;
    candidate?: string;
    diff?: string;
  }
  const rows: Row[] = [];
  for (const nb of notebooks) {
    for (const s of nb.slides) {
      rows.push({
        nb: nb.relKey, key: s.key, mismatch: s.mismatch, status: s.status,
        golden: s.goldenFile, candidate: s.candidateFile, diff: s.diffFile
      });
    }
  }
  rows.sort((a, b) => b.mismatch - a.mismatch);

  const allSlides = notebooks.flatMap((n) => n.slides);
  const mean = allSlides.length ? allSlides.reduce((a, s) => a + s.mismatch, 0) / allSlides.length : 0;
  const median = (() => {
    const xs = allSlides.map((s) => s.mismatch).sort((a, b) => a - b);
    if (!xs.length) return 0;
    const mid = Math.floor(xs.length / 2);
    return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
  })();

  const cell = (f?: string) =>
    f ? `<a href="${rel(reportDir, f)}" target="_blank"><img loading="lazy" src="${rel(reportDir, f)}"></a>` : '<span class="none">—</span>';

  const body = rows
    .map((r) => {
      const cls = r.mismatch > 0.15 ? 'bad' : r.mismatch > 0.05 ? 'warn' : 'good';
      return `<tr class="${cls}">
      <td class="meta"><div class="nb">${r.nb}</div><div class="key">slide ${r.key}</div>
        <div class="score">${pct(r.mismatch)}</div><div class="status">${r.status}</div></td>
      <td>${cell(r.golden)}</td><td>${cell(r.candidate)}</td><td>${cell(r.diff)}</td></tr>`;
    })
    .join('\n');

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>RISE diff — ${deckId}</title>
<style>
  body{font:14px system-ui,sans-serif;margin:0;background:#f6f7f9;color:#111}
  header{position:sticky;top:0;background:#fff;border-bottom:1px solid #ddd;padding:12px 20px;z-index:2}
  h1{font-size:18px;margin:0 0 4px}
  .summary{color:#555}
  table{border-collapse:collapse;width:100%}
  th{position:sticky;top:64px;background:#eef0f3;padding:8px;text-align:left;border-bottom:1px solid #ccc}
  td{border-bottom:1px solid #e3e3e3;padding:8px;vertical-align:top}
  td img{max-width:520px;width:100%;height:auto;border:1px solid #ccc;background:#fff}
  .meta{width:220px}
  .nb{font-weight:600;word-break:break-word}
  .key{color:#666}
  .score{font-size:20px;margin-top:6px}
  .status{color:#888;font-size:12px}
  tr.bad .score{color:#c0392b} tr.warn .score{color:#c77c10} tr.good .score{color:#2e7d32}
  .none{color:#bbb}
</style></head><body>
<header><h1>RISE look diff — ${deckId}</h1>
<div class="summary">${notebooks.length} notebook(s), ${allSlides.length} slide(s) ·
 mean mismatch <b>${pct(mean)}</b> · median <b>${pct(median)}</b> · sorted worst-first</div></header>
<table><thead><tr><th>slide</th><th>old (golden)</th><th>new (fork)</th><th>diff</th></tr></thead>
<tbody>${body}</tbody></table></body></html>`;

  const out = resolve(reportDir, 'index.html');
  writeFileSync(out, html);
  return out;
}
