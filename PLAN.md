# Plan: Autonomous harness to port "old RISE" look to the new JupyterLab RISE fork

## Context

The user teaches from ~400+ course slide decks authored as Jupyter notebooks and
presents them with the **classic** RISE extension (damianavila/RISE) on the old
Jupyter stack (Notebook 6.x). That stack blocks upgrading to modern Jupyter.
A port of RISE to JupyterLab 4.x exists (`jupyterlab_rise`) but is buggy and looks
very different. The user forked it at `https://github.com/hoelzl/rise` and wants a
**self-contained harness** that lets Claude Code work autonomously to:

1. Render the same notebook under **old RISE** (reference) and the **new fork**.
2. Measure the visual difference per slide.
3. Fix the fork (TypeScript/CSS) until the new look is *close* to the old one
   (not pixel-perfect, but visually similar).
4. Add **acceptance tests** (visual regression) that lock in progress so future
   fork changes don't regress fixed slides.
5. Iterate slide-by-slide and deck-by-deck, autonomously.

This repo (`JupyterLabRise`) is an empty git repo and becomes the harness.

### Confirmed decisions
- **Reference:** build an isolated old stack (Notebook 6.x + RISE 5.7.x, Py 3.11) and
  generate golden screenshots from it — no dependence on any external machine.
