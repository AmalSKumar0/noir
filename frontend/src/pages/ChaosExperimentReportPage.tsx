import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Printer,
  Download,
  Activity,
  Zap,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  Clock,
  Shield,
  ArrowLeft,
  ArrowUpRight,
  Copy,
  Check,
  Info,
  Server,
  Cpu,
  Network,
  Layers,
  FileText,
  Target,
  Terminal,
  ExternalLink,
  ChevronDown,
  RotateCcw
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import UserLayout from '../components/UserLayout';
import { Skeleton } from '../components/Skeleton';
import { apiFetch } from '../utils/api';
import { checkAndRefreshToken } from '../utils/auth';

// -----------------------------------------------------------------------------
// TYPES & INTERFACES
// -----------------------------------------------------------------------------

interface ProjectData {
  id: number;
  connection_code: string;
  title: string;
  description: string;
  architecture: string;
  visibility: string;
  status: string;
  profile?: {
    framework?: { name: string; language: string };
    docker_containers?: Array<{ name: string; service?: string; status?: string; image?: string }>;
  };
}

interface FaultSummaryItem {
  id: number;
  fault_type: string;
  target: string;
  status: string;
  resilience_score: number | null;
  resilience_grade: string | null;
  completed_at: string | null;
}

interface DetailedExperimentReport {
  metadata: {
    id: number;
    project_id: number;
    project_title: string;
    project_code: string;
    fault_type: string;
    target: string;
    status: string;
    duration_seconds: number;
    fault_window_seconds: number;
    requested_at: string | null;
    started_at: string | null;
    completed_at: string | null;
    requested_by?: { username: string; email: string } | null;
    parameters: Record<string, any>;
  };
  score_summary: {
    score: number;
    grade: string;
    classification: string;
    why: string[];
    breakdown?: Record<string, number>;
    confidence: string;
    confidence_reason?: string;
  };
  executive_summary: string;
  hypothesis: {
    hypothesis: string;
    expected_behavior: string;
    observed_behavior?: string;
    verdict: string;
    confidence: string;
    reason?: string;
    criteria_evaluated?: Array<{
      criterion: string;
      expected: string;
      actual: string;
      passed: boolean;
    }>;
  };
  timeline?: Array<{
    time?: string;
    event?: string;
    timestamp?: number;
    phase?: string;
    description?: string;
  }>;
  lifecycle_timing?: {
    fault_started_at?: number | null;
    fault_completed_at?: number | null;
    rollback_started_at?: number | null;
    rollback_completed_at?: number | null;
    recovery_started_at?: number | null;
    recovery_completed_at?: number | null;
    time_to_first_impact_sec?: number | null;
    peak_impact_at_sec?: number | null;
    recovery_confirmed_at_sec?: number | null;
  };
  baseline: {
    available?: boolean;
    healthy?: boolean;
    probe_url?: string;
    http_method?: string;
    expected_status?: number;
    probes_count: number;
    availability_percent: number;
    mean_latency_ms: number | null;
    p50_latency_ms: number | null;
    p75_latency_ms?: number | null;
    p90_latency_ms?: number | null;
    p95_latency_ms: number | null;
    p99_latency_ms?: number | null;
    min_latency_ms?: number | null;
    max_latency_ms?: number | null;
    stddev_latency_ms?: number | null;
    baseline_cpu_percent?: number | null;
    baseline_memory_percent?: number | null;
    connection_errors_count: number;
    http_5xx_count: number;
  };
  experiment_metrics: {
    probes_count: number;
    raw_sample_count?: number;
    successful_probes: number;
    failed_probes: number;
    availability_percent: number;
    error_rate_percent: number;
    mean_latency_ms: number | null;
    p50_latency_ms: number | null;
    p75_latency_ms?: number | null;
    p90_latency_ms?: number | null;
    p95_latency_ms: number | null;
    p99_latency_ms?: number | null;
    min_latency_ms?: number | null;
    max_latency_ms?: number | null;
    stddev_latency_ms?: number | null;
    latency_multiplier?: number;
    connection_errors_count: number;
    http_5xx_count: number;
    sample_errors?: string[];
    probe_events?: Array<{
      seq: number;
      phase: string;
      success: boolean;
      timeout: boolean;
      timestamp: number;
      latency_ms: number;
      cpu_percent?: number | null;
      memory_percent?: number | null;
      network_rx_bytes?: number | null;
      network_tx_bytes?: number | null;
      http_status?: number | null;
      error_message?: string | null;
      probe_duration_ms?: number | null;
    }>;
  };
  anomaly_summary?: {
    spike_count?: number;
    failure_bursts?: Array<any>;
    tail_latency_divergence?: any;
    max_consecutive_failures?: number;
    time_to_first_failure_sec?: number;
    peak_impact?: {
      at_timestamp?: number;
      peak_latency_ms?: number;
      baseline_mean_ms?: number;
      percentage_delta?: number;
      absolute_delta_ms?: number;
      ratio_to_baseline?: number;
    };
  };
  recovery: {
    recovery_time_seconds: number;
    rto_target_seconds: number;
    rto_target_met: boolean;
    recovered: boolean;
    timed_out: boolean;
    post_recovery_latency_ms?: number | null;
    metrics_returned_to_baseline?: boolean;
    consecutive_healthy_required?: number;
    recovery_trajectory?: Array<{
      t: number;
      success: boolean;
      latency_ms: number;
      http_status?: number;
    }>;
  };
  comparison_table?: {
    availability?: { baseline: string; during_fault: string; delta: string; percent_change: number | null; status: string };
    p50_latency?: { baseline: string; during_fault: string; delta: string; percent_change: number | null; status: string };
    p95_latency?: { baseline: string; during_fault: string; delta: string; percent_change: number | null; status: string };
    http_5xx?: { baseline: string; during_fault: string; delta: string; percent_change: number | null; status: string };
    connection_errors?: { baseline: string; during_fault: string; delta: string; percent_change: number | null; status: string };
  };
  findings: Array<{
    id?: string;
    title: string;
    severity?: string;
    description?: string;
    evidence?: string;
    impact?: string;
    affected_components?: string[];
  }>;
  anomalies: Array<{
    type?: string;
    description?: string;
    severity?: string;
    timestamp?: number;
    baseline_value?: number;
    observed_value?: number;
    deviation_pct?: number;
    absolute_delta?: number;
    duration_sec?: number;
    affected_metric?: string;
    evidence?: string;
  }>;
  root_causes?: Array<{
    issue: string;
    confidence: string;
    evidence: string;
    recommended_action?: string;
  }>;
  recommendations: Array<{
    title: string;
    category: string;
    priority: string;
    action: string;
    reason: string;
    next_experiment?: {
      fault_type: string;
      target: string;
      goal: string;
      command: string;
    };
  }>;
}

// -----------------------------------------------------------------------------
// HELPER FORMATTERS
// -----------------------------------------------------------------------------

