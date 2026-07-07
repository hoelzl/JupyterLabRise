# Diff goldens vs new-stack shots for a deck and build the HTML report.
param([Parameter(Mandatory)][string]$Deck, [int]$Limit, [switch]$All, [string]$Nb)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Push-Location (Join-Path $repo 'harness')
try {
    $a = @('src/cli.ts', 'compare', '--deck', $Deck)
    if ($Limit) { $a += @('--limit', "$Limit") }
    if ($All)   { $a += @('--all', 'true') }
    if ($Nb)    { $a += @('--nb', $Nb) }
    npx tsx @a
} finally { Pop-Location }
