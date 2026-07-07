# Rebuild the fork's JS/CSS after editing packages/**/src or style, so the
# dev-installed labextension picks up changes. Fast path for the Phase 4 fix loop.
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$scripts = Join-Path $repo 'envs/.venv-new/Scripts'
$env:PATH = "$scripts;$env:PATH"
Push-Location (Join-Path $repo 'rise')
try {
    & (Join-Path $scripts 'jlpm.exe') run build
} finally {
    Pop-Location
}
Write-Host 'Fork rebuilt. Re-run render-new + compare to see the effect.'
