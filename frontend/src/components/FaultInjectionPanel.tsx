import React, { useState, useEffect, useCallback, useId, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Info, 
  RefreshCw, 
  Copy, 
  Check, 
  Printer, 
  FileText,
  Square,
  Plus,
  Play,
  ArrowRight,
  ShieldCheck,
  CheckCircle
} from 'lucide-react';
import Modal from './Modal';
import FaultDetailModal from './FaultDetailModal';
import FaultReportModal from './FaultReportModal';
import { apiFetch } from '../utils/api';
import { getAccessToken } from '../utils/auth';

export interface FaultRecord {
  id: number;
  injection_id?: number | string;
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
  status: 'queued' | 'pending' | 'running' | 'completed' | 'failed' | 'cancel_requested' | 'cancelled';
  created_at?: string;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  logs_count?: number;
  result: Record<string, any> | null;
  error_message: string;
}

export interface FaultLogItem {
  id?: number;
  fault_id?: number;
  injection_id?: number | string;
  timestamp: string;
  level: string;
  message: string;
}

interface FaultInjectionPanelProps {
  projectIdentifier: string | number;
  projectCode?: string;
  initialContainers?: Array<{ id: string; name: string; service: string; image: string; status: string; ports?: string[] }>;
}

export type FaultTypeKey = 
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
  badge: string;
  description: string;
  impactWarning: string;
}

const FAULT_DEFINITIONS: FaultTypeMeta[] = [
  {
    key: 'cpu_stress',
    label: 'CPU Stress / Throttling',
    icon: Cpu,
    badge: 'Resource',
    description: 'Spawns worker processes to saturate CPU cores inside the container for a bounded duration.',
    impactWarning: 'CPU utilization will peak. Service throughput and response times may degrade.',
  },
  {
    key: 'network_delay',
    label: 'Network Latency / Delay',
    icon: Wifi,
    badge: 'Network',
    description: 'Injects artificial latency and jitter using Linux Traffic Control (tc/netem) on the container interface.',
    impactWarning: 'Responses will be delayed by the configured latency. Timeouts may occur.',
  },
  {
    key: 'memory_stress',
    label: 'Memory Pressure',
    icon: HardDrive,
    badge: 'Resource',
    description: 'Allocates a designated memory buffer inside the container to test OOM handling.',
    impactWarning: 'Container memory usage will surge to the allocated threshold for the specified duration.',
  },
  {
    key: 'container_stop',
    label: 'Container Stop & Hold',
    icon: PowerOff,
    badge: 'Downtime',
    description: 'Stops the target container for a configured duration, then automatically restarts it.',
    impactWarning: 'Target service will be offline for the designated duration. Healthchecks may trigger failover.',
  },
  {
    key: 'container_restart',
    label: 'Container Restart',
    icon: RotateCcw,
    badge: 'Availability',
    description: 'Gracefully halts and restarts the target container to test system reconnection and heartbeat recovery.',
    impactWarning: 'Target service will briefly drop active connections during restart cycle.',
  },
  {
    key: 'network_loss',
    label: 'Packet Loss',
    icon: WifiOff,
    badge: 'Network',
    description: 'Drops a percentage of network packets to simulate flaky WAN connections and packet drops.',
    impactWarning: 'Intermittent connection failures and TCP retransmissions will occur.',
  },
];

