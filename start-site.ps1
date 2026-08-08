$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

function Test-LocalUrl($url) {
  try {
    Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

if (-not (Test-LocalUrl "http://127.0.0.1:8787/api/health")) {
  Start-Process -FilePath "node" `
    -ArgumentList "server/index.js" `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $projectRoot "_api.out.log") `
    -RedirectStandardError (Join-Path $projectRoot "_api.err.log")
}

if (-not (Test-LocalUrl "http://127.0.0.1:5177")) {
  Start-Process -FilePath "npm.cmd" `
    -ArgumentList "run dev:web" `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $projectRoot "_web.out.log") `
    -RedirectStandardError (Join-Path $projectRoot "_web.err.log")
}

Start-Sleep -Seconds 3
Start-Process "http://127.0.0.1:5177"

Write-Host "DreamForge started: http://127.0.0.1:5177"
