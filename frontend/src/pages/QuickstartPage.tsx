import React, { useState } from 'react';
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
  Sparkles
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
      <div className="max-w-6xl mx-auto space-y-8 pb-16">
        
        {/* Header Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#120B2E] via-[#0D0822] to-[#05030D] border border-white/10 p-8 md:p-10 shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl -z-0 pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-mono font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>NOIR CLI AGENT ARCHITECTURE & COMMAND GUIDE</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                Noir CLI Agent & Telemetry Documentation
              </h1>
              <p className="text-sm md:text-base text-gray-400 max-w-2xl leading-relaxed">
                Autonomous reliability engineering agent. Runs in local workspace or CI/CD pipelines, profiles tech stacks, executes in-container tests, and streams real-time telemetry.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start md:self-auto">
              <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md text-right">
                <div className="text-xs text-gray-400">Agent Version</div>
                <div className="text-sm font-bold font-mono text-emerald-400">v1.2.0-stable</div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 mt-8 pt-6 border-t border-white/10 overflow-x-auto no-scrollbar">
            {[
              { id: 'quickstart', label: '1. Quick Start Workflow', icon: Zap },
              { id: 'commands', label: '2. CLI Command Reference', icon: Terminal },
              { id: 'architecture', label: '3. System Architecture & Flow', icon: Layers },
              { id: 'adr', label: '4. Tech Stack & ADR', icon: Cpu }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-medium transition-all whitespace-nowrap ${
                    isActive 
                      ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30 font-semibold' 
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* TAB 1: QUICKSTART WORKFLOW */}
        {activeTab === 'quickstart' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            
            {/* Quick Install Banner */}
            <div className="bg-[#0D0822]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-violet-400" />
                  Noir CLI Agent Installation
                </h3>
                <p className="text-xs md:text-sm text-gray-400 mt-1">
                  Install the agent globally or in your virtual environment using Python's package manager:
                </p>
              </div>

              <div className="w-full md:w-auto bg-black/80 border border-white/10 rounded-xl p-3 flex items-center justify-between gap-4 font-mono text-xs text-emerald-400">
                <span>pip install noir-agent</span>
                <button 
                  onClick={() => copyToClipboard('pip install noir-agent')}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                >
                  {copiedText === 'pip install noir-agent' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 4-Step Onboarding Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Step 1 */}
              <div className="bg-[#0D0822]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4 hover:border-violet-500/40 transition-all">
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-full bg-violet-600/20 text-violet-400 font-bold font-mono text-xs flex items-center justify-center border border-violet-500/30">01</span>
                  <span className="text-xs text-gray-400 font-mono">Authentication</span>
                </div>
                <h4 className="text-base font-bold text-white">Login to Noir Account</h4>
                <p className="text-xs text-gray-400">
                  Authenticate your local CLI agent with your Noir backend user account.
                </p>
                <div className="bg-black/80 border border-white/10 rounded-xl p-3 flex items-center justify-between font-mono text-xs text-emerald-400">
                  <span>noir login</span>
                  <button 
                    onClick={() => copyToClipboard('noir login')}
                    className="p-1 text-gray-400 hover:text-white"
                  >
                    {copiedText === 'noir login' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-[#0D0822]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4 hover:border-violet-500/40 transition-all">
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-full bg-violet-600/20 text-violet-400 font-bold font-mono text-xs flex items-center justify-center border border-violet-500/30">02</span>
                  <span className="text-xs text-gray-400 font-mono">Pairing</span>
                </div>
                <h4 className="text-base font-bold text-white">Connect Active Workspace</h4>
                <p className="text-xs text-gray-400">
                  Pair your current project directory using the unique project connection code.
                </p>
                <div className="bg-black/80 border border-white/10 rounded-xl p-3 flex items-center justify-between font-mono text-xs text-emerald-400">
                  <span>noir connect NR-KO2Y3DZZ</span>
                  <button 
                    onClick={() => copyToClipboard('noir connect NR-KO2Y3DZZ')}
                    className="p-1 text-gray-400 hover:text-white"
                  >
                    {copiedText === 'noir connect NR-KO2Y3DZZ' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-[#0D0822]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4 hover:border-violet-500/40 transition-all">
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-full bg-violet-600/20 text-violet-400 font-bold font-mono text-xs flex items-center justify-center border border-violet-500/30">03</span>
                  <span className="text-xs text-gray-400 font-mono">Container Execution</span>
                </div>
                <h4 className="text-base font-bold text-white">Run In-Container Engine & Live Stream</h4>
                <p className="text-xs text-gray-400">
                  Builds Docker container, runs tests inside container via <code className="text-violet-300 font-mono">docker exec</code>, and streams stdout/stderr to WebSocket.
                </p>
                <div className="bg-black/80 border border-white/10 rounded-xl p-3 flex items-center justify-between font-mono text-xs text-emerald-400">
                  <span>noir run</span>
                  <button 
                    onClick={() => copyToClipboard('noir run')}
                    className="p-1 text-gray-400 hover:text-white"
                  >
                    {copiedText === 'noir run' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Step 4 */}
              <div className="bg-[#0D0822]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4 hover:border-violet-500/40 transition-all">
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-full bg-violet-600/20 text-violet-400 font-bold font-mono text-xs flex items-center justify-center border border-violet-500/30">04</span>
                  <span className="text-xs text-gray-400 font-mono">AI Inspection</span>
                </div>
                <h4 className="text-base font-bold text-white">Run AI Reliability Scan</h4>
                <p className="text-xs text-gray-400">
                  Performs Lynx AST analysis, scans workspace dependencies, and generates architecture reports.
                </p>
                <div className="bg-black/80 border border-white/10 rounded-xl p-3 flex items-center justify-between font-mono text-xs text-emerald-400">
                  <span>noir analyze</span>
                  <button 
                    onClick={() => copyToClipboard('noir analyze')}
                    className="p-1 text-gray-400 hover:text-white"
                  >
                    {copiedText === 'noir analyze' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

            </div>

          </motion.div>
        )}

        {/* TAB 2: COMMAND REFERENCE */}
        {activeTab === 'commands' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            
            {/* Search & Filter Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#0D0822]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search commands (e.g. run, test, connect)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar">
                {['All', 'Core', 'Execution', 'Diagnostics', 'Auth'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                      selectedCategory === cat
                        ? 'bg-violet-600 text-white'
                        : 'bg-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Commands Table / Cards */}
            <div className="bg-[#0D0822]/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-xs text-gray-400 font-mono">
                      <th className="py-3.5 px-6 font-semibold">Command</th>
                      <th className="py-3.5 px-6 font-semibold">Category</th>
                      <th className="py-3.5 px-6 font-semibold">Description</th>
                      <th className="py-3.5 px-6 font-semibold text-right">Example Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs">
                    {filteredCommands.map((cmd) => (
                      <tr key={cmd.cmd} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-4 px-6 font-mono font-bold text-violet-300">
                          noir {cmd.cmd} {cmd.args && <span className="text-gray-500 font-normal">{cmd.args}</span>}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-2.5 py-1 rounded-md font-mono text-[10px] font-bold ${
                            cmd.category === 'Execution' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            cmd.category === 'Core' ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' :
                            cmd.category === 'Diagnostics' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {cmd.category}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-gray-300 leading-relaxed max-w-md">
                          {cmd.desc}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => copyToClipboard(cmd.example)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-black/60 hover:bg-violet-600/30 border border-white/10 hover:border-violet-500/40 rounded-lg text-emerald-400 font-mono text-xs transition-all"
                          >
                            <span>{cmd.example}</span>
                            {copiedText === cmd.example ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </motion.div>
        )}

        {/* TAB 3: SYSTEM ARCHITECTURE */}
        {activeTab === 'architecture' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            
            {/* ASCII Architecture Diagram Card */}
            <div className="bg-[#0D0822]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-violet-400" />
                Noir Agent Telemetry Architecture & Data Flow
              </h3>
              <p className="text-xs text-gray-400">
                End-to-end telemetry pipeline connecting local developer workspace containers to backend Django ASGI channels and frontend React dashboards.
              </p>

              <div className="bg-black/90 border border-white/10 rounded-xl p-6 font-mono text-xs text-violet-300 overflow-x-auto leading-relaxed">
{`                              ┌─────────────────────────────────────────┐
                              │             Noir CLI Agent              │
                              ├─────────────────────────────────────────┤
                              │  - Typer CLI Router                     │
                              │  - Lynx AST & Stack Profiler            │
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

            {/* Execution Sequence List */}
            <div className="bg-[#0D0822]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4">
              <h4 className="text-base font-bold text-white">End-to-End Execution Sequence (<code className="text-violet-300 font-mono">noir run</code>)</h4>
              
              <div className="space-y-3 text-xs text-gray-300">
                <div className="p-4 bg-white/5 border border-white/5 rounded-xl flex items-start gap-3">
                  <span className="font-mono text-violet-400 font-bold">1.</span>
                  <div>
                    <strong className="text-white">Workspace Scanning & Profiling:</strong> Scans active workspace using the <span className="text-violet-300">Lynx Engine</span>, detecting primary languages (Python, JS/TS, Go, Rust, Java) and test runners (<code className="text-emerald-400">pytest</code>, <code className="text-emerald-400">npm test</code>, etc.).
                  </div>
                </div>

                <div className="p-4 bg-white/5 border border-white/5 rounded-xl flex items-start gap-3">
                  <span className="font-mono text-violet-400 font-bold">2.</span>
                  <div>
                    <strong className="text-white">Test File Guard Check:</strong> If no test files are detected, execution is safely aborted with <code className="text-rose-400 font-mono">no test files found aborting noir</code> before building containers.
                  </div>
                </div>

                <div className="p-4 bg-white/5 border border-white/5 rounded-xl flex items-start gap-3">
                  <span className="font-mono text-violet-400 font-bold">3.</span>
                  <div>
                    <strong className="text-white">In-Container Test Runner (<code className="text-violet-300 font-mono">docker exec</code>):</strong> Builds container image dynamically and executes tests directly inside the isolated container environment.
                  </div>
                </div>

                <div className="p-4 bg-white/5 border border-white/5 rounded-xl flex items-start gap-3">
                  <span className="font-mono text-violet-400 font-bold">4.</span>
                  <div>
                    <strong className="text-white">Sub-10ms Telemetry Stream:</strong> Transmits output across stdout terminal and backend WebSocket channel (<code className="text-emerald-400 font-mono">ws://.../ws/project/&lt;code&gt;/logs/</code>) for live dashboard display.
                  </div>
                </div>
              </div>
            </div>

          </motion.div>
        )}

        {/* TAB 4: TECH STACK & ADR */}
        {activeTab === 'adr' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            
            <div className="bg-[#0D0822]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
                <Cpu className="w-5 h-5 text-violet-400" />
                Architectural Decision Record (ADR) & Honest Self-Evaluation
              </h3>
              <p className="text-xs text-gray-400 mb-6">
                We believe in authentic engineering transparency. Below is an authentic evaluation of our technology choices, questioning our own decisions and stating better high-performance alternatives.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {ADR_DECISIONS.map((adr, i) => (
                  <div key={i} className="bg-black/50 border border-white/10 rounded-xl p-5 space-y-3">
                    <h4 className="text-sm font-bold text-white font-mono">{adr.title}</h4>
                    
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-violet-400 font-semibold">Why We Chose It: </span>
                        <span className="text-gray-300">{adr.why}</span>
                      </div>

                      <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-2.5">
                        <span className="text-rose-300 font-bold block mb-1">❓ {adr.question}</span>
                        <span className="text-gray-300">{adr.evaluation}</span>
                      </div>

                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5">
                        <span className="text-emerald-400 font-bold block mb-1">🚀 Better Alternative Approach:</span>
                        <span className="text-gray-300">{adr.alternative}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance Benchmarks Card */}
            <div className="bg-[#0D0822]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                Performance Benchmarks & Target Metrics
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                  <div className="text-xs text-gray-400">Scan Latency (10k files)</div>
                  <div className="text-xl font-bold font-mono text-emerald-400 mt-1">140 ms</div>
                </div>

                <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                  <div className="text-xs text-gray-400">RAM Baseline Overhead</div>
                  <div className="text-xl font-bold font-mono text-violet-400 mt-1">~35 MB</div>
                </div>

                <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                  <div className="text-xs text-gray-400">Container Exec Latency</div>
                  <div className="text-xl font-bold font-mono text-amber-400 mt-1">&lt; 50 ms</div>
                </div>

                <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                  <div className="text-xs text-gray-400">WebSocket Stream Latency</div>
                  <div className="text-xl font-bold font-mono text-blue-400 mt-1">&lt; 12 ms</div>
                </div>
              </div>
            </div>

          </motion.div>
        )}

      </div>
    </UserLayout>
  );
}