export default function FaultInjectionPanel({ projectIdentifier, projectCode, initialContainers }: FaultInjectionPanelProps) {
  const navigate = useNavigate();
  const [history, setHistory] = useState<FaultRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // Containers State
  const [containers, setContainers] = useState<Array<{ id: string; name: string; service: string; image: string; status: string; ports?: string[] }>>(initialContainers || []);
  const [isLoadingContainers, setIsLoadingContainers] = useState(false);

  // Form & Dispatch Modal State
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [targetContainer, setTargetContainer] = useState('');
  const [selectedFaultType, setSelectedFaultType] = useState<FaultTypeKey>('cpu_stress');
  const [durationSec, setDurationSec] = useState<number>(15);
  const [timeoutSec, setTimeoutSec] = useState<number>(10);
  const [latencyMs, setLatencyMs] = useState<number>(500);
  const [jitterMs, setJitterMs] = useState<number>(50);
  const [lossPercent, setLossPercent] = useState<number>(20);
  const [cpuWorkers, setCpuWorkers] = useState<number>(2);
  const [memoryMb, setMemoryMb] = useState<number>(256);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState<string | null>(null);

  // Daemon Status ('noir fault listen' active indicator)
  const [isDaemonActive, setIsDaemonActive] = useState<boolean>(false);
  const [isCheckingDaemon, setIsCheckingDaemon] = useState<boolean>(false);

  // Cancellation & Stop State
  const [stoppingFaultIds, setStoppingFaultIds] = useState<Set<number>>(new Set());
  const [cancellingFaultIds, setCancellingFaultIds] = useState<Set<number>>(new Set());

  // Inspections & Printing Modals
  const [selectedDetailRecord, setSelectedDetailRecord] = useState<FaultRecord | null>(null);
  const [reportModalConfig, setReportModalConfig] = useState<{
    isOpen: boolean;
    mode: 'single' | 'collective';
    singleRecord?: FaultRecord | null;
  }>({ isOpen: false, mode: 'collective' });

  // Real-Time WebSocket & Log Stream State
  const [wsStatus, setWsStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
  const [liveLogs, setLiveLogs] = useState<FaultLogItem[]>([]);
  const logDedupeSetRef = useRef<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const terminalScrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Elapsed Timer State for Running Fault
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Derive Queued, Running, and Recent records
  const runningFault = history.find(h => h.status === 'running' || h.status === 'cancel_requested');
  const queuedFaults = history.filter(h => h.status === 'queued' || h.status === 'pending');
  const recentFaults = history.filter(h => h.status !== 'running' && h.status !== 'cancel_requested' && h.status !== 'queued' && h.status !== 'pending');

  // Elapsed Timer Effect
  useEffect(() => {
    if (!runningFault) {
      setElapsedSeconds(0);
      return;
    }
    const startMs = runningFault.started_at ? new Date(runningFault.started_at).getTime() : Date.now();
    const updateElapsed = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((now - startMs) / 1000));
      setElapsedSeconds(diff);
    };
    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [runningFault?.id, runningFault?.status, runningFault?.started_at]);

  // Auto-scroll terminal logs
  useEffect(() => {
    if (autoScroll && terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [liveLogs, autoScroll]);

  // Log deduplicator helper
  const addLogItem = useCallback((item: FaultLogItem) => {
    const key = `${item.id || ''}_${item.timestamp}_${item.message}`;
    if (logDedupeSetRef.current.has(key)) return;
    logDedupeSetRef.current.add(key);
    setLiveLogs(prev => [...prev.slice(-400), item]);
  }, []);

  // Fetch Fault History
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

  // Check Daemon Status ('noir fault listen')
  const checkDaemonStatus = useCallback(async () => {
    try {
      setIsCheckingDaemon(true);
      const resp = await apiFetch(`/api/project/${projectIdentifier}/stream-status/`);
      if (resp.ok) {
        const data = await resp.json();
        setIsDaemonActive(!!data.is_daemon_active);
      }
    } catch (e) {
      console.error('Failed to check daemon status:', e);
    } finally {
      setIsCheckingDaemon(false);
    }
  }, [projectIdentifier]);

  useEffect(() => {
    checkDaemonStatus();
    const interval = setInterval(checkDaemonStatus, 4000);
    return () => clearInterval(interval);
  }, [checkDaemonStatus]);

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
          if (!targetContainer && found[0]?.name) {
            setTargetContainer(found[0].name);
          }
        }
      }
    } catch (e) {
      console.warn('Could not fetch containers:', e);
    } finally {
      setIsLoadingContainers(false);
    }
  }, [projectIdentifier, targetContainer]);

  // Fetch Historical Logs for a Fault
  const fetchLogsForFault = useCallback(async (faultId: number) => {
    try {
      const resp = await apiFetch(`/api/projects/${projectIdentifier}/faults/${faultId}/logs/`);
      if (resp.ok) {
        const logs: FaultLogItem[] = await resp.json();
        logs.forEach(log => {
          addLogItem({
            id: log.id,
            fault_id: faultId,
            injection_id: faultId,
            timestamp: log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString(),
            level: log.level || 'INFO',
            message: log.message,
          });
        });
      }
    } catch (err) {
      console.warn('Could not fetch logs for fault:', err);
    }
  }, [projectIdentifier, addLogItem]);

  // WebSocket Connection Lifecycle with Reconnection
  useEffect(() => {
    const connCode = projectCode || String(projectIdentifier);
    if (!connCode) return;

    let isUnmounted = false;

    const connectWebSocket = () => {
      if (isUnmounted) return;

      const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      let host = apiBase.replace(/^https?:\/\//, '');
      if (host.endsWith('/api')) host = host.replace(/\/api$/, '');
      const wsProtocol = apiBase.startsWith('https') ? 'wss:' : 'ws:';
      const token = getAccessToken();
      const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
      const wsUrl = `${wsProtocol}//${host}/ws/project/${connCode}/logs/${tokenQuery}`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isUnmounted) { ws.close(); return; }
          setWsStatus('connected');
          // Re-sync states upon reconnect
          fetchFaults(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // 1. Structured log event
            if (data.type === 'injection.log') {
              addLogItem({
                id: data.id,
                fault_id: data.injection_id,
                injection_id: data.injection_id,
                timestamp: data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString(),
                level: data.level || 'INFO',
                message: data.message || data.log || '',
              });
            }

            // 2. Structured status event
            if (data.type === 'injection.status') {
              const faultId = Number(data.injection_id);
              setHistory(prev => prev.map(f => f.id === faultId ? { ...f, status: data.status, ...(data.fault || {}) } : f));
              fetchFaults(true);
            }

            // 3. Structured completion event
            if (data.type === 'injection.completed') {
              const faultId = Number(data.injection_id);
              setHistory(prev => prev.map(f => f.id === faultId ? { 
                ...f, 
                status: 'completed', 
                completed_at: data.completed_at || new Date().toISOString(), 
                result: data.result || f.result 
              } : f));
              setStoppingFaultIds(prev => { const s = new Set(prev); s.delete(faultId); return s; });
              fetchFaults(true);
            }

            // 4. Structured cancellation event
            if (data.type === 'injection.cancelled') {
              const faultId = Number(data.injection_id);
              setHistory(prev => prev.map(f => f.id === faultId ? { ...f, status: 'cancelled' } : f));
              setStoppingFaultIds(prev => { const s = new Set(prev); s.delete(faultId); return s; });
              setCancellingFaultIds(prev => { const s = new Set(prev); s.delete(faultId); return s; });
              fetchFaults(true);
            }

            // Legacy log fallback
            if (data.log && !data.type) {
              addLogItem({
                timestamp: data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString(),
                level: 'INFO',
                message: data.log,
              });
            }
          } catch (err) {
            console.error('Error parsing WebSocket message:', err);
          }
        };

        ws.onerror = () => {
          setWsStatus('reconnecting');
        };

        ws.onclose = () => {
          wsRef.current = null;
          if (!isUnmounted) {
            setWsStatus('reconnecting');
            reconnectTimeoutRef.current = setTimeout(connectWebSocket, 2500);
          }
        };
      } catch (err) {
        setWsStatus('reconnecting');
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    return () => {
      isUnmounted = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [projectCode, projectIdentifier, addLogItem, fetchFaults]);

  // Initial load
  useEffect(() => {
    fetchFaults();
    fetchContainers();
  }, [fetchFaults, fetchContainers]);

  // Fetch logs when running fault changes
  useEffect(() => {
    if (runningFault) {
      fetchLogsForFault(runningFault.id);
    }
  }, [runningFault?.id, fetchLogsForFault]);

  // Fallback Polling (quiet) when jobs are running or queued
  useEffect(() => {
    if (!runningFault && queuedFaults.length === 0) return;
    const interval = setInterval(() => {
      fetchFaults(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [runningFault, queuedFaults.length, fetchFaults]);

  // Build parameters object
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

  // Dispatch Fault Injection Job (NON-BLOCKING)
  const handleDispatchInjection = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitSuccessMsg(null);

    const target = targetContainer.trim();
    if (!target) {
      setFormError('Please select or specify a target Docker container.');
      return;
    }

    if (!isDaemonActive) {
      setFormError("Cannot queue fault: The Noir daemon ('noir fault listen') is not running. Please start the listener in your terminal before queuing a fault.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        fault_type: selectedFaultType,
        target,
        parameters: buildPayloadParameters(),
      };

      const resp = await apiFetch(`/api/projects/${projectIdentifier}/faults/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        const msg = errorData.detail || errorData.parameters || errorData.target || 'Failed to queue injection.';
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }

      const created: FaultRecord = await resp.json();
      setShowDispatchModal(false);
      setSubmitSuccessMsg(`Successfully queued #${created.id} (${created.fault_type}).`);
      
      // Instantly insert into local state as QUEUED
      setHistory(prev => [created, ...prev.filter(f => f.id !== created.id)]);
      fetchFaults(true);
    } catch (err: any) {
      setFormError(err.message || 'An unexpected error occurred while queuing injection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stop Running Injection (Idempotent 2-step transition)
  const handleStopActiveFault = async (faultId: number) => {
    setStoppingFaultIds(prev => new Set(prev).add(faultId));
    try {
      // Optimistically show STOPPING...
      setHistory(prev => prev.map(f => f.id === faultId ? { ...f, status: 'cancel_requested' } : f));
      
      const resp = await apiFetch(`/api/projects/${projectIdentifier}/faults/${faultId}/cancel/`, {
        method: 'POST',
      });
      if (resp.ok) {
        const updated: FaultRecord = await resp.json();
        setHistory(prev => prev.map(f => f.id === faultId ? updated : f));
      }
    } catch (err) {
      console.error('Failed to request cancellation:', err);
    }
  };

  // Cancel Queued Injection (Immediate transition)
  const handleCancelQueuedFault = async (faultId: number) => {
    setCancellingFaultIds(prev => new Set(prev).add(faultId));
    try {
      const resp = await apiFetch(`/api/projects/${projectIdentifier}/faults/${faultId}/cancel/`, {
        method: 'POST',
      });
      if (resp.ok) {
        const updated: FaultRecord = await resp.json();
        setHistory(prev => prev.map(f => f.id === faultId ? updated : f));
      }
    } catch (err) {
      console.error('Failed to cancel queued fault:', err);
    } finally {
      setCancellingFaultIds(prev => { const s = new Set(prev); s.delete(faultId); return s; });
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatCompletedDuration = (record: FaultRecord) => {
    if (record.duration_seconds !== null && record.duration_seconds !== undefined) {
      return `${record.duration_seconds}s`;
    }
    if (record.parameters && record.parameters.duration) {
      return `${record.parameters.duration}s`;
    }
    return '-';
  };

  return (
    <div className="space-y-3 font-sans">
      {/* COMPACT TOP TOOLBAR */}
      <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-lg p-3 relative">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
                  Injections
                </h2>
                {/* WebSocket Connection Status Pill */}
                <div className={`px-2 py-0.5 rounded-full text-[10px] font-mono flex items-center gap-1.5 border ${
                  wsStatus === 'connected'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : wsStatus === 'reconnecting'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    wsStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : wsStatus === 'reconnecting' ? 'bg-amber-400 animate-spin' : 'bg-zinc-500'
                  }`} />
                  <span className="capitalize">{wsStatus}</span>
                </div>

                {/* Daemon Status Pill */}
                <div className={`px-2 py-0.5 rounded-full text-[10px] font-mono flex items-center gap-1.5 border ${
                  isDaemonActive
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`} title={isDaemonActive ? "Noir daemon ('noir fault listen') is running" : "Noir daemon ('noir fault listen') is not running"}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    isDaemonActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`} />
                  <span>{isDaemonActive ? 'DAEMON ACTIVE' : 'DAEMON INACTIVE'}</span>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Asynchronous fault execution queue with live telemetry and Docker control.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* Quick CLI command */}
            <div className="hidden md:flex items-center gap-2 bg-[#090A0F] border border-zinc-800/80 rounded px-2 py-1 font-mono text-[11px]">
              <span className="text-zinc-500">$</span>
              <span className="text-emerald-400">noir fault listen</span>
              <button
                type="button"
                onClick={() => handleCopy('noir fault listen', 'listen')}
                className="text-zinc-400 hover:text-white p-0.5 cursor-pointer"
                title="Copy CLI listener command"
              >
                {copiedCmd === 'listen' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>

            {/* Print Collective Audit Report */}
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => setReportModalConfig({ isOpen: true, mode: 'collective' })}
                className="px-2.5 py-1.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-mono font-medium border border-zinc-700/60 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Print full project resilience audit report"
              >
                <Printer className="w-3.5 h-3.5 text-zinc-400" />
                <span className="hidden sm:inline">Audit Report</span>
              </button>
            )}

            {/* New Injection Dispatch Button */}
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setSubmitSuccessMsg(null);
                checkDaemonStatus();
                setShowDispatchModal(true);
              }}
              className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs font-mono transition-all flex items-center gap-1.5 shadow-sm hover:shadow-amber-500/20 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>New Injection</span>
            </button>
          </div>
        </div>
      </div>

      {submitSuccessMsg && (
        <div className="px-3 py-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{submitSuccessMsg}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setSubmitSuccessMsg(null)}
            className="text-emerald-400/60 hover:text-emerald-300 cursor-pointer text-[10px]"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. RUNNING SECTION (ACTIVE WORKLOAD + LIVE STREAM OUTPUT) */}
      <AnimatePresence>
        {runningFault && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="bg-[#0D0F17] border border-amber-500/30 rounded-lg overflow-hidden"
          >
            {/* Active Header Bar */}
            <div className="p-3 bg-amber-950/20 border-b border-amber-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* State Indicator */}
                <div className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded text-[11px] font-mono font-bold text-amber-300">
                  {runningFault.status === 'cancel_requested' ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                      <span>STOPPING...</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      <span>RUNNING</span>
                    </>
                  )}
                </div>

                {/* Strategy & Target */}
                <div className="flex items-center gap-1.5 text-xs text-zinc-200 font-mono">
                  <span className="font-semibold text-white uppercase">{runningFault.fault_type.replace('_', ' ')}</span>
                  <ArrowRight className="w-3 h-3 text-zinc-500" />
                  <span className="text-cyan-400 font-bold bg-cyan-950/40 border border-cyan-800/40 px-1.5 py-0.2 rounded">
                    {runningFault.target}
                  </span>
                </div>

                {/* Live Elapsed Counter */}
                <div className="flex items-center gap-1 text-xs font-mono text-zinc-400 bg-black/40 border border-zinc-800 px-2 py-0.5 rounded">
                  <Clock className="w-3 h-3 text-zinc-500" />
                  <span className="text-zinc-200 font-semibold">{formatTimer(elapsedSeconds)}</span>
                </div>

                {/* Parameters Tag */}
                <div className="text-[11px] font-mono text-zinc-400 hidden md:inline">
                  {runningFault.parameters.duration && `(${runningFault.parameters.duration}s duration)`}
                  {runningFault.parameters.workers && `(${runningFault.parameters.workers} workers)`}
                  {runningFault.parameters.latency_ms && `(${runningFault.parameters.latency_ms}ms)`}
                  {runningFault.parameters.memory_mb && `(${runningFault.parameters.memory_mb}MB)`}
                </div>
              </div>

              {/* Stop / Cancel Action */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  disabled={runningFault.status === 'cancel_requested' || stoppingFaultIds.has(runningFault.id)}
                  onClick={() => handleStopActiveFault(runningFault.id)}
                  className="px-3 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 hover:text-white text-xs font-mono font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Stop active execution and safely rollback Docker changes"
                >
                  {runningFault.status === 'cancel_requested' || stoppingFaultIds.has(runningFault.id) ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>STOPPING...</span>
                    </>
                  ) : (
                    <>
                      <Square className="w-3 h-3 fill-rose-400 text-rose-400" />
                      <span>STOP</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Live Monospace Log Terminal */}
            <div className="p-3 bg-[#08090D]">
              <div className="flex items-center justify-between pb-1.5 text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3 h-3 text-zinc-400" />
                  <span>Live Output Stream</span>
                  <span className="text-zinc-600">({liveLogs.length} events)</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 cursor-pointer text-zinc-400 hover:text-zinc-300">
                    <input 
                      type="checkbox" 
                      checked={autoScroll} 
                      onChange={e => setAutoScroll(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-0 w-3 h-3" 
                    />
                    <span>Auto-scroll</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const text = liveLogs.map(l => `[${l.timestamp}] [${l.level}] ${l.message}`).join('\n');
                      handleCopy(text, 'logs');
                    }}
                    className="hover:text-zinc-300 transition-colors cursor-pointer"
                  >
                    {copiedCmd === 'logs' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div 
                ref={terminalScrollRef}
                className="bg-[#050608] border border-zinc-800/80 rounded p-2.5 font-mono text-[11px] leading-relaxed max-h-44 overflow-y-auto space-y-1 select-text scrollbar-thin scrollbar-thumb-zinc-800"
              >
                {liveLogs.length === 0 ? (
                  <div className="text-zinc-600 italic py-2">
                    Listening for incoming injection logs on WebSocket...
                  </div>
                ) : (
                  liveLogs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-zinc-500 text-[10px] shrink-0 select-none">{log.timestamp}</span>
                      <span className={`text-[9px] uppercase px-1 rounded select-none shrink-0 ${
                        log.level === 'ERROR' 
                          ? 'bg-rose-500/20 text-rose-400' 
                          : log.level === 'WARN' 
                          ? 'bg-amber-500/20 text-amber-400' 
                          : 'bg-emerald-500/10 text-emerald-400'
                      }`}>
                        {log.level}
                      </span>
                      <span className="text-zinc-300 break-all">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. QUEUED SECTION */}
      {queuedFaults.length > 0 && (
        <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-zinc-900/60 border-b border-zinc-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300">Queue</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-violet-500/20 text-violet-300 border border-violet-500/30">
                {queuedFaults.length}
              </span>
            </div>
            <span className="text-[11px] text-zinc-500 font-mono">FIFO Execution Policy</span>
          </div>

          <div className="divide-y divide-zinc-800/60">
            {queuedFaults.map((q, idx) => (
              <div 
                key={q.id}
                className="px-3 py-2.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 hover:bg-zinc-900/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-zinc-500 w-4">
                    #{idx + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-zinc-200 uppercase">
                        {q.fault_type.replace('_', ' ')}
                      </span>
                      <span className="text-zinc-500 text-xs">→</span>
                      <span className="text-xs font-mono text-cyan-400 bg-cyan-950/30 border border-cyan-800/30 px-1 rounded">
                        {q.target}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                      {q.parameters.duration && `${q.parameters.duration}s duration `}
                      {q.parameters.workers && `• ${q.parameters.workers} workers `}
                      {q.parameters.latency_ms && `• ${q.parameters.latency_ms}ms latency `}
                      {q.parameters.memory_mb && `• ${q.parameters.memory_mb}MB `}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-violet-500/10 text-violet-300 border border-violet-500/30">
                    QUEUED
                  </span>
                  <button
                    type="button"
                    disabled={cancellingFaultIds.has(q.id)}
                    onClick={() => handleCancelQueuedFault(q.id)}
                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/30 text-zinc-400 text-[11px] font-mono border border-zinc-700/60 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {cancellingFaultIds.has(q.id) ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      'CANCEL'
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. RECENT INJECTIONS SECTION */}
      <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-zinc-900/60 border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300">Recent</span>
            <span className="text-[11px] text-zinc-500 font-mono">({recentFaults.length} runs)</span>
          </div>

          <button
            type="button"
            onClick={() => fetchFaults(true)}
            className="text-zinc-500 hover:text-zinc-300 text-xs flex items-center gap-1 font-mono transition-colors cursor-pointer"
            title="Refresh history"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Sync</span>
          </button>
        </div>

        {recentFaults.length === 0 ? (
          <div className="p-4 text-center text-xs font-mono text-zinc-500">
            No completed or cancelled fault executions recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#090A0F] text-zinc-500 text-[10px] uppercase border-b border-zinc-800/80">
                <tr>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Strategy</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2">Duration</th>
                  <th className="px-3 py-2">Executed At</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {recentFaults.slice(0, 15).map((record) => (
                  <tr key={record.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        record.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : record.status === 'cancelled'
                          ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {record.status === 'completed' && <CheckCircle className="w-2.5 h-2.5" />}
                        {record.status === 'cancelled' && <Ban className="w-2.5 h-2.5" />}
                        {record.status === 'failed' && <XCircle className="w-2.5 h-2.5" />}
                        <span>{record.status}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium text-white whitespace-nowrap">
                      {record.fault_type.replace('_', ' ')}
                    </td>
                    <td className="px-3 py-2 text-cyan-400 whitespace-nowrap">
                      {record.target}
                    </td>
                    <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">
                      {formatCompletedDuration(record)}
                    </td>
                    <td className="px-3 py-2 text-zinc-500 text-[11px] whitespace-nowrap">
                      {record.completed_at ? new Date(record.completed_at).toLocaleTimeString() : new Date(record.requested_at).toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedDetailRecord(record)}
                          className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[11px] transition-colors cursor-pointer"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          onClick={() => setReportModalConfig({ isOpen: true, mode: 'single', singleRecord: record })}
                          className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[11px] transition-colors cursor-pointer"
                        >
                          Report
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DISPATCH INJECTION MODAL (Allows continuous queuing) */}
      <Modal
        isOpen={showDispatchModal}
        onClose={() => setShowDispatchModal(false)}
        title="Queue Fault Injection"
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleDispatchInjection} className="space-y-4 font-mono">
          {formError && (
            <div className="p-3 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{formError}</span>
            </div>
          )}

          {/* Real-time Daemon Status Banner */}
          {isDaemonActive ? (
            <div className="flex items-center justify-between p-2.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold">Daemon Active: 'noir fault listen' is running</span>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 uppercase font-bold">Ready</span>
            </div>
          ) : (
            <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-semibold text-amber-200">Listener Required: 'noir fault listen' is not running</span>
                </div>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30 uppercase font-bold">Action Needed</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Noir requires the agent listener daemon to be actively running in your workspace to execute queued faults. Run this command in your project directory:
              </p>
              <div className="flex items-center justify-between bg-black/60 border border-zinc-800 rounded px-2.5 py-1.5 font-mono text-[11px]">
                <span className="text-zinc-300">$ <span className="text-emerald-400 font-bold">noir fault listen</span></span>
                <button
                  type="button"
                  onClick={() => handleCopy('noir fault listen', 'modal-listen')}
                  className="text-zinc-400 hover:text-white flex items-center gap-1 text-[10px] cursor-pointer"
                >
                  {copiedCmd === 'modal-listen' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCmd === 'modal-listen' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Fault Strategy Selector */}
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5 uppercase tracking-wider font-bold">
              1. Injection Strategy
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FAULT_DEFINITIONS.map(f => {
                const Icon = f.icon;
                const isSelected = selectedFaultType === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setSelectedFaultType(f.key)}
                    className={`p-2.5 rounded border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500 text-white'
                        : 'bg-[#090A0F] border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mb-1 ${isSelected ? 'text-amber-400' : 'text-zinc-500'}`} />
                    <div className="text-xs font-semibold">{f.label}</div>
                    <div className="text-[10px] text-zinc-500 uppercase mt-0.5">{f.badge}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Container */}
          <div>
            <label className="text-xs text-zinc-400 block mb-1 uppercase tracking-wider font-bold">
              2. Target Docker Container
            </label>
            {containers.length > 0 ? (
              <div className="flex gap-2">
                <select
                  value={targetContainer}
                  onChange={e => setTargetContainer(e.target.value)}
                  className="w-full bg-[#090A0F] border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Select running container --</option>
                  {containers.map((c, i) => (
                    <option key={i} value={c.name || c.service}>
                      {c.name || c.service} ({c.status || 'running'})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Or custom target"
                  value={targetContainer}
                  onChange={e => setTargetContainer(e.target.value)}
                  className="w-1/2 bg-[#090A0F] border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            ) : (
              <input
                type="text"
                placeholder="e.g. api-server, worker, redis"
                value={targetContainer}
                onChange={e => setTargetContainer(e.target.value)}
                className="w-full bg-[#090A0F] border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
              />
            )}
          </div>

          {/* Parameters */}
          <div className="p-3 bg-[#090A0F] border border-zinc-800/80 rounded space-y-3">
            <div className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider">
              3. Configure Parameters
            </div>

            {/* Duration (common to stress/delay/loss/stop) */}
            {selectedFaultType !== 'container_restart' && (
              <div>
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>Duration (seconds)</span>
                  <span className="text-amber-400 font-bold">{durationSec}s</span>
                </div>
                <input 
                  type="range" 
                  min={2} 
                  max={60} 
                  value={durationSec}
                  onChange={e => setDurationSec(Number(e.target.value))}
                  className="w-full accent-amber-500" 
                />
              </div>
            )}

            {/* CPU Stress */}
            {selectedFaultType === 'cpu_stress' && (
              <div>
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>CPU Workers</span>
                  <span className="text-amber-400 font-bold">{cpuWorkers}</span>
                </div>
                <input 
                  type="range" 
                  min={1} 
                  max={8} 
                  value={cpuWorkers}
                  onChange={e => setCpuWorkers(Number(e.target.value))}
                  className="w-full accent-amber-500" 
                />
              </div>
            )}

            {/* Network Latency */}
            {selectedFaultType === 'network_delay' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Latency (ms)</label>
                  <input
                    type="number"
                    min={10}
                    max={2000}
                    value={latencyMs}
                    onChange={e => setLatencyMs(Number(e.target.value))}
                    className="w-full bg-black/40 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Jitter (±ms)</label>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={jitterMs}
                    onChange={e => setJitterMs(Number(e.target.value))}
                    className="w-full bg-black/40 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200"
                  />
                </div>
              </div>
            )}

            {/* Network Loss */}
            {selectedFaultType === 'network_loss' && (
              <div>
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>Packet Loss (%)</span>
                  <span className="text-amber-400 font-bold">{lossPercent}%</span>
                </div>
                <input 
                  type="range" 
                  min={1} 
                  max={80} 
                  value={lossPercent}
                  onChange={e => setLossPercent(Number(e.target.value))}
                  className="w-full accent-amber-500" 
                />
              </div>
            )}

            {/* Memory Stress */}
            {selectedFaultType === 'memory_stress' && (
              <div>
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>Memory Buffer (MB)</span>
                  <span className="text-amber-400 font-bold">{memoryMb} MB</span>
                </div>
                <input 
                  type="range" 
                  min={32} 
                  max={1024} 
                  step={32}
                  value={memoryMb}
                  onChange={e => setMemoryMb(Number(e.target.value))}
                  className="w-full accent-amber-500" 
                />
              </div>
            )}

            {/* Stop/Restart Timeout */}
            {(selectedFaultType === 'container_restart' || selectedFaultType === 'container_stop') && (
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Graceful Timeout (seconds)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={timeoutSec}
                  onChange={e => setTimeoutSec(Number(e.target.value))}
                  className="w-full bg-black/40 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200"
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setShowDispatchModal(false)}
              className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isDaemonActive || !targetContainer.trim()}
              className="px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Queueing...</span>
                </>
              ) : !isDaemonActive ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Start 'noir fault listen' to Queue</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-black" />
                  <span>Queue Injection Job</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* DETAIL INSPECTION MODAL */}
      <FaultDetailModal
        record={selectedDetailRecord}
        isOpen={!!selectedDetailRecord}
        onClose={() => setSelectedDetailRecord(null)}
        onPrint={(rec) => {
          setSelectedDetailRecord(null);
          setReportModalConfig({ isOpen: true, mode: 'single', singleRecord: rec });
        }}
      />

      {/* REPORT PRINTING MODAL */}
      <FaultReportModal
        isOpen={reportModalConfig.isOpen}
        onClose={() => setReportModalConfig(prev => ({ ...prev, isOpen: false }))}
        mode={reportModalConfig.mode}
        projectTitle={history[0]?.project_title || 'Chaos Project'}
        projectCode={projectCode || String(projectIdentifier)}
        singleRecord={reportModalConfig.singleRecord}
        allRecords={history}
      />
    </div>
  );
}
