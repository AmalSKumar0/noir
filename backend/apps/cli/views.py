from pathlib import Path
import re
from django.conf import settings
from django.http import HttpResponse, HttpResponseRedirect, FileResponse, Http404

# Fallback bash installer if file is not found on disk
FALLBACK_INSTALL_SH = r'''#!/usr/bin/env bash
set -e
RESET='\033[0m'
BOLD='\033[1m'
GREEN='\033[38;2;16;185;129m'
VIOLET='\033[38;2;139;92;246m'
CYAN='\033[38;2;6;182;212m'
RED='\033[38;2;239;68;68m'
DIM='\033[38;2;161;161;170m'

echo -e ""
echo -e "${VIOLET}${BOLD}  ███╗   ██╗ ██████╗ ██╗██████╗ ${RESET}"
echo -e "${VIOLET}${BOLD}  ████╗  ██║██╔═══██╗██║██╔══██╗${RESET}"
echo -e "${VIOLET}${BOLD}  ██╔██╗ ██║██║   ██║██║██████╔╝${RESET}"
echo -e "${VIOLET}${BOLD}  ██║╚██╗██║██║   ██║██║██╔══██╗${RESET}"
echo -e "${VIOLET}${BOLD}  ██║ ╚████║╚██████╔╝██║██║  ██║${RESET}"
echo -e "${DIM}  Autonomous Reliability & Chaos Engineering Agent (Go Native)${RESET}"
echo -e ""

OS="$(uname -s)"
case "${OS}" in
    Linux*)     OS_NAME="linux";;
    Darwin*)    OS_NAME="darwin";;
    *)          echo -e "${RED}[!] Unsupported operating system: ${OS}${RESET}"; exit 1;;
esac

ARCH="$(uname -m)"
case "${ARCH}" in
    x86_64|amd64)   ARCH_NAME="amd64";;
    arm64|aarch64)  ARCH_NAME="arm64";;
    *)              echo -e "${RED}[!] Unsupported architecture: ${ARCH}${RESET}"; exit 1;;
esac

BINARY_NAME="noir-${OS_NAME}-${ARCH_NAME}"
BASE_URL="${NOIR_SERVER_URL:-{{BASE_URL}}}"
if [ -z "$BASE_URL" ]; then
    BASE_URL="{{BASE_URL}}"
fi

DOWNLOAD_URL="${BASE_URL%/}/downloads/${BINARY_NAME}"

echo -e "${DIM}▸ Target Platform:${RESET} ${BOLD}${OS_NAME}/${ARCH_NAME}${RESET}"
echo -e "${DIM}▸ Fetching binary:${RESET} ${CYAN}${DOWNLOAD_URL}${RESET}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf -- "$TMP_DIR"' EXIT
TARGET_TMP="${TMP_DIR}/noir"

if command -v curl >/dev/null 2>&1; then
    curl -fsSL --progress-bar "${DOWNLOAD_URL}" -o "${TARGET_TMP}"
elif command -v wget >/dev/null 2>&1; then
    wget -q --show-progress "${DOWNLOAD_URL}" -O "${TARGET_TMP}"
else
    echo -e "${RED}[!] Error: Neither curl nor wget was found in PATH.${RESET}"
    exit 1
fi

chmod +x "${TARGET_TMP}"
INSTALL_DIR="/usr/local/bin"
USE_SUDO=0

if [ -w "$INSTALL_DIR" ]; then
    USE_SUDO=0
elif command -v sudo >/dev/null 2>&1; then
    USE_SUDO=1
else
    INSTALL_DIR="${HOME}/.local/bin"
    mkdir -p "${INSTALL_DIR}"
    USE_SUDO=0
fi

DEST="${INSTALL_DIR}/noir"
echo -e "${DIM}▸ Installing to:${RESET}   ${BOLD}${DEST}${RESET}"

if [ "$USE_SUDO" -eq 1 ]; then
    echo -e "${DIM}  (Requesting sudo privileges to install into ${INSTALL_DIR})${RESET}"
    sudo mv "${TARGET_TMP}" "${DEST}"
    sudo chmod +x "${DEST}"
else
    mkdir -p "${INSTALL_DIR}"
    mv "${TARGET_TMP}" "${DEST}"
    chmod +x "${DEST}"
fi

if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    echo -e "${DIM}[i] Note: ${INSTALL_DIR} is not currently in your \$PATH.${RESET}"
    echo -e "${DIM}    Add this line to your ~/.bashrc or ~/.zshrc:${RESET}"
    echo -e "    ${CYAN}export PATH=\"\$PATH:${INSTALL_DIR}\"${RESET}"
fi

echo -e ""
echo -e "${GREEN}${BOLD}✔ Successfully installed Noir CLI Agent to ${DEST}!${RESET}"
echo -e ""
echo -e "${BOLD}Quickstart commands:${RESET}"
echo -e "  ${VIOLET}noir doctor${RESET}                  Run system & Docker diagnostics"
echo -e "  ${VIOLET}noir login${RESET}                   Authenticate developer credentials"
echo -e "  ${VIOLET}noir connect <PROJECT_CODE>${RESET}  Link workspace to your Noir project"
echo -e "  ${VIOLET}noir run${RESET}                     Run containerized tests & live chaos telemetry"
echo -e ""
'''

