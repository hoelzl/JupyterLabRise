# End-to-end for a deck: capture old (goldens) -> capture new (shots) -> compare -> report.
param([Parameter(Mandatory)][string]$Deck, [int]$Limit, [switch]$All, [string]$Nb)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Push-Location (Join-Path $repo 'harness')
try {
    $a = @('src/cli.ts', 'loop', '--deck', $Deck)
    if ($Limit) { $a += @('--limit', "$Limit") }
    if ($All)   { $a += @('--all', 'true') }
    if ($Nb)    { $a += @('--nb', $Nb) }
    npx tsx @a
} finally { Pop-Location }
