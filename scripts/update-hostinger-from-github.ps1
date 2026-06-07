param(
  [ValidateSet("site", "api", "marketing", "all")]
  [string]$Target = "site"
)

$ErrorActionPreference = "Stop"
$Repo = Resolve-Path (Join-Path $PSScriptRoot "..")

Push-Location $Repo
try {
  git fetch origin main
  git pull --ff-only origin main
  & (Join-Path $PSScriptRoot "deploy-hostinger.ps1") -Target $Target
}
finally {
  Pop-Location
}