# Fallback powershell installer if file is not found on disk
FALLBACK_INSTALL_PS1 = r'''$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "  ███╗   ██╗ ██████╗ ██╗██████╗ " -ForegroundColor DarkMagenta
Write-Host "  ████╗  ██║██╔═══██╗██║██╔══██╗" -ForegroundColor DarkMagenta
Write-Host "  ██╔██╗ ██║██║   ██║██║██████╔╝" -ForegroundColor Magenta
Write-Host "  ██║╚██╗██║██║   ██║██║██╔══██╗" -ForegroundColor Magenta
Write-Host "  ██║ ╚████║╚██████╔╝██║██║  ██║" -ForegroundColor Magenta
Write-Host "  Autonomous Reliability & Chaos Engineering Agent (Go Native)" -ForegroundColor Gray
Write-Host ""

$BaseUrl = $env:NOIR_SERVER_URL
if (-not $BaseUrl) {
    $BaseUrl = "{{BASE_URL}}"
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

try {
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($userPath -notlike "*$InstallDir*") {
        Write-Host "▸ Registering Noir to User PATH environment variable..." -ForegroundColor Gray
        $newPath = if ([string]::IsNullOrWhiteSpace($userPath)) { $InstallDir } else { "$userPath;$InstallDir" }
        [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    }
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
'''


def _get_base_url():
    """Returns the effective base URL for binary downloads (preferring FRONTEND_BASE_URL)."""
    frontend_url = getattr(settings, 'FRONTEND_BASE_URL', None)
    if frontend_url and str(frontend_url).strip():
        return str(frontend_url).strip().rstrip('/')
    backend_url = getattr(settings, 'BACKEND_BASE_URL', None)
    if backend_url and str(backend_url).strip():
        return str(backend_url).strip().rstrip('/')
    return "https://noir.amalskumar.dev"


def install_sh_view(request):
    """
    Serves the Linux/macOS shell installation script with the download BASE_URL
    populated from the environment configuration.
    """
    base_url = _get_base_url()
    
    # Try reading from frontend/public or frontend/dist if available on disk
    candidate_paths = [
        settings.BASE_DIR.parent / "frontend" / "public" / "install.sh",
        settings.BASE_DIR.parent / "frontend" / "dist" / "install.sh",
    ]
    
    content = None
    for p in candidate_paths:
        if p.exists():
            try:
                content = p.read_text(encoding="utf-8")
                break
            except Exception:
                pass

    if not content:
        content = FALLBACK_INSTALL_SH.replace("{{BASE_URL}}", base_url)
    else:
        # Dynamically inject base_url into the script
        content = re.sub(
            r'BASE_URL="\$\{NOIR_SERVER_URL:-[^}]*\}"',
            f'BASE_URL="${{NOIR_SERVER_URL:-{base_url}}}"',
            content
        )
        content = re.sub(
            r'(if \[ -z "\$BASE_URL" \]; then[\s\S]*?BASE_URL=")[^"]+(")',
            rf'\g<1>{base_url}\g<2>',
            content
        )

    response = HttpResponse(content, content_type="text/x-shellscript; charset=utf-8")
    response["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response


def install_ps1_view(request):
    """
    Serves the Windows PowerShell installation script with the download $BaseUrl
    populated from the environment configuration.
    """
    base_url = _get_base_url()

    candidate_paths = [
        settings.BASE_DIR.parent / "frontend" / "public" / "install.ps1",
        settings.BASE_DIR.parent / "frontend" / "dist" / "install.ps1",
    ]

    content = None
    for p in candidate_paths:
        if p.exists():
            try:
                content = p.read_text(encoding="utf-8")
                break
            except Exception:
                pass

    if not content:
        content = FALLBACK_INSTALL_PS1.replace("{{BASE_URL}}", base_url)
    else:
        content = re.sub(
            r'(\$BaseUrl = ")([^"]+)(")',
            rf'\g<1>{base_url}\g<3>',
            content
        )

    response = HttpResponse(content, content_type="text/plain; charset=utf-8")
    response["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response


def download_binary_view(request, filename):
    """
    Serves CLI binary artifacts directly if available locally, or redirects
    to the frontend hosting URL where static binary assets are served.
    """
    # Security: sanitize filename
    safe_filename = Path(filename).name
    if not safe_filename or safe_filename != filename:
        raise Http404("Invalid binary filename")

    candidate_dirs = [
        settings.BASE_DIR.parent / "frontend" / "public" / "downloads",
        settings.BASE_DIR.parent / "frontend" / "dist" / "downloads",
    ]

    for d in candidate_dirs:
        file_path = d / safe_filename
        if file_path.exists() and file_path.is_file():
            response = FileResponse(open(file_path, "rb"), as_attachment=True, filename=safe_filename)
            response["Content-Disposition"] = f'attachment; filename="{safe_filename}"'
            return response

    # Otherwise redirect to frontend downloads
    base_url = _get_base_url()
    return HttpResponseRedirect(f"{base_url}/downloads/{safe_filename}")
