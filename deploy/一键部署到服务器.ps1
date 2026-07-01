param(
  [switch]$NoPause
)

$ErrorActionPreference = "Stop"

$BundleRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Join-Path $BundleRoot "project"
$AppName = "quiz-site"
$LocalArchive = Join-Path $env:TEMP "$AppName.zip"
$TempPack = Join-Path $env:TEMP "$AppName-pack"
$LogFile = Join-Path $BundleRoot "deploy-log.txt"

Start-Transcript -Path $LogFile -Append | Out-Null

function Finish-WithPause {
  param([int]$Code = 0)
  Stop-Transcript | Out-Null
  if (-not $NoPause) {
    Write-Host ""
    Write-Host "Log file: $LogFile" -ForegroundColor Yellow
    Read-Host "Press Enter to close"
  }
  exit $Code
}

try {
  if (-not (Test-Path $ProjectDir)) {
    throw "Project bundle not found: $ProjectDir"
  }

  Write-Host "Windows Server deploy for quiz site" -ForegroundColor Cyan
  Write-Host ""

  $ComputerName = Read-Host "Windows Server computer name or IP"
  $Credential = Get-Credential -Message "Enter Windows Server admin credentials"
  $RemoteRoot = Read-Host "Remote app folder (Enter for C:\\quiz-site)"
  if ([string]::IsNullOrWhiteSpace($RemoteRoot)) { $RemoteRoot = "C:\quiz-site" }
  $Port = Read-Host "App port on server (Enter for 8000)"
  if ([string]::IsNullOrWhiteSpace($Port)) { $Port = "8000" }
  $Domain = Read-Host "Domain or server IP for browser access"
  $AdminUser = Read-Host "Fixed admin username (Enter for admin)"
  if ([string]::IsNullOrWhiteSpace($AdminUser)) { $AdminUser = "admin" }
  $AdminPassword = Read-Host "Fixed admin password"
  $SecretBytes = [byte[]]::new(48)
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($SecretBytes)
  $SecretKey = [Convert]::ToBase64String($SecretBytes)
  $AiKey = Read-Host "AI_API_KEY (blank to skip AI)"
  $AiBase = Read-Host "AI_API_BASE (blank to skip)"
  $AiModel = Read-Host "AI_MODEL (blank for gpt-4o-mini)"
  if ([string]::IsNullOrWhiteSpace($AiModel)) { $AiModel = "gpt-4o-mini" }

  if (Test-Path $LocalArchive) { Remove-Item $LocalArchive -Force }
  if (Test-Path $TempPack) { Remove-Item $TempPack -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $TempPack | Out-Null
  Copy-Item (Join-Path $ProjectDir "app.py") $TempPack
  Copy-Item (Join-Path $ProjectDir "requirements.txt") $TempPack
  Copy-Item (Join-Path $ProjectDir "static") $TempPack -Recurse
  Copy-Item (Join-Path $ProjectDir "templates") $TempPack -Recurse
  New-Item -ItemType Directory -Force -Path (Join-Path $TempPack "uploads") | Out-Null
  Compress-Archive -Path "$TempPack\*" -DestinationPath $LocalArchive -Force

  Write-Host "Connecting to remote server..." -ForegroundColor Cyan
  $Session = New-PSSession -ComputerName $ComputerName -Credential $Credential -Authentication Negotiate

  $RemoteZip = Join-Path $RemoteRoot "$AppName.zip"
  Invoke-Command -Session $Session -ScriptBlock {
    param($Path)
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Path) | Out-Null
  } -ArgumentList $RemoteZip
  Copy-Item $LocalArchive -Destination $RemoteZip -ToSession $Session

  Write-Host "Deploying app on server..." -ForegroundColor Cyan
  Invoke-Command -Session $Session -ScriptBlock {
    param($Root, $Zip, $Port, $AdminUser, $AdminPassword, $SecretKey, $AiKey, $AiBase, $AiModel)

    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
    New-Item -ItemType Directory -Force -Path $Root | Out-Null
    if (Test-Path $Root\*) { Remove-Item -Recurse -Force $Root\* }
    Expand-Archive -Path $Zip -DestinationPath $Root -Force
    New-Item -ItemType Directory -Force -Path (Join-Path $Root "uploads") | Out-Null

    if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
      throw "Python is not installed on the server."
    }

    Push-Location $Root
    if (-not (Test-Path ".venv")) {
      python -m venv .venv
    }
    .\.venv\Scripts\python.exe -m pip install --upgrade pip
    .\.venv\Scripts\python.exe -m pip install -r requirements.txt

    $serviceName = "QuizSite"
    $scriptPath = Join-Path $Root "run.ps1"
    @"
`$env:SECRET_KEY = "$SecretKey"
`$env:FIXED_ADMIN_USER = "$AdminUser"
`$env:FIXED_ADMIN_PASSWORD = "$AdminPassword"
`$env:AI_API_KEY = "$AiKey"
`$env:AI_API_BASE = "$AiBase"
`$env:AI_MODEL = "$AiModel"
`$env:PORT = "$Port"
Set-Location "$Root"
.\.venv\Scripts\python.exe app.py
"@ | Set-Content -LiteralPath $scriptPath -Encoding UTF8

    $taskAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""
    $taskTrigger = New-ScheduledTaskTrigger -AtStartup
    $taskPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
    Register-ScheduledTask -TaskName $serviceName -Action $taskAction -Trigger $taskTrigger -Principal $taskPrincipal -Force | Out-Null
    Start-ScheduledTask -TaskName $serviceName

    Pop-Location

    $appPoolInfo = @{
      Port = $Port
      Domain = $Domain
      AdminUser = $AdminUser
    }
    $appPoolInfo
  } -ArgumentList $RemoteRoot, $RemoteZip, $Port, $AdminUser, $AdminPassword, $SecretKey, $AiKey, $AiBase, $AiModel

  Write-Host ""
  Write-Host "Done." -ForegroundColor Green
  Write-Host "Open: http://$Domain"
  Write-Host "Admin: $AdminUser"

  Finish-WithPause 0
}
catch {
  Write-Host ""
  Write-Host "Deploy failed:" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  if ($_.ScriptStackTrace) { Write-Host $_.ScriptStackTrace -ForegroundColor DarkYellow }
  Finish-WithPause 1
}
