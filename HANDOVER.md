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

- **Phases 0–3 DONE. Phase 4 first pass DONE** on the sample notebook — the new
  fork now looks *close* to classic RISE on all 19 slides (title, bullet lists,
  bold-emphasis lists, image slide, subslide sequences). Ready to broaden.
- **Env — old (Notebook6+RISE):** BUILT at `envs/.venv-old`. `scripts/setup-old-env.ps1`.
- **Env — new (JupyterLab+fork):** BUILT at `envs/.venv-new`, fork dev-installed + labextension symlinked + server ext enabled. `scripts/setup-fork.ps1`.
- **Goldens captured:** deck `machine-learning-azav-de`, sample notebook (19 slides). New-stack shots also captured (19 — counts match).
- **Report:** `reports/machine-learning-azav-de/index.html` (mean mismatch 2.17%, down from 2.53% — but see metric caveat; the visual match is much better than that number implies).
- **Baseline scores:** RECORDED for the sample notebook in `config/baseline.json`
  (per-slide accepted thresholds = current mismatch ×1.5 + 0.5pp). Regenerate with
  `npx tsx src/cli.ts compare --deck <id> --writeBaseline true`.
- **Fork branch:** `port/classic-look` @ 55ebc9b (branched from `main` @ 837bddc).
  base.css edits committed there; NOT yet pushed to github.com/hoelzl/rise.
  Commits: e27216e (markdown/heading/image/blue-bar), 55ebc9b (code-cell sizing).
- **Coverage so far:** sample markdown notebook (19 slides) + a code-heavy notebook
  (`Z02 .../06 Matrix-Multiplikation`, 51 slides) — markdown, headings, images,
  bullet/bold lists, tables, code cells all now look close. Code cells lack saved
  outputs deck-wide (code-along style), so output rendering is still UNTESTED.

## Phase 4 — what was fixed (root cause found)

Both stacks use the *same* reveal config (`width/height:'100%'`, `center:true`,
`minScale:1.0`) → reveal scale is 1.0 in both, so the huge look difference was
NOT reveal scaling; it was **pure CSS**: the fork renders markdown through
JupyterLab's `jp-RenderedHTMLCommon`, which (a) resets font to an absolute 14px
(classic's `rendered_html` sits at 35.84px = 160% of the 22.4px slides font),
(b) gives small grey headings, (c) leaves images at natural size, and the fork's
own `width:100% !important` on `.slides` ate reveal's `margin:0.1`. Fixes live in
`rise/packages/application/style/base.css` (see the fork commit). Divergences
#1 (heading size), #2 (weight/color), #3 (image overflow), #5 (blue bar = the
JupyterLab `.jp-Collapser` active-cell indicator) are resolved.

**Capture fix (harness):** the fork defaults to `transition:'linear'`, so the old
capture screenshotted slides mid-animation (looked grey/offset/overflowing — a
red herring that masked the CSS fixes). `capture.ts` now injects `transition:none`
+ waits 600ms after advancing. Old stack was already `transition:none`.

**Residual minor diffs (acceptable "close"):** heading→list gap slightly tighter
than classic; content sits a touch higher. Diminishing returns — left as-is.

**Diagnostic tool:** `harness/src/probe-measure.ts` (`npx tsx src/probe-measure.ts old|new`)
dumps computed font-size/color/width/ancestor-chain for the h1/h2 + image on the
content slide — how the 14px-reset root cause was found. Avoid nested named
functions inside `page.evaluate` (tsx/esbuild injects `__name` → ReferenceError).

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
- **yarn.lock gotcha:** the venv's `jlpm` (Yarn) is older than the fork's committed
  lockfile format, so building rewrites `rise/yarn.lock` (v8→v6). Do NOT commit that
  churn — `git checkout -- yarn.lock` in `rise/` before committing base.css. If a
  rebuild then fails with `fsevents ... not present in your lockfile`, run
  `jlpm install` in `rise/` once to reconcile node_modules↔lockfile, then rebuild.
- Windows/PowerShell host. Bash tool available for POSIX. Deck paths contain spaces + German chars — quote carefully.

## Next step (do this next)

The sample notebook looks close. Broaden and lock in:
1. **Widen coverage on deck #1:** `scripts/render-old.ps1 -Deck machine-learning-azav-de -All true`
   (goldens for the whole `Completed` deck — proprietary, stays local), then
   `scripts/render-new.ps1 -Deck ... -All true`, then
   `scripts/compare.ps1 -Deck ... -All true`. Open the report, eyeball the new
   worst slides for divergences the sample didn't exercise (code cells + saved
   outputs, tables, math, multi-column HTML, deep fragment stacks). Fix in
   base.css; rebuild (`scripts/rebuild-fork.ps1`); re-render; re-compare.
2. Refresh baselines: `npx tsx src/cli.ts compare --deck <id> --all true --writeBaseline true`.
3. **Phase 5 — acceptance tests:** add `tests/visual.spec.ts` asserting each new
   render stays ≤ its `config/baseline.json` threshold; wire `scripts/test.ps1`.
4. **Phase 6 — fan out:** add decks to `config/decks.json`, regrow goldens + tests.

To SEE current state fast: open `reports/machine-learning-azav-de/index.html`, or Read
`goldens/.../slide-XXX.png` beside `shots/.../slide-XXX.png`.

NOTE: after editing base.css you MUST `scripts/rebuild-fork.ps1` before re-rendering,
or the dev-installed labextension serves stale CSS.

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
- Phase 4 (pass 1): diagnosed root cause (jp-RenderedHTMLCommon 14px reset; reveal
  configs identical so scaling was never the issue) via `probe-measure.ts`. Fixed
  base.css (heading typography, image fit, dropped width:100%!important, hid
  collapser). Fixed capture nondeterminism (transition:none + 600ms settle) — the
  fork's `transition:'linear'` had been capturing mid-animation. Mean 2.53%→2.17%;
  sample notebook now visually close on all 19 slides. Recorded baselines. Fork
  commit `port/classic-look` @ e27216e (unpushed). Added `compare --writeBaseline`.
- Phase 4 (pass 2): tested a code-heavy notebook (Matrix-Multiplikation, 51 slides).
  Found code cells rendered tiny (CM6 pins 13px) — same absolute-reset as markdown.
  Fixed code/prompt/output font to classic 32.256px + widened prompt gutter. Code
  cells now match. Fork commit 55ebc9b (unpushed). probe-measure.ts gained
  `[stack] [steps] [nbRel]` args + code/prompt selectors.

## How to resume in a fresh session

1. Read this file + `PLAN.md`.
2. `git submodule update --init --recursive`.
3. Check "Current status" above for the phase; run the "Next step".
