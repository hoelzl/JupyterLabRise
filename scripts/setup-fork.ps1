# Build the NEW stack: JupyterLab 4 + the RISE fork (rise/ submodule), dev-installed
# so CSS/TS edits + `jlpm build` are picked up without reinstalling.
# Idempotent. Requires: uv, Node/npm, and the rise/ submodule checked out.
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$venv = Join-Path $repo 'envs/.venv-new'
$py   = Join-Path $venv 'Scripts/python.exe'
$scripts = Join-Path $venv 'Scripts'
if (-not (Test-Path $venv)) {
    uv venv $venv --python 3.11
}

# JupyterLab (provides jlpm + the labextension tooling) and the build backend deps.
uv pip install --python $py 'jupyterlab>=4.5,<5' 'jupyter_server>=2,<3' jupyterlab-mathjax3
uv pip install --python $py hatchling hatch-nodejs-version hatch-jupyter-builder editables

$fork = Join-Path $repo 'rise'
# The lerna sub-package build scripts call `jlpm` from PATH, so put the venv first.
$env:PATH = "$scripts;$env:PATH"

Push-Location $fork
try {
    & (Join-Path $scripts 'jlpm.exe') install
    & (Join-Path $scripts 'jlpm.exe') run build
    # Editable Python install WITHOUT re-running the (already done) JS build.
    $env:HATCH_JUPYTER_BUILDER_SKIP_BUILD = '1'
    uv pip install --python $py -e $fork --no-build-isolation
    & (Join-Path $scripts 'jupyter.exe') labextension develop $fork --overwrite
    & (Join-Path $scripts 'jupyter.exe') server extension enable jupyterlab_rise
} finally {
    Remove-Item Env:\HATCH_JUPYTER_BUILDER_SKIP_BUILD -ErrorAction SilentlyContinue
    Pop-Location
}

& (Join-Path $scripts 'jupyter.exe') labextension list
Write-Host 'New fork stack ready (envs/.venv-new).'
