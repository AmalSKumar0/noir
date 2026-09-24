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
  CheckCircle,
  Activity
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
  resilience_score?: number | null;
  resilience_grade?: string | null;
  classification?: string | null;
  recommendations?: string[];
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
  const [probeUrl, setProbeUrl] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [showAdvancedProbe, setShowAdvancedProbe] = useState(false);
  const [rtoTargetSec, setRtoTargetSec] = useState<number>(5.0);
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
    setLiveLogs(prev => [...prev.slice(-300), item]);
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
  }, [checkDaemonStatus]);

  // Fetch Containers (reused from cache/prop if available)
  const fetchContainers = useCallback(async (force = false) => {
    if (!force && containers.length > 0) return;
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
  }, [projectIdentifier, targetContainer, containers.length]);

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

            // 1b. Structured log batch event
            if (data.type === 'injection.log_batch' && Array.isArray(data.logs)) {
              const itemsToAdd: FaultLogItem[] = [];
              data.logs.forEach((l: any) => {
                const item: FaultLogItem = {
                  fault_id: data.injection_id,
                  injection_id: data.injection_id,
                  timestamp: l.timestamp ? new Date(l.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString(),
                  level: l.level || 'INFO',
                  message: l.message || '',
                };
                const key = `${item.id || ''}_${item.timestamp}_${item.message}`;
                if (!logDedupeSetRef.current.has(key)) {
                  logDedupeSetRef.current.add(key);
                  itemsToAdd.push(item);
                }
              });
              if (itemsToAdd.length > 0) {
                setLiveLogs(prev => [...prev.slice(-300), ...itemsToAdd].slice(-300));
              }
            }

            // 2. Structured creation event
            if (data.type === 'injection.created' && data.fault) {
              setHistory(prev => {
                const exists = prev.some(f => f.id === data.fault.id);
                if (exists) {
                  return prev.map(f => f.id === data.fault.id ? { ...f, ...data.fault } : f);
                }
                return [data.fault, ...prev];
              });
            }

            // 3. Structured status event (event-driven: NO REST refetch needed)
            if (data.type === 'injection.status') {
              const faultId = Number(data.injection_id);
              setHistory(prev => prev.map(f => f.id === faultId ? { ...f, status: data.status, ...(data.fault || {}) } : f));
            }

            // 4. Structured completion event (event-driven: NO REST refetch needed)
            if (data.type === 'injection.completed') {
              const faultId = Number(data.injection_id);
              setHistory(prev => prev.map(f => f.id === faultId ? { 
                ...f, 
                status: 'completed', 
                completed_at: data.completed_at || new Date().toISOString(), 
                result: data.result || f.result,
                resilience_score: data.resilience_score ?? f.resilience_score,
                resilience_grade: data.resilience_grade ?? f.resilience_grade,
                ...(data.fault || {}) 
              } : f));
              setStoppingFaultIds(prev => { const s = new Set(prev); s.delete(faultId); return s; });
            }

            // 5. Structured cancellation event (event-driven: NO REST refetch needed)
            if (data.type === 'injection.cancelled') {
              const faultId = Number(data.injection_id);
              setHistory(prev => prev.map(f => f.id === faultId ? { ...f, status: 'cancelled', ...(data.fault || {}) } : f));
              setStoppingFaultIds(prev => { const s = new Set(prev); s.delete(faultId); return s; });
              setCancellingFaultIds(prev => { const s = new Set(prev); s.delete(faultId); return s; });
            }

            // 6. Live daemon status push from backend
            if (data.type === 'daemon.status') {
              setIsDaemonActive(!!data.is_daemon_active);
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

  // Fetch logs once when running fault changes (deduplicated)
  const fetchedLogsFaultIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (runningFault && fetchedLogsFaultIdRef.current !== runningFault.id) {
      fetchedLogsFaultIdRef.current = runningFault.id;
      fetchLogsForFault(runningFault.id);
    }
  }, [runningFault?.id, fetchLogsForFault]);

  // Fallback Polling (quiet) ONLY when disconnected from WebSocket
  useEffect(() => {
    if (wsStatus === 'connected') return;
    if (!runningFault && queuedFaults.length === 0) return;
    const interval = setInterval(() => {
      fetchFaults(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [wsStatus, runningFault, queuedFaults.length, fetchFaults]);

  // Build parameters object
  const buildPayloadParameters = () => {
    let params: Record<string, any> = {};
    switch (selectedFaultType) {
      case 'container_restart':
        params = { timeout: timeoutSec };
        break;
      case 'container_stop':
        params = { duration: durationSec, timeout: timeoutSec };
        break;
      case 'network_delay':
        params = { latency_ms: latencyMs, jitter_ms: jitterMs, duration: durationSec };
        break;
      case 'network_loss':
        params = { loss_percent: lossPercent, duration: durationSec };
        break;
      case 'cpu_stress':
        params = { workers: cpuWorkers, duration: durationSec };
        break;
      case 'memory_stress':
        params = { memory_mb: memoryMb, duration: durationSec };
        break;
      default:
        params = {};
    }
    if (probeUrl.trim()) {
      params.probe_url = probeUrl.trim();
    }
    if (hypothesis.trim()) {
      params.hypothesis = hypothesis.trim();
    }
    if (expectedBehavior.trim()) {
      params.expected_behavior = expectedBehavior.trim();
    }
    if (rtoTargetSec && rtoTargetSec > 0) {
      params.rto_target_seconds = rtoTargetSec;
    }
    return params;
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

    let active = isDaemonActive;
    if (!active) {
      // Immediate fresh check in case the daemon was just started or poll interval hasn't ticked
      try {
        const checkResp = await apiFetch(`/api/project/${projectIdentifier}/stream-status/`);
        if (checkResp.ok) {
          const checkData = await checkResp.json();
          if (checkData.is_daemon_active) {
            setIsDaemonActive(true);
            active = true;
          }
        }
      } catch (err) {
        // ignore
      }
    }

    if (!active) {
      setFormError("Cannot queue fault: The Noir daemon ('noir fault listen') is not running. Please start the listener in your terminal before queuing a fault.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Record<string, any> = {
        fault_type: selectedFaultType,
        target,
        parameters: buildPayloadParameters(),
      };
      if (hypothesis.trim()) {
        payload.hypothesis = hypothesis.trim();
      }
      if (expectedBehavior.trim()) {
        payload.expected_behavior = expectedBehavior.trim();
      }
      if (rtoTargetSec && rtoTargetSec > 0) {
        payload.rto_target_seconds = rtoTargetSec;
      }

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
      
      // Instantly insert into local state as QUEUED (no need to refetch entire list)
      setHistory(prev => [created, ...prev.filter(f => f.id !== created.id)]);
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

            {/* Collective Chaos Audit Report */}
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const isCo = window.location.pathname.startsWith('/company');
                  navigate(isCo ? `/company/projects/${projectIdentifier}/chaos/reports` : `/dashboard/projects/${projectIdentifier}/chaos/reports`);
                }}
                className="px-2.5 py-1.5 rounded bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 hover:text-purple-100 text-xs font-mono font-medium border border-purple-700/50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                title="Open full project Chaos Engineering Audit Report"
              >
                <Activity className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden sm:inline">Chaos Report</span>
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
                  <th className="px-3 py-2">Resilience</th>
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
                    <td className="px-3 py-2 whitespace-nowrap">
                      {(() => {
                        const score = record.resilience_score ?? record.result?.resilience?.score ?? record.result?.resilience_score;
                        const grade = record.resilience_grade ?? record.result?.resilience?.grade ?? record.result?.resilience_grade;
                        if (grade && score !== undefined && score !== null) {
                          const colorClass =
                            grade === 'A' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                            grade === 'B' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                            grade === 'C' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' :
                            'bg-rose-500/10 text-rose-400 border-rose-500/30';
                          return (
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border ${colorClass}`}>
                              <span>Grade {grade}</span>
                              <span className="text-[9px] opacity-75 font-mono">({Math.round(score)}%)</span>
                            </span>
                          );
                        }
                        return <span className="text-zinc-600 text-[10px]">—</span>;
                      })()}
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
                          onClick={() => {
                            const isCo = window.location.pathname.startsWith('/company');
                            navigate(isCo ? `/company/projects/${projectIdentifier}/chaos/reports/${record.id}` : `/dashboard/projects/${projectIdentifier}/chaos/reports/${record.id}`);
                          }}
                          className="px-2 py-0.5 rounded bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 hover:text-purple-100 border border-purple-700/50 text-[11px] transition-colors cursor-pointer flex items-center gap-1 font-mono"
                          title="View full SRE Chaos Audit Report"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Report</span>
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
        maxWidthClass="max-w-4xl"
      >
        <form onSubmit={handleDispatchInjection} className="space-y-3 font-mono">
          {formError && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{formError}</span>
            </div>
          )}

          {/* Compact 1-Line Daemon Status Strip */}
          {isDaemonActive ? (
            <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-medium">Daemon Active: 'noir fault listen' is connected</span>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 uppercase font-bold tracking-wider">
                Ready
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Daemon offline: start <code className="text-white font-bold bg-black/40 px-1 py-0.5 rounded">noir fault listen</code> in your terminal</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy('noir fault listen', 'modal-listen')}
                className="text-amber-200 hover:text-white flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 transition-colors cursor-pointer"
              >
                {copiedCmd === 'modal-listen' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCmd === 'modal-listen' ? 'Copied' : 'Copy Command'}</span>
              </button>
            </div>
          )}

          {/* Two-Column Horizontal Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-1">
            {/* Left Column: Strategy Selection & Target Container */}
            <div className="md:col-span-5 space-y-3">
              {/* Fault Strategy Selector (Compact Grid) */}
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1.5 uppercase tracking-wider font-bold">
                  1. Injection Strategy
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {FAULT_DEFINITIONS.map(f => {
                    const Icon = f.icon;
                    const isSelected = selectedFaultType === f.key;
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setSelectedFaultType(f.key)}
                        className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500 text-white shadow-sm ring-1 ring-amber-500/30'
                            : 'bg-[#090A0F] border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-400' : 'text-zinc-500'}`} />
                          <span className="text-[9px] text-zinc-500 uppercase font-mono">{f.badge}</span>
                        </div>
                        <div className="text-xs font-semibold leading-tight line-clamp-1">{f.label.split(' / ')[0]}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Docker Container */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-zinc-400 uppercase tracking-wider font-bold">
                    2. Target Container
                  </label>
                  {containers.length > 0 && (
                    <span className="text-[10px] text-emerald-400/90 font-mono">
                      {containers.length} active on host
                    </span>
                  )}
                </div>
                {containers.length > 0 ? (
                  <div className="flex gap-2">
                    <select
                      value={targetContainer}
                      onChange={e => setTargetContainer(e.target.value)}
                      className="w-full bg-[#090A0F] border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 font-mono"
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
                      placeholder="Or custom"
                      value={targetContainer}
                      onChange={e => setTargetContainer(e.target.value)}
                      className="w-1/3 bg-[#090A0F] border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder="e.g. dormcare-app, api-server, redis"
                    value={targetContainer}
                    onChange={e => setTargetContainer(e.target.value)}
                    className="w-full bg-[#090A0F] border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 font-mono"
                  />
                )}
              </div>
            </div>

            {/* Right Column: Execution Parameters & Hypothesis */}
            <div className="md:col-span-7 bg-[#0b0c13] border border-zinc-800/80 rounded-xl p-3.5 space-y-3 flex flex-col justify-between">
              {/* Parameters Header */}
              <div className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider flex items-center justify-between">
                <span>3. Parameters & Resilience SLA</span>
                <span className="text-[10px] text-amber-400/90 font-mono font-normal">
                  {selectedFaultType}
                </span>
              </div>

              {/* Duration & Target RTO Side-by-Side */}
              <div className="grid grid-cols-2 gap-3">
                {selectedFaultType !== 'container_restart' ? (
                  <div>
                    <div className="flex justify-between text-xs text-zinc-400 mb-1">
                      <span className="text-[11px] uppercase font-semibold">Duration</span>
                      <span className="text-amber-400 font-bold font-mono">{durationSec}s</span>
                    </div>
                    <input 
                      type="range" 
                      min={2} 
                      max={60} 
                      value={durationSec}
                      onChange={e => setDurationSec(Number(e.target.value))}
                      className="w-full accent-amber-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer" 
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-[11px] text-zinc-400 uppercase font-semibold block mb-1">Timeout</label>
                    <div className="flex items-center gap-1.5 bg-black/50 border border-zinc-800 rounded-lg px-2 py-1">
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={timeoutSec}
                        onChange={e => setTimeoutSec(Number(e.target.value))}
                        className="w-full bg-transparent text-xs text-zinc-200 focus:outline-none font-mono"
                      />
                      <span className="text-[10px] text-zinc-500 font-mono">sec</span>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex justify-between text-xs text-zinc-400 mb-1">
                    <span className="text-[11px] uppercase font-semibold">RTO Target</span>
                    <span className="text-purple-400 font-bold font-mono">{rtoTargetSec}s</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-black/50 border border-zinc-800 rounded-lg px-2 py-1">
                    <input
                      type="number"
                      min={0.5}
                      max={60}
                      step={0.5}
                      value={rtoTargetSec}
                      onChange={e => setRtoTargetSec(Number(e.target.value))}
                      className="w-full bg-transparent text-xs text-zinc-200 focus:outline-none font-mono"
                    />
                    <span className="text-[10px] text-zinc-500 font-mono">max</span>
                  </div>
                </div>
              </div>

              {/* Fault-Specific Intensity Parameter */}
              {selectedFaultType === 'cpu_stress' && (
                <div className="bg-black/40 border border-zinc-800/60 rounded-lg p-2.5">
                  <div className="flex justify-between text-xs text-zinc-300 mb-1">
                    <span className="text-[11px] uppercase tracking-wider font-semibold">CPU Workers</span>
                    <span className="text-amber-400 font-bold font-mono">{cpuWorkers} Core{cpuWorkers > 1 ? 's' : ''}</span>
                  </div>
                  <input 
                    type="range" 
                    min={1} 
                    max={8} 
                    value={cpuWorkers}
                    onChange={e => setCpuWorkers(Number(e.target.value))}
                    className="w-full accent-amber-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer" 
                  />
                </div>
              )}

              {selectedFaultType === 'memory_stress' && (
                <div className="bg-black/40 border border-zinc-800/60 rounded-lg p-2.5">
                  <div className="flex justify-between text-xs text-zinc-300 mb-1">
                    <span className="text-[11px] uppercase tracking-wider font-semibold">Memory Pressure</span>
                    <span className="text-amber-400 font-bold font-mono">{memoryMb} MB</span>
                  </div>
                  <input 
                    type="range" 
                    min={32} 
                    max={1024} 
                    step={32}
                    value={memoryMb}
                    onChange={e => setMemoryMb(Number(e.target.value))}
                    className="w-full accent-amber-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer" 
                  />
                </div>
              )}

              {selectedFaultType === 'network_loss' && (
                <div className="bg-black/40 border border-zinc-800/60 rounded-lg p-2.5">
                  <div className="flex justify-between text-xs text-zinc-300 mb-1">
                    <span className="text-[11px] uppercase tracking-wider font-semibold">Packet Loss</span>
                    <span className="text-amber-400 font-bold font-mono">{lossPercent}%</span>
                  </div>
                  <input 
                    type="range" 
                    min={1} 
                    max={80} 
                    value={lossPercent}
                    onChange={e => setLossPercent(Number(e.target.value))}
                    className="w-full accent-amber-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer" 
                  />
                </div>
              )}

              {selectedFaultType === 'network_delay' && (
                <div className="grid grid-cols-2 gap-2 bg-black/40 border border-zinc-800/60 rounded-lg p-2.5">
                  <div>
                    <label className="text-[10px] text-zinc-400 uppercase font-semibold block mb-1">Latency Delay</label>
                    <div className="flex items-center gap-1 bg-black/50 border border-zinc-800 rounded px-2 py-1">
                      <input
                        type="number"
                        min={10}
                        max={2000}
                        value={latencyMs}
                        onChange={e => setLatencyMs(Number(e.target.value))}
                        className="w-full bg-transparent text-xs text-zinc-200 focus:outline-none font-mono"
                      />
                      <span className="text-[10px] text-zinc-500">ms</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 uppercase font-semibold block mb-1">Jitter</label>
                    <div className="flex items-center gap-1 bg-black/50 border border-zinc-800 rounded px-2 py-1">
                      <input
                        type="number"
                        min={0}
                        max={500}
                        value={jitterMs}
                        onChange={e => setJitterMs(Number(e.target.value))}
                        className="w-full bg-transparent text-xs text-zinc-200 focus:outline-none font-mono"
                      />
                      <span className="text-[10px] text-zinc-500">±ms</span>
                    </div>
                  </div>
                </div>
              )}

              {selectedFaultType === 'container_stop' && (
                <div className="bg-black/40 border border-zinc-800/60 rounded-lg p-2.5 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400 uppercase font-semibold">SIGTERM Graceful Timeout</span>
                  <div className="flex items-center gap-1 bg-black/50 border border-zinc-800 rounded px-2 py-1 w-24">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={timeoutSec}
                      onChange={e => setTimeoutSec(Number(e.target.value))}
                      className="w-full bg-transparent text-xs text-zinc-200 focus:outline-none font-mono text-right"
                    />
                    <span className="text-[10px] text-zinc-500">sec</span>
                  </div>
                </div>
              )}

              {/* Single Resilience Hypothesis Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-zinc-400 uppercase tracking-wider font-bold">
                    Resilience Hypothesis
                  </label>
                  <span className="text-[10px] text-zinc-500 font-mono">Audit Objective</span>
                </div>
                <input
                  type="text"
                  placeholder={
                    selectedFaultType === 'cpu_stress'
                      ? 'e.g. Service maintains >=95% availability under CPU saturation'
                      : selectedFaultType === 'memory_stress'
                      ? 'e.g. Application avoids OOM kill and recovers baseline latency'
                      : selectedFaultType === 'network_delay'
                      ? 'e.g. Application tolerates latency without connection drops'
                      : selectedFaultType === 'network_loss'
                      ? 'e.g. Service handles packet loss with automatic retries'
                      : selectedFaultType === 'container_restart'
                      ? 'e.g. Container restarts cleanly and restores traffic within SLA'
                      : 'e.g. Standby replica assumes traffic or recovers within target RTO'
                  }
                  value={hypothesis}
                  onChange={e => setHypothesis(e.target.value)}
                  className="w-full bg-black/50 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              {/* Collapsible Custom Probe URL */}
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowAdvancedProbe(prev => !prev)}
                  className="text-[10px] text-zinc-500 hover:text-cyan-400 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>{showAdvancedProbe ? '▾' : '▸'} Custom Probe URL (Optional)</span>
                  <span className="text-[9px] text-zinc-600 font-mono">• auto-detected from Docker port</span>
                </button>
                {showAdvancedProbe && (
                  <input
                    type="text"
                    placeholder="e.g. http://localhost:8001/api/health/"
                    value={probeUrl}
                    onChange={e => setProbeUrl(e.target.value)}
                    className="w-full mt-1.5 bg-black/50 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons & Summary Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-zinc-800/80">
            <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono text-[10px]">
                {selectedFaultType}
              </span>
              <span>→</span>
              <span className="font-semibold text-white font-mono">
                {targetContainer.trim() || 'No target selected'}
              </span>
              <span>•</span>
              <span className="text-amber-400 font-mono">{durationSec}s</span>
              <span>•</span>
              <span className="text-purple-400 font-mono">RTO ≤ {rtoTargetSec}s</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !isDaemonActive || !targetContainer.trim()}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Queueing...</span>
                  </>
                ) : !isDaemonActive ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Start Listener to Queue</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-black" />
                    <span>Queue Injection Job</span>
                  </>
                )}
              </button>
            </div>
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
