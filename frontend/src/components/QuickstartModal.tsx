import React, { useState } from 'react';
import { 
  Terminal, 
  Check, 
  Copy, 
  Play, 
  Cpu, 
  Sparkles, 
  Stethoscope, 
  RefreshCw, 
  LogIn, 
  LogOut, 
  User, 
  ShieldCheck, 
  Zap, 
  Unlink, 
  Layers,
  Code2
} from 'lucide-react';
import Modal from './Modal';

interface QuickstartModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionCode?: string;
  isCompany?: boolean;
}

export default function QuickstartModal({ 
  isOpen, 
  onClose, 
  connectionCode = '', 
  isCompany = false 
}: QuickstartModalProps) {
  const [activeTab, setActiveTab] = useState<'commands' | 'workflow'>('commands');
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(label);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const cliCommands = [
    {
      name: 'noir connect <connection_code>',
      alias: 'noir init <code >',
      icon: Layers,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10 border-violet-500/20',
      tag: 'Step 1: Workspace Link',
      summary: 'Links your local repository to a Noir cloud project.',
      description: 'Scans local workspace project dependencies, frameworks (Django, React, PyTest, Jest), creates local .noir/config.json, and syncs runtime profile with backend.',
      example: connectionCode ? `noir connect ${connectionCode}` : 'noir connect nr_conn_x89a12k9'
    },
    {
      name: 'noir run',
      icon: Play,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      tag: 'Step 2: Container Telemetry',
      summary: 'Builds Docker image & streams live telemetry output.',
      description: 'Automatically detects Dockerfile or generates an isolated container environment, runs project test suite, and pipes stdout/stderr WebSocket logs to the Noir dashboard live stream terminal.',
      example: 'noir run'
    },
    {
      name: 'noir test',
      icon: Zap,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
      tag: 'Reliability Test Engine',
      summary: 'Executes test suite and persists failure logs in cloud database.',
      description: 'Runs automated unit & integration tests inside container/workspace, logs pass/fail counts, duration metrics, and stack traces to your dashboard history.',
      example: 'noir test'
    },
    {
      name: 'noir analyze',
      icon: Sparkles,
      color: 'text-pink-400',
      bg: 'bg-pink-500/10 border-pink-500/20',
      tag: 'AI Root Cause Agent',
      summary: 'Runs AI analysis on test failure stack traces & logs.',
      description: 'Diagnoses failure reasons, Pinpoints broken code files/lines, and generates actionable code patch solutions to restore build stability.',
      example: 'noir analyze'
    },
    {
      name: 'noir sync',
      icon: RefreshCw,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/20',
      tag: 'Stack Synchronizer',
      summary: 'Re-scans dependencies and updates runtime metadata.',
      description: 'Detects newly installed libraries, framework version updates, or environment shifts and synchronizes your cloud project stack profile.',
      example: 'noir sync'
    },
    {
      name: 'noir doctor',
      icon: Stethoscope,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/20',
      tag: 'System Diagnostics',
      summary: 'Performs health checks on CLI agent & Docker runtime.',
      description: 'Verifies Docker daemon status, Python/Node runtime versions, API server reachability, and WebSocket channel health to troubleshoot agent connection issues.',
      example: 'noir doctor'
    },
    {
      name: 'noir status',
      icon: ShieldCheck,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20',
      tag: 'Workspace Inspection',
      summary: 'Displays active project connection & agent details.',
      description: 'Shows linked project ID, connection code, workspace root directory, and current cloud API endpoint connection status.',
      example: 'noir status'
    },
    {
      name: 'noir login',
      icon: LogIn,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
      tag: 'Authentication',
      summary: 'Authenticates CLI session with user or company credentials.',
      description: 'Generates session tokens and configures CLI authentication headers for secure communication with backend endpoints.',
      example: 'noir login'
    },
    {
      name: 'noir whoami',
      icon: User,
      color: 'text-stone-300',
      bg: 'bg-stone-500/10 border-stone-500/20',
      tag: 'Session Info',
      summary: 'Prints currently authenticated account details.',
      description: 'Displays active username, email, user role (developer/company), and company organization affiliation.',
      example: 'noir whoami'
    },
    {
      name: 'noir logout',
      icon: LogOut,
      color: 'text-stone-400',
      bg: 'bg-stone-500/10 border-stone-500/20',
      tag: 'Session Control',
      summary: 'Terminates active CLI authentication session.',
      description: 'Clears saved session tokens from local storage while preserving project workspace connection files.',
      example: 'noir logout'
    },
    {
      name: 'noir disconnect',
      icon: Unlink,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10 border-orange-500/20',
      tag: 'Unlink Project',
      summary: 'Unlinks local workspace from connected cloud project.',
      description: 'Removes .noir configuration directory from local workspace without deleting cloud project records.',
      example: 'noir disconnect'
    }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Noir CLI Agent Guide & Commands"
      maxWidthClass="max-w-4xl"
    >
      <div className="space-y-6">
        {/* Header & Sub-Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-violet-400" />
            <span className="text-xs uppercase font-mono tracking-wider font-bold text-stone-200">
              {isCompany ? 'Enterprise Telemetry CLI Setup' : 'AI Reliability Agent CLI'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-xl border border-white/10 text-xs font-mono">
            <button
              onClick={() => setActiveTab('commands')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'commands'
                  ? 'bg-violet-600 text-white font-bold shadow'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Command Reference ({cliCommands.length})
            </button>
            <button
              onClick={() => setActiveTab('workflow')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'workflow'
                  ? 'bg-violet-600 text-white font-bold shadow'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Quickstart Workflow
            </button>
          </div>
        </div>

        {/* TAB 1: Command Reference */}
        {activeTab === 'commands' && (
          <div className="space-y-4">
            <p className="text-xs text-stone-400 leading-relaxed font-light">
              Run <code className="text-violet-300 font-mono font-bold">$ noir --help</code> or any specific subcommand with <code className="text-violet-300 font-mono font-bold">--help</code> in your terminal. Below is the full suite of autonomous agent commands:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[480px] overflow-y-auto pr-1.5 custom-scrollbar">
              {cliCommands.map((cmd, idx) => {
                const IconComponent = cmd.icon;
                const isCopied = copiedCommand === cmd.name;
                return (
                  <div 
                    key={idx}
                    className="p-4 rounded-2xl bg-black/50 border border-white/10 hover:border-violet-500/30 transition-all flex flex-col justify-between gap-3 group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider font-bold border ${cmd.bg} ${cmd.color}`}>
                          {cmd.tag}
                        </span>
                        {cmd.alias && (
                          <span className="text-[9px] font-mono text-stone-500">
                            Alias: {cmd.alias}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mb-1.5">
                        <IconComponent className={`w-4 h-4 shrink-0 ${cmd.color}`} />
                        <h4 className="text-xs font-mono font-bold text-white tracking-wide">
                          {cmd.name}
                        </h4>
                      </div>

                      <p className="text-xs text-stone-300 font-medium mb-1">
                        {cmd.summary}
                      </p>
                      <p className="text-[11px] text-stone-400/80 leading-relaxed font-light">
                        {cmd.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                      <code className="text-[10px] font-mono text-violet-300 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 truncate max-w-[80%]">
                        $ {cmd.example}
                      </code>
                      <button
                        onClick={() => handleCopy(`noir ${cmd.name.split(' ')[1]}`, cmd.name)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white transition-colors cursor-pointer shrink-0"
                        title="Copy command"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: Quickstart Workflow */}
        {activeTab === 'workflow' && (
          <div className="space-y-5">
            <p className="text-xs text-stone-400 leading-relaxed font-light">
              Follow this 4-step deployment workflow to connect your local workspace repository to Noir's live telemetry stream engine.
            </p>

            <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1.5 custom-scrollbar">
              {/* Step 1 */}
              <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center text-xs font-bold font-mono">01</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-white">Install Agent CLI</span>
                </div>
                <p className="text-xs text-stone-400">Install Noir CLI globally or inside your project Python environment:</p>
                <div className="relative group">
                  <pre className="p-3 rounded-xl bg-black/80 border border-stone-800 text-xs font-mono text-emerald-300 overflow-x-auto">
                    <code>pip install -e agent/   # Or npm install -g noir-agent</code>
                  </pre>
                  <button
                    onClick={() => handleCopy('pip install -e agent/', 'step1')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-white/5 text-stone-400 hover:text-white transition-all cursor-pointer"
                  >
                    {copiedCommand === 'step1' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center text-xs font-bold font-mono">02</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-white">Authenticate CLI Session</span>
                </div>
                <p className="text-xs text-stone-400">Log in to authenticate your CLI session with your dashboard account:</p>
                <div className="relative group">
                  <pre className="p-3 rounded-xl bg-black/80 border border-stone-800 text-xs font-mono text-emerald-300 overflow-x-auto">
                    <code>noir login</code>
                  </pre>
                  <button
                    onClick={() => handleCopy('noir login', 'step2')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-white/5 text-stone-400 hover:text-white transition-all cursor-pointer"
                  >
                    {copiedCommand === 'step2' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center text-xs font-bold font-mono">03</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-white">Connect Workspace to Cloud Project</span>
                </div>
                <p className="text-xs text-stone-400">Navigate to your project root directory and run connect with your connection code:</p>
                <div className="relative group">
                  <pre className="p-3 rounded-xl bg-black/80 border border-stone-800 text-xs font-mono text-emerald-300 overflow-x-auto">
                    <code>{connectionCode ? `noir connect ${connectionCode}` : 'noir connect <connection_code>'}</code>
                  </pre>
                  <button
                    onClick={() => handleCopy(connectionCode ? `noir connect ${connectionCode}` : 'noir connect <connection_code>', 'step3')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-white/5 text-stone-400 hover:text-white transition-all cursor-pointer"
                  >
                    {copiedCommand === 'step3' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Step 4 */}
              <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center text-xs font-bold font-mono">04</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-white">Run Live Container Telemetry Stream</span>
                </div>
                <p className="text-xs text-stone-400">Build container, execute tests, and stream live stdout/stderr logs to your dashboard:</p>
                <div className="relative group">
                  <pre className="p-3 rounded-xl bg-black/80 border border-stone-800 text-xs font-mono text-emerald-300 overflow-x-auto">
                    <code>noir run</code>
                  </pre>
                  <button
                    onClick={() => handleCopy('noir run', 'step4')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-white/5 text-stone-400 hover:text-white transition-all cursor-pointer"
                  >
                    {copiedCommand === 'step4' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between">
          <span className="text-[10px] font-mono text-stone-400">
            Noir Agent CLI v1.0 &bull; Docker Container Engine Supported
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-full border border-white/10 text-stone-400 hover:text-white hover:border-white/20 text-xs font-semibold uppercase tracking-widest transition-all cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </Modal>
  );
}
