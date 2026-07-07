# HANDOVER — RISE look-porting harness

> Living document. The single source of truth for resuming work. Update at every
> phase boundary and before any context handoff. Read this first.

## Mission (one paragraph)

Port the **classic RISE** slideshow look onto the JupyterLab 4 RISE fork
(`rise/` submodule → github.com/hoelzl/rise). Render each course notebook under old
RISE (reference) and the new fork, diff per slide, and iteratively fix the fork's
CSS/TS until the new look is *close* (not pixel-perfect) to the old one. Lock in
progress with visual-regression acceptance tests. Iterate slide-by-slide then
deck-by-deck. Full plan: `PLAN.md`.

## Current status

- **Phases 0–3 DONE. Full pipeline works end-to-end** (old render → new render → diff → report). Ready for Phase 4 (the CSS/TS fix loop).
- **Env — old (Notebook6+RISE):** BUILT at `envs/.venv-old`. `scripts/setup-old-env.ps1`.
- **Env — new (JupyterLab+fork):** BUILT at `envs/.venv-new`, fork dev-installed + labextension symlinked + server ext enabled. `scripts/setup-fork.ps1`.
- **Goldens captured:** deck `machine-learning-azav-de`, sample notebook (19 slides). New-stack shots also captured (19 — counts match).
- **First report:** `reports/machine-learning-azav-de/index.html` (mean mismatch 2.53% — but see metric caveat below).
- **Baseline scores:** none yet (`config/baseline.json` empty; fill during Phase 4).
- **Fork branch:** `main` @ 837bddc. No source edits yet.

## Diagnosed divergences (new fork vs old RISE) — Phase 4 targets

From the sample deck's report, the new fork differs from old RISE in these ways
(all fixable in `rise/packages/application/style/base.css`, maybe some TS):
1. **Headings far too small.** Old RISE h1/h2 are large; new fork renders them small.
2. **Heading weight/color wrong.** e.g. `# Willkommen!` is bold black in old, light grey + not bold in new.
3. **Images overflow instead of scaling to fit the slide.** Old RISE fits images to
   the slide; new fork renders them at natural size and they run off-screen. (Interacts
   with `scroll:true`.)
4. **Content not vertically centered / not scaled** the way old RISE does.
5. **Stray blue vertical bar on the left edge** in the new fork (identify: reveal
   progress? selected-cell indicator leaking through? a border on `.reveal .slides`).
6. Console shows repeated **`RangeError: Maximum call stack size exceeded`** on the
   new `/rise/` page — a real fork bug worth investigating (may or may not affect layout).

## Metric caveat (IMPORTANT)

pixelmatch mismatch ratio is **dominated by the white background**, so absolute
numbers look tiny (2–3%) even when text/images are visibly very different. Use it to
**rank** worst slides, not as an absolute similarity score. Consider a content-bbox or
SSIM refinement later if ranking proves insufficient.

## Known harness refinements (small, do when convenient)

- `HIDE_CHROME` in `harness/src/capture.ts` hides new-fork + reveal chrome, but NOT old
  RISE's own close (X) and help (?) buttons (they use RISE-specific ids). They show up
  as red in diffs. Add old-RISE selectors (inspect the old `/notebooks` RISE DOM).
- `harness/src/probe-new.ts` is a debug script (kept for reference; not wired into CLI).

## Key facts / decisions (don't re-derive)

- Reference "look" = **stock RISE, `simple` theme, `scroll:true`** (from `~/.jupyter/nbconfig/rise.json`). The aqua `rise.css` files under `Own/Old/...` are stale — ignore.
- Notebooks are rendered **as saved**: no execution, no kernel needed for display.
- Old & new RISE both read the same `slideshow` metadata → identical reveal.js slide graph → Nth (h,v) slide corresponds 1:1. Use `Reveal.getState()`/indices, not blind key-stepping. Assert equal slide counts before comparing.
- Deck #1: `.../machine-learning-azav-de/Folien/Notebooks/Completed` (has saved outputs). `Code-Along` sibling lacks outputs — defer.
- Fork is a lerna monorepo: **`packages/application`** = reveal.js/RISE app; **`packages/application/style/base.css`** (459 lines) is the core look. **`packages/lab`** = JupyterLab plugin. `ui-tests/` uses Galata/Playwright.
- Tooling: Python 3.11, Node v25/npm 11, `uv` 0.11, `gh`, git. No Jupyter on default PATH → project-local venvs.
- Windows/PowerShell host. Bash tool available for POSIX. Deck paths contain spaces + German chars — quote carefully.

## Next step (do this next)

Phase 4 — the fix loop. Iterate:
1. Edit `rise/packages/application/style/base.css` targeting divergence #1/#2 (heading
   size + weight/color) first — highest visual impact, lowest risk.
2. `scripts/rebuild-fork.ps1` (rebuilds JS/CSS; dev-install picks it up).
3. `scripts/render-new.ps1 -Deck machine-learning-azav-de` then
   `scripts/compare.ps1 -Deck machine-learning-azav-de`; open the report.
4. Compare new shot vs golden visually (Read the PNGs). Accept when close; record the
   score in `config/baseline.json`.
5. Move to next divergence (images-overflow, then centering, then the blue bar).
Then broaden with `-All true` on the deck, then add decks (Phase 6).

To SEE current state fast: open `reports/machine-learning-azav-de/index.html`, or Read
`goldens/.../slide-XXX.png` beside `shots/.../slide-XXX.png`.

## Commands cheat-sheet

```powershell
scripts/setup-old-env.ps1                                  # build old env (done)
scripts/setup-fork.ps1                                     # build new env + fork (done)
scripts/render-old.ps1 -Deck machine-learning-azav-de      # goldens (sample nb; add -All for full deck)
scripts/render-new.ps1 -Deck machine-learning-azav-de      # new shots
scripts/compare.ps1   -Deck machine-learning-azav-de       # diff + report
scripts/loop.ps1      -Deck machine-learning-azav-de       # all of the above
scripts/rebuild-fork.ps1                                   # after editing fork CSS/TS
```
Servers use fixed token `risetoken`, ports 8899 (old) / 8898 (new).

## Edit log

- Phase 0: scaffolded repo (README, PLAN.md, .gitignore, .gitattributes, config, envs/old, HANDOVER). Added `rise/` submodule @ 837bddc.
- Phase 1: built old stack (Notebook 6.5.7 + RISE 5.7.1). Extra pins needed: `setuptools<81`, `lxml_html_clean`. RISK GATE cleared. Captured first goldens.
- Phase 2: built new stack. Fork JS build needs the venv `Scripts` on PATH (lerna sub-scripts call bare `jlpm`). Editable install needs `hatchling hatch-nodejs-version hatch-jupyter-builder editables` + `HATCH_JUPYTER_BUILDER_SKIP_BUILD=1`. New fork does NOT expose `window.Reveal` → switched the walker to DOM+keyboard (works on both stacks). Captured new shots (19).
- Phase 3: pixelmatch compare + worst-first HTML report + baseline.json scaffold. First diff generated; divergences catalogued above.

## How to resume in a fresh session

1. Read this file + `PLAN.md`.
2. `git submodule update --init --recursive`.
3. Check "Current status" above for the phase; run the "Next step".
