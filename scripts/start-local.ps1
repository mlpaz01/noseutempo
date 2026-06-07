param(
  [int]$Port = 8088
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Server = Join-Path $Root "local_proxy_server.py"

$pythonCandidates = @(
  "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe",
  "python"
)

$Python = $pythonCandidates | Where-Object {
  if ($_ -eq "python") { return $true }
  Test-Path $_
} | Select-Object -First 1

if (-not $Python) {
  throw "Python nao encontrado. Instale Python ou use o runtime do Codex."
}

Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Start-Process -FilePath $Python `
  -ArgumentList @("`"$Server`"", [string]$Port) `
  -WorkingDirectory $Root `
  -WindowStyle Hidden

Start-Sleep -Seconds 2

$url = "http://127.0.0.1:$Port/login.html"
try {
  Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10 | Out-Null
  Write-Host "NoSeuTempo local rodando em $url"
} catch {
  throw "Servidor local iniciou, mas nao respondeu em $url"
}
