import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv, Plugin } from 'vite';

function installerScriptPlugin(targetUrl: string): Plugin {
  const cleanUrl = targetUrl.replace(/\/+$/, '');

  function replaceInFile(filePath: string, isPowerShell = false) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf-8');
    if (isPowerShell) {
      content = content.replace(
        /(\$BaseUrl = ")([^"]+)(")/,
        `$1${cleanUrl}$3`
      );
    } else {
      content = content.replace(
        /BASE_URL="\$\{NOIR_SERVER_URL:-[^}]*\}"/,
        `BASE_URL="\${NOIR_SERVER_URL:-${cleanUrl}}"`
      );
      content = content.replace(
        /(if \[ -z "\$BASE_URL" \]; then[\s\S]*?BASE_URL=")[^"]+(")/,
        `$1${cleanUrl}$2`
      );
    }
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  return {
    name: 'noir-installer-scripts-plugin',
    // Sync public files during build start
    buildStart() {
      const publicDir = path.resolve(__dirname, 'public');
      replaceInFile(path.join(publicDir, 'install.sh'), false);
      replaceInFile(path.join(publicDir, 'install.ps1'), true);
    },
    // Sync dist files after build bundle generation
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      replaceInFile(path.join(distDir, 'install.sh'), false);
      replaceInFile(path.join(distDir, 'install.ps1'), true);
    },
    // Dynamic serving during local development
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url === '/install.sh') {
          const filePath = path.resolve(__dirname, 'public/install.sh');
          if (fs.existsSync(filePath)) {
            let content = fs.readFileSync(filePath, 'utf-8');
            const host = req.headers.host || 'localhost:3000';
            const devUrl = `http://${host}`;
            content = content.replace(
              /BASE_URL="\$\{NOIR_SERVER_URL:-[^}]*\}"/,
              `BASE_URL="\${NOIR_SERVER_URL:-${devUrl}}"`
            );
            res.setHeader('Content-Type', 'text/x-shellscript; charset=utf-8');
            res.end(content);
            return;
          }
        } else if (url === '/install.ps1') {
          const filePath = path.resolve(__dirname, 'public/install.ps1');
          if (fs.existsSync(filePath)) {
            let content = fs.readFileSync(filePath, 'utf-8');
            const host = req.headers.host || 'localhost:3000';
            const devUrl = `http://${host}`;
            content = content.replace(
              /(\$BaseUrl = ")([^"]+)(")/,
              `$1${devUrl}$3`
            );
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end(content);
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appUrl = (
    env.VITE_APP_URL ||
    env.APP_URL ||
    process.env.VITE_APP_URL ||
    process.env.APP_URL ||
    'https://noir.amalskumar.dev'
  ).replace(/\/+$/, '');

  return {
    envPrefix: ['VITE_', 'APP_'],
    plugins: [
      react(),
      tailwindcss(),
      installerScriptPlugin(appUrl),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
