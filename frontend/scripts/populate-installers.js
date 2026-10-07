#!/usr/bin/env node
/**
 * Automatically syncs and populates the download base URL in Noir CLI installer scripts
 * (install.sh and install.ps1) using .env variables (APP_URL or VITE_APP_URL).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');

// Helper to parse key-value pairs from .env files
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      // Remove surrounding quotes if present
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return env;
}

// Read .env files in priority order
const rootEnv = parseEnvFile(path.join(frontendDir, '.env.production'));
const localEnv = parseEnvFile(path.join(frontendDir, '.env.local'));
const baseEnv = parseEnvFile(path.join(frontendDir, '.env'));

const appUrl = (
  process.env.VITE_APP_URL ||
  process.env.APP_URL ||
  rootEnv.VITE_APP_URL ||
  rootEnv.APP_URL ||
  localEnv.VITE_APP_URL ||
  localEnv.APP_URL ||
  baseEnv.VITE_APP_URL ||
  baseEnv.APP_URL ||
  'https://noir.amalskumar.dev'
).replace(/\/+$/, '');

console.log(`[Noir Installer Sync] Populating installer scripts with BASE_URL: ${appUrl}`);

function updateInstallSh(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf-8');

  // Replace default BASE_URL in bash script
  // e.g., BASE_URL="${NOIR_SERVER_URL:-https://noir.amalskumar.dev}" or fallback block
  const pattern = /BASE_URL="\$\{NOIR_SERVER_URL:-[^}]*\}"/;
  const fallbackPattern = /(if \[ -z "\$BASE_URL" \]; then[\s\S]*?BASE_URL=")[^"]+(")/;

  if (pattern.test(content)) {
    content = content.replace(pattern, `BASE_URL="\${NOIR_SERVER_URL:-${appUrl}}"`);
  } else {
    // If not found in that format, update the fallback assignment
    content = content.replace(
      /BASE_URL="\$\{NOIR_SERVER_URL:-\}"/,
      `BASE_URL="\${NOIR_SERVER_URL:-${appUrl}}"`
    );
  }

  if (fallbackPattern.test(content)) {
    content = content.replace(fallbackPattern, `$1${appUrl}$2`);
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`  ✔ Updated ${path.relative(frontendDir, filePath)}`);
}

function updateInstallPs1(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf-8');

  // Replace default $BaseUrl in powershell script
  const pattern = /(\$BaseUrl = ")([^"]+)(")/;
  if (pattern.test(content)) {
    content = content.replace(pattern, `$1${appUrl}$3`);
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`  ✔ Updated ${path.relative(frontendDir, filePath)}`);
}

// Update public/ sources
updateInstallSh(path.join(frontendDir, 'public', 'install.sh'));
updateInstallPs1(path.join(frontendDir, 'public', 'install.ps1'));

// Update dist/ targets if dist directory exists
updateInstallSh(path.join(frontendDir, 'dist', 'install.sh'));
updateInstallPs1(path.join(frontendDir, 'dist', 'install.ps1'));

console.log('[Noir Installer Sync] Done.');
