# Build the OLD reference stack (classic Notebook 6 + RISE 5.7) into envs/.venv-old.
# Idempotent: safe to re-run. Requires: uv, Python 3.11 available to uv.
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$venv = Join-Path $repo 'envs/.venv-old'
if (-not (Test-Path $venv)) {
    uv venv $venv --python 3.11
}
uv pip install --python (Join-Path $venv 'Scripts/python.exe') -r (Join-Path $repo 'envs/old/requirements.txt')

# Sanity check the stack imports.
& (Join-Path $venv 'Scripts/python.exe') -c "import notebook, rise, nbconvert; print('old stack OK:', notebook.__version__, 'rise', rise.__version__)"
Write-Host 'Old reference stack ready (envs/.venv-old).'
