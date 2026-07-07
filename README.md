# JupyterLabRise — RISE look-porting harness

A test harness for porting the **classic RISE** slideshow look to the
[JupyterLab 4 RISE fork](https://github.com/hoelzl/rise) (vendored here as the
`rise/` submodule).

## What it does

1. Renders a course notebook under **old RISE** (classic Notebook 6) → *golden* screenshots.
2. Renders the same notebook under the **new fork** (JupyterLab 4) → *candidate* screenshots.
3. Diffs them per slide (pixelmatch) and builds a worst-first HTML report.
4. Drives an iterative loop of CSS/TS fixes in the fork until the new look is close to the old one.
5. Locks in progress with Playwright visual-regression acceptance tests.

Notebooks are rendered **as saved** — no cell execution, no live kernel — so rendering
is fast and deterministic and the reference env stays small.

## Layout

- `rise/` — git submodule, the fork under test (edit CSS/TS here).
- `envs/old/` — pinned old reference stack (Notebook 6 + RISE 5.7).
- `harness/` — Playwright/TypeScript engine (servers, capture, compare, report).
- `config/decks.json` — deck registry; `config/baseline.json` — accepted per-slide scores.
- `goldens/` — committed reference screenshots. `shots/`, `reports/` — regenerable (gitignored).
- `tests/` — visual-regression acceptance suite.
- `scripts/` — PowerShell entry points.
- `PLAN.md` — the implementation plan. `HANDOVER.md` — living state / how to resume.

## Quick start

```powershell
git submodule update --init --recursive
scripts/setup-old-env.ps1        # build envs/.venv-old (Notebook 6 + RISE)
scripts/setup-fork.ps1           # build envs/.venv-new + dev-install the fork
scripts/loop.ps1 -Deck machine-learning-azav-de   # old→new→compare→report
```

See **HANDOVER.md** for current status and the exact next step.
