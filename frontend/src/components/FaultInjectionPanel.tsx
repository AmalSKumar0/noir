import React, { useState, useEffect, useCallback, useId } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  RotateCcw, 
  PowerOff, 
  Wifi, 
  WifiOff, 
  Cpu, 
  HardDrive, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Ban, 
  Loader2, 
  Terminal, 
  ChevronRight, 
  ShieldAlert,
  Info,
  RefreshCw,
  Copy,
  Check
} from 'lucide-react';
import Modal from './Modal';
import { apiFetch } from '../utils/api';

export interface FaultRecord {
  id: number;
  project: number;
  project_id: number;
  project_title: string;
  project_code: string;
  requested_by?: {
    id: number;
    username: string;
    email: string;
  } | null;
  fault_type: string;
  target: string;
  parameters: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  result: Record<string, any> | null;
  error_message: string;
}

interface FaultInjectionPanelProps {
  projectIdentifier: string | number;
  projectCode?: string;
  initialContainers?: Array<{ id: string; name: string; service: string; image: string; status: string; ports?: string[] }>;
}

type FaultTypeKey = 
  | 'container_restart' 
  | 'container_stop' 
  | 'network_delay' 
  | 'network_loss' 
  | 'cpu_stress' 
  | 'memory_stress';

interface FaultTypeMeta {
  key: FaultTypeKey;
  label: string;
  icon: React.ElementType;
  color: string;
  badge: string;
  description: string;
  impactWarning: string;
}

const FAULT_DEFINITIONS: FaultTypeMeta[] = [
  {
    key: 'container_restart',
    label: 'Container Restart',
    icon: RotateCcw,
    color: 'from-amber-500/20 to-orange-500/10 text-amber-400 border-amber-500/30',
    badge: 'Availability',
    description: 'Gracefully halts and restarts the target container to test system reconnection and heartbeat recovery.',
    impactWarning: 'Target service will briefly drop active connections during restart cycle.',
  },
  {
    key: 'container_stop',
    label: 'Container Stop & Hold',
    icon: PowerOff,
    color: 'from-rose-500/20 to-red-500/10 text-rose-400 border-rose-500/30',
    badge: 'Downtime',
    description: 'Stops the target container for a configured duration, then automatically restarts it to evaluate failover.',
    impactWarning: 'Target service will be offline for the designated duration. Healthchecks may trigger failover.',
  },
  {
    key: 'network_delay',
    label: 'Network Latency / Delay',
    icon: Wifi,
    color: 'from-cyan-500/20 to-blue-500/10 text-cyan-400 border-cyan-500/30',
    badge: 'Network',
    description: 'Injects artificial latency and jitter using Linux Traffic Control (tc/netem) on the container interface.',
    impactWarning: 'Responses will be delayed by the configured latency. Timeouts and latency degradation will occur.',
  },
  {
    key: 'network_loss',
    label: 'Packet Loss',
    icon: WifiOff,
    color: 'from-purple-500/20 to-violet-500/10 text-purple-400 border-purple-500/30',
    badge: 'Network',
    description: 'Drops a percentage of network packets to simulate flaky WAN connections and packet drops.',
    impactWarning: 'Intermittent connection failures, TCP retransmissions, and packet drops will be observed.',
  },
  {
    key: 'cpu_stress',
    label: 'CPU Stress / Throttling',
    icon: Cpu,
    color: 'from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/30',
    badge: 'Resource',
    description: 'Spawns worker processes to saturate CPU cores inside the container for a bounded duration.',
    impactWarning: 'CPU utilization will peak. Service throughput and response times may degrade.',
  },
  {
    key: 'memory_stress',
    label: 'Memory Pressure',
    icon: HardDrive,
    color: 'from-fuchsia-500/20 to-pink-500/10 text-fuchsia-400 border-fuchsia-500/30',
    badge: 'Resource',
    description: 'Allocates a designated memory buffer inside the container to test OOM handling and pressure response.',
    impactWarning: 'Container memory usage will surge to the allocated threshold for the specified duration.',
  },
];

