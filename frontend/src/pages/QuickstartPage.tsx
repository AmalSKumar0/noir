import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Terminal, 
  Cpu, 
  Layers, 
  Zap, 
  Check, 
  Copy, 
  Code2, 
  ShieldCheck, 
  Activity, 
  ArrowRight, 
  Search, 
  BookOpen, 
  Server, 
  GitBranch, 
  AlertTriangle,
  ChevronRight,
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
  Folder
} from 'lucide-react';
import UserLayout from '../components/UserLayout';
import { getUserRole } from '../utils/auth';

interface CommandItem {
  cmd: string;
  args?: string;
  usage: string;
  desc: string;
  category: 'Core' | 'Execution' | 'Diagnostics' | 'Auth';
  example: string;
}

const COMMANDS: CommandItem[] = [
  {
    cmd: 'connect',
    args: '<NR-CODE>',
    usage: 'noir connect NR-KO2Y3DZZ',
    desc: 'Pairs current workspace directory with a Noir project instance using connection code.',
    category: 'Core',
    example: 'noir connect NR-8X92A1P'
  },
  {
    cmd: 'fault listen',
    args: '',
    usage: 'noir fault listen',
    desc: 'Runs daemon to listen for manual chaos injections and report container targets.',
    category: 'Execution',
    example: 'noir fault listen'
  },
  {
    cmd: 'run',
    args: '[-i image] [-p port]',
    usage: 'noir run',
    desc: 'Builds Docker image, executes in-container tests, streams live telemetry & container logs to WebSockets.',
    category: 'Execution',
    example: 'noir run --port 8000:8000'
  },
  {
    cmd: 'test',
    args: '[-c command]',
    usage: 'noir test',
    desc: 'Executes workspace test suite in host environment and uploads duration & pass/fail metrics.',
    category: 'Execution',
    example: 'noir test -c "pytest tests/"'
  },
  {
    cmd: 'sync',
    args: '',
    usage: 'noir sync',
    desc: 'Runs instant Lynx AST profiler scan and pushes workspace technology metadata to Noir backend.',
    category: 'Core',
    example: 'noir sync'
  },
  {
    cmd: 'analyze',
    args: '',
    usage: 'noir analyze',
    desc: 'Triggers AI reliability & architecture inspection on current workspace AST & project structure.',
    category: 'Execution',
    example: 'noir analyze'
  },
  {
    cmd: 'status',
    args: '',
    usage: 'noir status',
    desc: 'Displays workspace pairing status, target project code, backend health, and user credentials.',
    category: 'Diagnostics',
    example: 'noir status'
  },
  {
    cmd: 'doctor',
    args: '',
    usage: 'noir doctor',
    desc: 'Diagnoses local environment (Docker daemon, Python runtime, Git status, Backend connectivity).',
    category: 'Diagnostics',
    example: 'noir doctor'
  },
  {
    cmd: 'config',
    args: '[get/set key val]',
    usage: 'noir config get backend',
    desc: 'Inspects and manages workspace configuration options stored in .noir/config.json.',
    category: 'Core',
    example: 'noir config set backend http://localhost:8000/api'
  },
  {
    cmd: 'login',
    args: '',
    usage: 'noir login',
    desc: 'Authenticates developer credentials with Noir backend and securely stores JWT tokens.',
    category: 'Auth',
    example: 'noir login'
  },
  {
    cmd: 'whoami',
    args: '',
    usage: 'noir whoami',
    desc: 'Displays currently authenticated user session identity and email address.',
    category: 'Auth',
    example: 'noir whoami'
  },
  {
    cmd: 'logout',
    args: '',
    usage: 'noir logout',
    desc: 'Clears locally saved authentication tokens from ~/.noir/credentials.json.',
    category: 'Auth',
    example: 'noir logout'
  },
  {
    cmd: 'disconnect',
    args: '',
    usage: 'noir disconnect',
    desc: 'Unpairs local workspace directory from Noir backend server.',
    category: 'Core',
    example: 'noir disconnect'
  }
];

