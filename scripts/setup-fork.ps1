# Build the NEW stack: JupyterLab 4 + the RISE fork (rise/ submodule), dev-installed
# so CSS/TS edits + `jlpm build` are picked up without reinstalling.
# Idempotent. Requires: uv, Node/npm, and the rise/ submodule checked out.
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$venv = Join-Path $repo 'envs/.venv-new'
$py   = Join-Path $venv 'Scripts/python.exe'
if (-not (Test-Path $venv)) {
    uv venv $venv --python 3.11
}

# JupyterLab first (provides jlpm and the build backend).
uv pip install --python $py 'jupyterlab>=4.5,<5' 'jupyter_server>=2,<3' jupyterlab-mathjax3

$fork = Join-Path $repo 'rise'
Push-Location $fork
try {
    # Build the extension JS, then dev-install into the venv.
    & (Join-Path $venv 'Scripts/jlpm.exe') install
    & (Join-Path $venv 'Scripts/jlpm.exe') run build
    uv pip install --python $py -e $fork --no-build-isolation
    & (Join-Path $venv 'Scripts/jupyter.exe') labextension develop $fork --overwrite
    & (Join-Path $venv 'Scripts/jupyter.exe') server extension enable jupyterlab_rise
} finally {
    Pop-Location
}

& (Join-Path $venv 'Scripts/jupyter.exe') labextension list
Write-Host 'New fork stack ready (envs/.venv-new).'
