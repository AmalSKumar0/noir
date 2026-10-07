#!/usr/bin/env bash
# ==============================================================================
#  Noir CLI Agent — Automated Direct Installer for Linux & macOS
# ==============================================================================
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

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     OS_NAME="linux";;
    Darwin*)    OS_NAME="darwin";;
    *)          echo -e "${RED}[!] Unsupported operating system: ${OS}${RESET}"; exit 1;;
esac

# Detect Architecture
ARCH="$(uname -m)"
case "${ARCH}" in
    x86_64|amd64)   ARCH_NAME="amd64";;
    arm64|aarch64)  ARCH_NAME="arm64";;
    *)              echo -e "${RED}[!] Unsupported architecture: ${ARCH}${RESET}"; exit 1;;
esac

BINARY_NAME="noir-${OS_NAME}-${ARCH_NAME}"

# Determine Base URL
BASE_URL="${NOIR_SERVER_URL:-https://noir.amalskumar.dev}"
if [ -z "$BASE_URL" ]; then
    # Default to deployed origin or fallback
    BASE_URL="https://noir.amalskumar.dev"
fi

DOWNLOAD_URL="${BASE_URL%/}/downloads/${BINARY_NAME}"

echo -e "${DIM}▸ Target Platform:${RESET} ${BOLD}${OS_NAME}/${ARCH_NAME}${RESET}"
echo -e "${DIM}▸ Fetching binary:${RESET} ${CYAN}${DOWNLOAD_URL}${RESET}"

# Create temporary directory
TMP_DIR="$(mktemp -d)"
trap 'rm -rf -- "$TMP_DIR"' EXIT

TARGET_TMP="${TMP_DIR}/noir"

# Download with curl or wget
if command -v curl >/dev/null 2>&1; then
    curl -fsSL --progress-bar "${DOWNLOAD_URL}" -o "${TARGET_TMP}"
elif command -v wget >/dev/null 2>&1; then
    wget -q --show-progress "${DOWNLOAD_URL}" -O "${TARGET_TMP}"
else
    echo -e "${RED}[!] Error: Neither curl nor wget was found in PATH.${RESET}"
    exit 1
fi

chmod +x "${TARGET_TMP}"

# Target install directory
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

# Check if INSTALL_DIR is in PATH
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
