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

- **Phase:** 0 (scaffold) — in progress.
- **Env — old (Notebook6+RISE):** NOT built yet. Spec at `envs/old/requirements.txt`.
- **Env — new (JupyterLab+fork):** NOT built yet.
- **Goldens captured:** none.
- **Baseline scores:** none.
- **Fork branch:** `main` @ 837bddc (submodule pin). No edits yet.

## Key facts / decisions (don't re-derive)

- Reference "look" = **stock RISE, `simple` theme, `scroll:true`** (from `~/.jupyter/nbconfig/rise.json`). The aqua `rise.css` files under `Own/Old/...` are stale — ignore.
- Notebooks are rendered **as saved**: no execution, no kernel needed for display.
- Old & new RISE both read the same `slideshow` metadata → identical reveal.js slide graph → Nth (h,v) slide corresponds 1:1. Use `Reveal.getState()`/indices, not blind key-stepping. Assert equal slide counts before comparing.
- Deck #1: `.../machine-learning-azav-de/Folien/Notebooks/Completed` (has saved outputs). `Code-Along` sibling lacks outputs — defer.
- Fork is a lerna monorepo: **`packages/application`** = reveal.js/RISE app; **`packages/application/style/base.css`** (459 lines) is the core look. **`packages/lab`** = JupyterLab plugin. `ui-tests/` uses Galata/Playwright.
- Tooling: Python 3.11, Node v25/npm 11, `uv` 0.11, `gh`, git. No Jupyter on default PATH → project-local venvs.
- Windows/PowerShell host. Bash tool available for POSIX. Deck paths contain spaces + German chars — quote carefully.

## Next step (do this next)

Phase 1 (RISK GATE): build the old stack and prove we can drive classic Notebook 6 +
RISE headlessly and screenshot slides. `scripts/setup-old-env.ps1`, then the
`harness` capture-old path. If the old stack can't be driven headlessly, STOP and
report (fallbacks: nbclassic shim, Docker).

## Edit log

- Phase 0: scaffolded repo (README, PLAN.md, .gitignore, config/decks.json, envs/old, HANDOVER). Added `rise/` submodule @ 837bddc.

## How to resume in a fresh session

1. Read this file + `PLAN.md`.
2. `git submodule update --init --recursive`.
3. Check "Current status" above for the phase; run the "Next step".
