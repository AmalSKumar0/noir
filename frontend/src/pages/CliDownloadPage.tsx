import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { 
  Terminal, 
  Download, 
  Check, 
  Copy, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Cpu, 
  HardDrive, 
  Zap, 
  CheckCircle2, 
  HelpCircle, 
  ExternalLink, 
  ChevronDown, 
  ChevronRight, 
  RefreshCw,
  FolderGit2,
  Play,
  Monitor,
  Flame,
  FileCode,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  Code2
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import UserLayout from '../components/UserLayout';
import { getUserRole } from '../utils/auth';

type Platform = 'linux' | 'windows' | 'darwin' | 'all';

interface BinaryInfo {
  name: string;
  filename: string;
  platform: 'Linux' | 'Windows' | 'macOS';
  arch: string;
  size: string;
  sha256: string;
  downloadUrl: string;
}

const BINARIES: BinaryInfo[] = [
  {
    name: 'Noir CLI for Linux (x86_64)',
    filename: 'noir-linux-amd64',
    platform: 'Linux',
    arch: 'x86_64 / amd64',
    size: '9.4 MB',
    sha256: '1a17d590f39ba19a04d7b4d65d5ca25fc3b1453ecadbbb1704568dc22c93a220',
    downloadUrl: '/downloads/noir-linux-amd64'
  },
  {
    name: 'Noir CLI for Linux (ARM64)',
    filename: 'noir-linux-arm64',
    platform: 'Linux',
    arch: 'arm64 / aarch64',
    size: '8.7 MB',
    sha256: 'fab1ad72c2c1d1f371d48f9af10eb700cd74ac5fe8a6eee1bfbe98ad3b5f4d82',
    downloadUrl: '/downloads/noir-linux-arm64'
  },
  {
    name: 'Noir CLI for Windows (x64)',
    filename: 'noir-windows-amd64.exe',
    platform: 'Windows',
    arch: 'x86_64 / x64',
    size: '9.4 MB',
    sha256: 'cd394a6328fd148057444c267b36f7f4f69bb85ce6f3997ae577054e49784daa',
    downloadUrl: '/downloads/noir-windows-amd64.exe'
  },
  {
    name: 'Noir CLI for macOS (Apple Silicon)',
    filename: 'noir-darwin-arm64',
    platform: 'macOS',
    arch: 'arm64 (M1/M2/M3/M4)',
    size: '8.6 MB',
    sha256: '9d0fd82802496b0d7f9980f7943f0d9eee02939bf4dcdc37674642b021db2d7e',
    downloadUrl: '/downloads/noir-darwin-arm64'
  },
  {
    name: 'Noir CLI for macOS (Intel)',
    filename: 'noir-darwin-amd64',
    platform: 'macOS',
    arch: 'x86_64 (Intel)',
    size: '9.2 MB',
    sha256: '41f963e45a1ff4232bb06dfc410b9fbd0fce32f33a0d58d864b7a407d986a826',
    downloadUrl: '/downloads/noir-darwin-amd64'
  }
];

const defaultAppUrl = (
  (import.meta.env.VITE_APP_URL as string | undefined) ||
  (import.meta.env.APP_URL as string | undefined) ||
  'https://noir.amalskumar.dev'
);

export default function CliDownloadPage() {
  const [platform, setPlatform] = useState<Platform>('linux');
  const [detectedOs, setDetectedOs] = useState<string>('Linux');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState<string>(
    typeof window !== 'undefined' && window.location.origin ? window.location.origin : defaultAppUrl
  );

  const userRole = getUserRole();
  const isAuthenticated = Boolean(userRole);

  // Detect Host Base URL and User's Operating System
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin || defaultAppUrl);

      const ua = window.navigator.userAgent.toLowerCase();
      if (ua.includes('win')) {
        setPlatform('windows');
        setDetectedOs('Windows');
      } else if (ua.includes('mac') || ua.includes('darwin')) {
        setPlatform('darwin');
        setDetectedOs('macOS');
      } else {
        setPlatform('linux');
        setDetectedOs('Linux');
      }
    }
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const linuxInstallCmd = `curl -fsSL ${baseUrl || defaultAppUrl}/install.sh | bash`;
  const windowsInstallCmd = `irm ${baseUrl || defaultAppUrl}/install.ps1 | iex`;
  const macInstallCmd = `curl -fsSL ${baseUrl || defaultAppUrl}/install.sh | bash`;

  // Main Page Content
  const content = (
    <div className="space-y-12 pb-16 max-w-6xl mx-auto">
      {/* =========================================================================
          1. HERO HEADER WITH OS AUTO-DETECTION
         ========================================================================= */}
      <div className="relative pt-6 sm:pt-10 pb-4 text-center">
        {/* Glow backdrop */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[280px] bg-violet-600/15 rounded-full blur-[110px] pointer-events-none -z-10" />

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-300 text-xs font-mono mb-4 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
          <span>Go Native Engine v2.0 • Zero Dependencies</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-3">
          Download & Install <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-indigo-300 to-emerald-400">Noir CLI Agent</span>
        </h1>
        
        <p className="text-zinc-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
          Statically compiled Go binary for sub-8ms startup latency and native chaos engineering telemetry. 
          Install directly into your system PATH with a single command.
        </p>

        {/* Auto-detected OS Pill */}
        <div className="mt-5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-zinc-500">Detected System:</span>
          <span className="font-semibold text-emerald-400">{detectedOs}</span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-400">Pre-selected optimal architecture</span>
        </div>
      </div>

      {/* =========================================================================
          2. PLATFORM TABS
         ========================================================================= */}
      <div className="flex justify-center">
        <div className="inline-flex p-1.5 rounded-xl bg-zinc-950/90 border border-zinc-800 shadow-xl gap-1">
          <button
            type="button"
            onClick={() => setPlatform('linux')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              platform === 'linux'
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-900/30 font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Linux & WSL</span>
            {detectedOs === 'Linux' && (
              <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] bg-white/20 text-white">Default</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setPlatform('windows')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              platform === 'windows'
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-900/30 font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Windows (PowerShell)</span>
            {detectedOs === 'Windows' && (
              <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] bg-white/20 text-white">Default</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setPlatform('darwin')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              platform === 'darwin'
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-900/30 font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>macOS</span>
            {detectedOs === 'macOS' && (
              <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] bg-white/20 text-white">Default</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setPlatform('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              platform === 'all'
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-900/30 font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>All Binaries</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          3. AUTOMATED 1-CLICK INSTALLATION CARDS
         ========================================================================= */}
      <AnimatePresence mode="wait">
        {platform === 'linux' && (
          <motion.div
            key="linux"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Primary Automated Install Box */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#0F111A] to-[#0A0C13] border border-violet-500/20 p-6 sm:p-8 shadow-2xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-semibold">
                      RECOMMENDED
                    </span>
                    <span className="text-xs text-zinc-400">Linux (Ubuntu, Debian, Fedora, Arch, Alpine, WSL)</span>
                  </div>
                  <h2 className="text-xl font-bold text-white mt-1">One-Line Automated Installation</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Downloads architecture binary, marks executable (<code className="text-violet-300">chmod +x</code>), and installs directly to <code className="text-emerald-400">/usr/local/bin/noir</code>.
                  </p>
                </div>
                
                <a
                  href="/downloads/noir-linux-amd64"
                  download="noir"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-all shadow-lg shadow-violet-600/30 shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Direct Download (.bin)</span>
                </a>
              </div>

              {/* Terminal Code Block */}
              <div className="mt-5">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                  <span className="font-mono text-[11px] text-zinc-500">Run in your terminal (bash/zsh):</span>
                  <span className="text-[11px] text-zinc-500">No root required (auto-prompts sudo if needed)</span>
                </div>
                
                <div className="relative group rounded-xl bg-black/80 border border-zinc-800 p-4 font-mono text-xs text-zinc-200 overflow-x-auto flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400 select-none">$</span>
                    <span className="text-zinc-100 select-all font-semibold tracking-wide">
                      {linuxInstallCmd}
                    </span>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => copyToClipboard(linuxInstallCmd, 'linux-cmd')}
                    className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 text-xs font-sans"
                    title="Copy command"
                  >
                    {copiedKey === 'linux-cmd' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Alternative Manual Commands */}
              <div className="mt-5 pt-4 border-t border-zinc-800/80">
                <div className="text-xs font-medium text-zinc-400 mb-2 flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-violet-400" />
                  <span>Alternative manual install using curl:</span>
                </div>
                <div className="rounded-xl bg-zinc-950 border border-zinc-800/80 p-3 font-mono text-[11px] text-zinc-300 overflow-x-auto flex items-center justify-between gap-3">
                  <code>
                    curl -fsSL {baseUrl || defaultAppUrl}/downloads/noir-linux-amd64 -o noir && chmod +x noir && sudo mv noir /usr/local/bin/
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(`curl -fsSL ${baseUrl || defaultAppUrl}/downloads/noir-linux-amd64 -o noir && chmod +x noir && sudo mv noir /usr/local/bin/`, 'linux-manual')}
                    className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors shrink-0"
                  >
                    {copiedKey === 'linux-manual' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {platform === 'windows' && (
          <motion.div
            key="windows"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Windows Automated Install Box */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#0F111A] to-[#0A0C13] border border-blue-500/20 p-6 sm:p-8 shadow-2xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-blue-500/10 border border-blue-500/25 text-blue-400 font-semibold">
                      WINDOWS NATIVE
                    </span>
                    <span className="text-xs text-zinc-400">Windows 10, 11, Server (PowerShell 5.1+)</span>
                  </div>
                  <h2 className="text-xl font-bold text-white mt-1">One-Line PowerShell Direct Installer</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Downloads <code className="text-blue-300">noir.exe</code> to <code className="text-blue-300">%USERPROFILE%\.noir\bin</code> and automatically registers it to your User <code className="text-emerald-400">PATH</code>.
                  </p>
                </div>
                
                <a
                  href="/downloads/noir-windows-amd64.exe"
                  download="noir.exe"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-lg shadow-blue-600/30 shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Download noir.exe (9.4 MB)</span>
                </a>
              </div>

              {/* Terminal Code Block */}
              <div className="mt-5">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                  <span className="font-mono text-[11px] text-zinc-500">Run in Windows PowerShell (or Terminal):</span>
                  <span className="text-[11px] text-zinc-500">Auto-adds to PATH environment variable</span>
                </div>
                
                <div className="relative group rounded-xl bg-black/80 border border-zinc-800 p-4 font-mono text-xs text-zinc-200 overflow-x-auto flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-blue-400 select-none">PS&gt;</span>
                    <span className="text-zinc-100 select-all font-semibold tracking-wide">
                      {windowsInstallCmd}
                    </span>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => copyToClipboard(windowsInstallCmd, 'win-cmd')}
                    className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 text-xs font-sans"
                    title="Copy command"
                  >
                    {copiedKey === 'win-cmd' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Manual Windows Steps */}
              <div className="mt-5 pt-4 border-t border-zinc-800/80">
                <div className="text-xs font-medium text-zinc-400 mb-2 flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Alternative manual download & placement:</span>
                </div>
                <div className="rounded-xl bg-zinc-950 border border-zinc-800/80 p-3 font-mono text-[11px] text-zinc-300 overflow-x-auto space-y-1">
                  <div className="text-zinc-500"># 1. Download noir-windows-amd64.exe and rename to noir.exe</div>
                  <div className="text-zinc-500"># 2. Move to C:\Windows\System32 or any folder in your PATH</div>
                  <div className="text-zinc-200">Invoke-WebRequest -Uri "{baseUrl || defaultAppUrl}/downloads/noir-windows-amd64.exe" -OutFile "$HOME\noir.exe"</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {platform === 'darwin' && (
          <motion.div
            key="darwin"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* macOS Automated Install Box */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#0F111A] to-[#0A0C13] border border-emerald-500/20 p-6 sm:p-8 shadow-2xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-semibold">
                      MACOS NATIVE
                    </span>
                    <span className="text-xs text-zinc-400">macOS 12+ (Apple Silicon M1/M2/M3/M4 & Intel x86)</span>
                  </div>
                  <h2 className="text-xl font-bold text-white mt-1">One-Line Terminal Direct Installer</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Automatically detects Apple Silicon vs Intel and links <code className="text-emerald-400">noir</code> into <code className="text-emerald-400">/usr/local/bin</code>.
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <a
                    href="/downloads/noir-darwin-arm64"
                    download="noir"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Apple Silicon</span>
                  </a>
                  <a
                    href="/downloads/noir-darwin-amd64"
                    download="noir"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Intel</span>
                  </a>
                </div>
              </div>

              {/* Terminal Code Block */}
              <div className="mt-5">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                  <span className="font-mono text-[11px] text-zinc-500">Run in Terminal.app or iTerm:</span>
                  <span className="text-[11px] text-zinc-500">Auto-detects M-series vs Intel</span>
                </div>
                
                <div className="relative group rounded-xl bg-black/80 border border-zinc-800 p-4 font-mono text-xs text-zinc-200 overflow-x-auto flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400 select-none">$</span>
                    <span className="text-zinc-100 select-all font-semibold tracking-wide">
                      {macInstallCmd}
                    </span>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => copyToClipboard(macInstallCmd, 'mac-cmd')}
                    className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 text-xs font-sans"
                    title="Copy command"
                  >
                    {copiedKey === 'mac-cmd' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {platform === 'all' && (
          <motion.div
            key="all"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className="text-center pb-2">
              <h2 className="text-xl font-bold text-white">All Pre-compiled Standalone Binaries</h2>
              <p className="text-xs text-zinc-400 mt-1">Download raw static binaries for custom deployment, containers, or offline systems.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          4. DIRECT BINARY DOWNLOAD CARDS TABLE
         ========================================================================= */}
      <div className="rounded-2xl bg-[#0C0E16] border border-zinc-800/90 overflow-hidden shadow-xl">
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-violet-400" />
              <span>Direct Executable Downloads</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">Statically linked native binaries with zero external runtime dependencies.</p>
          </div>
          <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300">
            v2.0.0 (Go 1.24)
          </span>
        </div>

        <div className="divide-y divide-zinc-800/70">
          {BINARIES.map((bin) => (
            <div 
              key={bin.filename} 
              className="p-4 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-zinc-900/30 transition-colors"
            >
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 shrink-0 mt-0.5 sm:mt-0">
                  {bin.platform === 'Windows' ? (
                    <Monitor className="w-5 h-5 text-blue-400" />
                  ) : bin.platform === 'macOS' ? (
                    <Cpu className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Terminal className="w-5 h-5 text-violet-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{bin.name}</span>
                    <span className="px-2 py-0.2 rounded text-[10px] font-mono bg-zinc-800 text-zinc-300">
                      {bin.arch}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1 font-mono">
                    <span className="text-zinc-500">File: <code className="text-zinc-300">{bin.filename}</code></span>
                    <span>•</span>
                    <span className="text-zinc-500">Size: <span className="text-emerald-400">{bin.size}</span></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end md:self-center">
                {/* Copy Checksum Button */}
                <button
                  type="button"
                  onClick={() => copyToClipboard(bin.sha256, `sha-${bin.filename}`)}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-mono text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Copy SHA-256 Checksum"
                >
                  {copiedKey === `sha-${bin.filename}` ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">SHA Copied</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3 h-3 text-zinc-500" />
                      <span>SHA-256</span>
                    </>
                  )}
                </button>

                {/* Direct Download Button */}
                <a
                  href={bin.downloadUrl}
                  download={bin.filename}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition-all shadow-sm hover:scale-[1.02]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* =========================================================================
          5. STEP-BY-STEP QUICKSTART GUIDE
         ========================================================================= */}
      <div className="rounded-2xl bg-[#0C0E16] border border-zinc-800/90 p-6 sm:p-8">
        <div className="text-center max-w-xl mx-auto mb-8">
          <h3 className="text-xl font-bold text-white">Next Steps: Verify & Connect</h3>
          <p className="text-xs text-zinc-400 mt-1">
            After installing Noir CLI, pair your workspace directory with your cloud dashboard in under 30 seconds.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Step 1 */}
          <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-2.5 relative">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-full bg-violet-600/20 border border-violet-500/30 text-violet-300 text-xs font-mono font-bold flex items-center justify-center">
                1
              </span>
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Verification</span>
            </div>
            <h4 className="text-xs font-semibold text-white">Run Diagnostics</h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Verifies Docker daemon status, backend latency, and stored credentials.
            </p>
            <div className="p-2 rounded-lg bg-black border border-zinc-900 font-mono text-[11px] text-violet-300 flex items-center justify-between">
              <code>noir doctor</code>
              <button 
                type="button" 
                onClick={() => copyToClipboard('noir doctor', 'step-1')}
                className="hover:text-white"
              >
                {copiedKey === 'step-1' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-2.5 relative">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-full bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs font-mono font-bold flex items-center justify-center">
                2
              </span>
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Authentication</span>
            </div>
            <h4 className="text-xs font-semibold text-white">Login Developer Account</h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Securely stores JWT authentication tokens in your local OS Keyring.
            </p>
            <div className="p-2 rounded-lg bg-black border border-zinc-900 font-mono text-[11px] text-indigo-300 flex items-center justify-between">
              <code>noir login</code>
              <button 
                type="button" 
                onClick={() => copyToClipboard('noir login', 'step-2')}
                className="hover:text-white"
              >
                {copiedKey === 'step-2' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-2.5 relative">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-300 text-xs font-mono font-bold flex items-center justify-center">
                3
              </span>
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Pair Workspace</span>
            </div>
            <h4 className="text-xs font-semibold text-white">Link Project Code</h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Connects your repo folder using the code shown in your dashboard.
            </p>
            <div className="p-2 rounded-lg bg-black border border-zinc-900 font-mono text-[11px] text-blue-300 flex items-center justify-between">
              <code>noir connect &lt;CODE&gt;</code>
              <button 
                type="button" 
                onClick={() => copyToClipboard('noir connect NR-XXXX', 'step-3')}
                className="hover:text-white"
              >
                {copiedKey === 'step-3' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Step 4 */}
          <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-2.5 relative">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-full bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold flex items-center justify-center">
                4
              </span>
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Execute Chaos</span>
            </div>
            <h4 className="text-xs font-semibold text-white">Run Container Tests</h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Injects faults and streams live test & reliability telemetry to WebSockets.
            </p>
            <div className="p-2 rounded-lg bg-black border border-zinc-900 font-mono text-[11px] text-emerald-300 flex items-center justify-between">
              <code>noir run</code>
              <button 
                type="button" 
                onClick={() => copyToClipboard('noir run', 'step-4')}
                className="hover:text-white"
              >
                {copiedKey === 'step-4' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          6. ARCHITECTURE COMPARISON (GO NATIVE VS PYTHON)
         ========================================================================= */}
      <div className="rounded-2xl bg-gradient-to-b from-[#0F111C] to-[#0A0B12] border border-zinc-800 p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono bg-violet-500/10 text-violet-300 border border-violet-500/25 mb-1.5">
              <Zap className="w-3 h-3 text-violet-400" />
              <span>Benchmark Evolution</span>
            </div>
            <h3 className="text-lg font-bold text-white">Why We Rewrote Noir CLI in Pure Go</h3>
          </div>
          <Link
            to="/quickstart"
            className="text-xs font-semibold text-violet-400 hover:text-violet-300 inline-flex items-center gap-1"
          >
            <span>View Architecture Decision Record</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800">
            <span className="text-[10px] font-mono uppercase text-zinc-500">Startup Latency</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-emerald-400">&lt; 8 ms</span>
              <span className="text-xs text-zinc-500 line-through">650 ms</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-2">
              Instantaneous CLI execution. Statically linked machine code avoids Python interpreter boot overhead.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800">
            <span className="text-[10px] font-mono uppercase text-zinc-500">Memory Footprint (RSS)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-emerald-400">~9.2 MB</span>
              <span className="text-xs text-zinc-500 line-through">65 MB</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-2">
              Zero virtual environment or pip memory overhead. Perfect for low-resource CI runners.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800">
            <span className="text-[10px] font-mono uppercase text-zinc-500">Host Dependencies</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-violet-400">0 Packages</span>
              <span className="text-xs text-zinc-500">Python 3.10+</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-2">
              Requires no Python, Pip, Wheel, or C compilers installed on developer workstations.
            </p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          7. TROUBLESHOOTING & FAQ ACCORDION
         ========================================================================= */}
      <div className="rounded-2xl bg-[#0C0E16] border border-zinc-800/90 p-6 sm:p-8 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-violet-400" />
          <span>Troubleshooting & Installation FAQ</span>
        </h3>

        <div className="space-y-2">
          {[
            {
              q: "Windows PowerShell: 'Script execution is disabled on this system' error?",
              a: "PowerShell by default blocks remote scripts. Open PowerShell and run: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`. After running that once, the direct installer command will execute cleanly."
            },
            {
              q: "Linux: 'noir: command not found' after installation?",
              a: "Ensure `/usr/local/bin` or `~/.local/bin` is in your environment PATH. Run `echo $PATH`. If missing, add `export PATH=\"$PATH:/usr/local/bin:~/.local/bin\"` to your `~/.bashrc` or `~/.zshrc` file and reload with `source ~/.bashrc`."
            },
            {
              q: "How do I upgrade Noir CLI to the latest version?",
              a: "Simply re-run the one-line install command for your operating system at any time! The installer will automatically download and overwrite the binary with the latest release while keeping your login tokens and configs intact."
            },
            {
              q: "How do I build from source code if I have Go installed?",
              a: "Clone the repo, navigate to the `cli/` directory, and run `make install` or `go build -ldflags=\"-s -w\" -o /usr/local/bin/noir main.go`."
            },
            {
              q: "Where does Noir CLI store configuration and credentials?",
              a: "Credentials are saved in your OS Keyring with an encrypted fallback in `~/.noir/credentials.json` (chmod 0600). Workspace associations are stored locally in `.noir/config.json`."
            }
          ].map((faq, index) => (
            <div 
              key={index} 
              className="rounded-xl bg-zinc-950/60 border border-zinc-800/70 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setActiveFaq(activeFaq === index ? null : index)}
                className="w-full p-3.5 sm:px-4 text-left flex items-center justify-between text-xs font-semibold text-zinc-200 hover:text-white transition-colors cursor-pointer"
              >
                <span>{faq.q}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${activeFaq === index ? 'rotate-180' : ''}`} />
              </button>
              
              {activeFaq === index && (
                <div className="px-4 pb-3.5 text-xs text-zinc-400 border-t border-zinc-800/50 pt-2.5 font-mono leading-relaxed bg-black/30">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // If user is authenticated in developer/company workspace, render inside UserLayout
  if (isAuthenticated) {
    return (
      <UserLayout>
        {content}
      </UserLayout>
    );
  }

  // Public visitor view: render inside standard Navbar and Footer
  return (
    <main className="min-h-screen bg-[#07060B] text-white font-sans relative selection:bg-violet-500/30">
      <Navbar isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} />
      <div className="pt-20 px-4 sm:px-6 md:px-12 max-w-[1400px] mx-auto">
        {content}
      </div>
      <Footer />
    </main>
  );
}