export default function FaultInjectionPanel({ projectIdentifier, projectCode, initialContainers }: FaultInjectionPanelProps) {
  const [history, setHistory] = useState<FaultRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // Containers State
  const [containers, setContainers] = useState<Array<{ id: string; name: string; service: string; image: string; status: string; ports?: string[] }>>(initialContainers || []);
  const [isLoadingContainers, setIsLoadingContainers] = useState(false);

  // Form State
  const [targetContainer, setTargetContainer] = useState('');
  const [selectedFaultType, setSelectedFaultType] = useState<FaultTypeKey>('container_restart');
  const [durationSec, setDurationSec] = useState<number>(10);
  const [timeoutSec, setTimeoutSec] = useState<number>(10);
  const [latencyMs, setLatencyMs] = useState<number>(500);
  const [jitterMs, setJitterMs] = useState<number>(50);
  const [lossPercent, setLossPercent] = useState<number>(20);
  const [cpuWorkers, setCpuWorkers] = useState<number>(2);
  const [memoryMb, setMemoryMb] = useState<number>(256);

  // UI Modals
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedAuditRecord, setSelectedAuditRecord] = useState<FaultRecord | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState<string | null>(null);

  // Unique accessible form field IDs
  const targetInputId = useId();
  const restartTimeoutId = useId();
  const stopDurationId = useId();
  const stopTimeoutId = useId();
  const delayLatencyId = useId();
  const delayJitterId = useId();
  const delayDurationId = useId();
  const lossPercentId = useId();
  const lossDurationId = useId();
  const cpuWorkersId = useId();
  const cpuDurationId = useId();
  const memoryMbId = useId();
  const memoryDurationId = useId();

  // Active (Pending or Running) Injections
  const activeFault = history.find(h => h.status === 'pending' || h.status === 'running');

  // Fetch Fault Injections History
  const fetchFaults = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoadingHistory(true);
    try {
      const resp = await apiFetch(`/api/projects/${projectIdentifier}/faults/`);
      if (resp.ok) {
        const data = await resp.json();
        setHistory(data);
      }
    } catch (e) {
      console.error('Failed to fetch fault injections:', e);
    } finally {
      if (!quiet) setIsLoadingHistory(false);
    }
  }, [projectIdentifier]);

  // Fetch Containers
  const fetchContainers = useCallback(async () => {
    setIsLoadingContainers(true);
    try {
      const resp = await apiFetch(`/api/projects/${projectIdentifier}/containers/`);
      if (resp.ok) {
        const data = await resp.json();
        const found = data.containers || data.docker_containers || [];
        if (found.length > 0) {
          setContainers(found);
        }
      }
    } catch (e) {
      console.warn('Could not fetch containers:', e);
    } finally {
      setIsLoadingContainers(false);
    }
  }, [projectIdentifier]);

  useEffect(() => {
    if (initialContainers && initialContainers.length > 0) {
      setContainers(initialContainers);
    }
  }, [initialContainers]);

  useEffect(() => {
    fetchFaults();
    fetchContainers();
  }, [fetchFaults, fetchContainers]);

  // Dynamic Auto-polling when an active fault is in-flight
  useEffect(() => {
    if (!activeFault) return;
    const interval = setInterval(() => {
      fetchFaults(true);
    }, 2500);
    return () => clearInterval(interval);
  }, [activeFault, fetchFaults]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  // Build parameters object based on selected fault type
  const buildPayloadParameters = () => {
    switch (selectedFaultType) {
      case 'container_restart':
        return { timeout: timeoutSec };
      case 'container_stop':
        return { duration: durationSec, timeout: timeoutSec };
      case 'network_delay':
        return { latency_ms: latencyMs, jitter_ms: jitterMs, duration: durationSec };
      case 'network_loss':
        return { loss_percent: lossPercent, duration: durationSec };
      case 'cpu_stress':
        return { workers: cpuWorkers, duration: durationSec };
      case 'memory_stress':
        return { memory_mb: memoryMb, duration: durationSec };
      default:
        return {};
    }
  };

  // Pre-submit validation
  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitSuccessMsg(null);

    const trimmedTarget = targetContainer.trim();
    if (!trimmedTarget) {
      setFormError('Please specify the target container name or Docker service.');
      return;
    }

    setShowConfirmModal(true);
  };

  // Execute Dispatch
  const handleConfirmDispatch = async () => {
    setIsSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        fault_type: selectedFaultType,
        target: targetContainer.trim(),
        parameters: buildPayloadParameters(),
      };

      const resp = await apiFetch(`/api/projects/${projectIdentifier}/faults/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        const msg = errorData.detail || errorData.parameters || 'Failed to dispatch fault injection request.';
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }

      setShowConfirmModal(false);
      setSubmitSuccessMsg(`Successfully queued '${selectedFaultType}' on target '${targetContainer.trim()}'. Waiting for Noir agent...`);
      fetchFaults(true);
    } catch (err: any) {
      setFormError(err.message || 'An unexpected error occurred during dispatch.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel Pending Fault
  const handleCancelFault = async (faultId: number) => {
    setIsCancelling(true);
    try {
      const resp = await apiFetch(`/api/projects/${projectIdentifier}/faults/${faultId}/cancel/`, {
        method: 'POST',
      });
      if (resp.ok) {
        fetchFaults(true);
      }
    } catch (err) {
      console.error('Failed to cancel fault:', err);
    } finally {
      setIsCancelling(false);
    }
  };

  const selectedMeta = FAULT_DEFINITIONS.find(f => f.key === selectedFaultType)!;

  return (
    <div className="space-y-8 font-sans">
      {/* Top Overview & Agent Daemon Info Banner */}
      <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 md:p-8 backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  Manual Fault Injection Engine
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    Safe & Reversible
                  </span>
                </h2>
                <p className="text-xs md:text-sm text-white/50 mt-1">
                  Inject safe, allowlisted chaos experiments into containerized project nodes to verify high-availability and self-healing.
                </p>
              </div>
            </div>
          </div>

          {/* Quick CLI listener copy chip */}
          <div className="bg-black/50 border border-white/10 rounded-2xl p-3 font-mono text-xs w-full lg:w-auto">
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="text-white/40 block text-[10px] uppercase tracking-wider">Agent Daemon Listener</span>
                <span className="text-emerald-400 font-semibold">$ noir fault listen</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy('noir fault listen', 'listen')}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-all cursor-pointer"
                title="Copy command"
              >
                {copiedCmd === 'listen' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ACTIVE / IN-FLIGHT EXPERIMENT CARD (IF ANY) */}
      <AnimatePresence>
        {activeFault && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className={`border rounded-[2rem] p-6 backdrop-blur-md relative overflow-hidden ${
              activeFault.status === 'running'
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-violet-500/10 border-violet-500/30'
            }`}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${
                    activeFault.status === 'running' 
                      ? 'bg-amber-500/20 text-amber-300 animate-pulse' 
                      : 'bg-violet-500/20 text-violet-300'
                  }`}>
                    {activeFault.status === 'running' ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <Clock className="w-6 h-6 animate-pulse" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold uppercase tracking-widest text-white/60">
                        Active Fault Experiment #{activeFault.id}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-bold ${
                        activeFault.status === 'running'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                      }`}>
                        {activeFault.status === 'running' ? 'RUNNING (Docker Active)' : 'PENDING (Queued for Agent)'}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-white mt-1">
                      Fault: <span className="text-violet-300 font-mono">{activeFault.fault_type}</span> on container{' '}
                      <span className="text-cyan-300 font-mono">[{activeFault.target}]</span>
                    </div>
                    <div className="text-xs text-white/50 font-mono mt-1">
                      Parameters: {JSON.stringify(activeFault.parameters)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                  {activeFault.status === 'pending' && (
                    <button
                      type="button"
                      disabled={isCancelling}
                      onClick={() => handleCancelFault(activeFault.id)}
                      className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 text-xs font-mono font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isCancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                      Cancel Queued Request
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => fetchFaults(true)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all cursor-pointer"
                    title="Refresh status"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EXPERIMENT DISPATCHER SECTION */}
      <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 md:p-8 backdrop-blur-md space-y-6">
        <div className="flex justify-between items-center pb-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-white">
              Configure & Dispatch Fault
            </h3>
          </div>
          <span className="text-xs text-white/40 font-mono">Step 1 of 2: Configure</span>
        </div>

        {formError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>{formError}</div>
          </div>
        )}

        {submitSuccessMsg && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>{submitSuccessMsg}</div>
          </div>
        )}

        <form onSubmit={handleOpenConfirm} className="space-y-6">
          {/* Target Container Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor={targetInputId} className="block text-xs font-mono text-white/70 uppercase tracking-wider">
                Target Docker Container / Service Name <span className="text-rose-400">*</span>
              </label>
              {containers.length > 0 && (
                <span className="text-[10px] font-mono text-cyan-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  {containers.length} detected in project
                </span>
              )}
            </div>

            {/* Quick-select container pills if discovered */}
            {containers.length > 0 && (
              <div className="space-y-1.5 py-1">
                <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider block">
                  Detected Project Containers (Click to select):
                </span>
                <div className="flex flex-wrap gap-2">
                  {containers.map((c) => {
                    const isSelected = targetContainer.trim() === c.name || targetContainer.trim() === c.service;
                    const isRunning = c.status?.toLowerCase() === 'running';
                    return (
                      <button
                        type="button"
                        key={c.id || c.name}
                        onClick={() => setTargetContainer(c.name || c.service)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-mono transition-all flex items-center gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-violet-600/30 border-violet-400 text-white shadow-[0_0_12px_rgba(139,92,246,0.3)] ring-1 ring-violet-400'
                            : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isRunning
                              ? 'bg-emerald-400 animate-pulse'
                              : c.status?.toLowerCase() === 'defined'
                              ? 'bg-amber-400'
                              : 'bg-stone-500'
                          }`}
                        />
                        <span className="font-semibold text-white">{c.name}</span>
                        {c.service && c.service !== c.name && (
                          <span className="text-[10px] text-white/40">({c.service})</span>
                        )}
                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/40 text-white/50">
                          {c.status || 'unknown'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="relative">
              <input
                id={targetInputId}
                type="text"
                value={targetContainer}
                onChange={(e) => setTargetContainer(e.target.value)}
                placeholder="e.g. web, backend-api, db, redis, auth-service"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 font-mono focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
            <p className="text-[11px] text-white/40 font-mono">
              Select a detected container above or enter a custom container/service identifier matching Docker on your host.
            </p>
          </div>

          {/* Fault Type Selection Grid */}
          <div className="space-y-3">
            <label className="block text-xs font-mono text-white/70 uppercase tracking-wider">
              Select Allowlisted Fault Strategy <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {FAULT_DEFINITIONS.map((fault) => {
                const Icon = fault.icon;
                const isSelected = selectedFaultType === fault.key;
                return (
                  <div
                    key={fault.key}
                    onClick={() => setSelectedFaultType(fault.key)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                      isSelected
                        ? 'bg-violet-600/10 border-violet-500 shadow-lg shadow-violet-900/20'
                        : 'bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/[0.07]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`p-2 rounded-xl border ${fault.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-white/60 border border-white/10">
                          {fault.badge}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white mb-1">{fault.label}</h4>
                      <p className="text-xs text-white/50 leading-relaxed">{fault.description}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono">
                      <span className={isSelected ? 'text-violet-300 font-bold' : 'text-white/40'}>
                        {isSelected ? 'Selected Strategy' : 'Click to Select'}
                      </span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-violet-400" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* DYNAMIC PARAMETER CONFIGURATION CARD */}
          <div className="bg-black/30 border border-white/10 rounded-2xl p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-violet-400">
                  {selectedMeta.label} Parameters
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 uppercase bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Auto-Rollback Active
              </span>
            </div>

            {/* Parameter Inputs by Fault Type */}
            {selectedFaultType === 'container_restart' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label htmlFor={restartTimeoutId} className="text-xs font-mono text-white/70">
                    Graceful Restart Timeout (seconds):
                  </label>
                  <span className="text-xs font-mono text-violet-300 font-bold">{timeoutSec}s</span>
                </div>
                <input
                  id={restartTimeoutId}
                  type="range"
                  min="1"
                  max="60"
                  value={timeoutSec}
                  onChange={(e) => setTimeoutSec(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
                <p className="text-[11px] text-white/40 font-mono">Time allowed for the process to exit cleanly before sending SIGKILL.</p>
              </div>
            )}

            {selectedFaultType === 'container_stop' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label htmlFor={stopDurationId} className="text-xs font-mono text-white/70">
                      Downtime Duration (seconds):
                    </label>
                    <span className="text-xs font-mono text-violet-300 font-bold">{durationSec}s</span>
                  </div>
                  <input
                    id={stopDurationId}
                    type="range"
                    min="1"
                    max="180"
                    value={durationSec}
                    onChange={(e) => setDurationSec(Number(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                  <p className="text-[11px] text-white/40 font-mono">How long the container stays stopped before automatic restart.</p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label htmlFor={stopTimeoutId} className="text-xs font-mono text-white/70">
                      Stop Timeout (seconds):
                    </label>
                    <span className="text-xs font-mono text-violet-300 font-bold">{timeoutSec}s</span>
                  </div>
                  <input
                    id={stopTimeoutId}
                    type="range"
                    min="1"
                    max="60"
                    value={timeoutSec}
                    onChange={(e) => setTimeoutSec(Number(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                  <p className="text-[11px] text-white/40 font-mono">Max seconds to wait before forcing stop.</p>
                </div>
              </div>
            )}

            {selectedFaultType === 'network_delay' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label htmlFor={delayLatencyId} className="text-xs font-mono text-white/70">
                        Added Latency (ms):
                      </label>
                      <span className="text-xs font-mono text-cyan-300 font-bold">{latencyMs}ms</span>
                    </div>
                    <input
                      id={delayLatencyId}
                      type="range"
                      min="10"
                      max="3000"
                      step="10"
                      value={latencyMs}
                      onChange={(e) => setLatencyMs(Number(e.target.value))}
                      className="w-full accent-cyan-500"
                    />
                    <p className="text-[11px] text-white/40 font-mono">Base packet roundtrip delay injected via Linux tc.</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label htmlFor={delayJitterId} className="text-xs font-mono text-white/70">
                        Jitter Variance (±ms):
                      </label>
                      <span className="text-xs font-mono text-cyan-300 font-bold">±{jitterMs}ms</span>
                    </div>
                    <input
                      id={delayJitterId}
                      type="range"
                      min="0"
                      max="500"
                      step="10"
                      value={jitterMs}
                      onChange={(e) => setJitterMs(Number(e.target.value))}
                      className="w-full accent-cyan-500"
                    />
                    <p className="text-[11px] text-white/40 font-mono">Standard latency variation jitter.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label htmlFor={delayDurationId} className="text-xs font-mono text-white/70">
                      Injection Duration (seconds):
                    </label>
                    <span className="text-xs font-mono text-violet-300 font-bold">{durationSec}s</span>
                  </div>
                  <input
                    id={delayDurationId}
                    type="range"
                    min="2"
                    max="180"
                    value={durationSec}
                    onChange={(e) => setDurationSec(Number(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                  <p className="text-[11px] text-white/40 font-mono">Tc rules are automatically wiped after duration ends.</p>
                </div>
              </div>
            )}

            {selectedFaultType === 'network_loss' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label htmlFor={lossPercentId} className="text-xs font-mono text-white/70">
                      Packet Loss Ratio (%):
                    </label>
                    <span className="text-xs font-mono text-purple-300 font-bold">{lossPercent}%</span>
                  </div>
                  <input
                    id={lossPercentId}
                    type="range"
                    min="1"
                    max="90"
                    step="1"
                    value={lossPercent}
                    onChange={(e) => setLossPercent(Number(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                  <p className="text-[11px] text-white/40 font-mono">Percentage of outbound/inbound packets dropped.</p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label htmlFor={lossDurationId} className="text-xs font-mono text-white/70">
                      Loss Duration (seconds):
                    </label>
                    <span className="text-xs font-mono text-violet-300 font-bold">{durationSec}s</span>
                  </div>
                  <input
                    id={lossDurationId}
                    type="range"
                    min="2"
                    max="180"
                    value={durationSec}
                    onChange={(e) => setDurationSec(Number(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                  <p className="text-[11px] text-white/40 font-mono">Traffic filters automatically revert after duration.</p>
                </div>
              </div>
            )}

            {selectedFaultType === 'cpu_stress' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label htmlFor={cpuWorkersId} className="text-xs font-mono text-white/70">
                      Burn Worker Threads:
                    </label>
                    <span className="text-xs font-mono text-emerald-300 font-bold">{cpuWorkers} worker(s)</span>
                  </div>
                  <input
                    id={cpuWorkersId}
                    type="range"
                    min="1"
                    max="8"
                    value={cpuWorkers}
                    onChange={(e) => setCpuWorkers(Number(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                  <p className="text-[11px] text-white/40 font-mono">Parallel calculation processes spawned inside container.</p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label htmlFor={cpuDurationId} className="text-xs font-mono text-white/70">
                      Stress Duration (seconds):
                    </label>
                    <span className="text-xs font-mono text-violet-300 font-bold">{durationSec}s</span>
                  </div>
                  <input
                    id={cpuDurationId}
                    type="range"
                    min="2"
                    max="120"
                    value={durationSec}
                    onChange={(e) => setDurationSec(Number(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                  <p className="text-[11px] text-white/40 font-mono">Processes automatically exit when duration expires.</p>
                </div>
              </div>
            )}

            {selectedFaultType === 'memory_stress' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label htmlFor={memoryMbId} className="text-xs font-mono text-white/70">
                      Memory Buffer Size:
                    </label>
                    <span className="text-xs font-mono text-fuchsia-300 font-bold">{memoryMb} MB</span>
                  </div>
                  <input
                    id={memoryMbId}
                    type="range"
                    min="32"
                    max="2048"
                    step="32"
                    value={memoryMb}
                    onChange={(e) => setMemoryMb(Number(e.target.value))}
                    className="w-full accent-fuchsia-500"
                  />
                  <p className="text-[11px] text-white/40 font-mono">Heap allocation maintained inside container RAM.</p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label htmlFor={memoryDurationId} className="text-xs font-mono text-white/70">
                      Hold Duration (seconds):
                    </label>
                    <span className="text-xs font-mono text-violet-300 font-bold">{durationSec}s</span>
                  </div>
                  <input
                    id={memoryDurationId}
                    type="range"
                    min="2"
                    max="120"
                    value={durationSec}
                    onChange={(e) => setDurationSec(Number(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                  <p className="text-[11px] text-white/40 font-mono">Buffer is automatically freed after duration expires.</p>
                </div>
              </div>
            )}

            {/* Impact Notice Alert Box */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <span className="font-bold">Expected Behavior: </span>
                {selectedMeta.impactWarning}
              </div>
            </div>
          </div>

          {/* Trigger Button */}
          <div className="flex justify-end items-center pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !!activeFault}
              className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-mono font-bold text-xs shadow-lg shadow-violet-900/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              Review & Queue Fault Injection
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* AUDIT LOG & EXPERIMENT HISTORY TABLE */}
      <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 md:p-8 backdrop-blur-md space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-white/5">
          <div>
            <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-violet-400" />
              Fault Injection Audit Log & Results
            </h3>
            <p className="text-xs text-white/50 mt-1">
              Complete audit trail of all manual chaos executions, status changes, and rollback verifications.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchFaults()}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {isLoadingHistory ? (
          <div className="py-12 text-center text-white/40 font-mono text-xs flex justify-center items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
            Loading fault injection history...
          </div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center bg-black/20 rounded-2xl border border-white/5 p-6">
            <Zap className="w-8 h-8 text-white/20 mx-auto mb-2" />
            <p className="text-xs font-mono text-white/40">No fault injections have been requested for this project yet.</p>
            <p className="text-[11px] text-white/30 font-mono mt-1">Use the dispatcher above to test container resilience.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-white/10 text-white/40 uppercase text-[10px] tracking-wider">
                  <th className="pb-3 pl-2">ID</th>
                  <th className="pb-3">Fault Strategy</th>
                  <th className="pb-3">Target Container</th>
                  <th className="pb-3">Parameters</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Requested At</th>
                  <th className="pb-3 text-right pr-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white/80">
                {history.map((record) => {
                  let statusBadge = (
                    <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-white/10 text-white/60">
                      {record.status}
                    </span>
                  );
                  if (record.status === 'completed') {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1 w-fit">
                        <CheckCircle2 className="w-3 h-3" /> Completed
                      </span>
                    );
                  } else if (record.status === 'failed') {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-1 w-fit">
                        <XCircle className="w-3 h-3" /> Failed
                      </span>
                    );
                  } else if (record.status === 'running') {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-1 w-fit animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" /> Running
                      </span>
                    );
                  } else if (record.status === 'pending') {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-violet-500/10 border border-violet-500/20 text-violet-300 flex items-center gap-1 w-fit">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                    );
                  } else if (record.status === 'cancelled') {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-stone-500/10 border border-white/10 text-white/40 flex items-center gap-1 w-fit">
                        <Ban className="w-3 h-3" /> Cancelled
                      </span>
                    );
                  }

                  return (
                    <tr key={record.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 pl-2 text-white/40">#{record.id}</td>
                      <td className="py-3.5 font-bold text-violet-300">{record.fault_type}</td>
                      <td className="py-3.5 text-cyan-300 font-semibold">{record.target}</td>
                      <td className="py-3.5 text-white/50 max-w-[200px] truncate" title={JSON.stringify(record.parameters)}>
                        {Object.entries(record.parameters || {})
                          .map(([k, v]) => `${k}=${v}`)
                          .join(', ')}
                      </td>
                      <td className="py-3.5">{statusBadge}</td>
                      <td className="py-3.5 text-white/40 text-[11px]">
                        {new Date(record.requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="py-3.5 text-right pr-2">
                        <button
                          type="button"
                          onClick={() => setSelectedAuditRecord(record)}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-[11px] transition-colors cursor-pointer"
                        >
                          Audit Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PRE-FLIGHT CONFIRMATION MODAL */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirm Fault Injection Experiment"
        maxWidthClass="max-w-xl"
      >
        <div className="space-y-5 font-mono">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              Manual Execution Warning
            </div>
            <p className="leading-relaxed">
              You are about to inject <span className="font-bold text-white">{selectedMeta.label}</span> into Docker container{' '}
              <span className="font-bold text-cyan-300">{targetContainer.trim()}</span>.
            </p>
            <p className="text-[11px] text-amber-300/80">
              {selectedMeta.impactWarning}
            </p>
          </div>

          <div className="bg-black/50 border border-white/10 rounded-2xl p-4 space-y-2 text-xs">
            <span className="text-[10px] text-white/40 uppercase tracking-widest block">Execution Payload</span>
            <pre className="text-emerald-300 overflow-x-auto text-[11px]">
              {JSON.stringify(
                {
                  fault_type: selectedFaultType,
                  target: targetContainer.trim(),
                  parameters: buildPayloadParameters(),
                },
                null,
                2
              )}
            </pre>
          </div>

          <p className="text-[11px] text-white/50 leading-relaxed font-sans">
            Once confirmed, this request will be recorded with an immutable audit ID. The local Noir agent listening on your machine (<code className="text-violet-300 font-mono">noir fault listen</code>) will pick up the task, execute the Docker manipulation, and restore normal state upon completion.
          </p>

          <div className="flex justify-end items-center gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => setShowConfirmModal(false)}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirmDispatch}
              className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-lg shadow-violet-900/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-300" />}
              Confirm & Dispatch Request
            </button>
          </div>
        </div>
      </Modal>

      {/* AUDIT DRILL-DOWN MODAL */}
      <Modal
        isOpen={!!selectedAuditRecord}
        onClose={() => setSelectedAuditRecord(null)}
        title={`Fault Audit Record #${selectedAuditRecord?.id}`}
        maxWidthClass="max-w-2xl"
      >
        {selectedAuditRecord && (
          <div className="space-y-5 font-mono text-xs">
            {/* Header info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white/5 border border-white/10 rounded-2xl p-4">
              <div>
                <span className="text-white/40 block text-[10px] uppercase">Strategy</span>
                <span className="font-bold text-violet-300">{selectedAuditRecord.fault_type}</span>
              </div>
              <div>
                <span className="text-white/40 block text-[10px] uppercase">Target</span>
                <span className="font-bold text-cyan-300">{selectedAuditRecord.target}</span>
              </div>
              <div>
                <span className="text-white/40 block text-[10px] uppercase">Status</span>
                <span className="font-bold text-white uppercase">{selectedAuditRecord.status}</span>
              </div>
              <div>
                <span className="text-white/40 block text-[10px] uppercase">Duration</span>
                <span className="font-bold text-emerald-400">
                  {selectedAuditRecord.duration_seconds ? `${selectedAuditRecord.duration_seconds}s` : '-'}
                </span>
              </div>
            </div>

            {/* Timestamps & User */}
            <div className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-white/40">Requested By:</span>
                <span className="text-white">
                  {selectedAuditRecord.requested_by?.username || 'User'} ({selectedAuditRecord.requested_by?.email || '-'})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Requested At:</span>
                <span className="text-white">{new Date(selectedAuditRecord.requested_at).toLocaleString()}</span>
              </div>
              {selectedAuditRecord.started_at && (
                <div className="flex justify-between">
                  <span className="text-white/40">Started At:</span>
                  <span className="text-white">{new Date(selectedAuditRecord.started_at).toLocaleString()}</span>
                </div>
              )}
              {selectedAuditRecord.completed_at && (
                <div className="flex justify-between">
                  <span className="text-white/40">Completed At:</span>
                  <span className="text-white">{new Date(selectedAuditRecord.completed_at).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Error Message if failed */}
            {selectedAuditRecord.error_message && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-1">
                <span className="font-bold text-[10px] uppercase tracking-wider block">Error Description:</span>
                <p className="text-xs">{selectedAuditRecord.error_message}</p>
              </div>
            )}

            {/* Execution Result JSON */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-white/40 uppercase tracking-widest block">Agent Execution Result</span>
              <pre className="p-4 rounded-2xl bg-black/60 border border-white/10 text-emerald-300 overflow-x-auto text-[11px] max-h-60">
                {JSON.stringify(selectedAuditRecord.result || {}, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedAuditRecord(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs cursor-pointer"
              >
                Close Audit View
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
