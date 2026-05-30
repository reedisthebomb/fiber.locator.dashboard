param(
  [int]$DaysBack = 2,
  [string]$DellHost = "100.69.22.78",
  [string]$DellUser = "linux",
  [string]$RemoteZipPath = "/home/linux/device-imports/dmi-tablet/windows/outlook-exports/onecall-export-now.zip",
  [switch]$NoPause
)

$ErrorActionPreference = "Stop"

function Pause-End {
  param([int]$ExitCode = 0)
  if (-not $NoPause) {
    Write-Host ""
    Read-Host "Press Enter to close"
  }
  exit $ExitCode
}

try {
  $projectRoot = Split-Path -Parent $PSScriptRoot
  $exportScript = Join-Path $PSScriptRoot "export_outlook_onecall.ps1"
  $exportDir = Join-Path $env:USERPROFILE "Downloads\onecall-export-now"
  $zipPath = Join-Path $env:USERPROFILE "Downloads\onecall-export-now.zip"

  if (-not (Test-Path $exportScript)) {
    throw "Missing export helper: $exportScript"
  }

  $scp = Get-Command "scp.exe" -ErrorAction SilentlyContinue
  if (-not $scp) {
    $scp = Get-Command "scp" -ErrorAction SilentlyContinue
  }
  if (-not $scp) {
    throw "OpenSSH scp was not found. Install OpenSSH Client in Windows Optional Features."
  }

  Write-Host "Fiber Locator daily Outlook refresh"
  Write-Host "Project: $projectRoot"
  Write-Host "Lookback: $DaysBack day(s)"
  Write-Host "Export folder: $exportDir"
  Write-Host "Upload target: ${DellUser}@${DellHost}:$RemoteZipPath"
  Write-Host ""

  Write-Host "Cleaning previous export..."
  Remove-Item $exportDir -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force -Path $exportDir | Out-Null

  Write-Host "Exporting Outlook tickets..."
  powershell -ExecutionPolicy Bypass -File $exportScript -DaysBack $DaysBack -IncludeRead -OutputDir $exportDir
  if ($LASTEXITCODE -ne 0) {
    throw "Outlook export failed with exit code $LASTEXITCODE"
  }

  $ticketFiles = Get-ChildItem -Path $exportDir -Filter "Arkansas One Call Ticket *.txt" -File
  if (-not $ticketFiles.Count) {
    throw "No Arkansas One Call ticket files were exported. Check Outlook sync and DaysBack."
  }

  Write-Host "Compressing $($ticketFiles.Count) ticket file(s)..."
  Compress-Archive -Path (Join-Path $exportDir "Arkansas One Call Ticket *.txt") -DestinationPath $zipPath -Force

  $remoteDir = Split-Path -Parent $RemoteZipPath
  $remote = "${DellUser}@${DellHost}"

  Write-Host "Preparing Dell destination..."
  ssh $remote "mkdir -p '$remoteDir'"
  if ($LASTEXITCODE -ne 0) {
    throw "Could not create remote directory: $remoteDir"
  }

  Write-Host "Uploading ZIP to Dell..."
  & $scp.Source $zipPath "${remote}:$RemoteZipPath"
  if ($LASTEXITCODE -ne 0) {
    throw "Upload failed with exit code $LASTEXITCODE"
  }

  Write-Host ""
  Write-Host "Done."
  Write-Host "Exported: $($ticketFiles.Count) ticket file(s)"
  Write-Host "ZIP: $zipPath"
  Write-Host "Uploaded: ${remote}:$RemoteZipPath"
  Write-Host ""
  Write-Host "Next: tell Codex the upload is done so it can sync inbox, refresh polygons, deploy, and verify live."
  Pause-End 0
} catch {
  Write-Host ""
  Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
  Pause-End 1
}