- **Browser driver:** Playwright headless (matches the fork's existing Galata/Playwright `ui-tests/`).
- **Repo layout:** fork `hoelzl/rise` as a **git submodule** inside this repo.
- **First milestone:** depth-first on ONE deck — the
  `machine-learning-azav-de/Folien/Notebooks/Completed` set — prove the whole loop,
  then fan out.

### Key facts established during exploration
- Reference deck: `C:\Users\tc\Programming\Python\Courses\Own\PythonCourses\output\trainer\machine-learning-azav-de\Folien\Notebooks\` (`Completed/` + `Code-Along/`, 428 notebooks). Notebooks use `slideshow` metadata (`slide`/`subslide`), jupytext, standard `python3` kernel; nbformat 4.
- Old RISE config: `~/.jupyter/nbconfig/rise.json` = `{"scroll": true}` → default "simple" theme, default transition, scroll enabled. The `rise.css` files found (aqua body) are stale test artifacts, **not** the reference look. The reference look is therefore **stock RISE + scroll mode**.
- Both old and new RISE read the *same* `slideshow` metadata and build the *same* reveal.js slide graph, so the Nth `(horizontal, vertical)` slide position corresponds 1:1 between stacks — enabling deterministic per-slide comparison.
- **RISE renders saved notebook content only** (markdown, code source, saved outputs). Display requires **no cell execution and no live kernel** → the old env can be tiny (notebook + rise), and rendering is fast and deterministic.
- The fork is a standard JupyterLab 4 extension: TypeScript/CSS, `jlpm`/yarn + lerna, dev-install via `pip install -e .` + `jupyter labextension develop`. It already contains `ui-tests/` (Galata/Playwright) — the natural home for acceptance tests. Requires JupyterLab ≥ 4.1.2.
- Tooling present: Python 3.11, Node v25 / npm 11, `uv` (used by the courses), `gh` CLI, git. No Jupyter on the default PATH — envs will be project-local venvs.

---

## Target repository layout

```
JupyterLabRise/
  README.md                     # what this is, how to run the loop
  PLAN.md                       # this plan (copied in from .claude/plans)
  HANDOVER.md                   # living handover doc (state, next steps, log)
  .gitmodules / rise/           # submodule → github.com/hoelzl/rise (the fork)
  .gitignore                    # venvs, node_modules, shots/, reports/, test-results/

  envs/
    old/requirements.txt        # notebook==6.5.x, rise==5.7.x, ipykernel, jupyter-client pins
    old/README.md               # how the old reference env is built/driven

  scripts/                      # PowerShell entry points (Windows-first)
    setup-old-env.ps1           # uv venv envs/.venv-old + pip install -r envs/old/requirements.txt
    setup-fork.ps1              # submodule init, jlpm install, jlpm build, pip install -e rise into .venv-new
    render-old.ps1              # capture goldens for a deck
    render-new.ps1              # capture new-stack shots for a deck
    compare.ps1                 # diff + report for a deck
    loop.ps1                    # end-to-end for a deck (old→new→compare→report)

  harness/                      # Node/Playwright project (the engine)
    package.json                # playwright, pixelmatch, pngjs, tsx
    playwright.config.ts
    src/
      slides.ts                 # parse a notebook → ordered slide list (h/v indices) from slideshow metadata
      server-old.ts             # launch classic notebook server on .venv-old, return URL/token
      server-new.ts             # launch JupyterLab on .venv-new, return URL/token
      capture-old.ts            # open notebook, trigger RISE (Alt+R), step reveal.js, screenshot each slide
      capture-new.ts            # same for JupyterLab fork; drive reveal.js via Reveal API
      compare.ts                # pixelmatch per slide → score + diff PNG
      report.ts                 # build reports/<deck>/index.html (old | new | diff, sorted worst-first)
      cli.ts                    # `capture --stack old|new --deck ... `, `compare --deck ...`
      config.ts                 # viewport, theme/scroll parity, tolerance thresholds

  config/
    decks.json                  # deck registry: id, path, glob, viewport, notes
    baseline.json               # per-slide accepted similarity scores (updated as we fix)

  goldens/<deck>/<notebook>/slide-000.png ...     # old-RISE reference (committed, LFS-optional)
  shots/<deck>/...              # new-stack renders (gitignored, regenerated)
  reports/<deck>/index.html     # human-review artifact (gitignored)

  tests/                        # acceptance = visual regression, run in CI
    visual.spec.ts              # for each golden, render new stack, assert diff ≤ threshold
```

Acceptance tests live in `tests/` (harness-owned) rather than the fork's `ui-tests/`, because they compare the **new fork against the old-look goldens** — a harness concern. The fork's own `ui-tests/` stay for the fork's internal behavior.

---

## Implementation phases

Each phase ends by updating `HANDOVER.md` (state + how to resume) and committing.

### Phase 0 — Scaffold & submodule
- `git submodule add https://github.com/hoelzl/rise rise` (pin a commit/branch).
- Create repo skeleton, `.gitignore`, `README.md`, copy this plan to `PLAN.md`, seed `HANDOVER.md`.
- `config/decks.json` with deck #1 = `machine-learning-azav-de` (Completed), viewport `1920×1080`.
- **Verify:** `git submodule status` clean; tree matches layout.

### Phase 1 — Old reference stack (RISK SPIKE — do first)
- `envs/old/requirements.txt`: `notebook==6.5.7`, `rise==5.7.1`, `ipykernel`, plus the transitive pins RISE/Notebook6 need on Py3.11 (`traitlets`, `tornado`, `jinja2`, `nbconvert<7`, `pyzmq` as required). Build with `uv venv` + `uv pip`.
- `scripts/setup-old-env.ps1` builds `.venv-old` and writes RISE config parity (`scroll:true`, default theme).
- `harness/src/server-old.ts` launches `jupyter notebook --no-browser` (classic), captures token.
- `harness/src/capture-old.ts`: Playwright opens a notebook, presses **Alt+R** to enter RISE, waits for reveal.js, walks the slide graph (Space / arrow keys, or `Reveal.slide(h,v)` via `page.evaluate`), screenshots each slide to `goldens/`.
- **Verify (gate):** goldens for 3–5 representative notebooks from deck #1 render correctly and look like the user's real slides. If classic Notebook 6 + RISE cannot be driven headlessly on this machine, STOP and report — this is the make-or-break dependency. (Fallbacks to raise with user: `nbclassic` shim, or Docker-based old stack.)

### Phase 2 — New fork stack
- `scripts/setup-fork.ps1`: `.venv-new` with `jupyterlab>=4.5`; in `rise/`: `jlpm install && jlpm build`; `pip install -e rise`; `jupyter labextension develop rise --overwrite`. Apply matching RISE settings (scroll/theme) via JupyterLab settings.
- `harness/src/server-new.ts` + `capture-new.ts`: open the same notebook in JupyterLab, trigger the fork's slideshow, step the same slide indices, screenshot to `shots/`.
- **Verify:** new-stack shots produced for the same 3–5 notebooks; slide counts match goldens 1:1.

### Phase 3 — Compare + report
- `harness/src/compare.ts`: normalize size, `pixelmatch` → per-slide mismatch ratio (similarity score) + diff PNG. Aggregate to `reports/<deck>/index.html` with **old | new | diff** columns, sorted worst-first, plus a summary score.
- `config/baseline.json` records current per-slide scores.
- **Verify:** open the report; confirm scores rank the genuinely-worst slides highest.

### Phase 4 — Fix loop (the autonomous core)
- Working on the *worst* slides first, diagnose divergence by inspecting both DOMs/computed CSS (Playwright `page` in each stack) and comparing to old RISE's stylesheet expectations.
- Edit fork **CSS first** (theme, font sizes, spacing, code-cell styling, reveal scaling, scroll behavior), then TS where structural. Rebuild (`jlpm build`), re-render, re-score.
- Accept a slide when its score crosses the tolerance; update `config/baseline.json`.
- Loop over slides in the deck, then across decks. Keep an edit log in `HANDOVER.md`.
- (Optional, only if the user opts into multi-agent orchestration later: a Workflow can fan out "diagnose slide → propose CSS fix → verify" across many slides. Not required for the base harness.)
- **Verify:** deck #1 median similarity improves materially vs the Phase 3 baseline; before/after report saved.

### Phase 5 — Acceptance tests (regression lock)
- `tests/visual.spec.ts`: for every committed golden, render the new stack and assert diff ≤ the accepted threshold from `baseline.json`. Runnable via `npx playwright test` and wired into a `scripts/test.ps1` / CI job (GitHub Actions in the harness repo).
- **Verify:** suite passes on the current fixed state; deliberately reverting one CSS fix makes exactly the affected slide(s) fail.

### Phase 6 — Fan out
- Add more decks to `config/decks.json` (other `Own` courses / languages), regenerate goldens, run the loop, grow the acceptance suite.
- **Verify:** loop runs unattended across ≥2 decks; report + tests updated.

---

## Autonomy & handover model
- **`HANDOVER.md`** is the single source of truth for resuming: current phase, env build status, which decks/slides have goldens, current baseline scores, open problems, and the exact commands to continue. Updated at every phase boundary and before any context handoff.
- Deterministic **PowerShell entry points** in `scripts/` mean a fresh session (or the user) can rebuild envs and re-run the loop with one command each.
- Fork edits are committed on a branch in the `rise/` submodule and pushed to `hoelzl/rise`; the harness repo pins the submodule commit so state is reproducible.

## Primary risks & mitigations
1. **Driving classic Notebook 6 + RISE headlessly on Windows/Py3.11** — the linchpin (Phase 1 gate). Mitigation: pin known-good versions; fallbacks = `nbclassic`, or a Dockerized old stack if native fails.
2. **Slide correspondence drift** (e.g., fragments, `notes`) — use reveal.js `Reveal.getState()`/indices, not blind key-stepping, and assert equal slide counts before comparing.
3. **Rendering nondeterminism** (fonts, animations, cursor) — fixed viewport, disable reveal transitions for capture, mask volatile regions, settle delays.
4. **Golden storage size** (hundreds of PNGs) — PNG optimization; consider Git LFS if the repo grows large.
5. **Notebooks without saved outputs** (Code-Along) — start with `Completed/` (has outputs); treat Code-Along separately.

## Verification (end-to-end)
1. `scripts/setup-old-env.ps1` then `scripts/render-old.ps1 -Deck machine-learning-azav-de` → goldens appear and visually match real slides.
2. `scripts/setup-fork.ps1` then `scripts/render-new.ps1 -Deck ...` → new shots, slide counts equal.
3. `scripts/compare.ps1 -Deck ...` → `reports/.../index.html` opens with sorted diffs + summary score.
4. After Phase 4 edits, re-run compare → median similarity improved; before/after saved.
5. `npx playwright test` (Phase 5) passes; reverting one fix fails exactly the expected slide(s).