const ADR_DECISIONS = [
  {
    title: '1. CLI Engine: Python (Typer + Rich)',
    why: 'Rapid developer velocity, high-fidelity terminal UI via Rich, native AST parsing capabilities.',
    question: 'Is Python optimal for a developer CLI tool?',
    evaluation: 'No. Python requires a runtime environment, introducing ~250ms import latency and ~35MB RAM footprint.',
    alternative: 'Go (Cobra + Lipgloss) or Rust (Clap + Ratatouille). Static 10MB binary, sub-10ms startup, <5MB RAM footprint. Planned for v2.0.'
  },
  {
    title: '2. Container Orchestration: Subprocess CLI vs Docker Socket API',
    why: 'Zero third-party C bindings. Works out-of-the-box on any Linux/macOS/WSL machine with Docker in $PATH.',
    question: 'Is spawning shell subprocesses for docker run/exec efficient?',
    evaluation: 'It introduces minor IPC overhead under heavy log output (thousands of lines per second).',
    alternative: 'Direct Docker Engine gRPC/Socket Client (/var/run/docker.sock) for direct Unix domain socket streaming.'
  },
  {
    title: '3. Test Detection Engine: Custom Lynx Scanner vs Tree-Sitter',
    why: 'Zero C dependencies. Fast recursive file walk with smart ignore sets (.venv, node_modules, .git).',
    question: 'Does file pattern matching catch edge-case test suites?',
    evaluation: 'Pattern matching finds standard test conventions but misses inline or monorepo configurations without explicit config.',
    alternative: 'Tree-Sitter C-Bindings for semantic AST code understanding across 40+ languages.'
  },
  {
    title: '4. Telemetry Transport: REST + WebSockets (Django Channels)',
    why: 'REST for idempotent metrics; WebSockets for low-latency full-duplex log streaming.',
    question: 'Are JSON WebSockets scalable for massive log bursts?',
    evaluation: 'JSON string serialization adds minor bandwidth and CPU escaping overhead.',
    alternative: 'gRPC over HTTP/2 with Protocol Buffers for 60-70% bandwidth reduction and multiplexed streams.'
  }
];

