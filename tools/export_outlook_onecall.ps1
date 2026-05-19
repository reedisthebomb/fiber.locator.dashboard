param(
  [int]$DaysBack = 4,
  [string]$OutputDir = "$env:USERPROFILE\Downloads",
  [switch]$IncludeRead,
  [switch]$SyncToServer,
  [switch]$SyncToLocalServer,
  [string]$ServerUser = "kali",
  [string]$ServerHost = "192.168.50.231",
  [int]$ServerPort = 22,
  [string]$ServerInboxDir = "/opt/onecall-locator-dashboard/data/inbox",
  [string]$LocalServerInboxDir = "\\wsl.localhost\kali-linux\opt\onecall-locator-dashboard\data\inbox"
)

$ErrorActionPreference = "Stop"
$ticketPattern = "\b\d{6}-\d{4}\b"
$since = (Get-Date).AddDays(-1 * $DaysBack)
function Get-CommandPath {
  param(
    [string[]]$Names
  )

  foreach ($name in $Names) {
    $command = Get-Command $name -ErrorAction SilentlyContinue
    if ($command) {
      return $command.Source
    }
  }

  return $null
}

function Sync-FilesToServer {
  param(
    [string[]]$Files,
    [string]$User,
    [string]$ServerAddress,
    [int]$Port,
    [string]$InboxDir
  )

  if (-not $Files.Count) {
    Write-Host "No exported files to sync."
    return
  }

  if (-not $ServerAddress) {
    throw "Set -ServerHost when using -SyncToServer."
  }

  $ssh = Get-CommandPath -Names @("ssh.exe", "ssh")
  $scp = Get-CommandPath -Names @("scp.exe", "scp")
  if (-not $ssh -or -not $scp) {
    throw "OpenSSH client tools ssh/scp are required for -SyncToServer."
  }

  $remote = "$User@$ServerAddress"
  & $ssh -p $Port $remote "mkdir -p '$InboxDir'"
  if ($LASTEXITCODE -ne 0) {
    throw ("Failed to create remote inbox directory {0} on {1}" -f $InboxDir, $remote)
  }

  $remotePath = ("{0}:{1}/" -f $remote, $InboxDir)
  $copyArgs = @("-P", $Port) + $Files + @($remotePath)
  & $scp @copyArgs
  if ($LASTEXITCODE -ne 0) {
    throw ("Failed to copy exported ticket files to {0}" -f $remotePath)
  }

  foreach ($file in $Files) {
    Write-Host ("Synced {0} -> {1}" -f (Split-Path $file -Leaf), $remotePath)
  }
}

function Sync-FilesToLocalServer {
  param(
    [string[]]$Files,
    [string]$InboxDir
  )

  if (-not $Files.Count) {
    Write-Host "No exported files to sync locally."
    return
  }

  if (-not (Test-Path $InboxDir)) {
    New-Item -ItemType Directory -Force -Path $InboxDir | Out-Null
  }

  foreach ($file in $Files) {
    Copy-Item -LiteralPath $file -Destination $InboxDir -Force
    Write-Host ("Synced {0} -> {1}" -f (Split-Path $file -Leaf), $InboxDir)
  }
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$outlook = New-Object -ComObject Outlook.Application
$namespace = $outlook.GetNamespace("MAPI")
$inbox = $namespace.GetDefaultFolder(6)
$items = $inbox.Items
$items.Sort("[ReceivedTime]", $true)

$exported = 0
$exportedFiles = @()
foreach ($item in $items) {
  if ($item.Class -ne 43) {
    continue
  }
  if ($item.ReceivedTime -lt $since) {
    break
  }
  if (-not $IncludeRead -and -not $item.UnRead) {
    continue
  }

  $subject = [string]$item.Subject
  $body = [string]$item.Body
  $haystack = "$subject`n$body"
  $ticketMatch = [regex]::Match($haystack, $ticketPattern)
  if (-not $ticketMatch.Success) {
    continue
  }
  if ($haystack -notmatch "Arkansas One Call|AR One Call|811") {
    continue
  }

  $ticketNumber = $ticketMatch.Value
  $safeSubject = $subject -replace '[\\/:*?"<>|]', ' '
  $path = Join-Path $OutputDir "Arkansas One Call Ticket $ticketNumber.txt"

  $content = @(
    "Subject: $subject",
    "From: $($item.SenderName) <$($item.SenderEmailAddress)>",
    "Date: $($item.ReceivedTime.ToString('o'))",
    "To: $($item.To)",
    "",
    $body
  ) -join "`r`n"

  Set-Content -Path $path -Value $content -Encoding UTF8
  $exported += 1
  $exportedFiles += $path
  Write-Host "Exported $ticketNumber -> $path"
}

Write-Host "Done. Exported $exported ticket message(s) to $OutputDir"

if ($SyncToServer) {
  Sync-FilesToServer -Files $exportedFiles -User $ServerUser -ServerAddress $ServerHost -Port $ServerPort -InboxDir $ServerInboxDir
  Write-Host "Server sync complete."
}

if ($SyncToLocalServer) {
  Sync-FilesToLocalServer -Files $exportedFiles -InboxDir $LocalServerInboxDir
  Write-Host "Local server sync complete."
}
