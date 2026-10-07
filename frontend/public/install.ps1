# ==============================================================================
#  Noir CLI Agent — Automated Direct Installer for Windows (PowerShell)
# ==============================================================================
$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "  ███╗   ██╗ ██████╗ ██╗██████╗ " -ForegroundColor DarkMagenta
Write-Host "  ████╗  ██║██╔═══██╗██║██╔══██╗" -ForegroundColor DarkMagenta
Write-Host "  ██╔██╗ ██║██║   ██║██║██████╔╝" -ForegroundColor Magenta
Write-Host "  ██║╚██╗██║██║   ██║██║██╔══██╗" -ForegroundColor Magenta
Write-Host "  ██║ ╚████║╚██████╔╝██║██║  ██║" -ForegroundColor Magenta
Write-Host "  Autonomous Reliability & Chaos Engineering Agent (Go Native)" -ForegroundColor Gray
Write-Host ""

# Determine Base URL
$BaseUrl = $env:NOIR_SERVER_URL
if (-not $BaseUrl) {
    $BaseUrl = "http://localhost:3000"
}
$BaseUrl = $BaseUrl.TrimEnd('/')

$DownloadUrl = "$BaseUrl/downloads/noir-windows-amd64.exe"

$InstallDir = Join-Path $HOME ".noir\bin"
$ExePath = Join-Path $InstallDir "noir.exe"

Write-Host "▸ Target Directory: " -NoNewline -ForegroundColor Gray
Write-Host $InstallDir -ForegroundColor White

Write-Host "▸ Fetching binary:  " -NoNewline -ForegroundColor Gray
Write-Host $DownloadUrl -ForegroundColor Cyan

if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

$TempFile = Join-Path $env:TEMP "noir_installer_$([Guid]::NewGuid().ToString()).exe"

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $TempFile -UseBasicParsing
    Move-Item -Path $TempFile -Destination $ExePath -Force
}
catch {
    Write-Host "[!] Download failed: $_" -ForegroundColor Red
    if (Test-Path $TempFile) { Remove-Item $TempFile -Force -ErrorAction SilentlyContinue }
    exit 1
}

# Update User PATH in Registry so future terminals have noir available
try {
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($userPath -notlike "*$InstallDir*") {
        Write-Host "▸ Registering Noir to User PATH environment variable..." -ForegroundColor Gray
        $newPath = if ([string]::IsNullOrWhiteSpace($userPath)) { $InstallDir } else { "$userPath;$InstallDir" }
        [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    }
    # Update current session PATH
    if ($env:Path -notlike "*$InstallDir*") {
        $env:Path = "$env:Path;$InstallDir"
    }
}
catch {
    Write-Host "[!] Note: Could not auto-update PATH. Please add $InstallDir to your environment PATH." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✔ Successfully installed Noir CLI Agent to $ExePath!" -ForegroundColor Green
Write-Host ""
Write-Host "Quickstart commands:" -ForegroundColor White
Write-Host "  noir doctor                  " -ForegroundColor Magenta -NoNewline; Write-Host "Run system & Docker diagnostics" -ForegroundColor Gray
Write-Host "  noir login                   " -ForegroundColor Magenta -NoNewline; Write-Host "Authenticate developer credentials" -ForegroundColor Gray
Write-Host "  noir connect <PROJECT_CODE>  " -ForegroundColor Magenta -NoNewline; Write-Host "Link workspace to your Noir project" -ForegroundColor Gray
Write-Host "  noir run                     " -ForegroundColor Magenta -NoNewline; Write-Host "Run containerized tests & live chaos telemetry" -ForegroundColor Gray
Write-Host ""
Write-Host "Tip: If 'noir' is not recognized in an existing open terminal, restart your terminal or run: `$env:Path = [Environment]::GetEnvironmentVariable('Path','User') + ';' + [Environment]::GetEnvironmentVariable('Path','Machine')" -ForegroundColor DarkGray
Write-Host ""
