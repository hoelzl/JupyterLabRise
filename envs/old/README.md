# Old reference stack (classic Notebook 6 + RISE 5.7)

Renders notebooks with the **original** RISE look to produce golden screenshots.

- Built into `envs/.venv-old` by `scripts/setup-old-env.ps1` (uv, Python 3.11).
- Pinned deps: `requirements.txt`. Notebook 6.5.7 + RISE 5.7.1 + nbconvert 6.x.
- Notable pins: `setuptools<81` (RISE imports `pkg_resources`), `lxml_html_clean`
  (nbconvert 6 imports `lxml.html.clean`, split out of modern lxml).
- Isolated Jupyter config in `jupyter-config/` (set via `JUPYTER_CONFIG_DIR`):
  - `nbconfig/notebook.json` enables the `rise/main` nbextension.
  - `nbconfig/rise.json` pins the presentation look for reproducible captures:
    `scroll:true` (matches the user's real config), `theme:simple`,
    `transition:none` (settled screenshots), controls/progress off.
- Notebooks are rendered **as saved** — no kernel, no execution.

## Manual smoke test

```powershell
$env:JUPYTER_CONFIG_DIR = "$PWD/envs/old/jupyter-config"
envs/.venv-old/Scripts/python.exe -m notebook --no-browser --port 8899 `
  --NotebookApp.token=risetoken --notebook-dir "<deck path>"
# then open a notebook and press Alt+R
```

## Fallbacks (if classic Notebook 6 ever stops working here)

- `nbclassic` shim on a newer server.
- Dockerized old stack (pin the same versions in an image).
