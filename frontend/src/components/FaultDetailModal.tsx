import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  Loader2,
  Printer,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Square,
  Wifi,
  Radio,
  Cpu,
  HardDrive,
  Terminal,
  Activity,
  Layers,
  Server,
} from 'lucide-react';
import Modal from './Modal';
import { FaultRecord } from './FaultInjectionPanel';

interface FaultDetailModalProps {
  record: FaultRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onPrint: (record: FaultRecord) => void;
}

const FAULT_TYPE_META: Record<string, { label: string; icon: any; color: string; desc: string }> = {
  container_restart: {
    label: 'Container Restart',
    icon: RotateCcw,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    desc: 'Simulates sudden service crash and restart cycle.',
  },
  container_stop: {
    label: 'Container Stop',
    icon: Square,
    color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    desc: 'Halts container execution to verify fallback or redundancy.',
  },
  network_delay: {
    label: 'Network Delay (Latency)',
    icon: Wifi,
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    desc: 'Injects simulated network transmission delay with optional jitter.',
  },
  network_loss: {
    label: 'Network Packet Loss',
    icon: Radio,
    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
    desc: 'Drops designated percentage of packets to test packet retry logic.',
  },
  cpu_stress: {
    label: 'CPU Pressure / Stress',
    icon: Cpu,
    color: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    desc: 'Spawns worker threads inside container to evaluate CPU throttling.',
  },
  memory_stress: {
    label: 'Memory Pressure / Stress',
    icon: HardDrive,
    color: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/30',
    desc: 'Allocates memory buffer to test OOM handling and pressure response.',
  },
};

