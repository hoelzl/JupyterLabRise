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

## Current status (as of 2026-07-08)

- **Phases 0–6 DONE.** The fork looks *close* to classic RISE across every content
  type we've tested, and a regression suite locks it in. The core porting work is
  essentially complete and **pushed** to `github.com/hoelzl/rise`. What remains is
  optional polish + one real fork bug to investigate (see **Next Steps &
  Recommendations**).
- **Acceptance suite:** `scripts/test.ps1` (→ `harness/src/acceptance.ts`) re-renders
  every baselined notebook under the new fork and asserts each slide stays ≤ its
  `config/baseline.json` threshold (+0.01 eps). Currently **159/159 pass** (deck-1
  `machine-learning-azav-de` = 81 slides, `evaluation` deck = 78). Exits 1 on
  regression; notebooks without local goldens are SKIPPED (goldens are
  proprietary/local-only).
- **Envs:** old (Notebook6+RISE) at `envs/.venv-old` (`scripts/setup-old-env.ps1`);
  new (JupyterLab+fork) at `envs/.venv-new`, fork dev-installed + labextension
  symlinked + server ext enabled (`scripts/setup-fork.ps1`). Both BUILT.
- **Fork branch:** `port/classic-look` @ **08d3a2e** (branched from `main` @
  837bddc), **pushed** to github.com/hoelzl/rise. Parent repo `main` @ 1bea0ed
  (pushed to git@github.com:hoelzl/JupyterLabRise.git), submodule pointer =
  08d3a2e. Fork commit history: e27216e (heading/image/blue-bar) → 55ebc9b →
  b8f78fa (code sizing) → 6cb1199 (table inherit — *pushed by the user from another
  session; the branch diverged, so ALWAYS `git fetch` the submodule before
  pushing*) → 2f3c9bb (block spacing + table centering) → dd93d51* → 61cb661
  (blockquote box) → 08d3a2e (scope table sizing to markdown). It has NOT been
  merged to the fork's `main` / no PR opened yet — that's the user's call.
- **Content coverage (all VERIFIED close to classic):** markdown, headings, images,
  bullet/bold/nested lists, markdown tables, code cells (source + syntax), math /
  inline LaTeX (`$…$`, vectors), multi-column HTML/float layouts, blockquotes,
  `voiceover` narration cells, `<details>/<summary>`, **and rendered code OUTPUTS**
  (matplotlib/seaborn PNG plots + pandas DataFrame HTML tables). Two courses tested
  (`machine-learning-azav-de` + `python-best-practice-de`) → the look generalizes.
- **Decks registered** (`config/decks.json`): `machine-learning-azav-de` (deck #1,
  4 sample nbs), `evaluation` (4 nbs incl. the 2 executed-output ones),
  `python-best-practice-de` (2 nbs). All course notebooks are **code-along (no saved
  outputs)** — the 2 output notebooks were executed by us into `output/evaluation/`.

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

**Block spacing (FIXED 2026-07-08, evaluation deck):** the heading→list /
list→list / heading→paragraph gaps were collapsing to ~0. Root cause: classic
Notebook spaces sibling blocks with a 1em *top* margin on the *following* element
(`.rendered_html * + ul/ol/p/table { margin-top: 1em }`) and gives blocks no
bottom margin; the fork instead inherited a tangle of JupyterLab `margin-bottom`
+ reveal-theme list margins that left headings (bottom-margin 0) flush against the
next block and gave sibling lists a zero gap. Fixed in base.css by zeroing the
p/ul/ol/table bottom margins and driving all spacing from classic's top-margin
rules (`* + p/ul/ol/table` and `h1..h6 + *`, nested lists → 0). Measured with the
new `probe-spacing.ts`. Fork commit `dd93d51`.

**Tables (FIXED same pass):** JupyterLab pins `table { font-size: 14px }` so tables
rendered tiny; classic tables inherit the 35.84px body font. base.css now sets
`.jp-RenderedHTMLCommon table { font-size: inherit; margin: auto }`.

**Residual minor diffs (acceptable "close"):** content vertical centering can sit a
touch high/low vs classic on very tall slides. Two output-area residuals (minor,
left as-is): (1) a pandas DataFrame's `<p>200 rows × 5 columns</p>` footer inherits
the 35.84px markdown container font so it's larger than classic's; (2) code prompts
read `[N]:` (JupyterLab convention) vs classic's `In [N]:` / `Out[N]:`. Both stem
from broad `.jp-RenderedHTMLCommon` markdown rules leaking into output areas — a
full fix would scope the container font/heading/spacing rules to
`.jp-RenderedMarkdown` (as done for tables), but risk/benefit doesn't justify it yet.

