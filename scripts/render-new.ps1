# Capture new-stack screenshots (fork) for a deck. Pass -Deck ID and optional -Limit N.
param([Parameter(Mandatory)][string]$Deck, [int]$Limit, [switch]$All, [string]$Nb)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Push-Location (Join-Path $repo 'harness')
try {
    $a = @('src/cli.ts', 'capture', '--stack', 'new', '--deck', $Deck)
    if ($Limit) { $a += @('--limit', "$Limit") }
    if ($All)   { $a += @('--all', 'true') }
    if ($Nb)    { $a += @('--nb', $Nb) }
    npx tsx @a
} finally { Pop-Location }
