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
  essentially complete and **pushed** to `github.com/hoelzl/rise`.
- **The `RangeError` (divergence #6) is now root-caused** — it is benign FAST
  design-token theming noise at slideshow init, NOT the slide-graph recursion once
  feared (see the dedicated "RangeError" section). No fork change was needed/made.
- **DOGFOODED (2026-07-08)** — presented a real deck live at 3840×2160 and fixed
  three live-only issues the static harness couldn't catch (portrait-first flip,
  black full-screen margins, stray grey scrollbar). All fixed, verified live, and
  acceptance stays 159/159. See the **"Live dogfood fixes"** section. These are the
  first fork changes beyond the CSS look-port (one touches `rise.ts`).
- **Acceptance suite:** `scripts/test.ps1` (→ `harness/src/acceptance.ts`) re-renders
  every baselined notebook under the new fork and asserts each slide stays ≤ its
  `config/baseline.json` threshold (+0.01 eps). Currently **159/159 pass** (deck-1
  `machine-learning-azav-de` = 81 slides, `evaluation` deck = 78). Exits 1 on
  regression; notebooks without local goldens are SKIPPED (goldens are
  proprietary/local-only).
- **Envs:** old (Notebook6+RISE) at `envs/.venv-old` (`scripts/setup-old-env.ps1`);
  new (JupyterLab+fork) at `envs/.venv-new`, fork dev-installed + labextension
  symlinked + server ext enabled (`scripts/setup-fork.ps1`). Both BUILT.
- **Fork branch:** `port/classic-look` @ **4578bdb** (branched from `main` @
  837bddc), **pushed** to github.com/hoelzl/rise. Parent repo `main` @ ba32a00
  (pushed to git@github.com:hoelzl/JupyterLabRise.git), submodule pointer =
  4578bdb. Fork commit history: e27216e (heading/image/blue-bar) → 55ebc9b →
  b8f78fa (code sizing) → 6cb1199 (table inherit — *pushed by the user from another
  session; the branch diverged, so ALWAYS `git fetch` the submodule before
  pushing*) → 2f3c9bb (block spacing + table centering) → dd93d51* → 61cb661
  (blockquote box) → 08d3a2e (scope table sizing to markdown) → 4578bdb (three
  live-presentation fixes from dogfooding — see "Live dogfood fixes").
  **PR OPEN:** github.com/hoelzl/rise/pull/1 (`port/classic-look` → `main`), not
  yet merged — merge is the user's call.
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
6. **ROOT-CAUSED 2026-07-08 (was OPEN) — `RangeError: Maximum call stack size
   exceeded`.** NOT a slide-graph recursion (the old suspicion) and NOT caused by
   our CSS. It comes from **JupyterLab's FAST design-token theming**
   (`@jupyter/web-components` + `@microsoft/fast-foundation`): the derived
   colour-palette recipes recurse (`DesignTokenNode.get → getValueFor → evaluate →
   getValueFor …`; downstream `PaletteRGB.from`/`ColorScale.sort`/`binarySearch`).
   **Severity is far lower than feared** — see the dedicated section below. Left
   as-is (no safe cheap fix); details + a candidate structural fix are recorded.

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

## Live dogfood fixes (2026-07-08)

Presented deck #1 live from the fork at **3840×2160** (via `packages/lab`'s "Render
as Reveal Slideshow" / Alt+R, which opens the standalone `/rise/` app — the same
`packages/application` render the harness uses). Three live-only issues surfaced;
all fixed, all verified live, acceptance still **159/159**.

1. **Portrait-first flip.** On entering the slideshow the first slide came up in a
   narrow portrait layout and only snapped to landscape on the first slide change.
   Cause: reveal.js computes its layout while the notebook panel is still growing
   to fill the shell (narrow → portrait aspect); the first `slidechanged`
   internally re-layouts and fixes it. Fix (`packages/application/src/plugins/rise.ts`,
   the reveal `ready` handler): force a re-layout once the container settles
   (`requestAnimationFrame` + a 250ms `setTimeout` calling `Reveal.layout()`) and
   on container resize (a `ResizeObserver` on `panel.node`).

2. **Black margins in full screen.** RISE's `margin: 0.1` leaves side margins around
   the slide (this geometry is IDENTICAL in classic RISE — measured — so it is NOT
   a regression). But in the fork those margins were **black** vs classic's white.
   Cause: RISE full-screen calls `requestFullscreen()` on the `.reveal` element, and
   reveal.js 4 paints the deck background on `.reveal-viewport` (the body), not on
   `.reveal` — so the full-screened `.reveal` is transparent and the browser paints
   a black `::backdrop` that shows through the margins. Windowed, the white body
   behind it showed → white; only full screen was black. Fix (`base.css`): paint
   `.reveal` + `.reveal::backdrop` with `var(--r-background-color, #fff)`. No-op
   windowed; theme-correct.