**Diagnostic tool:** `harness/src/probe-measure.ts` (`npx tsx src/probe-measure.ts old|new`)
dumps computed font-size/color/width/ancestor-chain for the h1/h2 + image on the
content slide — how the 14px-reset root cause was found. Avoid nested named
functions inside `page.evaluate` (tsx/esbuild injects `__name` → ReferenceError).

## Diagnosed divergences (new fork vs old RISE) — original Phase 4 targets

Historical list of the divergences found on the first deck. **#1–#5 are all
RESOLVED** in `base.css` (see fork commits + the fix write-ups above). **#6 is the
one still open** and is the top recommended next-session item.
1. ~~Headings far too small.~~ FIXED (heading typography restored).
2. ~~Heading weight/color wrong.~~ FIXED (bold black, classic %-sizes).
3. ~~Images overflow instead of scaling to fit.~~ FIXED (max-width/height:100%).
4. ~~Content not vertically centered/scaled.~~ FIXED enough ("close"); minor
   residual centering on very tall slides.
5. ~~Stray blue vertical bar on the left edge.~~ FIXED (hid `.jp-Collapser`).
6. **OPEN — `RangeError: Maximum call stack size exceeded`** repeated in the console
   on the new `/rise/` page. Never root-caused. A real fork bug (not cosmetic);
   the leading suspect behind the (now-worked-around) tall-slide capture flake, and
   could surface during live presentations. **See Next Steps recommendation.**

## Capture flake on tall slides (FIXED 2026-07-08)

The evaluation deck's `06 Copilot Kontext geben.ipynb` (12 `voiceover` narration
cells → very tall slides) rendered wholesale-wrong ~50% of runs: a contiguous tail
of slides came out ~90% mismatch at once. Cause: tall slides scroll into place,
and a screenshot caught mid-scroll left a blank/offset frame whose scroll offset
then persisted for the rest of the notebook. Fixed in `capture.ts`: bump the
post-advance settle 600→1000ms AND force `scrollTop=0` on the reveal
viewport/section immediately before every screenshot (short slides are unaffected —
scrollTop is already 0). 5/5 clean acceptance runs after the fix (was ~50% fail).

Note: `voiceover` is a non-standard slide_type; both stacks treat it as a
continuation of the current subslide, so voiceover cells render as inline yellow
HTML boxes appended to the preceding slide — matching between stacks, no CSS
needed.

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
- Deck #1: `.../machine-learning-azav-de/Folien/Notebooks/Completed`. NOTE: despite
  the `Completed` name these notebooks are **code-along — they have NO saved
  outputs** (you execute cells live while teaching). To test rendered outputs we
  EXECUTED notebooks ourselves (see the execute command in Next Steps). Executed
  output notebooks live in `output/evaluation/` (the `evaluation` deck).
- Fork is a lerna monorepo: **`packages/application`** = reveal.js/RISE app;
  **`packages/application/style/base.css`** is the core look (ALL our CSS fixes live
  here). **`packages/lab`** = JupyterLab plugin. `ui-tests/` uses Galata/Playwright.