export default function FaultDetailModal({ record, isOpen, onClose, onPrint }: FaultDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'diagnostics' | 'raw'>('overview');
  const [copied, setCopied] = useState(false);

  if (!record) return null;

  const meta = FAULT_TYPE_META[record.fault_type] || {
    label: record.fault_type,
    icon: Activity,
    color: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
    desc: 'Custom chaos engineering fault execution.',
  };
  const IconComponent = meta.icon;

  const durationSec = record.duration_seconds ?? record.result?.duration_seconds ?? null;
  const isRecovered = record.result?.recovered !== false;
  const resultMessage = record.result?.message || (record.status === 'completed' ? 'Fault execution completed cleanly.' : record.error_message || 'Execution finished.');

  // Timing calculations
  const requestedDate = new Date(record.requested_at);
  const startedDate = record.started_at ? new Date(record.started_at) : null;
  const completedDate = record.completed_at ? new Date(record.completed_at) : null;
  const dispatchLatencyMs = startedDate ? Math.max(0, startedDate.getTime() - requestedDate.getTime()) : null;

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(record, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      maxWidthClass="max-w-4xl"
    >
      <div className="space-y-4 -mt-2">
        {/* TOP STATUS HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${meta.color}`}>
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">Fault Audit #{record.id}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-mono font-bold border ${meta.color}`}>
                  {meta.label}
                </span>
              </div>
              <h2 className="text-base font-bold text-white flex items-center gap-2 mt-0.5">
                Target: <span className="font-mono text-cyan-300">{record.target}</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            {record.status === 'completed' && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Completed
              </span>
            )}
            {record.status === 'failed' && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" /> Execution Failed
              </span>
            )}
            {record.status === 'running' && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-1.5 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> In Progress
              </span>
            )}
            {record.status === 'pending' && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-violet-500/10 border border-violet-500/20 text-violet-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Awaiting Daemon
              </span>
            )}
            {record.status === 'cancelled' && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-stone-500/10 border border-white/10 text-white/40 flex items-center gap-1.5">
                <Ban className="w-3.5 h-3.5" /> Cancelled
              </span>
            )}

            <button
              type="button"
              onClick={() => onPrint(record)}
              className="h-8 px-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 shadow-md shadow-violet-900/30 cursor-pointer"
              title="Print individual report"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Report</span>
            </button>
          </div>
        </div>

        {/* METRICS SUMMARY RIBBON */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
            <span className="text-[10px] text-white/40 uppercase font-mono tracking-wider block">Duration</span>
            <div className="text-sm font-bold font-mono text-emerald-400">
              {durationSec !== null ? `${durationSec.toFixed(2)}s` : '-'}
            </div>
            <span className="text-[10px] text-white/40 font-mono block">Chaos Active Hold</span>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
            <span className="text-[10px] text-white/40 uppercase font-mono tracking-wider block">Rollback Recovery</span>
            <div className="flex items-center gap-1.5 text-sm font-bold font-mono">
              {isRecovered ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Verified Clean
                </span>
              ) : (
                <span className="text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Failed Cleanup
                </span>
              )}
            </div>
            <span className="text-[10px] text-white/40 font-mono block">State Safety Check</span>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
            <span className="text-[10px] text-white/40 uppercase font-mono tracking-wider block">Dispatch Latency</span>
            <div className="text-sm font-bold font-mono text-violet-300">
              {dispatchLatencyMs !== null ? `${dispatchLatencyMs}ms` : '-'}
            </div>
            <span className="text-[10px] text-white/40 font-mono block">Queue to Claim Time</span>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
            <span className="text-[10px] text-white/40 uppercase font-mono tracking-wider block">Target Service</span>
            <div className="text-sm font-bold font-mono text-cyan-300 truncate" title={record.target}>
              {record.target}
            </div>
            <span className="text-[10px] text-white/40 font-mono block">Host Docker Node</span>
          </div>
        </div>

        {/* INTERACTIVE NAVIGATION TABS */}
        <div className="flex border-b border-white/10 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-2 text-xs font-mono font-semibold transition-colors border-b-2 -mb-px flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'overview'
                ? 'border-violet-400 text-violet-300'
                : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Overview & Metrics
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`px-3 py-2 text-xs font-mono font-semibold transition-colors border-b-2 -mb-px flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'timeline'
                ? 'border-violet-400 text-violet-300'
                : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Execution Timeline
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('diagnostics')}
            className={`px-3 py-2 text-xs font-mono font-semibold transition-colors border-b-2 -mb-px flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'diagnostics'
                ? 'border-violet-400 text-violet-300'
                : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Diagnostics & Errors
            {record.error_message && (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('raw')}
            className={`px-3 py-2 text-xs font-mono font-semibold transition-colors border-b-2 -mb-px flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'raw'
                ? 'border-violet-400 text-violet-300'
                : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Raw Payload JSON
          </button>
        </div>

        {/* TAB CONTENTS */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* AGENT VERDICT MESSAGE */}
            <div className={`p-3.5 rounded-xl border text-xs font-mono ${
              record.status === 'completed'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : record.status === 'failed'
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                : 'bg-white/5 border-white/10 text-white/80'
            }`}>
              <div className="flex items-center gap-2 font-bold mb-1">
                {record.status === 'completed' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : record.status === 'failed' ? (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                ) : (
                  <Activity className="w-4 h-4 text-violet-400 shrink-0" />
                )}
                <span>Agent Execution Verdict</span>
              </div>
              <p className="leading-relaxed text-[11px] text-white/80">{resultMessage}</p>
            </div>

            {/* RESILIENCE AUDIT ASSESSMENT */}
            {(() => {
              const sc = record.resilience_score ?? record.result?.resilience?.score ?? record.result?.resilience_score;
              const gr = record.resilience_grade ?? record.result?.resilience?.grade ?? record.result?.resilience_grade;
              const cls = record.classification ?? record.result?.resilience?.classification ?? record.result?.classification;
              const base = record.result?.steady_state_baseline ?? record.result?.resilience?.steady_state_baseline;
              const expM = record.result?.experiment_metrics ?? record.result?.resilience?.experiment_metrics;
              const recM = record.result?.recovery_metrics ?? record.result?.resilience?.recovery_metrics;
              const recs: string[] = record.recommendations ?? record.result?.recommendations ?? record.result?.resilience?.recommendations ?? [];

              if (sc === undefined || sc === null || !gr) return null;

              return (
                <div className="space-y-3 font-mono text-xs">
                  <div className="p-4 rounded-xl bg-black/50 border border-white/10 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-white/10">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black border ${
                          gr === 'A' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                          gr === 'B' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                          gr === 'C' ? 'bg-orange-500/20 text-orange-300 border-orange-500/40' :
                          'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        }`}>
                          {gr}
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-white/40">Resilience Engineering Score</div>
                          <div className="text-base font-bold text-white flex items-center gap-2">
                            <span>{Math.round(sc)} / 100</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                              gr === 'A' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                              gr === 'B' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                              gr === 'C' ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' :
                              'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            }`}>
                              Grade {gr}
                            </span>
                          </div>
                        </div>
                      </div>
                      {cls && (
                        <div className="text-right">
                          <div className="text-[10px] uppercase text-white/40">Classification</div>
                          <div className="text-xs font-bold text-violet-300 uppercase tracking-wide">
                            {cls}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 3-STAGE LIFECYCLE */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-white/40 uppercase font-bold">1. Baseline</span>
                          <span className={`w-2 h-2 rounded-full ${base?.status ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        </div>
                        <div className="text-xs font-bold text-white">
                          {base?.mean_latency_ms !== undefined ? `${base.mean_latency_ms.toFixed(1)} ms` : 'Active'}
                        </div>
                        <div className="text-[10px] text-white/40">
                          HTTP {base?.status_code || 200} | {base?.sample_count || 1} probes
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-white/40 uppercase font-bold">2. In-Fault</span>
                          <span className={`w-2 h-2 rounded-full ${
                            (expM?.availability_pct ?? 100) >= 90 ? 'bg-emerald-400' :
                            (expM?.availability_pct ?? 100) >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                          }`} />
                        </div>
                        <div className="text-xs font-bold text-white">
                          {expM?.availability_pct !== undefined ? `${expM.availability_pct.toFixed(0)}% Availability` : 'Monitored'}
                        </div>
                        <div className="text-[10px] text-white/40">
                          P95: {expM?.p95_latency_ms ? `${expM.p95_latency_ms.toFixed(1)}ms` : '-'} | {expM?.latency_degradation_factor ? `${expM.latency_degradation_factor.toFixed(1)}x lag` : 'Normal'}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-white/40 uppercase font-bold">3. Rollback RTO</span>
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        </div>
                        <div className="text-xs font-bold text-emerald-400">
                          {recM?.rto_seconds !== undefined ? `${recM.rto_seconds.toFixed(2)}s RTO` : 'Clean Rollback'}
                        </div>
                        <div className="text-[10px] text-white/40">
                          Steady-State Restored
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RECOMMENDATIONS */}
                  {recs && recs.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-white/40 uppercase font-mono tracking-wider block flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
                        Architectural Recommendations
                      </span>
                      <div className="p-3 rounded-xl bg-violet-950/20 border border-violet-500/20 text-[11px] font-mono space-y-1.5 text-white/80">
                        {recs.map((rec, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="text-violet-400 font-bold shrink-0">→</span>
                            <span className="leading-relaxed">{rec}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* PARAMETERS MATRIX */}
            <div className="space-y-2">
              <span className="text-[10px] text-white/40 uppercase font-mono tracking-wider block">
                Chaos Parameters Injected
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {Object.entries(record.parameters || {}).map(([key, val]) => (
                  <div key={key} className="p-2.5 rounded-lg bg-black/40 border border-white/5 font-mono text-xs">
                    <span className="text-[10px] text-white/40 uppercase block mb-0.5">{key.replace('_', ' ')}</span>
                    <span className="font-bold text-violet-300">{String(val)}</span>
                  </div>
                ))}
                {(!record.parameters || Object.keys(record.parameters).length === 0) && (
                  <div className="col-span-full py-3 text-center text-white/30 text-xs font-mono bg-black/20 rounded-lg">
                    No custom parameters specified (standard defaults applied).
                  </div>
                )}
              </div>
            </div>

            {/* RECOVERY & SAFETY GUARANTEE */}
            <div className="p-3.5 rounded-xl bg-black/50 border border-white/10 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  State Rollback & Safety Guarantee
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  Auto-Rollback Active
                </span>
              </div>
              <p className="text-[11px] text-white/60 leading-relaxed font-sans">
                Noir executes chaos injections inside isolated Linux cgroups and container namespaces. Once the injection expires or an error is encountered, the daemon automatically reverts traffic controls, frees memory buffers, and restores normal operational limits.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="space-y-3 font-mono text-xs">
            <span className="text-[10px] text-white/40 uppercase tracking-wider block">
              Lifecycle Execution Milestones
            </span>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
              {/* Step 1: Requested */}
              <div className="relative">
                <div className="absolute -left-6 top-0 w-4 h-4 rounded-full bg-violet-600 border-2 border-[#0D0F17] flex items-center justify-center" />
                <div className="bg-white/[0.02] border border-white/5 p-3 rounded-lg space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white">1. Fault Injection Dispatched</span>
                    <span className="text-[10px] text-white/40">{requestedDate.toLocaleString()}</span>
                  </div>
                  <p className="text-[11px] text-white/60">
                    Requested by <span className="text-violet-300">{record.requested_by?.username || 'User'}</span> ({record.requested_by?.email || 'N/A'})
                  </p>
                </div>
              </div>

              {/* Step 2: Claimed */}
              <div className="relative">
                <div className={`absolute -left-6 top-0 w-4 h-4 rounded-full border-2 border-[#0D0F17] flex items-center justify-center ${
                  startedDate ? 'bg-cyan-600' : 'bg-white/20'
                }`} />
                <div className="bg-white/[0.02] border border-white/5 p-3 rounded-lg space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white">2. Claimed by Daemon</span>
                    <span className="text-[10px] text-white/40">
                      {startedDate ? startedDate.toLocaleString() : 'Pending pickup'}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/60">
                    {startedDate
                      ? `Noir daemon (noir fault listen) claimed and validated pre-flight container checks.`
                      : 'Waiting for an active local daemon process to claim this injection task.'}
                  </p>
                </div>
              </div>

              {/* Step 3: Chaos Applied */}
              <div className="relative">
                <div className={`absolute -left-6 top-0 w-4 h-4 rounded-full border-2 border-[#0D0F17] flex items-center justify-center ${
                  record.status === 'completed' || record.status === 'failed' ? 'bg-amber-500' : 'bg-white/20'
                }`} />
                <div className="bg-white/[0.02] border border-white/5 p-3 rounded-lg space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white">3. Chaos Payload Injected</span>
                    <span className="text-[10px] text-white/40">
                      {durationSec !== null ? `Hold: ${durationSec}s` : '-'}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/60">
                    Strategy <span className="text-violet-300 font-bold">{record.fault_type}</span> applied on container <span className="text-cyan-300 font-bold">{record.target}</span>.
                  </p>
                </div>
              </div>

              {/* Step 4: Finished */}
              <div className="relative">
                <div className={`absolute -left-6 top-0 w-4 h-4 rounded-full border-2 border-[#0D0F17] flex items-center justify-center ${
                  record.status === 'completed'
                    ? 'bg-emerald-500'
                    : record.status === 'failed'
                    ? 'bg-rose-500'
                    : 'bg-white/20'
                }`} />
                <div className="bg-white/[0.02] border border-white/5 p-3 rounded-lg space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white">4. Final State & Audit Reporting</span>
                    <span className="text-[10px] text-white/40">
                      {completedDate ? completedDate.toLocaleString() : '-'}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/60">
                    {record.status === 'completed'
                      ? 'Rollback verified. State clean. Audit telemetry logged in project history.'
                      : record.status === 'failed'
                      ? `Execution terminated with failure. Error recorded.`
                      : 'Pending final execution result.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'diagnostics' && (
          <div className="space-y-3 font-mono text-xs">
            {record.error_message ? (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-rose-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Failure Analysis & Root Cause</span>
                </div>
                <div className="p-3 rounded-lg bg-black/60 border border-rose-500/20 text-rose-200 select-all overflow-x-auto text-[11px]">
                  {record.error_message}
                </div>
                <div className="pt-2 text-[11px] text-rose-300/80 space-y-1 font-sans">
                  <span className="font-bold font-mono block text-rose-400">Remediation Guidelines:</span>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Verify container <code className="text-white font-mono">{record.target}</code> is running locally (<code className="text-white font-mono">docker ps</code>).</li>
                    <li>Ensure Docker socket has write permissions for the user running <code className="text-white font-mono">noir fault listen</code>.</li>
                    <li>For network emulation (latency/loss), ensure host Docker daemon allows <code className="text-white font-mono">NET_ADMIN</code> capabilities.</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>All Health Checks & Rollback Operations Passed</span>
                </div>
                <p className="text-[11px] text-emerald-300/80 font-sans">
                  No execution faults or unhandled exceptions occurred during this chaos test. Container health was maintained, and all network/resource allocations were completely released.
                </p>
              </div>
            )}

            {/* Execution Details Dump if available */}
            {record.result?.details && Object.keys(record.result.details).length > 0 && (
              <div className="space-y-1.5 pt-2">
                <span className="text-[10px] text-white/40 uppercase tracking-wider block">Observed Diagnostics Details</span>
                <pre className="p-3 rounded-xl bg-black/60 border border-white/10 text-cyan-300 overflow-x-auto text-[11px]">
                  {JSON.stringify(record.result.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {activeTab === 'raw' && (
          <div className="space-y-2 font-mono text-xs">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-white/40 uppercase tracking-widest block">Full Audit Record Payload</span>
              <button
                type="button"
                onClick={handleCopyJSON}
                className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-[11px] flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
              </button>
            </div>
            <pre className="p-3.5 rounded-xl bg-black/70 border border-white/10 text-emerald-300 overflow-x-auto text-[11px] max-h-72">
              {JSON.stringify(record, null, 2)}
            </pre>
          </div>
        )}

        {/* BOTTOM ACTION BAR */}
        <div className="flex justify-between items-center pt-3 border-t border-white/10 font-mono text-xs">
          <div className="flex items-center gap-2 text-white/40 text-[11px]">
            <Server className="w-3.5 h-3.5" />
            <span>Project: <strong className="text-white/70">{record.project_code || record.project}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyJSON}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