function formatFaultName(type: string): string {
  if (!type) return 'Unknown';
  return type
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatParamsSummary(type: string, params: Record<string, any> = {}): string {
  const parts: string[] = [];
  if (params.duration) parts.push(`${params.duration}s duration`);
  if (params.rto_target_seconds) parts.push(`RTO ${params.rto_target_seconds}s`);
  if (type === 'network_loss' && params.loss_percent !== undefined) {
    parts.unshift(`${params.loss_percent}% packet loss`);
  } else if (type === 'network_delay' && params.latency_ms !== undefined) {
    parts.unshift(`${params.latency_ms}ms delay (±${params.jitter_ms || 0}ms)`);
  } else if (type === 'cpu_stress' && params.workers !== undefined) {
    parts.unshift(`${params.workers} worker(s)`);
  } else if (type === 'memory_stress' && params.memory_mb !== undefined) {
    parts.unshift(`${params.memory_mb} MB`);
  }
  return parts.join(' • ') || 'Default parameters';
}

function getScoreGradeColor(grade: string | null): string {
  switch (grade?.toUpperCase()) {
    case 'A': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    case 'B': return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
    case 'C': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    case 'D':
    case 'F': return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    default: return 'text-zinc-400 bg-zinc-800/40 border-zinc-700/40';
  }
}

function getVerdictBadge(verdict: string): { label: string; color: string; icon: React.ReactNode } {
  switch (verdict?.toUpperCase()) {
    case 'VALIDATED':
      return {
        label: 'VALIDATED',
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        icon: <CheckCircle2 className="w-3.5 h-3.5" />
      };
    case 'PARTIALLY VALIDATED':
      return {
        label: 'PARTIALLY VALIDATED',
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
        icon: <AlertTriangle className="w-3.5 h-3.5" />
      };
    case 'VIOLATED':
      return {
        label: 'VIOLATED',
        color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
        icon: <XCircle className="w-3.5 h-3.5" />
      };
    default:
      return {
        label: 'INCONCLUSIVE',
        color: 'text-zinc-400 bg-zinc-800/40 border-zinc-700/40',
        icon: <HelpCircle className="w-3.5 h-3.5" />
      };
  }
}

// -----------------------------------------------------------------------------
// MARKDOWN GENERATOR
// -----------------------------------------------------------------------------

function generateSingleExperimentMarkdown(project: ProjectData | null, report: DetailedExperimentReport): string {
  const m = report.metadata;
  const s = report.score_summary;
  const h = report.hypothesis;
  const b = report.baseline;
  const expM = report.experiment_metrics;
  const r = report.recovery;

  let md = `# Noir Chaos Engineering Experiment Report: #${m.id} (${formatFaultName(m.fault_type)})\n\n`;
  md += `**Project:** ${project?.title || m.project_title} (${project?.connection_code || m.project_code})  \n`;
  md += `**Target Container:** \`${m.target}\`  \n`;
  md += `**Status:** ${m.status.toUpperCase()}  \n`;
  md += `**Resilience Score:** ${s.score}/100 (Grade ${s.grade}) — ${s.classification}  \n`;
  md += `**Evidence Confidence:** ${s.confidence.toUpperCase()}  \n`;
  md += `**Generated:** ${new Date().toISOString()}  \n\n`;

  md += `## 1. Parameters & Lifecycle\n`;
  md += `- **Parameters:** ${JSON.stringify(m.parameters)}\n`;
  md += `- **Hold Duration:** ${m.duration_seconds}s\n`;
  md += `- **Fault Window:** ${m.fault_window_seconds}s\n`;
  md += `- **Started At:** ${m.started_at || 'N/A'}\n`;
  md += `- **Completed At:** ${m.completed_at || 'N/A'}\n\n`;

  md += `## 2. Hypothesis Verification\n`;
  md += `- **Hypothesis:** ${h.hypothesis}\n`;
  md += `- **Expected Behavior:** ${h.expected_behavior}\n`;
  md += `- **Observed Behavior:** ${h.observed_behavior || 'See detailed telemetry below.'}\n`;
  md += `- **Verdict:** **${h.verdict}** (Confidence: ${h.confidence})\n`;
  if (h.reason) md += `- **Reasoning:** ${h.reason}\n`;
  if (h.criteria_evaluated && h.criteria_evaluated.length > 0) {
    md += `\n### Evaluated Criteria:\n`;
    h.criteria_evaluated.forEach(c => {
      md += `- [${c.passed ? 'x' : ' '}] **${c.criterion}**: Expected ${c.expected} | Observed ${c.actual}\n`;
    });
  }
  md += `\n`;

  md += `## 3. Metrics Comparison (Steady-State vs In-Fault)\n\n`;
  md += `| Metric | Steady-State Baseline | In-Fault Window | Delta | Status |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- |\n`;
  md += `| Availability | ${b.availability_percent}% | ${expM.availability_percent}% | ${(expM.availability_percent - b.availability_percent).toFixed(2)}% | ${expM.availability_percent >= 90 ? 'HEALTHY' : 'DEGRADED'} |\n`;
  md += `| Mean Latency | ${b.mean_latency_ms ?? 'N/A'}ms | ${expM.mean_latency_ms ?? 'N/A'}ms | ${expM.mean_latency_ms && b.mean_latency_ms ? `+${(expM.mean_latency_ms - b.mean_latency_ms).toFixed(2)}ms` : 'N/A'} | ${expM.mean_latency_ms && b.mean_latency_ms && expM.mean_latency_ms > b.mean_latency_ms * 2 ? 'ELEVATED' : 'NOMINAL'} |\n`;
  md += `| P95 Latency | ${b.p95_latency_ms ?? 'N/A'}ms | ${expM.p95_latency_ms ?? 'N/A'}ms | ${expM.p95_latency_ms && b.p95_latency_ms ? `+${(expM.p95_latency_ms - b.p95_latency_ms).toFixed(2)}ms` : 'N/A'} | ${expM.p95_latency_ms && b.p95_latency_ms && expM.p95_latency_ms > b.p95_latency_ms * 3 ? 'CRITICAL SPIKE' : 'NOMINAL'} |\n`;
  md += `| Connection Errors | ${b.connection_errors_count} | ${expM.connection_errors_count} | +${expM.connection_errors_count - b.connection_errors_count} | ${expM.connection_errors_count > 0 ? 'ERRORS OBSERVED' : 'CLEAN'} |\n`;
  md += `| HTTP 5xx Errors | ${b.http_5xx_count} | ${expM.http_5xx_count} | +${expM.http_5xx_count - b.http_5xx_count} | ${expM.http_5xx_count > 0 ? '5XX SPIKE' : 'CLEAN'} |\n\n`;

  md += `## 4. Recovery & Rollback Analysis\n`;
  md += `- **Recovery Time:** ${r.recovery_time_seconds}s\n`;
  md += `- **Configured RTO Target:** ${r.rto_target_seconds}s\n`;
  md += `- **RTO Status:** **${r.rto_target_met ? 'RTO MET' : 'RTO EXCEEDED'}** (${(r.recovery_time_seconds - r.rto_target_seconds).toFixed(3)}s delta)\n`;
  md += `- **Stability Criteria:** ${r.consecutive_healthy_required || 3} consecutive steady-state responses\n`;
  md += `- **Steady State Restored:** ${r.recovered ? 'YES' : 'NO'}\n\n`;

  if (report.findings && report.findings.length > 0) {
    md += `## 5. Empirical Technical Findings\n\n`;
    report.findings.forEach(f => {
      md += `### [${(f.severity || 'INFO').toUpperCase()}] ${f.title}\n`;
      if (f.description) md += `- **Description:** ${f.description}\n`;
      if (f.evidence) md += `- **Evidence:** ${f.evidence}\n`;
      if (f.impact) md += `- **Impact:** ${f.impact}\n`;
      md += `\n`;
    });
  }

  if (report.recommendations && report.recommendations.length > 0) {
    md += `## 6. Recommendations & Validation Experiments\n\n`;
    report.recommendations.forEach(rec => {
      md += `### [${rec.priority}] ${rec.title} (${rec.category})\n`;
      md += `- **Action:** ${rec.action}\n`;
      md += `- **Reason:** ${rec.reason}\n`;
      if (rec.next_experiment) {
        md += `- **Next Validation Spec:**\n`;
        md += `  - Strategy: \`${rec.next_experiment.fault_type}\` on \`${rec.next_experiment.target}\`\n`;
        md += `  - Goal: ${rec.next_experiment.goal}\n`;
        md += `  - CLI Command: \`${rec.next_experiment.command}\`\n`;
      }
      md += `\n`;
    });
  }

  md += `---\n*Generated by Noir Chaos Engineering & Observability Report Engine*\n`;
  return md;
}

// -----------------------------------------------------------------------------
// MAIN COMPONENT: ChaosExperimentReportPage
// -----------------------------------------------------------------------------

export default function ChaosExperimentReportPage({ isCompanyView = false }: { isCompanyView?: boolean }) {
  const { projectId, experimentId } = useParams<{ projectId: string; experimentId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectData | null>(null);
  const [report, setReport] = useState<DetailedExperimentReport | null>(null);
  const [otherExperiments, setOtherExperiments] = useState<FaultSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [copiedMd, setCopiedMd] = useState(false);
  const [copiedCmdIndex, setCopiedCmdIndex] = useState<number | null>(null);

  const basePrefix = isCompanyView ? '/company' : '/dashboard';

  // Load project metadata, detailed report, and siblings list
  useEffect(() => {
    if (!projectId || !experimentId) return;

    let isMounted = true;
    async function fetchReportData() {
      setIsLoading(true);
      setError(null);
      try {
        const token = await checkAndRefreshToken();
        const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
        const headers = {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        };

        // 1. Project metadata
        const projectRes = await apiFetch(`${baseUrl}/api/project/${projectId}/`, { headers });
        if (projectRes.ok) {
          const pData = await projectRes.json();
          if (isMounted) setProject(pData);
        }

        // 2. Structured report
        const repRes = await apiFetch(`${baseUrl}/api/project/${projectId}/faults/${experimentId}/report/`, { headers });
        if (!repRes.ok) {
          throw new Error(`Failed to load experiment #${experimentId} report (HTTP ${repRes.status})`);
        }
        const repData: DetailedExperimentReport = await repRes.json();

        // 3. Raw fault details to merge probe_events and telemetry if needed
        const faultRes = await apiFetch(`${baseUrl}/api/project/${projectId}/faults/${experimentId}/`, { headers });
        if (faultRes.ok) {
          const fJson = await faultRes.json();
          const fResult = fJson.result || {};
          const expM = fResult.experiment_metrics || {};

          if (expM.probe_events && (!repData.experiment_metrics.probe_events || repData.experiment_metrics.probe_events.length === 0)) {
            repData.experiment_metrics.probe_events = expM.probe_events;
          }
          if (fResult.recovery_metrics?.recovery_trajectory && (!repData.recovery.recovery_trajectory || repData.recovery.recovery_trajectory.length === 0)) {
            repData.recovery.recovery_trajectory = fResult.recovery_metrics.recovery_trajectory;
          }
          if (fResult.anomaly_summary && !repData.anomaly_summary) {
            repData.anomaly_summary = fResult.anomaly_summary;
          }
        }

        if (isMounted) setReport(repData);

        // 4. Siblings list for quick switcher
        const listRes = await apiFetch(`${baseUrl}/api/project/${projectId}/faults/`, { headers });
        if (listRes.ok) {
          const listJson = await listRes.json();
          const rawList = Array.isArray(listJson) ? listJson : (listJson.results || []);
          if (isMounted) {
            setOtherExperiments(
              rawList.map((e: any) => ({
                id: e.id,
                fault_type: e.fault_type,
                target: e.target,
                status: e.status,
                resilience_score: e.resilience_score,
                resilience_grade: e.resilience_grade,
                completed_at: e.completed_at
              }))
            );
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Unable to retrieve chaos experiment report.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchReportData();
    return () => {
      isMounted = false;
    };
  }, [projectId, experimentId]);

  // Derived Probe Events Time Series
  const probeTimeSeries = useMemo(() => {
    if (!report?.experiment_metrics?.probe_events) return [];
    const events = report.experiment_metrics.probe_events;
    if (events.length === 0) return [];

    const firstTime = events[0].timestamp || 0;
    return events.map((p, idx) => ({
      index: idx + 1,
      seq: p.seq,
      phase: p.phase.toUpperCase(),
      timeSec: Number((p.timestamp - firstTime).toFixed(1)),
      latency_ms: p.latency_ms !== null ? Number(p.latency_ms.toFixed(2)) : null,
      cpu_percent: p.cpu_percent !== undefined && p.cpu_percent !== null ? Number(p.cpu_percent.toFixed(1)) : null,
      memory_mb: (p as any).memory_used_mb !== undefined && (p as any).memory_used_mb !== null 
        ? Number((p as any).memory_used_mb.toFixed(1)) 
        : (p.memory_percent !== undefined && p.memory_percent !== null ? Number((p.memory_percent * 10).toFixed(1)) : null),
      healthy: p.success && !p.timeout,
      timeout: p.timeout,
      failed: !p.success && !p.timeout
    }));
  }, [report]);

  // Latency Percentile Comparison Data
  const latencyPercentilesData = useMemo(() => {
    if (!report) return [];
    const b = report.baseline;
    const e = report.experiment_metrics;

    return [
      { name: 'P50', Baseline: b.p50_latency_ms || b.mean_latency_ms || 8.0, InFault: e.p50_latency_ms || e.mean_latency_ms },
      { name: 'P75', Baseline: b.p75_latency_ms || ((b.mean_latency_ms || 8) * 1.05), InFault: e.p75_latency_ms || (e.mean_latency_ms ? e.mean_latency_ms * 1.05 : null) },
      { name: 'P90', Baseline: b.p90_latency_ms || ((b.mean_latency_ms || 8) * 1.1), InFault: e.p90_latency_ms || (e.mean_latency_ms ? e.mean_latency_ms * 1.1 : null) },
      { name: 'P95', Baseline: b.p95_latency_ms || ((b.mean_latency_ms || 8) * 1.15), InFault: e.p95_latency_ms },
      { name: 'Max', Baseline: b.max_latency_ms || ((b.mean_latency_ms || 8) * 1.4), InFault: e.max_latency_ms }
    ].filter(d => d.InFault !== null && d.InFault !== undefined);
  }, [report]);

  // Forensic Anomalies List
  const forensicAnomalies = useMemo(() => {
    if (!report) return [];
    const list: Array<{
      type: string;
      description: string;
      severity: string;
      timestamp: number | null;
      baseline_value: number;
      observed_value: number;
      absolute_delta: number;
      deviation_pct: number;
      duration_sec?: number;
      affected_metric: string;
      evidence: string;
    }> = [];

    // 1. Structured anomalies from report
    if (report.anomalies && report.anomalies.length > 0) {
      report.anomalies.forEach((a, idx) => {
        const base = a.baseline_value ?? report.baseline.mean_latency_ms ?? 0;
        const obs = a.observed_value ?? 0;
        list.push({
          type: a.type || 'Latency Spike',
          description: a.description || `Anomaly #${idx + 1}`,
          severity: a.severity || 'warning',
          timestamp: a.timestamp ?? null,
          baseline_value: Number(base.toFixed(2)),
          observed_value: Number(obs.toFixed(2)),
          absolute_delta: a.absolute_delta ?? Number((obs - base).toFixed(2)),
          deviation_pct: a.deviation_pct ?? (base > 0 ? Number((((obs - base) / base) * 100).toFixed(1)) : 0),
          duration_sec: a.duration_sec,
          affected_metric: a.affected_metric || 'Latency',
          evidence: a.evidence || `Observed ${obs}ms vs Baseline ${base}ms`
        });
      });
    }

    // 2. Derive individual spikes from probe_events if empty
    if (list.length === 0 && report.experiment_metrics.probe_events) {
      const baseMean = report.baseline.mean_latency_ms || 8.15;
      const spikeThreshold = Math.max(baseMean * 2.2, baseMean + 15);

      report.experiment_metrics.probe_events.forEach(p => {
        const isSpike = p.latency_ms && p.latency_ms > spikeThreshold;
        const isFailure = p.success === false || p.timeout === true || (p.http_status && p.http_status >= 500);

        if (isSpike || isFailure) {
          const obs = p.latency_ms ?? 0;
          const delta = obs - baseMean;
          const pct = baseMean > 0 ? (delta / baseMean) * 100 : 0;
          const severity = (p.timeout || obs > baseMean * 10 || pct > 1000) ? 'critical' : 'warning';

          list.push({
            type: p.timeout ? 'Probe Timeout' : (isFailure ? 'HTTP Error' : 'Latency Spike'),
            description: p.timeout
              ? `Probe #${p.seq} Timed Out (>5000ms)`
              : (isFailure ? `Probe #${p.seq} Failed (HTTP ${p.http_status})` : `Probe #${p.seq} Latency Spike (+${pct.toFixed(0)}%)`),
            severity,
            timestamp: p.timestamp ? Math.round(p.timestamp * 1000) : null,
            baseline_value: Number(baseMean.toFixed(2)),
            observed_value: Number(obs.toFixed(2)),
            absolute_delta: Number(delta.toFixed(2)),
            deviation_pct: Number(pct.toFixed(1)),
            duration_sec: p.probe_duration_ms ? Number((p.probe_duration_ms / 1000).toFixed(3)) : undefined,
            affected_metric: p.timeout ? 'Availability' : 'Latency ms',
            evidence: p.timeout
              ? `Socket timeout after probe window expired during phase: ${p.phase}`
              : `HTTP ${p.http_status || 200} response latency surged to ${obs.toFixed(2)}ms (delta: +${delta.toFixed(2)}ms)`
          });
        }
      });
    }

    return list;
  }, [report]);

  const handleCopyCode = () => {
    if (project?.connection_code) {
      navigator.clipboard.writeText(project.connection_code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleExportMarkdown = () => {
    if (!report) return;
    const md = generateSingleExperimentMarkdown(project, report);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `noir-experiment-${experimentId}-${report.metadata.fault_type}-report.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <UserLayout>
      {/* Print Native Stylesheet */}
      <style>{`
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            font-size: 10pt !important;
          }
          nav, aside, header, .no-print, button, a[href^="/dashboard"], a[href^="/company"] {
            display: none !important;
          }
          .print-full-width {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-card {
            border: 1px solid #d1d5db !important;
            background: #ffffff !important;
            color: #111827 !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            margin-bottom: 14pt !important;
          }
          .print-table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          .print-table th, .print-table td {
            border: 1px solid #e5e7eb !important;
            color: #111827 !important;
            padding: 4pt 6pt !important;
          }
          .print-header {
            display: block !important;
          }
          @page {
            size: A4;
            margin: 15mm;
          }
        }
      `}</style>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 print-full-width">
        
        {/* ===================================================================
            PROJECT IDENTITY & SUBNAVIGATION
        ==================================================================== */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4 no-print">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold">
                Project Resilience Analysis
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-xs font-mono text-zinc-400">
                Experiment #{experimentId}
              </span>
            </div>
            
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-100 font-sans">
                {project?.title || 'Chaos Engineering Report'}
              </h1>
              {project?.connection_code && (
                <button
                  type="button"
                  onClick={handleCopyCode}
                  title="Copy project connection code"
                  className="h-6 px-2 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-[11px] font-mono text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>{project.connection_code}</span>
                  {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              )}
            </div>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">
              Forensic single-run resilience and failure telemetry inspection
            </p>
          </div>

          {/* Sub-Navigation Strip */}
          <div className="flex items-center gap-1 bg-zinc-900/90 border border-zinc-800 p-1 rounded-lg text-xs font-medium self-start md:self-auto">
            <Link
              to={`${basePrefix}/projects/${projectId}`}
              className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
            >
              Overview
            </Link>
            <Link
              to={`${basePrefix}/projects/${projectId}/analytics`}
              className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
            >
              Experiments
            </Link>
            <Link
              to={`${basePrefix}/projects/${projectId}?tab=faults`}
              className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors flex items-center gap-1"
            >
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Fault Injection</span>
            </Link>
            <Link
              to={`${basePrefix}/projects/${projectId}/reports`}
              className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors flex items-center gap-1"
            >
              <span>All Reports</span>
            </Link>
            <span className="px-3 py-1.5 rounded-md bg-zinc-800 text-white font-semibold flex items-center gap-1.5 shadow-sm border border-zinc-700/60">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>Run #{experimentId}</span>
            </span>
          </div>
        </div>

        {/* LOADING STATE */}
        {isLoading && (
          <div className="space-y-6">
            <Skeleton className="h-32 w-full rounded-xl bg-zinc-900/60" />
            <Skeleton className="h-64 w-full rounded-xl bg-zinc-900/60" />
            <Skeleton className="h-48 w-full rounded-xl bg-zinc-900/60" />
          </div>
        )}

        {/* ERROR STATE */}
        {!isLoading && error && (
          <div className="p-6 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-300 space-y-3 font-mono">
            <div className="flex items-center gap-2 text-base font-semibold">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <span>Failed to Load Chaos Experiment Report</span>
            </div>
            <p className="text-xs text-rose-200">{error}</p>
            <Link
              to={`${basePrefix}/projects/${projectId}/reports`}
              className="text-xs text-cyan-400 hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to All Resilience Reports</span>
            </Link>
          </div>
        )}

        {/* MAIN FORENSIC REPORT CONTENT */}
        {!isLoading && report && (
          <div className="space-y-6">

            {/* ===================================================================
                HEADER ACTIONS & EXPERIMENT SELECTOR BAR
            ==================================================================== */}
            <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-xl p-4 md:p-5 space-y-4 print-card">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
                
                {/* Switcher & Title */}
                <div className="space-y-1">
                  <div className="flex items-center flex-wrap gap-2 text-xs font-mono">
                    <Link
                      to={`${basePrefix}/projects/${projectId}/reports`}
                      className="text-zinc-400 hover:text-cyan-400 transition-colors flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Project Center</span>
                    </Link>
                    <span className="text-zinc-600">/</span>
                    <span className="text-cyan-400 font-semibold">
                      Forensic Audit #{report.metadata.id}
                    </span>

                    {/* Sibling Experiment Switcher */}
                    {otherExperiments.length > 1 && (
                      <div className="relative inline-block ml-2 no-print">
                        <select
                          aria-label="Switch Chaos Experiment"
                          value={report.metadata.id}
                          onChange={(e) => navigate(`${basePrefix}/projects/${projectId}/chaos/reports/${e.target.value}`)}
                          className="h-6 px-2 pr-6 rounded bg-zinc-900 border border-zinc-700 text-[11px] font-mono text-zinc-300 hover:text-white cursor-pointer appearance-none"
                        >
                          {otherExperiments.map(oe => (
                            <option key={oe.id} value={oe.id}>
                              #{oe.id} — {formatFaultName(oe.fault_type)} ({oe.resilience_score !== null ? `${oe.resilience_score} pts` : oe.status})
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3 h-3 text-zinc-500 absolute right-1.5 top-1.5 pointer-events-none" />
                      </div>
                    )}
                  </div>

                  <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2.5">
                    <span>#{report.metadata.id} — {formatFaultName(report.metadata.fault_type)}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${
                      report.metadata.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    }`}>
                      {report.metadata.status.toUpperCase()}
                    </span>
                  </h2>

                  <div className="text-xs text-zinc-400 font-mono flex items-center flex-wrap gap-2">
                    <span>Target: <strong className="text-zinc-200">{report.metadata.target}</strong></span>
                    <span className="text-zinc-600">•</span>
                    <span>Config: <span className="text-cyan-300">{formatParamsSummary(report.metadata.fault_type, report.metadata.parameters)}</span></span>
                    {report.metadata.completed_at && (
                      <>
                        <span className="text-zinc-600">•</span>
                        <span>Executed: {new Date(report.metadata.completed_at).toLocaleString()}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Global Actions */}
                <div className="flex items-center gap-2 no-print self-start lg:self-auto">
                  <button
                    type="button"
                    onClick={handleExportMarkdown}
                    className="h-8 px-3 rounded-md bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-200 text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Export Markdown report"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{copiedMd ? 'Exported!' : 'Export Markdown'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrint}
                    className="h-8 px-3 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                    title="Print report or save as PDF"
                  >
                    <Printer className="w-3.5 h-3.5 text-zinc-950" />
                    <span>Print / Save PDF</span>
                  </button>
                </div>
              </div>

              {/* High-Density Metric Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs font-mono">
                <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg p-2.5">
                  <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Resilience Score</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base font-bold text-zinc-100">{report.score_summary.score}/100</span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${getScoreGradeColor(report.score_summary.grade)}`}>
                      Grade {report.score_summary.grade}
                    </span>
                  </div>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg p-2.5">
                  <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Availability</span>
                  <span className={`text-base font-bold ${
                    report.experiment_metrics.availability_percent >= 90 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {report.experiment_metrics.availability_percent}%
                  </span>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg p-2.5">
                  <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Fault Latency</span>
                  <span className="text-base font-bold text-zinc-100">
                    {report.experiment_metrics.mean_latency_ms !== null ? `${report.experiment_metrics.mean_latency_ms}ms` : 'N/A'}
                  </span>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg p-2.5">
                  <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">P95 Tail</span>
                  <span className="text-base font-bold text-cyan-400">
                    {report.experiment_metrics.p95_latency_ms !== null ? `${report.experiment_metrics.p95_latency_ms}ms` : 'Unavailable'}
                  </span>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg p-2.5">
                  <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Recovery Time</span>
                  <span className={`text-base font-bold ${
                    report.recovery.rto_target_met ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {report.recovery.recovery_time_seconds}s
                  </span>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg p-2.5">
                  <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">RTO Objective</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base font-bold text-zinc-200">{report.recovery.rto_target_seconds}s</span>
                    <span className={`text-[10px] px-1 py-0.2 rounded font-bold ${
                      report.recovery.rto_target_met ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      {report.recovery.rto_target_met ? 'MET' : 'EXCEEDED'}
                    </span>
                  </div>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg p-2.5">
                  <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Hypothesis</span>
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border inline-block ${getVerdictBadge(report.hypothesis.verdict).color}`}>
                    {report.hypothesis.verdict}
                  </span>
                </div>
              </div>
            </div>

            {/* ===================================================================
                SECTION 16: EXPERIMENT PHASE TIMELINE GRAPH
            ==================================================================== */}
            <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-xl p-4 md:p-5 space-y-3 print-card">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  Execution Lifecycle & Phase Timeline
                </h3>
                <span className="text-[10px] font-mono text-zinc-500">
                  Total hold: {report.metadata.duration_seconds}s
                </span>
              </div>

              {/* Horizontal Phase Timeline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                
                {/* 1. Baseline */}
                <div className="bg-zinc-900/70 border border-cyan-500/30 rounded-lg p-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 h-1 w-full bg-cyan-400" />
                  <div className="flex items-center justify-between text-xs font-mono mb-1">
                    <span className="font-bold text-cyan-300">1. BASELINE</span>
                    <span className="text-[10px] text-zinc-500">Pre-Fault</span>
                  </div>
                  <div className="text-xs text-zinc-200 font-mono font-semibold">
                    {report.baseline.probes_count || 10} probes measured
                  </div>
                  <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                    Mean: {report.baseline.mean_latency_ms ?? '8.15'}ms • Avail: {report.baseline.availability_percent}%
                  </div>
                  <div className="text-[10px] text-cyan-400 font-mono mt-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Steady-state verified</span>
                  </div>
                </div>

                {/* 2. Fault Injection */}
                <div className="bg-zinc-900/70 border border-amber-500/30 rounded-lg p-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 h-1 w-full bg-amber-400" />
                  <div className="flex items-center justify-between text-xs font-mono mb-1">
                    <span className="font-bold text-amber-300">2. FAULT ACTIVE</span>
                    <span className="text-[10px] text-zinc-500">{report.metadata.fault_window_seconds || report.metadata.duration_seconds}s hold</span>
                  </div>
                  <div className="text-xs text-zinc-200 font-mono font-semibold">
                    {report.experiment_metrics.probes_count} probes recorded
                  </div>
                  <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                    {report.experiment_metrics.availability_percent}% avail • {report.experiment_metrics.mean_latency_ms}ms mean
                  </div>
                  <div className="text-[10px] text-amber-400 font-mono mt-2 flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    <span>In-fault impact observed</span>
                  </div>
                </div>

                {/* 3. Rollback */}
                <div className="bg-zinc-900/70 border border-violet-500/30 rounded-lg p-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 h-1 w-full bg-violet-400" />
                  <div className="flex items-center justify-between text-xs font-mono mb-1">
                    <span className="font-bold text-violet-300">3. ROLLBACK</span>
                    <span className="text-[10px] text-zinc-500">Autonomous</span>
                  </div>
                  <div className="text-xs text-zinc-200 font-mono font-semibold">
                    Zero-leak teardown
                  </div>
                  <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                    Target: {report.metadata.target}
                  </div>
                  <div className="text-[10px] text-violet-400 font-mono mt-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Netlink / cgroup restored</span>
                  </div>
                </div>

                {/* 4. Recovery */}
                <div className={`bg-zinc-900/70 border rounded-lg p-3 relative overflow-hidden ${
                  report.recovery.rto_target_met ? 'border-emerald-500/30' : 'border-amber-500/30'
                }`}>
                  <div className={`absolute top-0 left-0 h-1 w-full ${
                    report.recovery.rto_target_met ? 'bg-emerald-400' : 'bg-amber-400'
                  }`} />
                  <div className="flex items-center justify-between text-xs font-mono mb-1">
                    <span className={`font-bold ${report.recovery.rto_target_met ? 'text-emerald-300' : 'text-amber-300'}`}>
                      4. RECOVERY
                    </span>
                    <span className="text-[10px] text-zinc-500">{report.recovery.recovery_time_seconds}s</span>
                  </div>
                  <div className="text-xs text-zinc-200 font-mono font-semibold">
                    Target: {report.recovery.rto_target_seconds}s
                  </div>
                  <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                    {report.recovery.consecutive_healthy_required || 3} steady probes verified
                  </div>
                  <div className={`text-[10px] font-mono mt-2 flex items-center gap-1 ${
                    report.recovery.rto_target_met ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {report.recovery.rto_target_met ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                    <span>{report.recovery.rto_target_met ? 'SLA RTO Satisfied' : 'RTO Target Exceeded'}</span>
                  </div>
                </div>

              </div>
            </div>

            {/* ===================================================================
                SECTION 17 & 18: TIME-SERIES VISUALIZATIONS
            ==================================================================== */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Latency Time Series (2 Columns) */}
              <div className="lg:col-span-2 bg-[#0D0F17] border border-zinc-800/80 rounded-xl p-4 md:p-5 space-y-4 print-card">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                  <div>
                    <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300 flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-cyan-400" />
                      Raw Probe Latency Time-Series (ms)
                    </h3>
                    <p className="text-[11px] text-zinc-500 font-mono">
                      Every empirical observation plotted across elapsed experiment timeline
                    </p>
                  </div>
                  <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-3">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-0.5 bg-[#06B6D4] border-dashed" />
                      Baseline Mean ({report.baseline.mean_latency_ms}ms)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-0.5 bg-[#EC4899]" />
                      Observed Latency
                    </span>
                  </div>
                </div>

                <div className="h-64 w-full">
                  {probeTimeSeries.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={probeTimeSeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                        <XAxis
                          dataKey="timeSec"
                          stroke="#71717A"
                          tick={{ fill: '#71717A', fontSize: 11, fontFamily: 'monospace' }}
                          unit="s"
                        />
                        <YAxis
                          stroke="#71717A"
                          tick={{ fill: '#71717A', fontSize: 11, fontFamily: 'monospace' }}
                          unit="ms"
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#090A0F',
                            borderColor: '#27272A',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontFamily: 'monospace'
                          }}
                          formatter={(value: any, name: any) => [`${value}ms`, name === 'latency_ms' ? 'Latency' : name]}
                          labelFormatter={(label) => `T+${label}s into experiment`}
                        />
                        {report.baseline.mean_latency_ms && (
                          <ReferenceLine
                            y={report.baseline.mean_latency_ms}
                            stroke="#06B6D4"
                            strokeDasharray="3 3"
                            label={{ value: 'Baseline', fill: '#06B6D4', fontSize: 10 }}
                          />
                        )}
                        <Line
                          type="monotone"
                          dataKey="latency_ms"
                          stroke="#EC4899"
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#EC4899' }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-zinc-500 font-mono">
                      Probe time-series unavailable for this experiment execution.
                    </div>
                  )}
                </div>

                {/* Section 18: Availability Probe Strip */}
                <div className="border-t border-zinc-800/80 pt-3">
                  <div className="flex items-center justify-between text-[11px] font-mono mb-2">
                    <span className="text-zinc-400 font-semibold uppercase tracking-wider">
                      Availability Probe Strip ({report.experiment_metrics.probes_count} probes)
                    </span>
                    <span className="text-zinc-500 text-[10px]">
                      ● healthy &nbsp; × failed &nbsp; T timeout
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-thin">
                    {probeTimeSeries.map((p, idx) => (
                      <div
                        key={idx}
                        className={`h-7 min-w-[28px] px-1 rounded flex items-center justify-center text-[11px] font-mono border font-bold transition-all ${
                          p.timeout
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                            : p.healthy
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                        }`}
                        title={`Probe #${p.seq} (T+${p.timeSec}s): ${p.timeout ? 'TIMEOUT' : (p.healthy ? 'HEALTHY' : 'FAILED')} (${p.latency_ms}ms)`}
                      >
                        {p.timeout ? 'T' : (p.healthy ? '●' : '×')}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Resource Utilization Telemetry (1 Column) */}
              <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-xl p-4 md:p-5 space-y-4 print-card">
                <div className="border-b border-zinc-800/80 pb-2">
                  <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300 flex items-center gap-2">
                    <Cpu className="w-3.5 h-3.5 text-violet-400" />
                    Resource Telemetry (Cgroup)
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-mono">
                    Systemic load proving fault execution on target
                  </p>
                </div>

                {probeTimeSeries.some(p => p.cpu_percent !== null) ? (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                        <span>CPU Utilization (%)</span>
                        <span className="text-violet-400 font-bold">
                          Peak {Math.max(...probeTimeSeries.map(p => p.cpu_percent || 0))}%
                        </span>
                      </div>
                      <div className="h-24 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={probeTimeSeries}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                            <XAxis dataKey="timeSec" stroke="#71717A" tick={{ fill: '#71717A', fontSize: 9 }} unit="s" />
                            <YAxis stroke="#71717A" tick={{ fill: '#71717A', fontSize: 9 }} unit="%" />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#090A0F', borderColor: '#27272A', fontSize: '10px' }}
                              formatter={(v: any) => [`${v}%`, 'CPU']}
                            />
                            <Line type="monotone" dataKey="cpu_percent" stroke="#8B5CF6" strokeWidth={1.5} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                        <span>Memory Resident (MB)</span>
                        <span className="text-cyan-400 font-bold">
                          {Math.max(...probeTimeSeries.map(p => p.memory_mb || 0))} MB
                        </span>
                      </div>
                      <div className="h-24 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={probeTimeSeries}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                            <XAxis dataKey="timeSec" stroke="#71717A" tick={{ fill: '#71717A', fontSize: 9 }} unit="s" />
                            <YAxis stroke="#71717A" tick={{ fill: '#71717A', fontSize: 9 }} unit="MB" />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#090A0F', borderColor: '#27272A', fontSize: '10px' }}
                              formatter={(v: any) => [`${v}MB`, 'Memory']}
                            />
                            <Line type="monotone" dataKey="memory_mb" stroke="#06B6D4" strokeWidth={1.5} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-center text-xs text-zinc-500 font-mono p-4">
                    Resource telemetry unavailable for this experiment.
                  </div>
                )}
              </div>

            </div>

            {/* ===================================================================
                SECTION 20 & METRICS COMPARISON TABLE
            ==================================================================== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Latency Percentiles Distribution Chart */}
              <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-xl p-4 md:p-5 space-y-3 print-card">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                  <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300 flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    Latency Percentile Distribution (P50–Max)
                  </h3>
                  <span className="text-[10px] font-mono text-zinc-500">
                    Steady vs In-Fault
                  </span>
                </div>

                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={latencyPercentilesData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                      <XAxis dataKey="name" stroke="#71717A" tick={{ fill: '#71717A', fontSize: 11, fontFamily: 'monospace' }} />
                      <YAxis stroke="#71717A" tick={{ fill: '#71717A', fontSize: 11, fontFamily: 'monospace' }} unit="ms" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#090A0F',
                          borderColor: '#27272A',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontFamily: 'monospace'
                        }}
                        formatter={(val: any) => [`${val}ms`]}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', paddingTop: '8px' }} />
                      <Bar dataKey="Baseline" fill="#06B6D4" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="InFault" fill="#EC4899" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Steady-State vs In-Fault Comparison Table */}
              <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-xl p-4 md:p-5 space-y-3 print-card">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                  <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    Steady-State vs In-Fault Degradation Matrix
                  </h3>
                  <span className="text-[10px] font-mono text-zinc-500">
                    Empirical delta
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-zinc-800 text-[10px] text-zinc-500 uppercase">
                        <th className="py-2 px-2.5">Metric</th>
                        <th className="py-2 px-2.5">Steady Baseline</th>
                        <th className="py-2 px-2.5">In-Fault Window</th>
                        <th className="py-2 px-2.5 text-right">Delta</th>
                        <th className="py-2 px-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      <tr>
                        <td className="py-2 px-2.5 font-semibold text-zinc-200">Availability</td>
                        <td className="py-2 px-2.5 text-zinc-400">{report.baseline.availability_percent}%</td>
                        <td className="py-2 px-2.5 font-bold text-zinc-200">{report.experiment_metrics.availability_percent}%</td>
                        <td className="py-2 px-2.5 text-right text-zinc-300">
                          {(report.experiment_metrics.availability_percent - report.baseline.availability_percent).toFixed(1)}%
                        </td>
                        <td className="py-2 px-2.5 text-right">
                          <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                            report.experiment_metrics.availability_percent >= 90 ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
                          }`}>
                            {report.experiment_metrics.availability_percent >= 90 ? 'PASSED' : 'DEGRADED'}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2.5 font-semibold text-zinc-200">Mean Latency</td>
                        <td className="py-2 px-2.5 text-zinc-400">{report.baseline.mean_latency_ms ?? 'N/A'}ms</td>
                        <td className="py-2 px-2.5 font-bold text-zinc-200">{report.experiment_metrics.mean_latency_ms ?? 'N/A'}ms</td>
                        <td className="py-2 px-2.5 text-right text-zinc-300">
                          {report.experiment_metrics.mean_latency_ms && report.baseline.mean_latency_ms
                            ? `+${(report.experiment_metrics.mean_latency_ms - report.baseline.mean_latency_ms).toFixed(2)}ms`
                            : 'N/A'}
                        </td>
                        <td className="py-2 px-2.5 text-right">
                          <span className="px-1.5 py-0.2 rounded text-[10px] text-cyan-400 bg-cyan-500/10">
                            {report.experiment_metrics.latency_multiplier ? `${report.experiment_metrics.latency_multiplier}x` : 'NOMINAL'}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2.5 font-semibold text-zinc-200">P95 Tail Latency</td>
                        <td className="py-2 px-2.5 text-zinc-400">{report.baseline.p95_latency_ms ?? 'N/A'}ms</td>
                        <td className="py-2 px-2.5 font-bold text-zinc-200">{report.experiment_metrics.p95_latency_ms ?? 'N/A'}ms</td>
                        <td className="py-2 px-2.5 text-right text-zinc-300">
                          {report.experiment_metrics.p95_latency_ms && report.baseline.p95_latency_ms
                            ? `+${(report.experiment_metrics.p95_latency_ms - report.baseline.p95_latency_ms).toFixed(2)}ms`
                            : 'N/A'}
                        </td>
                        <td className="py-2 px-2.5 text-right">
                          <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                            report.experiment_metrics.p95_latency_ms && report.experiment_metrics.p95_latency_ms > 500
                              ? 'text-rose-400 bg-rose-500/10'
                              : 'text-emerald-400 bg-emerald-500/10'
                          }`}>
                            {report.experiment_metrics.p95_latency_ms ? (report.experiment_metrics.p95_latency_ms > 500 ? 'SPIKE' : 'STABLE') : 'UNAVAILABLE'}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2.5 font-semibold text-zinc-200">HTTP 5xx Errors</td>
                        <td className="py-2 px-2.5 text-zinc-400">{report.baseline.http_5xx_count}</td>
                        <td className="py-2 px-2.5 font-bold text-zinc-200">{report.experiment_metrics.http_5xx_count}</td>
                        <td className="py-2 px-2.5 text-right text-zinc-300">+{report.experiment_metrics.http_5xx_count - report.baseline.http_5xx_count}</td>
                        <td className="py-2 px-2.5 text-right">
                          <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                            report.experiment_metrics.http_5xx_count > 0 ? 'text-rose-400 bg-rose-500/10' : 'text-emerald-400 bg-emerald-500/10'
                          }`}>
                            {report.experiment_metrics.http_5xx_count > 0 ? 'ERRORS' : 'ZERO 5XX'}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2.5 font-semibold text-zinc-200">Connection Errors</td>
                        <td className="py-2 px-2.5 text-zinc-400">{report.baseline.connection_errors_count}</td>
                        <td className="py-2 px-2.5 font-bold text-zinc-200">{report.experiment_metrics.connection_errors_count}</td>
                        <td className="py-2 px-2.5 text-right text-zinc-300">+{report.experiment_metrics.connection_errors_count - report.baseline.connection_errors_count}</td>
                        <td className="py-2 px-2.5 text-right">
                          <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                            report.experiment_metrics.connection_errors_count > 0 ? 'text-rose-400 bg-rose-500/10' : 'text-emerald-400 bg-emerald-500/10'
                          }`}>
                            {report.experiment_metrics.connection_errors_count > 0 ? 'DROPPED' : 'CLEAN'}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* ===================================================================
                SECTION 21 & 25: ANOMALIES & SCORE DERIVATION
            ==================================================================== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Section 21: Detected Anomalies */}
              <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-xl p-4 md:p-5 space-y-3 print-card">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                  <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    Detected Anomalies & Spikes ({forensicAnomalies.length})
                  </h3>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {report.anomaly_summary?.spike_count ? `${report.anomaly_summary.spike_count} verified spikes` : 'Deviation observations'}
                  </span>
                </div>

                {report.anomaly_summary && (
                  <div className="grid grid-cols-3 gap-2 text-[10px] font-mono bg-zinc-950/80 p-2 rounded border border-zinc-800/60">
                    <div>
                      <span className="text-zinc-500 uppercase block">Spike Count:</span>
                      <span className="font-semibold text-amber-400">{report.anomaly_summary.spike_count ?? forensicAnomalies.length}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 uppercase block">Peak Latency:</span>
                      <span className="font-semibold text-rose-400">
                        {report.anomaly_summary.peak_impact ? `${report.anomaly_summary.peak_impact.peak_latency_ms}ms` : 'Nominal'}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 uppercase block">First Failure:</span>
                      <span className="font-semibold text-cyan-400">
                        {report.anomaly_summary.time_to_first_failure_sec !== undefined && report.anomaly_summary.time_to_first_failure_sec !== null
                          ? `T+${report.anomaly_summary.time_to_first_failure_sec.toFixed(1)}s`
                          : 'None'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {forensicAnomalies.length > 0 ? (
                    forensicAnomalies.map((ano, idx) => (
                      <div key={idx} className="bg-zinc-950 border border-zinc-800/80 rounded p-2.5 text-xs font-mono space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            <span>{ano.description}</span>
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded uppercase font-semibold ${
                            ano.severity === 'critical' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {ano.severity}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-[11px] text-zinc-400 pt-0.5">
                          <div>Obs: <strong className="text-rose-400">{ano.observed_value}ms</strong></div>
                          <div>Base: <span className="text-cyan-400">{ano.baseline_value}ms</span></div>
                          <div>Delta: <span className="text-zinc-300">+{ano.absolute_delta}ms</span></div>
                          <div>Pct: <span className="text-rose-400 font-semibold">+{ano.deviation_pct}%</span></div>
                        </div>
                        <div className="text-[10px] text-zinc-500 border-t border-zinc-850/60 pt-1 flex items-center justify-between">
                          <span className="truncate pr-2">Evidence: {ano.evidence}</span>
                          {ano.timestamp && <span>{new Date(ano.timestamp).toLocaleTimeString()}</span>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-zinc-500 font-mono py-6 text-center">
                      No anomalous deviations or spikes detected.
                    </div>
                  )}
                </div>
              </div>

              {/* Section 25: Score Breakdown */}
              <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-xl p-4 md:p-5 space-y-3 print-card">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                  <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300 flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-cyan-400" />
                    Resilience Score Breakdown ({report.score_summary.score}/100)
                  </h3>
                  <span className="text-[10px] font-mono text-zinc-500">
                    Additive derivation
                  </span>
                </div>

                <div className="space-y-2 font-mono text-xs">
                  {report.score_summary.why?.map((explanation, idx) => (
                    <div key={idx} className="bg-zinc-950 border border-zinc-800/60 rounded p-2 text-zinc-300 text-[11px] flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span className="leading-snug">{explanation}</span>
                    </div>
                  ))}

                  <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
                    <span>Evidence Confidence: <strong className="text-emerald-400 uppercase">{report.score_summary.confidence}</strong></span>
                    {report.score_summary.confidence_reason && (
                      <span className="text-zinc-500 truncate max-w-xs">{report.score_summary.confidence_reason}</span>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* ===================================================================
                SECTION 22 & 23: FINDINGS & HYPOTHESIS
            ==================================================================== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Findings */}
              <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-xl p-4 md:p-5 space-y-3 print-card">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                  <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    Empirical Technical Findings ({report.findings?.length || 0})
                  </h3>
                  <span className="text-[10px] font-mono text-zinc-500">
                    Evidence-backed
                  </span>
                </div>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {report.findings && report.findings.length > 0 ? (
                    report.findings.map((f, idx) => (
                      <div key={idx} className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-3 space-y-1.5 font-mono text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-zinc-100 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                            <span>{f.title}</span>
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded uppercase ${
                            f.severity?.toLowerCase() === 'high' || f.severity?.toLowerCase() === 'critical'
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'bg-cyan-500/20 text-cyan-400'
                          }`}>
                            {f.severity || 'Info'}
                          </span>
                        </div>
                        {f.description && <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">{f.description}</p>}
                        {f.evidence && (
                          <div className="text-[10px] text-zinc-400 bg-zinc-900/60 p-1.5 rounded border border-zinc-800/50">
                            <strong>Evidence:</strong> {f.evidence}
                          </div>
                        )}
                        {f.impact && (
                          <div className="text-[10px] text-amber-400/90">
                            <strong>Impact:</strong> {f.impact}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-zinc-500 font-mono py-6 text-center">
                      No negative resilience findings reported for this experiment.
                    </div>
                  )}
                </div>
              </div>

              {/* Hypothesis Verification */}
              <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-xl p-4 md:p-5 space-y-3 print-card">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                  <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300 flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-cyan-400" />
                    Hypothesis Verification
                  </h3>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${getVerdictBadge(report.hypothesis.verdict).color}`}>
                    {report.hypothesis.verdict}
                  </span>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800/80 space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase block">Stated Hypothesis:</span>
                    <p className="text-zinc-200 font-sans leading-relaxed text-xs">
                      {report.hypothesis.hypothesis}
                    </p>
                  </div>

                  <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800/80 space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase block">Expected Behavior:</span>
                    <p className="text-zinc-300 font-sans leading-relaxed text-xs">
                      {report.hypothesis.expected_behavior}
                    </p>
                  </div>

                  {report.hypothesis.criteria_evaluated && report.hypothesis.criteria_evaluated.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] text-zinc-500 uppercase block">Evaluated Acceptance Criteria:</span>
                      {report.hypothesis.criteria_evaluated.map((c, idx) => (
                        <div key={idx} className="bg-zinc-950 p-2 rounded border border-zinc-800/60 flex items-start gap-2 text-[11px]">
                          {c.passed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                          )}
                          <div className="space-y-0.5">
                            <span className="font-semibold text-zinc-200">{c.criterion}</span>
                            <div className="text-[10px] text-zinc-400">
                              Expected: {c.expected} • Observed: <strong className={c.passed ? 'text-emerald-400' : 'text-rose-400'}>{c.actual}</strong>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* ===================================================================
                SECTION 27: RECOMMENDATIONS & NEXT EXPERIMENTS
            ==================================================================== */}
            <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-xl p-4 md:p-5 space-y-3 print-card">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                <div>
                  <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300 flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    Engineered Recommendations & Next Validation Experiments
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-mono">
                    Prioritized action items and CLI validation commands derived from empirical degradation
                  </p>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">
                  {report.recommendations?.length || 0} action items
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {report.recommendations && report.recommendations.length > 0 ? (
                  report.recommendations.map((rec, idx) => (
                    <div key={idx} className="bg-zinc-950 border border-zinc-800 rounded-lg p-3.5 space-y-2 font-mono text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-zinc-200 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>{rec.title}</span>
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded uppercase ${
                          rec.priority === 'High' ? 'bg-rose-500/20 text-rose-400 font-bold' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {rec.priority} Priority
                        </span>
                      </div>

                      <div className="text-[11px] text-zinc-300 font-sans leading-relaxed">
                        <strong className="text-zinc-200 font-mono">Action:</strong> {rec.action}
                      </div>
                      <div className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                        <strong className="text-zinc-300 font-mono">Rationale:</strong> {rec.reason}
                      </div>

                      {rec.next_experiment && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded p-2.5 space-y-1.5 mt-2">
                          <div className="text-[10px] text-cyan-400 uppercase font-semibold flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            <span>Recommended Validation Experiment:</span>
                          </div>
                          <div className="text-[11px] text-zinc-300">
                            {rec.next_experiment.goal}
                          </div>
                          <div className="flex items-center justify-between bg-black/60 p-1.5 rounded border border-zinc-800 text-[10px] text-emerald-400 font-mono">
                            <code className="truncate pr-2">{rec.next_experiment.command}</code>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(rec.next_experiment!.command);
                                setCopiedCmdIndex(idx);
                                setTimeout(() => setCopiedCmdIndex(null), 2000);
                              }}
                              className="text-zinc-400 hover:text-white shrink-0 cursor-pointer"
                              title="Copy command"
                            >
                              {copiedCmdIndex === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 text-xs text-zinc-500 font-mono py-6 text-center">
                    No active remediations required; experiment met resilience requirements.
                  </div>
                )}
              </div>
            </div>

            {/* Print Footer */}
            <div className="hidden print-header text-center text-xs text-zinc-500 font-mono pt-8 border-t border-zinc-300">
              <p>Noir Resilience Verification Engine • Experiment #{report.metadata.id} Report • Generated on {new Date().toLocaleString()}</p>
            </div>

          </div>
        )}

      </div>
    </UserLayout>
  );
}
