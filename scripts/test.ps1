# Acceptance / visual-regression suite: re-render every baselined notebook under
# the new fork and assert each slide stays within its config/baseline.json
# threshold. Exits non-zero on any regression. Needs local goldens (proprietary);
# notebooks without goldens are skipped, not failed.
#   scripts/test.ps1                       # all baselined decks
#   scripts/test.ps1 -Deck <id> -Eps 0.015 # one deck, custom epsilon
param([string]$Deck, [double]$Eps)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Push-Location (Join-Path $repo 'harness')
try {
    $a = @('src/acceptance.ts')
    if ($Deck) { $a += @('--deck', $Deck) }
    if ($Eps)  { $a += @('--eps', "$Eps") }
    npx tsx @a
} finally { Pop-Location }