3. **Stray grey vertical scrollbar** over the slide that drifted right on each slide
   change and never disappeared. Cause: JupyterLab's `.jp-WindowedPanel-outer`
   (overflow:auto) scroll container — kept even with `windowingMode:'none'` — has
   content a hair taller than the viewport, so it paints a scrollbar; that scrollbar
   also stole layout width, feeding the #1 `ResizeObserver` → `Reveal.layout()` loop
   (→ the drift). Fix (`base.css`): hide the scrollbar (`scrollbar-width:none` +
   `::-webkit-scrollbar{display:none}`) WITHOUT disabling scroll. NOTE: do **not**
   use `overflow:hidden` here — it clips the tall voiceover slides (caught as 12
   acceptance failures on `06 Copilot Kontext geben`); tall slides must still scroll.

Not a bug (also confirmed live): the "Ihre Reise / Phase 1/2/3" slides advance as
separate slides because cells 8/9 are authored `slide_type: subslide` (not
`fragment`) — an authoring choice, rendered correctly (matches classic).

**Dogfood gotcha — browser cache.** The `/rise/` app bundles have fixed names
(`*.bundle.js`, no content hash) yet are served `Cache-Control: public,
max-age=31536000, immutable`. After a `rebuild-fork` a plain reload (even reopening
the tab) keeps serving the year-cached bundle. Use Chrome **"Empty Cache and Hard
Reload"** (F12 → right-click reload) to pick up a rebuild. (Headless Playwright uses
a fresh browser each run, so probes always see the new build — that mismatch cost
time to spot.)

**Dogfood how-to (for the next session).** Launch the fork live rooted at a deck:
```
JUPYTER_CONFIG_DIR=<repo>/envs/new/jupyter-config \
  <repo>/envs/.venv-new/Scripts/python.exe -m jupyterlab --no-browser \
  --port=8890 --ip=127.0.0.1 --ServerApp.token=risetoken \
  --ServerApp.root_dir="<deck path>" --ServerApp.open_browser=False
```
Open `http://127.0.0.1:8890/lab?token=risetoken`, open a notebook, Alt+R. Course
deps (pandas/matplotlib) live in the **course root `.venv`**, NOT `.venv-new`; it is
registered as the **"Python (Courses)"** kernel (`jupyter kernelspec remove
pythoncourses` to undo) — pick it for live cell execution of dep-heavy notebooks.
Layout/live diagnostics: `harness/src/probe-layout.ts` (reveal geometry at any
viewport + initial-vs-post-nav), `probe-layout-old.ts` (classic target),
`probe-greybar.ts` (scrollbar/overflow suspects via the portrait→resize path),
`probe-bg.ts` (per-layer background colours).

## RangeError (divergence #6) — ROOT-CAUSED 2026-07-08

**What it is:** `RangeError: Maximum call stack size exceeded`, logged (caught, not
thrown-through) by JupyterLab's FAST web-component theming. Two stack shapes, both
inside the dependency `@jupyter/web-components` / `@microsoft/fast-foundation` /
`@microsoft/fast-element` — NOT in any RISE/reveal or harness code:
1. `Store.get → DesignTokenNode.get → DesignTokenImpl.getValueFor → (web-components)
   Object.evaluate → BindingObserver → DesignTokenBindingObserver.handleChange → …`
   (a **design-token derivation cycle** — a node's `get()` walks its ancestry and
   never terminates).
2. `PaletteRGBImpl.from → ComponentStateColorPalette → ColorPalette → ColorScale.
   sortColorScaleStops → Array.sort` and `colorContrast → binarySearch` self-
   recursing — downstream symptoms of (1) (the palette recipe re-entered mid-derive).

**Severity — much lower than the old handover implied. It is essentially benign
console noise:**
- Fires **only at slideshow entry/init** (~36–63×, count is nondeterministic).
  **Zero** additional errors when advancing slides or resizing the window (measured).
  So the fear that it "could bite during live presentations on big decks" is
  unfounded — it is a one-time load-time burst, independent of slide count.
- **Zero effect on rendered slides** — the acceptance suite is 159/159 and every
  content type looks close to classic. FAST catches the error and logs it.
- It is **fork/embedding-specific, not upstream**: a **plain** `/lab/tree/<nb>`
  notebook in the SAME env has **65 `jp-button`s and 0 RangeErrors**. So JupyterLab's
  FAST theming resolves fine normally; something about RISE's embedding triggers it.

**The trigger (structural):** in a plain Lab page `body` itself carries class
`jp-ThemedContainer` → a **single, stable FAST design-token root**; nested themed
containers (completer, command palette, toolbar popup) inherit from it. In the RISE
`/rise/` app `body` is `rise-enabled theme-simple` (NOT a themed container), so each
nested `.jp-ThemedContainer` — including the one holding the notebook — becomes its
**own independent design-token root** (3 roots vs 1). With no single parent root, the
derived-palette token recipes cycle. (Confirmed via `probe-roots.ts`.)