export default function QuickstartPage({ isCompanyView = false }: { isCompanyView?: boolean }) {
  const [activeTab, setActiveTab] = useState<'quickstart' | 'commands' | 'architecture' | 'adr'>('quickstart');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const filteredCommands = COMMANDS.filter(cmd => {
    const matchesSearch = cmd.cmd.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          cmd.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          cmd.usage.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'All' || cmd.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <UserLayout>
      <div className="space-y-3.5 pb-12">
        
        {/* =========================================================================
            1. COMPACT COMMAND HEADER BAR
           ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
              <Link to="/dashboard" className="hover:text-zinc-300">Noir</Link>
              <span className="text-zinc-600">/</span>
              <span className="text-zinc-300">Developer Documentation</span>
              <span className="text-zinc-600">/</span>
              <span className="text-zinc-400">CLI & Architecture</span>
            </div>
            <div className="flex items-center gap-2.5 mt-0.5">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-100 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-violet-400" />
                <span>CLI Agent & Telemetry Guide</span>
              </h1>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
                v1.2.0-stable
              </span>
            </div>
          </div>

          {/* Quick Install Pill */}
          <div className="flex items-center gap-2">
            <div className="h-8 px-2.5 rounded-md bg-[#0D0F17] border border-zinc-800 flex items-center gap-2 font-mono text-xs">
              <span className="text-zinc-500 text-[10px] select-none">INSTALL:</span>
              <span className="text-emerald-400 font-semibold">pip install noir-agent</span>
              <button
                type="button"
                onClick={() => copyToClipboard('pip install noir-agent')}
                className="text-zinc-400 hover:text-white p-0.5 transition-colors cursor-pointer"
                title="Copy install command"
              >
                {copiedText === 'pip install noir-agent' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <Link
              to="/dashboard"
              className="h-8 px-3 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium inline-flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <span>Back to Overview</span>
            </Link>
          </div>
        </div>

        {/* =========================================================================
            2. LINEAR TAB NAVIGATION
           ========================================================================= */}
        <div className="flex items-center gap-1 border-b border-zinc-800/80 pb-2 text-xs font-medium overflow-x-auto">
          {[
            { id: 'quickstart', label: '1. Quickstart Workflow', icon: Zap },
            { id: 'commands', label: '2. Command Reference', icon: Terminal, badge: COMMANDS.length },
            { id: 'architecture', label: '3. Telemetry Pipeline', icon: Layers },
            { id: 'adr', label: '4. Tech Stack & ADR', icon: Cpu }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`h-7 px-3 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  isActive 
                    ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-sm' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-violet-400' : 'text-zinc-500'}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className="px-1 py-0.2 rounded text-[10px] font-mono bg-zinc-900 text-zinc-400">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* =========================================================================
            TAB 1: QUICKSTART WORKFLOW (High-density 4-step grid)
           ========================================================================= */}
        {activeTab === 'quickstart' && (
          <div className="space-y-3.5">
            {/* Summary strip */}
            <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-lg p-3 px-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
                <span className="text-zinc-300 font-medium">
                  Connect any Dockerized codebase to Noir in 4 commands: authenticate, pair, execute, and inspect.
                </span>
              </div>
              <span className="text-[11px] font-mono text-zinc-500 shrink-0">
                Setup time: &lt; 60 seconds
              </span>
            </div>

            {/* 4-Column Workflow Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              
              {/* Step 1 */}
              <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-lg p-3 flex flex-col justify-between hover:border-zinc-700 transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20">
                      STEP 01
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">Auth</span>
                  </div>
                  <h4 className="text-xs font-semibold text-zinc-200">Authenticate Agent</h4>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                    Authenticate your local CLI agent with your Noir user account session.
                  </p>
                </div>
                <div className="mt-3 bg-[#090A0F] border border-zinc-800/80 rounded px-2 py-1.5 flex items-center justify-between font-mono text-[11px] text-emerald-400">
                  <span>noir login</span>
                  <button 
                    onClick={() => copyToClipboard('noir login')}
                    className="text-zinc-500 hover:text-zinc-200 p-0.5 transition-colors cursor-pointer"
                    title="Copy command"
                  >
                    {copiedText === 'noir login' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-lg p-3 flex flex-col justify-between hover:border-zinc-700 transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20">
                      STEP 02
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">Pairing</span>
                  </div>
                  <h4 className="text-xs font-semibold text-zinc-200">Connect Workspace</h4>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                    Pair your current working directory using your unique connection code.
                  </p>
                </div>
                <div className="mt-3 bg-[#090A0F] border border-zinc-800/80 rounded px-2 py-1.5 flex items-center justify-between font-mono text-[11px] text-emerald-400 truncate">
                  <span className="truncate">noir connect &lt;CODE&gt;</span>
                  <button 
                    onClick={() => copyToClipboard('noir connect NR-KO2Y3DZZ')}
                    className="text-zinc-500 hover:text-zinc-200 p-0.5 transition-colors cursor-pointer shrink-0 ml-1"
                    title="Copy command"
                  >
                    {copiedText === 'noir connect NR-KO2Y3DZZ' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-lg p-3 flex flex-col justify-between hover:border-zinc-700 transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20">
                      STEP 03
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">Execution</span>
                  </div>
                  <h4 className="text-xs font-semibold text-zinc-200">Stream Telemetry</h4>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                    Builds container, runs tests inside container, and streams real-time logs.
                  </p>
                </div>
                <div className="mt-3 bg-[#090A0F] border border-zinc-800/80 rounded px-2 py-1.5 flex items-center justify-between font-mono text-[11px] text-emerald-400">
                  <span>noir run</span>
                  <button 
                    onClick={() => copyToClipboard('noir run')}
                    className="text-zinc-500 hover:text-zinc-200 p-0.5 transition-colors cursor-pointer"
                    title="Copy command"
                  >
                    {copiedText === 'noir run' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Step 4 */}
              <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-lg p-3 flex flex-col justify-between hover:border-zinc-700 transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20">
                      STEP 04
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">Chaos</span>
                  </div>
                  <h4 className="text-xs font-semibold text-zinc-200">Chaos Daemon</h4>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                    Starts listener daemon to execute network delays, stops, and stress injections.
                  </p>
                </div>
                <div className="mt-3 bg-[#090A0F] border border-zinc-800/80 rounded px-2 py-1.5 flex items-center justify-between font-mono text-[11px] text-emerald-400">
                  <span>noir fault listen</span>
                  <button 
                    onClick={() => copyToClipboard('noir fault listen')}
                    className="text-zinc-500 hover:text-zinc-200 p-0.5 transition-colors cursor-pointer"
                    title="Copy command"
                  >
                    {copiedText === 'noir fault listen' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

            </div>

            {/* Quick Diagnostic Doctor bar */}
            <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2 text-zinc-400">
                <Activity className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Verify local environment dependencies (Docker daemon, Python, Git):</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-zinc-200 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-[11px]">
                  noir doctor
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard('noir doctor')}
                  className="text-zinc-400 hover:text-white p-1 transition-colors cursor-pointer"
                  title="Copy doctor command"
                >
                  {copiedText === 'noir doctor' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: CLI COMMAND REFERENCE (Compact Table)
           ========================================================================= */}
        {activeTab === 'commands' && (
          <div className="space-y-3">
            
            {/* Filter Controls Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-[#0D0F17] border border-zinc-800/80 rounded-lg p-2.5 px-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter commands (run, connect, fault)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-7 bg-zinc-900 border border-zinc-800 rounded-md pl-7 pr-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors font-mono"
                />
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                {['All', 'Core', 'Execution', 'Diagnostics', 'Auth'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`h-6 px-2.5 rounded text-[11px] font-mono transition-colors cursor-pointer whitespace-nowrap ${
                      selectedCategory === cat
                        ? 'bg-zinc-800 text-zinc-100 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Commands Table */}
            <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800/60 text-zinc-400 font-mono text-[11px] uppercase bg-zinc-900/20">
                      <th className="py-2 px-3.5 font-medium">Command</th>
                      <th className="py-2 px-3 font-medium">Category</th>
                      <th className="py-2 px-3 font-medium">Description</th>
                      <th className="py-2 px-3.5 text-right font-medium">Example (Copyable)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40 font-mono text-[11px]">
                    {filteredCommands.map((cmd) => (
                      <tr key={cmd.cmd} className="hover:bg-zinc-900/40 text-zinc-300">
                        <td className="py-2.5 px-3.5 font-bold text-violet-300 whitespace-nowrap">
                          noir {cmd.cmd} {cmd.args && <span className="text-zinc-500 font-normal">{cmd.args}</span>}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono uppercase ${
                            cmd.category === 'Execution' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            cmd.category === 'Core' ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' :
                            cmd.category === 'Diagnostics' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {cmd.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-zinc-400 font-sans max-w-sm">
                          {cmd.desc}
                        </td>
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(cmd.example)}
                            className="inline-flex items-center gap-1.5 px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded text-emerald-400 font-mono text-[11px] transition-colors cursor-pointer"
                          >
                            <span>{cmd.example}</span>
                            {copiedText === cmd.example ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-zinc-500" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* =========================================================================
            TAB 3: SYSTEM ARCHITECTURE & DATA FLOW
           ========================================================================= */}
        {activeTab === 'architecture' && (
          <div className="space-y-3.5">
            
            {/* ASCII Architecture Diagram Panel */}
            <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-lg p-3.5 space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
                <h3 className="text-xs font-semibold uppercase tracking-wider font-mono text-zinc-200 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-violet-400" />
                  Noir Telemetry Architecture & Data Flow
                </h3>
                <span className="text-[10px] font-mono text-zinc-500">
                  Full-Duplex ASGI + WebSockets
                </span>
              </div>

              <div className="bg-[#090A0F] border border-zinc-800/80 rounded p-4 font-mono text-[11px] text-zinc-300 overflow-x-auto leading-tight select-text">
{`                              ┌─────────────────────────────────────────┐
                              │             Noir CLI Agent              │
                              ├─────────────────────────────────────────┤
                              │  - Typer CLI Router & Rich Output       │
                              │  - Lynx AST & Dependency Profiler       │
                              │  - Intelligent Test Detector            │
                              │  - Docker Container Orchestrator        │
                              │  - REST & WebSocket Telemetry Client    │
                              └────────────────────┬────────────────────┘
                                                   │
                ┌──────────────────────────────────┼──────────────────────────────────┐
                │                                  │                                  │
                ▼                                  ▼                                  ▼
  ┌───────────────────────────┐      ┌───────────────────────────┐      ┌───────────────────────────┐
  │      Docker Daemon        │      │    Noir Django Backend    │      │     Frontend Dashboard    │
  ├───────────────────────────┤      ├───────────────────────────┤      ├───────────────────────────┤
  │  - Isolated Container     │      │  - REST Telemetry Endpoints│      │  - Real-time Log Terminal │
  │  - \`docker exec\` Tests    │      │  - Django Channels ASGI   │      │  - Reliability Metrics UI │
  │  - Live Log Stream        │      │  - PostgreSQL Telemetry   │      │  - Live Status Badges     │
  └───────────────────────────┘      └───────────────────────────┘      └───────────────────────────┘`}
              </div>
            </div>

            {/* Execution Sequence Grid */}
            <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-lg p-3.5 space-y-2.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-zinc-200">
                Execution Lifecycle (<code className="text-violet-400">noir run</code>)
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                <div className="p-2.5 bg-[#090A0F] border border-zinc-800/80 rounded">
                  <span className="font-mono text-violet-400 font-bold block mb-1 text-[11px]">01. Profiling</span>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Scans active workspace with <strong className="text-zinc-200">Lynx Engine</strong>, detecting languages & test runners.
                  </p>
                </div>

                <div className="p-2.5 bg-[#090A0F] border border-zinc-800/80 rounded">
                  <span className="font-mono text-violet-400 font-bold block mb-1 text-[11px]">02. Guard Check</span>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Verifies test suite exists before building containers to prevent empty Docker builds.
                  </p>
                </div>

                <div className="p-2.5 bg-[#090A0F] border border-zinc-800/80 rounded">
                  <span className="font-mono text-violet-400 font-bold block mb-1 text-[11px]">03. In-Container Exec</span>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Builds container image and executes test runner inside isolated runtime (<code className="text-zinc-300">docker exec</code>).
                  </p>
                </div>

                <div className="p-2.5 bg-[#090A0F] border border-zinc-800/80 rounded">
                  <span className="font-mono text-violet-400 font-bold block mb-1 text-[11px]">04. Live Telemetry</span>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Streams stdout/stderr across WebSockets (&lt;10ms latency) to dashboard monitors.
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* =========================================================================
            TAB 4: TECH STACK & ADR (Architectural Decision Record)
           ========================================================================= */}
        {activeTab === 'adr' && (
          <div className="space-y-3.5">
            
            {/* ADR Grid */}
            <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-lg p-3.5 space-y-3">
              <div className="pb-2 border-b border-zinc-800/80 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider font-mono text-zinc-200 flex items-center gap-2">
                    <Cpu className="w-3.5 h-3.5 text-violet-400" />
                    Architectural Decision Records (ADR)
                  </h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Engineering self-evaluation of technology choices and performance tradeoffs.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ADR_DECISIONS.map((adr, i) => (
                  <div key={i} className="bg-[#090A0F] border border-zinc-800/80 rounded-lg p-3 space-y-2">
                    <h4 className="text-xs font-bold text-zinc-200 font-mono">{adr.title}</h4>
                    
                    <div className="space-y-1.5 text-[11px]">
                      <div>
                        <span className="text-zinc-500 font-mono">Decision: </span>
                        <span className="text-zinc-300">{adr.why}</span>
                      </div>

                      <div className="bg-rose-950/20 border border-rose-600/30 rounded p-2">
                        <span className="text-rose-400 font-mono font-semibold block mb-0.5">❓ {adr.question}</span>
                        <span className="text-zinc-400">{adr.evaluation}</span>
                      </div>

                      <div className="bg-emerald-950/20 border border-emerald-600/30 rounded p-2">
                        <span className="text-emerald-400 font-mono font-semibold block mb-0.5">🚀 High-Performance Alternative:</span>
                        <span className="text-zinc-400">{adr.alternative}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance Benchmarks Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-[#0D0F17] border border-zinc-800/80 rounded-lg">
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">Scan Latency (10k files)</span>
                <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">140ms</span>
                <span className="text-[10px] text-zinc-500 font-mono">Lynx AST Engine</span>
              </div>

              <div className="p-3 bg-[#0D0F17] border border-zinc-800/80 rounded-lg">
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">RAM Baseline Overhead</span>
                <span className="text-xl font-bold font-mono text-violet-400 mt-1 block">~35MB</span>
                <span className="text-[10px] text-zinc-500 font-mono">Rich UI Runtime</span>
              </div>

              <div className="p-3 bg-[#0D0F17] border border-zinc-800/80 rounded-lg">
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">Container Exec Latency</span>
                <span className="text-xl font-bold font-mono text-amber-400 mt-1 block">&lt; 50ms</span>
                <span className="text-[10px] text-zinc-500 font-mono">Subprocess IPC</span>
              </div>

              <div className="p-3 bg-[#0D0F17] border border-zinc-800/80 rounded-lg">
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">WebSocket Stream Latency</span>
                <span className="text-xl font-bold font-mono text-blue-400 mt-1 block">&lt; 12ms</span>
                <span className="text-[10px] text-zinc-500 font-mono">Django Channels ASGI</span>
              </div>
            </div>

          </div>
        )}

      </div>
    </UserLayout>
  );
}