- **Markdown vs output scoping (IMPORTANT pattern):** rules meant for slide markdown
  must be scoped to `.jp-RenderedMarkdown`, NOT the broader `.jp-RenderedHTMLCommon`
  — because code-cell OUTPUTS (DataFrames, rich HTML) also use
  `.jp-RenderedHTMLCommon`. The table rule already does this; the font-size/heading/
  spacing rules do NOT yet (that's residual #4 in Next Steps).
- Tooling: Python 3.11, Node v25/npm 11, `uv` 0.11, `gh`, git. No Jupyter on default PATH → project-local venvs.
- **yarn.lock gotcha:** the venv's `jlpm` (Yarn) is older than the fork's committed
  lockfile format, so building rewrites `rise/yarn.lock` (v8→v6). Do NOT commit that
  churn — `git checkout -- yarn.lock` in `rise/` before committing base.css. If a
  rebuild then fails with `fsevents ... not present in your lockfile`, run
  `jlpm install` in `rise/` once to reconcile node_modules↔lockfile, then rebuild.
- Windows/PowerShell host. Bash tool available for POSIX. Deck paths contain spaces + German chars — quote carefully.

## Next Steps & Recommendations

**Bottom line: the porting work is done and shipped.** The fork looks close to
classic RISE across every content type in the course decks, tests are green
(159/159), and everything is pushed. Nothing below is *required*. Here is each
candidate next step with an explicit recommendation, roughly highest-value first.

1. **Dogfood it — present a real deck from the fork. → DO THIS FIRST.**
   The single most valuable thing left. Everything so far is validated against
   *static snapshots*; your real presentations run **live** (you execute cells as
   you teach). Open a real course notebook in the new stack (`envs/.venv-new`,
   `jupyter lab`, enter RISE) and actually click through a lesson, running cells.
   That's the only way to catch live-execution/interaction issues the snapshot
   harness can't. Low effort, high signal. If it feels right, that's your cue to
   open the PR (#6 below).

2. **Investigate the `RangeError: Maximum call stack size exceeded`. → DO, if #1
   surfaces anything OR you want the fork solid.** This is the only known *real
   bug* (divergence #6), never root-caused. It's the leading suspect behind the
   tall-slide capture flake (which we worked around, not fixed) and could bite
   during live presentations on big decks. Approach: open a large deck in the fork,
   reproduce in the browser console, read the stack trace, find the recursion
   (suspect: slide-graph building in `packages/application` or a reveal plugin/init
   loop). Medium effort, medium-high value. **Recommended.**

3. **Execute a few more varied-output notebooks. → DO a small pass, MEDIUM value.**
   We covered matplotlib PNG plots + pandas DataFrame tables. Untested output
   shapes that could surprise: **error tracebacks** (colored ANSI), **subplots /
   multiple figures**, **styled DataFrames** (`.style`), **SVG/vector plots**,
   rich reprs. Pick 2–3 notebooks, execute with the root `.venv` (command below),
   drop into `output/evaluation/`, add to the `evaluation` deck sample, render +
   compare. Only worth it if you actually present executed outputs like these.

4. **Fix the two output-area residuals (DataFrame footer size + `[N]:` vs
   `In [N]:`/`Out[N]:` prompts). → DEFER / only if it bothers you. LOW value.**
   Both come from broad `.jp-RenderedHTMLCommon` markdown rules leaking into output
   areas. The clean fix is to scope the container `font-size`/heading/spacing rules
   to `.jp-RenderedMarkdown` (as already done for tables). But it touches rules that
   affect all 159 baselined slides → non-trivial regression risk for a cosmetic
   win. If you do it: one careful pass, re-render everything, re-baseline. **My
   recommendation: skip unless you notice it live.**

5. **Broaden static coverage (`-All true` on a full deck; deep fragment stacks,
   very wide tables, SVG). → DEFER, LOW urgency.** Diminishing returns — math,
   multi-col, blockquote, tables, lists, code all verified across two courses.
   Spot-check only if a specific deck looks off.

6. **Open a PR / merge `port/classic-look` → fork `main`. → YOUR CALL.** The branch
   is pushed and clean. Recommend doing #1 (dogfood) first, then open the PR once
   you're confident presenting from it.

7. **Metric refinement (content-bbox or SSIM instead of white-dominated pixelmatch).
   → SKIP unless ranking fails.** The current metric ranks worst-slides fine for the
   human-review workflow; it's only misleading as an *absolute* score (see caveat).

**Suggested fresh-session plan:** do #1 (dogfood) → if issues or ambition, #2
(RangeError). Treat #3 as opportunistic, #4–#7 as defer/skip.

To SEE current state fast: open `reports/<deck>/index.html`, or Read
`goldens/<deck>/<nb>/slide-XXX.png` beside `shots/<deck>/<nb>/slide-XXX.png`.

**Executing a notebook to get outputs** (root env has all course deps):
```bash
MPLBACKEND="module://matplotlib_inline.backend_inline" \
  "C:/Users/tc/Programming/Python/Courses/Own/PythonCourses/.venv/Scripts/python.exe" \
  -m nbconvert --to notebook --execute --inplace \
  --ExecutePreprocessor.timeout=180 --ExecutePreprocessor.kernel_name=python3 "<notebook>"
```
The inline backend is REQUIRED for PNG capture — `MPLBACKEND=Agg` gives `<Figure>`
text instead of images.

REMINDER: after editing base.css you MUST `scripts/rebuild-fork.ps1` before
re-rendering, or the dev-installed labextension serves stale CSS. If rebuild errors
on `fsevents ... not present in your lockfile`, run `jlpm install` in `rise/` once,
then rebuild (see yarn.lock gotcha).

## Commands cheat-sheet

```powershell
scripts/setup-old-env.ps1                       # build old env (done)
scripts/setup-fork.ps1                          # build new env + fork (done)
scripts/render-old.ps1 -Deck <id>               # goldens (sample nbs; -All full deck; -Nb "rel.ipynb" one)
scripts/render-new.ps1 -Deck <id>               # new shots (same flags)
scripts/compare.ps1    -Deck <id>               # diff + reports/<id>/index.html
scripts/loop.ps1       -Deck <id>               # old + new + compare
scripts/rebuild-fork.ps1                        # MUST run after editing fork CSS/TS
scripts/test.ps1                                # acceptance suite (all baselined decks); -Deck <id> to scope
# write/refresh baselines after an accepted change:
#   cd harness; npx tsx src/cli.ts compare --deck <id> --writeBaseline true
```
Deck ids: `machine-learning-azav-de`, `evaluation`, `python-best-practice-de`.
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
  Fixed code/prompt/output font + widened prompt gutter. Fork commit 55ebc9b.
  probe-measure.ts gained `[stack] [steps] [nbRel]` args + code/prompt selectors.
- Phase 4 (pass 3): a long-code slide (Woche 09 Hybride Suche) exposed that 32.256px
  was too big (clipped long lines vs classic) — the reading came from a hidden
  CodeMirror sizing helper. Corrected code to the true classic 22.4px (slides base).
  Fork commit b8f78fa. writeBaseline now MERGES; baselines recorded for all 3 nbs.
- Phase 5: acceptance suite `harness/src/acceptance.ts` + `scripts/test.ps1`. Re-renders
  each baselined notebook, asserts slide mismatch ≤ baseline+eps, exits 1 on
  regression, SKIPs notebooks lacking local goldens. 81/81 pass; fail path verified.
- Phase 6 (start): added `evaluation` deck (2 notebooks: voiceover narration + a
  markdown table + heading-then-list slides) to `config/decks.json`. Surfaced two
  divergences the first deck didn't exercise — tiny tables (jp 14px reset) and
  collapsed block spacing (heading→list / list→list gaps = 0). Both fixed in
  base.css (fork `dd93d51`); added `probe-spacing.ts` (per-block vertical-rhythm
  measurement). Baselines recorded for 50 evaluation slides; full suite 131/131.
- Phase 6 (fan-out): expanded ML deck sample (math/LaTeX, multi-column HTML,
  blockquote notebooks) + added a 2nd course deck `python-best-practice-de`. All
  static content held up — math (inline `$…$`, vectors), nested lists, multi-col
  images (high mismatch = metric artifact on shifted photos, not a bug) all match;
  the look generalizes to a 2nd course (1.89% mean). Fixed one real divergence:
  blockquote box (fork `61cb661` — restore reveal simple-theme box, keep <details>
  triangle per user).
- Phase 6 (outputs): EXECUTED 2 notebooks via the PythonCourses root `.venv`
  (Python 3.13, matplotlib/seaborn/pandas + nbconvert) into `output/evaluation/`
  (`13-01 Datenvisualisierung` = PNG plots, `12-01 Datenanalyse mit pandas` = HTML
  DataFrames) — the FIRST decks with saved outputs. Matplotlib PNG plots + code
  cells match classic. Found + fixed a shipped regression: the broad table
  font-size rule oversized pandas DataFrame OUTPUT tables ~2.5x — scoped it to
  `.jp-RenderedMarkdown` (fork `08d3a2e`). Baselines now 78 evaluation slides;
  full suite 159/159. To re-execute: `MPLBACKEND="module://matplotlib_inline.backend_inline"
  <root>/.venv/Scripts/python.exe -m nbconvert --to notebook --execute --inplace
  --ExecutePreprocessor.kernel_name=python3 "<nb>"` (the inline backend is REQUIRED
  for PNG capture; do NOT set MPLBACKEND=Agg).

## How to resume in a fresh session

1. Read this file (esp. **Current status** + **Next Steps & Recommendations**) and `PLAN.md`.
2. `git submodule update --init --recursive` (fork should land on `port/classic-look` @ 08d3a2e).
3. Sanity-check green: `scripts/test.ps1` → expect **159/159**.
4. Pick from **Next Steps & Recommendations** (recommended: #1 dogfood, then #2 RangeError).
   Everything is shipped — no in-flight/half-done work to pick up.

### Key files touched by this feature (harness side)
- `rise/packages/application/style/base.css` — ALL the look fixes (fork submodule).
- `harness/src/capture.ts` — Playwright slide walker + screenshot (transition:none,
  1000ms settle, scrollTop=0 before each shot).
- `harness/src/compare.ts`, `report.ts` — pixelmatch diff + worst-first HTML report.
- `harness/src/acceptance.ts` — the regression suite (→ `scripts/test.ps1`).
- `harness/src/cli.ts` — `capture`/`compare`/`loop` + `--writeBaseline`.
- `harness/src/probe-measure.ts`, `probe-spacing.ts` — computed-style / vertical-rhythm
  diagnostics (how root causes were found; not wired into CLI).
- `config/decks.json` — deck registry; `config/baseline.json` — per-slide thresholds.
- `goldens/` (old-RISE reference, gitignored/proprietary), `shots/`, `reports/` (regenerated).