**Dead end tried (don't repeat):** the errors are NOT driven by the hidden notebook
toolbar's FAST consumers. The fork already `notebookPanel.toolbar.hide()`s it
(`packages/application/src/plugins/rise.ts` ~line 171, with a commented-out
`dispose()` that "fail[s] due to the dynamic load of the toolbar items"). Detaching
the toolbar node in `revealMode` removed all 12 `jp-button`s but the error count went
**UP** (36→63) — proving the cause is the design-token **node tree**, not the
consuming elements. Reverted; fork is unchanged (still @ 08d3a2e).

**Candidate real fix (unverified, medium effort, touches init — the user's call):**
give the RISE app a **single stable design-token root** matching plain Lab — e.g.
add `jp-ThemedContainer` to `document.body` (and ensure the JupyterLab theme
change-listener registers it as the FAST root) so the nested containers inherit
instead of each rooting independently. This is deep in FAST/`@jupyter/web-components`
behaviour and unverified; given the near-zero impact, **recommendation: leave it**
unless it actually manifests as a visible/perf problem when presenting live.

**Diagnostics added (`harness/src/`, run with `npx tsx src/<file> [deckId] [nbRel]`;
not wired into the CLI, kept for reference like `probe-measure`/`probe-spacing`):**
`probe-rangeerror.ts` (captures the full Error.stack out of the console args),
`probe-fast.ts` (error count by phase init/advance/resize + FAST-element + CSS-var
audit), `probe-plain.ts` (the plain-notebook control → 0 errors), `probe-roots.ts`
(the design-token-root plain-vs-RISE structural comparison — the smoking gun).

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

2. **~~Investigate the `RangeError`.~~ DONE 2026-07-08 — root-caused; see the
   "RangeError (divergence #6)" section above.** Bottom line: it's benign FAST
   design-token theming noise at slideshow init (not slide-graph, not our CSS,
   fork-specific, zero effect on rendering, does not recur during navigation).
   **Recommendation: LEAVE IT** unless it visibly manifests live. A candidate
   structural fix (single `body.jp-ThemedContainer` design-token root, matching
   plain Lab) is documented but unverified and not worth the init-code risk given
   the near-zero impact. Only revisit if a live presentation shows lag/glitches
   traceable to it.

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

6. **~~Open a PR~~ DONE — merge `port/classic-look` → fork `main`. → MERGE IS YOUR
   CALL.** Dogfooded (#1) and the PR is open: github.com/hoelzl/rise/pull/1. The
   branch is pushed and clean; acceptance 159/159 and verified live at 4K. Nothing
   left but to review + merge when you're ready.

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

- Post-Phase-6 (RangeError investigation, 2026-07-08): root-caused divergence #6.
  Built `probe-rangeerror/probe-fast/probe-plain/probe-roots.ts` to reproduce and
  bisect. Findings: the error is FAST/`@jupyter/web-components` design-token
  derivation recursion, fires only at slideshow init (0 on navigation/resize),
  0 effect on rendering (159/159 still green), and is fork-specific (plain
  `/lab/tree/` notebook = 0 errors). Structural trigger: RISE's `body` is not a
  `jp-ThemedContainer` so the notebook's themed container becomes an independent
  design-token root (3 roots vs plain Lab's 1). Tried & reverted a
  toolbar-node-detach fix (error count rose 36→63 → cause is the token node tree,
  not consumers). No fork change kept (still @ 08d3a2e; yarn.lock churn reverted).
  Recommendation recorded: leave it unless it manifests live.

- Live dogfood (2026-07-08): presented deck #1 from the fork at 3840×2160 and fixed
  3 live-only issues — portrait-first flip (`rise.ts` re-layout on settle/resize),
  black full-screen margins (`base.css` `.reveal`/`::backdrop` background), stray
  grey scrollbar (`base.css` hide `.jp-WindowedPanel-outer` scrollbar). One aborted
  attempt: `overflow:hidden` on the scroll container clipped tall voiceover slides
  (12 acceptance fails) → switched to hiding just the scrollbar. Added live
  diagnostics `probe-layout{,-old}.ts`, `probe-greybar.ts`, `probe-bg.ts`.
  Acceptance 159/159 throughout. See "Live dogfood fixes". Fork changes committed
  (see fork branch line in Current status).

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
- `harness/src/probe-rangeerror.ts`, `probe-fast.ts`, `probe-plain.ts`,
  `probe-roots.ts` — FAST design-token RangeError diagnostics (divergence #6; not
  wired into CLI). See the "RangeError" section.
- `config/decks.json` — deck registry; `config/baseline.json` — per-slide thresholds.
- `goldens/` (old-RISE reference, gitignored/proprietary), `shots/`, `reports/` (regenerated).
