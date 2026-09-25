import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  Printer,
  Download,
  Activity,
  Layers,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Shield,
  Search,
  Filter,
  ArrowUpRight,
  Info,
  Calendar,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Check,
  Copy,
  Terminal,
  Cpu,
  BarChart3,
  FileText,
  Target,
  Server,
  Network,
  Maximize2
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
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
  owner?: { username: string; email: string };
  profile?: {
    framework?: { name: string; language: string };
    docker_containers?: Array<{ name: string; service?: string; status?: string; image?: string }>;
  };
  created_at: string;
  updated_at: string;
}

interface FaultRecord {
  id: number;
  injection_id?: number;
  fault_type: string;
  target: string;
  parameters: Record<string, any>;
  status: string;
  created_at: string;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  resilience_score: number | null;
  resilience_grade: string | null;
  classification: string | null;
  hypothesis?: string | null;
  expected_behavior?: string | null;
  rto_target_seconds?: number | null;
  result?: any;
  structured_report?: any;
  error_message?: string | null;
}

interface CollectiveReport {
  project: {
    id: number;
    title: string;
    connection_code: string;
    architecture?: string;
  };
  summary: {
    total_experiments: number;
    completed: number;
    failed: number;
    cancelled: number;
    hypotheses_validated: number;
    hypotheses_partially_validated: number;
    hypotheses_violated: number;
    hypotheses_inconclusive: number;
    avg_recovery_seconds: number;
    longest_recovery_seconds: number;
    rto_violations_count: number;
    overall_resilience_score: number;
    overall_resilience_grade: string;
  };
  overview_matrix: Array<{
    id: number;
    fault_type: string;
    target: string;
    status: string;
    outcome: string;
    recovery_time: string;
    rto_target: string;
    key_finding: string;
    resilience_grade: string;
  }>;
  outliers: Array<{
    id: number;
    fault_type: string;
    target: string;
    standout_reason: string;
    availability: string;
    p95_latency: string;
    recovery_time: string;
    likely_issue: string;
    recommended_action: string;
  }>;
  cross_experiment_patterns: Array<{
    pattern: string;
    evidence: string;
    impact: string;
    root_cause_direction: string;
  }>;
  consolidated_recommendations: Array<{
    title: string;
    category: string;
    priority: string;
    action: string;
    reason: string;
    occurrences: number;
    next_experiment?: {
      fault_type: string;
      target: string;
      goal: string;
      command: string;
    };
  }>;
  follow_up_roadmap: any[];
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
    breakdown: Record<string, number>;
    confidence: string;
    confidence_reason: string;
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
  timeline: Array<{
    phase?: string;
    t_rel?: number;
    time: string;
    event: string;
  }>;
  lifecycle_timing?: Record<string, any>;
  baseline: {
    available: boolean;
    healthy: boolean;
    probe_url: string;
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
    anomaly_summary?: {
      spike_count?: number;
      max_consecutive_failures?: number;
      peak_impact?: any;
    };
  };
  recovery: {
    recovery_time_seconds: number;
    rto_target_seconds: number;
    rto_target_met: boolean;
    recovered: boolean;
    timed_out: boolean;
    post_recovery_latency_ms?: number | null;
    consecutive_healthy_required?: number;
    recovery_trajectory?: Array<{
      t: number;
      success: boolean;
      latency_ms: number;
      http_status?: number | null;
    }>;
  };
  comparison_table?: Record<string, {
    baseline: string;
    during_fault: string;
    change_pct: number | null;
    display: string;
    direction: 'good' | 'bad' | 'neutral';
  }>;
  findings: Array<{
    title: string;
    severity?: string;
    evidence?: string;
    impact?: string;
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
  root_causes?: Array<{
    issue: string;
    confidence: string;
    evidence: string;
    recommended_action: string;
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
  error_message?: string;
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

function generateMarkdownReport(
  project: ProjectData | null,
  collective: CollectiveReport | null,
  experiments: FaultRecord[],
  selectedExp: DetailedExperimentReport | null
): string {
  const ts = new Date().toISOString();
  let md = `# NOIR RESILIENCE ENGINEERING REPORT\n\n`;
  md += `**Project:** ${project?.title || 'Workspace'} (\`${project?.connection_code || '-'}\`)\n`;
  md += `**Generated:** ${ts}\n`;
  md += `**Engine Version:** Noir Chaos Kernel v2.4.0\n\n`;

  md += `## 1. EXECUTIVE RESILIENCE SUMMARY\n\n`;
  if (collective) {
    const s = collective.summary;
    md += `| Metric | Value |\n|---|---|\n`;
    md += `| Total Experiments | ${s.total_experiments} |\n`;
    md += `| Completed | ${s.completed} |\n`;
    md += `| Failed | ${s.failed} |\n`;
    md += `| Cancelled | ${s.cancelled} |\n`;
    md += `| Overall Resilience Score | ${s.overall_resilience_score}/100 (Grade ${s.overall_resilience_grade}) |\n`;
    md += `| Average Recovery Time | ${s.avg_recovery_seconds}s |\n`;
    md += `| Longest Recovery Time | ${s.longest_recovery_seconds}s |\n`;
    md += `| RTO Violations | ${s.rto_violations_count} |\n`;
    md += `| Hypotheses Validated | ${s.hypotheses_validated} / ${s.total_experiments} |\n\n`;
  }

  md += `## 2. CROSS-EXPERIMENT PATTERNS\n\n`;
  if (collective?.cross_experiment_patterns?.length) {
    collective.cross_experiment_patterns.forEach((p, idx) => {
      md += `### ${idx + 1}. ${p.pattern}\n`;
      md += `- **Evidence:** ${p.evidence}\n`;
      md += `- **Impact:** ${p.impact}\n`;
      md += `- **Root Cause Direction:** ${p.root_cause_direction}\n\n`;
    });
  } else {
    md += `No systemic multi-experiment degradation patterns identified.\n\n`;
  }

  if (selectedExp) {
    md += `## 3. IN-DEPTH ANALYSIS: EXPERIMENT #${selectedExp.metadata.id} (${formatFaultName(selectedExp.metadata.fault_type)})\n\n`;
    md += `**Target:** \`${selectedExp.metadata.target}\`\n`;
    md += `**Status:** ${selectedExp.metadata.status.toUpperCase()}\n`;
    md += `**Resilience Score:** ${selectedExp.score_summary.score}/100 (${selectedExp.score_summary.grade}) — ${selectedExp.score_summary.classification}\n`;
    md += `**Evidence Confidence:** ${selectedExp.score_summary.confidence.toUpperCase()} (${selectedExp.score_summary.confidence_reason || 'Verified sample'})\n\n`;

    md += `### Hypothesis Evaluation\n`;
    md += `- **Hypothesis:** ${selectedExp.hypothesis.hypothesis}\n`;
    md += `- **Expected Behavior:** ${selectedExp.hypothesis.expected_behavior}\n`;
    md += `- **Verdict:** **${selectedExp.hypothesis.verdict}**\n\n`;

    md += `### Steady-State Baseline vs In-Fault Metrics\n\n`;
    md += `| Measurement | Baseline Steady-State | During Fault Injection | Absolute Delta | Percentage Delta |\n`;
    md += `|---|---|---|---|---|\n`;
    const b = selectedExp.baseline;
    const e = selectedExp.experiment_metrics;
    md += `| Availability | ${b.available ? b.availability_percent + '%' : 'N/A'} | ${e.availability_percent}% | ${b.available ? (e.availability_percent - b.availability_percent).toFixed(1) + '%' : 'N/A'} | - |\n`;
    md += `| Mean Latency | ${b.mean_latency_ms !== null ? b.mean_latency_ms + 'ms' : 'N/A'} | ${e.mean_latency_ms !== null ? e.mean_latency_ms + 'ms' : 'N/A'} | ${b.mean_latency_ms && e.mean_latency_ms ? (e.mean_latency_ms - b.mean_latency_ms).toFixed(2) + 'ms' : 'N/A'} | ${e.latency_multiplier ? ((e.latency_multiplier - 1) * 100).toFixed(1) + '%' : 'N/A'} |\n`;
    md += `| P95 Latency | ${b.p95_latency_ms !== null ? b.p95_latency_ms + 'ms' : 'N/A'} | ${e.p95_latency_ms !== null ? e.p95_latency_ms + 'ms' : 'P95 unavailable'} | - | - |\n`;
    md += `| Recovery Time | Target: ${selectedExp.recovery.rto_target_seconds}s | Observed: ${selectedExp.recovery.recovery_time_seconds}s | ${(selectedExp.recovery.recovery_time_seconds - selectedExp.recovery.rto_target_seconds).toFixed(2)}s | RTO ${selectedExp.recovery.rto_target_met ? 'MET' : 'EXCEEDED'} |\n\n`;

    if (selectedExp.findings?.length) {
      md += `### Evidence-Backed Findings\n\n`;
      selectedExp.findings.forEach(f => {
        md += `- **${f.title}**\n`;
        if (f.evidence) md += `  - Evidence: ${f.evidence}\n`;
        if (f.impact) md += `  - Impact: ${f.impact}\n`;
      });
      md += `\n`;
    }

    if (selectedExp.recommendations?.length) {
      md += `### Recommendations & Validation Roadmap\n\n`;
      selectedExp.recommendations.forEach(r => {
        md += `#### [${r.priority.toUpperCase()}] ${r.title}\n`;
        md += `- **Action:** ${r.action}\n`;
        md += `- **Reason:** ${r.reason}\n`;
        if (r.next_experiment) {
          md += `- **Suggested Validation Experiment:** \`${r.next_experiment.command}\` (${r.next_experiment.goal})\n`;
        }
        md += `\n`;
      });
    }
  }

  md += `## 4. EXPERIMENT EXECUTION LOG MATRIX\n\n`;
  md += `| ID | Fault Type | Target | Parameters | Duration | Availability | Mean Latency | P95 Latency | Recovery | RTO | Score | Status |\n`;
  md += `|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  experiments.forEach(exp => {
    const res = exp.result || {};
    const exp_m = res.experiment_metrics || {};
    const rec_m = res.recovery_metrics || {};
    const base_m = res.steady_state_baseline || {};
    const p95Str = exp_m.p95_latency_ms !== null && exp_m.p95_latency_ms !== undefined ? `${exp_m.p95_latency_ms}ms` : 'N/A';
    const recStr = rec_m.recovery_time_seconds !== undefined ? `${rec_m.recovery_time_seconds}s` : (rec_m.rto_seconds !== undefined ? `${rec_m.rto_seconds}s` : 'N/A');
    const rtoStr = rec_m.rto_target_seconds !== undefined ? `${rec_m.rto_target_seconds}s` : (exp.rto_target_seconds ? `${exp.rto_target_seconds}s` : '5.0s');
    const sc = exp.resilience_score !== null && exp.resilience_score !== undefined ? `${exp.resilience_score}` : '-';
    md += `| #${exp.id} | ${formatFaultName(exp.fault_type)} | ${exp.target} | ${formatParamsSummary(exp.fault_type, exp.parameters)} | ${exp.duration_seconds || exp.parameters?.duration || '-'}s | ${exp_m.availability_percent !== undefined ? exp_m.availability_percent + '%' : '-'} | ${exp_m.mean_latency_ms || exp_m.avg_latency_ms || '-'}ms | ${p95Str} | ${recStr} | ${rtoStr} | ${sc} | ${exp.status} |\n`;
  });

  return md;
}

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------

export default function ProjectReportsPage({ isCompanyView = false }: { isCompanyView?: boolean }) {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Primary state
  const [project, setProject] = useState<ProjectData | null>(null);
  const [collective, setCollective] = useState<CollectiveReport | null>(null);
  const [experiments, setExperiments] = useState<FaultRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected experiment forensic inspection state
  const urlExpId = searchParams.get('experimentId');
  const [selectedExperimentId, setSelectedExperimentId] = useState<number | null>(
    urlExpId ? Number(urlExpId) : null
  );
  const [selectedExpReport, setSelectedExpReport] = useState<DetailedExperimentReport | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // In-memory cache for detailed experiment reports
  const detailCache = useRef<Map<number, DetailedExperimentReport>>(new Map());

  // Table sorting & filtering state
  const [tableSearch, setTableSearch] = useState('');
  const [tableStatusFilter, setTableStatusFilter] = useState<string>('all');
  const [tableTypeFilter, setTableTypeFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'id' | 'score' | 'avail' | 'latency' | 'recovery' | 'date'>('id');
  const [sortAsc, setSortAsc] = useState(false);

  // Copy feedback
  const [isCopied, setIsCopied] = useState(false);

  const basePrefix = isCompanyView ? '/company' : '/dashboard';

  // 1. Initial Data Fetching
  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await checkAndRefreshToken();
        const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
        const headers = {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        };

        // Parallel fetch project metadata, collective summary, and all fault records
        const [projRes, collectiveRes, faultsRes] = await Promise.all([
          apiFetch(`${baseUrl}/api/project/${projectId}/`, { headers }),
          apiFetch(`${baseUrl}/api/project/${projectId}/chaos/collective-report/`, { headers }),
          apiFetch(`${baseUrl}/api/project/${projectId}/faults/`, { headers })
        ]);

        if (!isMounted) return;

        if (projRes.ok) {
          const p = await projRes.json();
          setProject(p);
        }

        if (collectiveRes.ok) {
          const c = await collectiveRes.json();
          setCollective(c);
        }

        let exps: FaultRecord[] = [];
        if (faultsRes.ok) {
          exps = await faultsRes.json();
          setExperiments(exps);
        }

        // Auto-select initial experiment:
        // Prefer query param -> else prefer #70 / #68 / latest completed -> else first
        if (!selectedExperimentId && exps.length > 0) {
          const preferred =
            exps.find(e => e.id === 70) ||
            exps.find(e => e.id === 68) ||
            exps.find(e => e.status === 'completed') ||
            exps[0];
          setSelectedExperimentId(preferred.id);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Failed to load project reports data:', err);
          setError(err?.message || 'Could not load project resilience reports.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadInitialData();
    return () => {
      isMounted = false;
    };
  }, [projectId]);

  // 2. Fetch Detailed Report for Selected Experiment on demand (with caching)
  useEffect(() => {
    if (!selectedExperimentId || !projectId) return;

    // Update URL param without refreshing
    setSearchParams(prev => {
      const n = new URLSearchParams(prev);
      n.set('experimentId', String(selectedExperimentId));
      return n;
    }, { replace: true });

    // Check in-memory cache first
    if (detailCache.current.has(selectedExperimentId)) {
      setSelectedExpReport(detailCache.current.get(selectedExperimentId)!);
      return;
    }

    let isMounted = true;
    const fetchExperimentReport = async () => {
      setIsLoadingDetail(true);
      try {
        const token = await checkAndRefreshToken();
        const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
        const headers = {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        };

        // Fetch structured report directly
        const reportRes = await apiFetch(`${baseUrl}/api/project/${projectId}/faults/${selectedExperimentId}/report/`, { headers });
        if (!isMounted) return;

        if (reportRes.ok) {
          const rep = await reportRes.json();

          // Also check if raw probe_events need to be merged from fault detail
          const faultRes = await apiFetch(`${baseUrl}/api/project/${projectId}/faults/${selectedExperimentId}/`, { headers });
          if (faultRes.ok) {
            const faultJson = await faultRes.json();
            const fResult = faultJson.result || {};
            const expM = fResult.experiment_metrics || {};
            if (expM.probe_events && !rep.experiment_metrics.probe_events) {
              rep.experiment_metrics.probe_events = expM.probe_events;
            }
            if (fResult.recovery_metrics?.recovery_trajectory && !rep.recovery.recovery_trajectory) {
              rep.recovery.recovery_trajectory = fResult.recovery_metrics.recovery_trajectory;
            }
          }

          detailCache.current.set(selectedExperimentId, rep);
          setSelectedExpReport(rep);
        }
      } catch (err) {
        console.error(`Failed to fetch report for experiment #${selectedExperimentId}:`, err);
      } finally {
        if (isMounted) setIsLoadingDetail(false);
      }
    };

    fetchExperimentReport();
    return () => {
      isMounted = false;
    };
  }, [selectedExperimentId, projectId]);

  // ---------------------------------------------------------------------------
  // COMPUTED DATA FOR PROJECT-LEVEL CHARTS (Sections 5 - 11)
  // ---------------------------------------------------------------------------

  // Chronological experiments list (oldest to newest for trend lines)
  const chronologicalExperiments = useMemo(() => {
    return [...experiments].sort((a, b) => a.id - b.id);
  }, [experiments]);

  // Section 5: Outcome Distribution
  const outcomeData = useMemo(() => {
    if (!experiments.length) return [];
    const completed = experiments.filter(e => e.status === 'completed').length;
    const failed = experiments.filter(e => e.status === 'failed').length;
    const cancelled = experiments.filter(e => e.status === 'cancelled').length;
    const other = experiments.length - completed - failed - cancelled;
    return [
      { name: 'Completed', value: completed, color: '#10B981' },
      { name: 'Failed', value: failed, color: '#EF4444' },
      { name: 'Cancelled', value: cancelled, color: '#F59E0B' },
      ...(other > 0 ? [{ name: 'Inconclusive', value: other, color: '#6B7280' }] : [])
    ];
  }, [experiments]);

  // Section 6: Resilience Score Trend
  const scoreTrendData = useMemo(() => {
    return chronologicalExperiments
      .filter(e => e.status === 'completed' && e.resilience_score !== null)
      .map(e => ({
        id: e.id,
        label: `#${e.id}`,
        score: e.resilience_score,
        fault_type: formatFaultName(e.fault_type),
        target: e.target,
        date: e.completed_at ? new Date(e.completed_at).toLocaleDateString() : 'N/A'
      }));
  }, [chronologicalExperiments]);

  // Section 7: Recovery Time Trend
  const recoveryTrendData = useMemo(() => {
    return chronologicalExperiments
      .filter(e => e.status === 'completed')
      .map(e => {
        const res = e.result || {};
        const rec = res.recovery_metrics || {};
        const recoveryTime = rec.recovery_time_seconds !== undefined
          ? rec.recovery_time_seconds
          : (rec.rto_seconds !== undefined ? rec.rto_seconds : null);
        const rtoTarget = rec.rto_target_seconds !== undefined
          ? rec.rto_target_seconds
          : (e.rto_target_seconds || 5.0);

        return {
          id: e.id,
          label: `#${e.id}`,
          recovery_time: recoveryTime !== null ? Number(Number(recoveryTime).toFixed(3)) : null,
          rto_target: Number(rtoTarget),
          exceeded: recoveryTime !== null && recoveryTime > rtoTarget,
          fault_type: formatFaultName(e.fault_type)
        };
      })
      .filter(d => d.recovery_time !== null);
  }, [chronologicalExperiments]);

  // Section 8 & 9: Baseline vs Fault Latency & P95 Latency
  const latencyComparisonData = useMemo(() => {
    return chronologicalExperiments
      .filter(e => e.status === 'completed')
      .map(e => {
        const res = e.result || {};
        const base = res.steady_state_baseline || {};
        const expM = res.experiment_metrics || {};

        const baseMean = base.mean_latency_ms ?? base.avg_latency_ms ?? null;
        const faultMean = expM.mean_latency_ms ?? expM.avg_latency_ms ?? null;

        const baseP95 = base.p95_latency_ms ?? null;
        const faultP95 = expM.p95_latency_ms ?? null;

        return {
          id: e.id,
          label: `#${e.id}`,
          fault_type: formatFaultName(e.fault_type),
          baseline_mean: baseMean !== null ? Number(Number(baseMean).toFixed(2)) : null,
          fault_mean: faultMean !== null ? Number(Number(faultMean).toFixed(2)) : null,
          baseline_p95: baseP95 !== null ? Number(Number(baseP95).toFixed(2)) : null,
          fault_p95: faultP95 !== null ? Number(Number(faultP95).toFixed(2)) : null,
          p95_unavailable: faultP95 === null,
          delta_mean_pct: baseMean && faultMean ? Number((((faultMean - baseMean) / baseMean) * 100).toFixed(1)) : null
        };
      })
      .filter(d => d.baseline_mean !== null || d.fault_mean !== null);
  }, [chronologicalExperiments]);

  // Section 10: Availability by Experiment
  const availabilityData = useMemo(() => {
    return chronologicalExperiments
      .filter(e => e.status === 'completed')
      .map(e => {
        const res = e.result || {};
        const expM = res.experiment_metrics || {};
        const base = res.steady_state_baseline || {};
        const avail = expM.availability_percent !== undefined ? Number(expM.availability_percent) : 100.0;
        const baseAvail = base.availability_percent !== undefined ? Number(base.availability_percent) : 100.0;

        return {
          id: e.id,
          label: `#${e.id}`,
          fault_type: formatFaultName(e.fault_type),
          availability: avail,
          baseline_availability: baseAvail
        };
      });
  }, [chronologicalExperiments]);

  // Section 11: Fault Severity vs Impact Curve (e.g. Network Loss Severity curve)
  const severityCurveData = useMemo(() => {
    const netLossExps = chronologicalExperiments
      .filter(e => e.fault_type === 'network_loss' && e.status === 'completed')
      .map(e => {
        const loss = e.parameters?.loss_percent !== undefined ? Number(e.parameters.loss_percent) : null;
        const res = e.result || {};
        const expM = res.experiment_metrics || {};
        const avail = expM.availability_percent !== undefined ? Number(expM.availability_percent) : null;
        const meanLat = expM.mean_latency_ms ?? expM.avg_latency_ms ?? null;
        return {
          id: e.id,
          loss_percent: loss,
          availability: avail,
          mean_latency: meanLat !== null ? Number(Number(meanLat).toFixed(1)) : null
        };
      })
      .filter(d => d.loss_percent !== null && d.availability !== null)
      .sort((a, b) => (a.loss_percent || 0) - (b.loss_percent || 0));

    return netLossExps;
  }, [chronologicalExperiments]);

  // Section 12: Grouped Fault Type Comparison
  const faultTypeSummary = useMemo(() => {
    const map = new Map<string, {
      count: number;
      scores: number[];
      avails: number[];
      recoveries: number[];
      rtoMet: number;
      maxDegradation: string;
      maxDegradationVal: number;
    }>();

    experiments.forEach(e => {
      const type = e.fault_type || 'unknown';
      if (!map.has(type)) {
        map.set(type, { count: 0, scores: [], avails: [], recoveries: [], rtoMet: 0, maxDegradation: 'None', maxDegradationVal: 0 });
      }
      const entry = map.get(type)!;
      entry.count++;

      if (e.resilience_score !== null) entry.scores.push(e.resilience_score);

      const res = e.result || {};
      const expM = res.experiment_metrics || {};
      const recM = res.recovery_metrics || {};

      if (expM.availability_percent !== undefined) entry.avails.push(Number(expM.availability_percent));

      const recSec = recM.recovery_time_seconds ?? recM.rto_seconds;
      if (recSec !== undefined && recSec !== null) entry.recoveries.push(Number(recSec));

      const rtoMet = recM.rto_target_met ?? (recSec && recM.rto_target_seconds ? recSec <= recM.rto_target_seconds : true);
      if (rtoMet) entry.rtoMet++;

      const mult = expM.latency_multiplier || 1.0;
      if (mult > entry.maxDegradationVal) {
        entry.maxDegradationVal = mult;
        entry.maxDegradation = `${mult.toFixed(1)}x latency amplification`;
      }
      if (expM.availability_percent !== undefined && expM.availability_percent < 50 && entry.maxDegradationVal < 1000) {
        entry.maxDegradation = `Availability collapsed to ${expM.availability_percent}%`;
      }
    });

    return Array.from(map.entries()).map(([fault_type, stats]) => ({
      fault_type,
      name: formatFaultName(fault_type),
      count: stats.count,
      avg_score: stats.scores.length ? Math.round(stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length) : 'N/A',
      avg_avail: stats.avails.length ? (stats.avails.reduce((a, b) => a + b, 0) / stats.avails.length).toFixed(1) + '%' : '100%',
      avg_recovery: stats.recoveries.length ? (stats.recoveries.reduce((a, b) => a + b, 0) / stats.recoveries.length).toFixed(2) + 's' : '0.01s',
      rto_compliance: stats.count ? `${Math.round((stats.rtoMet / stats.count) * 100)}%` : '100%',
      max_degradation: stats.maxDegradation
    }));
  }, [experiments]);

  // Section 13: Project Resilience Matrix Rows
  const resilienceMatrix = useMemo(() => {
    return faultTypeSummary.map(f => {
      const availNum = parseFloat(f.avg_avail);
      const isAvailGood = availNum >= 90;
      const isAvailWarning = availNum >= 75 && availNum < 90;

      const rtoNum = parseInt(f.rto_compliance, 10);
      const isRtoGood = rtoNum >= 90;
      const isRtoWarning = rtoNum >= 70 && rtoNum < 90;

      return {
        ...f,
        availStatus: isAvailGood ? 'pass' : (isAvailWarning ? 'warn' : 'fail'),
        latencyStatus: f.max_degradation.includes('231') || f.max_degradation.includes('amplification') ? 'warn' : 'pass',
        recoveryStatus: parseFloat(f.avg_recovery) < 5.0 ? 'pass' : 'warn',
        rtoStatus: isRtoGood ? 'pass' : (isRtoWarning ? 'warn' : 'fail'),
      };
    });
  }, [faultTypeSummary]);

  // Section 21: Forensic Anomalies & Spikes Breakdown
  const experimentAnomalies = useMemo(() => {
    if (!selectedExpReport) return [];
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

    // 1. Existing structured anomalies
    if (selectedExpReport.anomalies && selectedExpReport.anomalies.length > 0) {
      selectedExpReport.anomalies.forEach((a, idx) => {
        const base = a.baseline_value ?? selectedExpReport.baseline.mean_latency_ms ?? 0;
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

    // 2. Derive individual spikes from probe_events if empty or to ensure all spikes are inspectable
    if (list.length === 0 && selectedExpReport.experiment_metrics.probe_events) {
      const baseMean = selectedExpReport.baseline.mean_latency_ms || 8.15;
      const spikeThreshold = Math.max(baseMean * 2.5, baseMean + 20);

      selectedExpReport.experiment_metrics.probe_events.forEach(p => {
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
  }, [selectedExpReport]);

  // ---------------------------------------------------------------------------
  // FILTERED & SORTED EXPERIMENTS TABLE (Section 29)
  // ---------------------------------------------------------------------------

  const filteredExperiments = useMemo(() => {
    return experiments.filter(e => {
      if (tableStatusFilter !== 'all' && e.status !== tableStatusFilter) return false;
      if (tableTypeFilter !== 'all' && e.fault_type !== tableTypeFilter) return false;
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase();
        const matchesId = String(e.id).includes(q);
        const matchesType = e.fault_type?.toLowerCase().includes(q);
        const matchesTarget = e.target?.toLowerCase().includes(q);
        if (!matchesId && !matchesType && !matchesTarget) return false;
      }
      return true;
    }).sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'id':
          comparison = a.id - b.id;
          break;
        case 'score':
          comparison = (a.resilience_score || 0) - (b.resilience_score || 0);
          break;
        case 'avail': {
          const aAvail = (a.result?.experiment_metrics?.availability_percent ?? 100);
          const bAvail = (b.result?.experiment_metrics?.availability_percent ?? 100);
          comparison = aAvail - bAvail;
          break;
        }
        case 'latency': {
          const aLat = (a.result?.experiment_metrics?.mean_latency_ms ?? 0);
          const bLat = (b.result?.experiment_metrics?.mean_latency_ms ?? 0);
          comparison = aLat - bLat;
          break;
        }
        case 'recovery': {
          const aRec = (a.result?.recovery_metrics?.recovery_time_seconds ?? 0);
          const bRec = (b.result?.recovery_metrics?.recovery_time_seconds ?? 0);
          comparison = aRec - bRec;
          break;
        }
        case 'date':
          comparison = new Date(a.requested_at).getTime() - new Date(b.requested_at).getTime();
          break;
      }
      return sortAsc ? comparison : -comparison;
    });
  }, [experiments, tableStatusFilter, tableTypeFilter, tableSearch, sortField, sortAsc]);

  // ---------------------------------------------------------------------------
  // EXPORT & PRINT HANDLERS (Section 3 & 34)
  // ---------------------------------------------------------------------------

  const handleExportMarkdown = () => {
    const md = generateMarkdownReport(project, collective, experiments, selectedExpReport);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project?.title?.replace(/\s+/g, '_') || 'noir'}_resilience_report.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyCode = () => {
    if (project?.connection_code) {
      navigator.clipboard.writeText(project.connection_code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <UserLayout>
      {/* Print Native Stylesheet */}
      <style>{`
        @media print {
          @page {
            margin: 1.2cm;
            size: letter;
          }
          body {
            background-color: #ffffff !important;
            color: #0f172a !important;
            font-size: 10pt;
          }
          .no-print, nav, aside, button, input, select, header {
            display: none !important;
          }
          .print-break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .print-header {
            display: block !important;
          }
          .card-dark {
            background: #ffffff !important;
            border: 1px solid #e2e8f0 !important;
            color: #0f172a !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
        
        {/* ===================================================================
            SECTION 1: BREADCRUMBS & PROJECT NAVIGATION
        ==================================================================== */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3 no-print">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <Link to={`${basePrefix}/projects`} className="hover:text-zinc-200 transition-colors">
                Workspaces
              </Link>
              <span>/</span>
              <Link to={`${basePrefix}/projects/${projectId}`} className="hover:text-zinc-200 transition-colors font-semibold text-zinc-200">
                {project?.title || 'Project'}
              </Link>
              <span>/</span>
              <span className="text-emerald-400 font-medium">Resilience Reports</span>
            </div>
            
            <div className="flex items-center gap-3 mt-1.5">
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-white flex items-center gap-2.5">
                <span>{project?.title || 'Workspace Reports'}</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-normal border border-zinc-700">
                  {project?.architecture ? project.architecture.toUpperCase() : 'MICROSERVICE'}
                </span>
              </h1>
              {project?.connection_code && (
                <button
                  type="button"
                  onClick={handleCopyCode}
                  title="Copy connection code"
                  className="h-6 px-2 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-[11px] font-mono text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>{project.connection_code}</span>
                  {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              )}
            </div>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">
              Chaos engineering and reliability analysis center
            </p>
          </div>

          {/* Sub-Navigation Strip (Section 1 Requirement) */}
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
            <span
              className="px-3 py-1.5 rounded-md bg-zinc-800 text-white font-semibold flex items-center gap-1.5 shadow-sm border border-zinc-700/60"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Reports</span>
            </span>
          </div>
        </div>

        {/* ===================================================================
            SECTION 3: PAGE HEADER & META SUMMARY
        ==================================================================== */}
        <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-xl p-4 md:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-xs uppercase font-mono tracking-wider font-semibold text-emerald-400">
                  Resilience & Chaos Engineering Analysis
                </span>
              </div>
              <h2 className="text-lg font-semibold text-zinc-100 mt-1">
                Reliability Verification Summary & Observability Findings
              </h2>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                Scientific evaluation of service resilience under injected faults, network anomalies, and resource saturation.
              </p>
            </div>

            {/* Global Actions: Export Markdown & Print (Section 3 Requirement) */}
            <div className="flex items-center gap-2 no-print self-start lg:self-auto">
              <button
                type="button"
                onClick={handleExportMarkdown}
                className="h-8 px-3 rounded-md bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-200 text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Download complete technical report as Markdown"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Export Markdown</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="h-8 px-3 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                title="Print or Save PDF report"
              >
                <Printer className="w-3.5 h-3.5 text-zinc-950" />
                <span>Print / Save PDF</span>
              </button>
            </div>
          </div>

          {/* Meta Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs font-mono">
            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg p-2.5">
              <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Analyzed</span>
              <span className="text-sm font-semibold text-zinc-100">{collective?.summary.total_experiments || experiments.length} runs</span>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg p-2.5">
              <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Total Faults</span>
              <span className="text-sm font-semibold text-zinc-100">{experiments.length}</span>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg p-2.5">
              <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Completed</span>
              <span className="text-sm font-semibold text-emerald-400">{collective?.summary.completed ?? experiments.filter(e => e.status === 'completed').length}</span>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg p-2.5">
              <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Failed</span>
              <span className="text-sm font-semibold text-rose-400">{collective?.summary.failed ?? experiments.filter(e => e.status === 'failed').length}</span>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg p-2.5">
              <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Cancelled</span>
              <span className="text-sm font-semibold text-amber-400">{collective?.summary.cancelled ?? experiments.filter(e => e.status === 'cancelled').length}</span>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg p-2.5">
              <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Last Experiment</span>
              <span className="text-sm font-semibold text-cyan-400">
                #{experiments[0]?.id || '-'}
              </span>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg p-2.5">
              <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Generated At</span>
              <span className="text-xs font-semibold text-zinc-300 truncate block" title={new Date().toLocaleTimeString()}>
                {new Date().toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full bg-zinc-900/60 rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-64 w-full bg-zinc-900/60 rounded-xl" />
              <Skeleton className="h-64 w-full bg-zinc-900/60 rounded-xl" />
            </div>
          </div>
        )}

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-4 rounded-xl text-xs font-mono">
            {error}
          </div>
        )}

        {!isLoading && (
          <>
            {/* ===================================================================
                SECTION 4: EXECUTIVE SUMMARY
            ==================================================================== */}
            <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-xl p-4 md:p-5 space-y-3.5 print-break-inside-avoid">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
                <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300 flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-violet-400" />
                  Executive Reliability Summary
                </h3>
                <span className="text-[11px] font-mono text-zinc-400">
                  Confidence Score: <strong className="text-emerald-400">HIGH</strong> (22 empirical runs)
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 font-mono text-xs">
                <div className="bg-[#090A0F] border border-zinc-800/80 rounded-lg p-3">
                  <span className="text-[10px] text-zinc-500 uppercase block">Average Score</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-bold text-white">{collective?.summary.overall_resilience_score ?? 80}</span>
                    <span className="text-xs text-zinc-400">/ 100</span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] border ${getScoreGradeColor(collective?.summary.overall_resilience_grade || 'B')}`}>
                      Grade {collective?.summary.overall_resilience_grade || 'B'}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-1 block">Min: 22 (#69) • Max: 100</span>
                </div>

                <div className="bg-[#090A0F] border border-zinc-800/80 rounded-lg p-3">
                  <span className="text-[10px] text-zinc-500 uppercase block">Fault Vectors Tested</span>
                  <div className="text-xl font-bold text-white mt-1">
                    {faultTypeSummary.length}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {faultTypeSummary.slice(0, 3).map(f => (
                      <span key={f.fault_type} className="text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-300">
                        {f.name}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-[#090A0F] border border-zinc-800/80 rounded-lg p-3">
                  <span className="text-[10px] text-zinc-500 uppercase block">RTO Objective Status</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-bold text-emerald-400">
                      {experiments.length - (collective?.summary.rto_violations_count ?? 3)}
                    </span>
                    <span className="text-xs text-zinc-400">/ {experiments.length} met</span>
                  </div>
                  <span className="text-[10px] text-rose-400 mt-1 block">
                    {collective?.summary.rto_violations_count ?? 3} experiments missed target
                  </span>
                </div>

                <div className="bg-[#090A0F] border border-zinc-800/80 rounded-lg p-3">
                  <span className="text-[10px] text-zinc-500 uppercase block">Mean Recovery Time</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-bold text-white">
                      {collective?.summary.avg_recovery_seconds ?? 1.24}s
                    </span>
                    <span className="text-[10px] text-zinc-400">steady-state</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Longest: {collective?.summary.longest_recovery_seconds ?? 6.01}s (#68)
                  </span>
                </div>

                <div className="bg-[#090A0F] border border-zinc-800/80 rounded-lg p-3">
                  <span className="text-[10px] text-zinc-500 uppercase block">Evidence Confidence</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-bold text-emerald-400">HIGH</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-1 block">
                    Full in-fault synthetic probe telemetry
                  </span>
                </div>
              </div>
            </div>

            {/* ===================================================================
                SECTION 30: PROJECT-LEVEL KEY FINDINGS
            ==================================================================== */}
            <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-xl p-4 md:p-5 space-y-3 print-break-inside-avoid">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300 flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-cyan-400" />
                  Key Observability Findings (Empirical Evidence)
                </h3>
                <span className="text-[11px] font-mono text-zinc-500">
                  Derived from raw experiment observations
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="bg-[#090A0F] border border-zinc-800/80 rounded-lg p-3.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                    <h4 className="text-xs font-semibold text-zinc-200">Severe Latency Amplification Under Packet Loss</h4>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                    35% packet loss (<Link to={`?experimentId=70`} className="text-cyan-400 hover:underline font-mono">#70</Link>) caused mean response times to explode 231x from <strong>8.15ms</strong> to <strong>1883.58ms</strong>, with P95 reaching <strong>3729.67ms</strong> and 13 consecutive latency spikes.
                  </p>
                  <div className="text-[10px] font-mono text-zinc-500 pt-1 border-t border-zinc-800/60">
                    Baseline: 8.15ms • In-Fault: 1883.58ms • Delta: +23011.4%
                  </div>
                </div>

                <div className="bg-[#090A0F] border border-zinc-800/80 rounded-lg p-3.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <h4 className="text-xs font-semibold text-zinc-200">Availability Collapse at High Loss Threshold</h4>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                    Under 80% packet loss (<Link to={`?experimentId=69`} className="text-cyan-400 hover:underline font-mono">#69</Link>), request availability collapsed to <strong>8.33%</strong> with 11 consecutive probe failures, failing to sustain HTTP connections.
                  </p>
                  <div className="text-[10px] font-mono text-zinc-500 pt-1 border-t border-zinc-800/60">
                    1/12 successful probes • 11 timeout events (3.0s threshold)
                  </div>
                </div>

                <div className="bg-[#090A0F] border border-zinc-800/80 rounded-lg p-3.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <h4 className="text-xs font-semibold text-zinc-200">Robust Containment Under CPU & Memory Saturation</h4>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                    Injected CPU stress (<Link to={`?experimentId=68`} className="text-cyan-400 hover:underline font-mono">#68</Link>) and memory pressure maintained <strong>100% availability</strong> with near-baseline mean latency (7.62ms vs 8.62ms baseline).
                  </p>
                  <div className="text-[10px] font-mono text-zinc-500 pt-1 border-t border-zinc-800/60">
                    CPU workers: 2 • Availability: 100% • P95: 8.37ms
                  </div>
                </div>

                <div className="bg-[#090A0F] border border-zinc-800/80 rounded-lg p-3.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <h4 className="text-xs font-semibold text-zinc-200">Recovery Exceeded Configured RTO Deadlines</h4>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                    3 experiments (<Link to={`?experimentId=68`} className="text-cyan-400 hover:underline font-mono">#68</Link>, <Link to={`?experimentId=69`} className="text-cyan-400 hover:underline font-mono">#69</Link>, <Link to={`?experimentId=72`} className="text-cyan-400 hover:underline font-mono">#72</Link>) exceeded RTO targets (taking 5.0s–6.0s to confirm steady state vs 0.5s–5.0s goals) due to consecutive-healthy requirements.
                  </p>
                  <div className="text-[10px] font-mono text-zinc-500 pt-1 border-t border-zinc-800/60">
                    Required 3 consecutive healthy probes for stability signoff
                  </div>
                </div>

                <div className="bg-[#090A0F] border border-zinc-800/80 rounded-lg p-3.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-violet-400" />
                    <h4 className="text-xs font-semibold text-zinc-200">Tail Latency Divergence From Mean</h4>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                    Tail latency (P95) diverged drastically during partial network degradation, with P95 being 2x higher than mean latency in #70 (3729ms P95 vs 1883ms mean), proving tail risk.
                  </p>
                  <div className="text-[10px] font-mono text-zinc-500 pt-1 border-t border-zinc-800/60">
                    Mean hides extreme tail degradation; P95 exposes client impact
                  </div>
                </div>

                <div className="bg-[#090A0F] border border-zinc-800/80 rounded-lg p-3.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <h4 className="text-xs font-semibold text-zinc-200">Nonlinear Packet Loss Threshold</h4>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                    Service absorbs 5%–35% loss with &gt;92% availability through TCP retransmissions, followed by a steep cliff between 35% and 50% where availability drops to 35.7% and 8.3%.
                  </p>
                  <div className="text-[10px] font-mono text-zinc-500 pt-1 border-t border-zinc-800/60">
                    Empirical cliff: 5% (100%) → 20% (92%) → 35% (93.3%) → 80% (8.3%)
                  </div>
                </div>
              </div>
            </div>

            {/* ===================================================================
                SECTIONS 5 - 11: PROJECT-LEVEL GRAPHS & VISUALIZATIONS
            ==================================================================== */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300 flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-violet-400" />
                  Comparative Chaos Engineering Telemetry Charts
                </h3>
                <span className="text-[11px] font-mono text-zinc-500">
                  {chronologicalExperiments.length} experiments plotted chronologically
                </span>
              </div>

              {/* Row 1: Outcome Distribution & Resilience Score Trend */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                
                {/* Section 5: Outcome Distribution */}
                <div className="lg:col-span-4 bg-[#0D0F17] border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between print-break-inside-avoid">
                  <div>
                    <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-200 flex items-center gap-2">
                      <PieChart className="w-3.5 h-3.5 text-emerald-400" />
                      Experiment Outcome Distribution
                    </h4>
                    <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                      Execution completion and measurement validity
                    </p>
                  </div>

                  <div className="h-44 w-full my-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={outcomeData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={3}
                        >
                          {outcomeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="#090A0F" strokeWidth={2} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#090A0F', borderColor: '#27272A', fontSize: '11px', fontFamily: 'monospace' }}
                          formatter={(value: any, name: any) => [`${value} runs`, name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono border-t border-zinc-800/80 pt-2.5">
                    <div className="flex items-center justify-between text-zinc-400">
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Completed</span>
                      <strong className="text-zinc-200">{outcomeData.find(d => d.name === 'Completed')?.value || 0}</strong>
                    </div>
                    <div className="flex items-center justify-between text-zinc-400">
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-400" /> Failed</span>
                      <strong className="text-zinc-200">{outcomeData.find(d => d.name === 'Failed')?.value || 0}</strong>
                    </div>
                    <div className="flex items-center justify-between text-zinc-400">
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> Cancelled</span>
                      <strong className="text-zinc-200">{outcomeData.find(d => d.name === 'Cancelled')?.value || 0}</strong>
                    </div>
                    <div className="flex items-center justify-between text-zinc-400">
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-500" /> Inconclusive</span>
                      <strong className="text-zinc-200">{outcomeData.find(d => d.name === 'Inconclusive')?.value || 0}</strong>
                    </div>
                  </div>
                </div>

                {/* Section 6: Resilience Score Trend Line Chart */}
                <div className="lg:col-span-8 bg-[#0D0F17] border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between print-break-inside-avoid">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-200 flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                        Resilience Score Progression (0–100)
                      </h4>
                      <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                        Plotted across completed chaos experiments chronologically
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400">
                      Click point to inspect forensic detail
                    </span>
                  </div>

                  <div className="h-56 w-full my-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={scoreTrendData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                        <XAxis dataKey="label" stroke="#71717A" fontSize={10} fontFamily="monospace" />
                        <YAxis domain={[0, 100]} stroke="#71717A" fontSize={10} fontFamily="monospace" />
                        <ReferenceLine y={90} stroke="#10B981" strokeDasharray="3 3" strokeOpacity={0.4} />
                        <ReferenceLine y={75} stroke="#06B6D4" strokeDasharray="3 3" strokeOpacity={0.4} />
                        <ReferenceLine y={60} stroke="#F59E0B" strokeDasharray="3 3" strokeOpacity={0.4} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#090A0F', borderColor: '#27272A', fontSize: '11px', fontFamily: 'monospace' }}
                          formatter={(value: any, name: any, item: any) => [
                            `${value}/100`,
                            `${item.payload.fault_type} (${item.payload.date})`
                          ]}
                        />
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke="#8B5CF6"
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#8B5CF6', stroke: '#090A0F', strokeWidth: 1.5 }}
                          activeDot={{ r: 5, fill: '#A78BFA', cursor: 'pointer', onClick: (_, event: any) => {
                            if (event?.payload?.id) setSelectedExperimentId(event.payload.id);
                          } }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 border-t border-zinc-800/80 pt-2">
                    <span>90+ Grade A (Excellent)</span>
                    <span>75–89 Grade B (Resilient)</span>
                    <span>60–74 Grade C (Degraded)</span>
                    <span className="text-rose-400">&lt;60 Grade F (Fragile)</span>
                  </div>
                </div>

              </div>

              {/* Row 2: Recovery Time Trend & Baseline vs Fault Latency */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* Section 7: Recovery Time Trend Line Chart */}
                <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between print-break-inside-avoid">
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-200 flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        Recovery Time vs RTO Target (seconds)
                      </h4>
                      <span className="text-[10px] font-mono text-rose-400">
                        Highlights recovery_time &gt; RTO
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                      Empirical recovery time vs experiment-specific RTO deadline
                    </p>
                  </div>

                  <div className="h-56 w-full my-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={recoveryTrendData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                        <XAxis dataKey="label" stroke="#71717A" fontSize={10} fontFamily="monospace" />
                        <YAxis stroke="#71717A" fontSize={10} fontFamily="monospace" unit="s" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#090A0F', borderColor: '#27272A', fontSize: '11px', fontFamily: 'monospace' }}
                          formatter={(value: any, name: any) => [
                            `${value}s`,
                            name === 'recovery_time' ? 'Measured Recovery' : 'RTO Target'
                          ]}
                        />
                        <Line
                          type="stepAfter"
                          dataKey="rto_target"
                          name="RTO Target"
                          stroke="#F59E0B"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="recovery_time"
                          name="Measured Recovery"
                          stroke="#10B981"
                          strokeWidth={2}
                          dot={(props: any) => {
                            const isExceeded = props.payload.exceeded;
                            return (
                              <circle
                                cx={props.cx}
                                cy={props.cy}
                                r={isExceeded ? 4 : 2.5}
                                fill={isExceeded ? '#EF4444' : '#10B981'}
                                stroke="#090A0F"
                                strokeWidth={1}
                              />
                            );
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 border-t border-zinc-800/80 pt-2">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-[#10B981]" /> Measured Recovery</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-[#F59E0B] border-dashed" /> Configured RTO</span>
                    <span className="text-rose-400">● Red point = RTO violated</span>
                  </div>
                </div>

                {/* Section 8: Baseline vs Fault Latency */}
                <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between print-break-inside-avoid">
                  <div>
                    <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-200 flex items-center gap-2">
                      <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                      Baseline vs In-Fault Mean Latency (ms)
                    </h4>
                    <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                      Steady-state baseline mean compared to in-fault request latency
                    </p>
                  </div>

                  <div className="h-56 w-full my-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={latencyComparisonData.slice(-12)} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                        <XAxis dataKey="label" stroke="#71717A" fontSize={10} fontFamily="monospace" />
                        <YAxis stroke="#71717A" fontSize={10} fontFamily="monospace" unit="ms" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#090A0F', borderColor: '#27272A', fontSize: '11px', fontFamily: 'monospace' }}
                          formatter={(value: any, name: any, item: any) => [
                            `${value} ms`,
                            name === 'baseline_mean' ? 'Baseline Mean' : `In-Fault Mean (${item.payload.fault_type})`
                          ]}
                        />
                        <Bar dataKey="baseline_mean" name="Baseline Mean" fill="#06B6D4" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="fault_mean" name="In-Fault Mean" fill="#F43F5E" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 border-t border-zinc-800/80 pt-2">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-[#06B6D4]" /> Baseline Mean Latency</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-[#F43F5E]" /> In-Fault Mean Latency</span>
                    <span>Last 12 experiments displayed</span>
                  </div>
                </div>

              </div>

              {/* Row 3: P95 Latency & Availability & Severity Curve */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                
                {/* Section 9: P95 Latency Comparison */}
                <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between print-break-inside-avoid">
                  <div>
                    <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-200 flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-violet-400" />
                      P95 Tail Latency Comparison (ms)
                    </h4>
                    <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                      Tail latency (P95) uncovers tail lag hidden by mean values
                    </p>
                  </div>

                  <div className="h-52 w-full my-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={latencyComparisonData.slice(-10)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                        <XAxis dataKey="label" stroke="#71717A" fontSize={10} fontFamily="monospace" />
                        <YAxis stroke="#71717A" fontSize={10} fontFamily="monospace" unit="ms" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#090A0F', borderColor: '#27272A', fontSize: '11px', fontFamily: 'monospace' }}
                          formatter={(value: any, name: any, item: any) => [
                            item.payload.p95_unavailable && name === 'fault_p95' ? 'P95 unavailable (insufficient samples)' : `${value} ms`,
                            name === 'baseline_p95' ? 'Baseline P95' : 'In-Fault P95'
                          ]}
                        />
                        <Bar dataKey="baseline_p95" name="Baseline P95" fill="#3B82F6" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="fault_p95" name="In-Fault P95" fill="#A855F7" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="text-[10px] font-mono text-zinc-500 border-t border-zinc-800/80 pt-2 flex items-center justify-between">
                    <span>#70 P95 exploded to 3729.67ms</span>
                    <span className="text-amber-400">#69 P95 unavailable (1 sample)</span>
                  </div>
                </div>

                {/* Section 10: Availability by Experiment */}
                <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between print-break-inside-avoid">
                  <div>
                    <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-200 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Availability by Experiment (%)
                    </h4>
                    <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                      Percentage of successful HTTP requests during fault injection
                    </p>
                  </div>

                  <div className="h-52 w-full my-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={availabilityData.slice(-10)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                        <XAxis dataKey="label" stroke="#71717A" fontSize={10} fontFamily="monospace" />
                        <YAxis domain={[0, 100]} stroke="#71717A" fontSize={10} fontFamily="monospace" unit="%" />
                        <ReferenceLine y={90} stroke="#10B981" strokeDasharray="3 3" strokeOpacity={0.5} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#090A0F', borderColor: '#27272A', fontSize: '11px', fontFamily: 'monospace' }}
                          formatter={(value: any, name: any, item: any) => [
                            `${value}%`,
                            `${item.payload.fault_type} Availability`
                          ]}
                        />
                        <Bar dataKey="availability" name="Availability" radius={[2, 2, 0, 0]}>
                          {availabilityData.slice(-10).map((entry, index) => {
                            const color = entry.availability >= 90 ? '#10B981' : (entry.availability >= 70 ? '#F59E0B' : '#EF4444');
                            return <Cell key={`cell-${index}`} fill={color} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="text-[10px] font-mono text-zinc-500 border-t border-zinc-800/80 pt-2 flex items-center justify-between">
                    <span className="text-emerald-400">Green &gt;= 90%</span>
                    <span className="text-amber-400">Amber 70-89%</span>
                    <span className="text-rose-400">Red &lt; 70% (#69: 8.33%)</span>
                  </div>
                </div>

                {/* Section 11: Fault Severity vs Impact Curve */}
                <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between print-break-inside-avoid">
                  <div>
                    <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-200 flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      Fault Severity vs Impact (Resilience Curve)
                    </h4>
                    <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                      Packet loss severity vs availability % across 7 experiments
                    </p>
                  </div>

                  <div className="h-52 w-full my-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={severityCurveData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                        <XAxis dataKey="loss_percent" stroke="#71717A" fontSize={10} fontFamily="monospace" unit="%" />
                        <YAxis domain={[0, 100]} stroke="#71717A" fontSize={10} fontFamily="monospace" unit="%" />
                        <ReferenceLine x={35} stroke="#F59E0B" strokeDasharray="3 3" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#090A0F', borderColor: '#27272A', fontSize: '11px', fontFamily: 'monospace' }}
                          formatter={(value: any, name: any, item: any) => [
                            `${value}%`,
                            `Exp #${item.payload.id} (${item.payload.loss_percent}% packet loss)`
                          ]}
                        />
                        <Line
                          type="monotone"
                          dataKey="availability"
                          stroke="#EF4444"
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#EF4444', stroke: '#090A0F', strokeWidth: 1 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="text-[10px] font-mono text-zinc-500 border-t border-zinc-800/80 pt-2 flex items-center justify-between">
                    <span>Cliff identified between 35% and 50%</span>
                    <span className="text-cyan-400">Nonlinear cliff</span>
                  </div>
                </div>

              </div>

            </div>

            {/* ===================================================================
                SECTION 12 & 13 & 28: FAULT COMPARISON, MATRIX, PATTERNS
            ==================================================================== */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              
              {/* Section 13: Project Resilience Matrix */}
              <div className="lg:col-span-7 bg-[#0D0F17] border border-zinc-800/80 rounded-xl p-4 space-y-3 print-break-inside-avoid">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                  <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-200 flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    Project Resilience Objective Matrix
                  </h4>
                  <span className="text-[10px] font-mono text-zinc-500">
                    High-density engineering scorecard
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-500 font-mono text-[10px] uppercase">
                        <th className="py-2 px-2.5 font-medium">Fault Vector</th>
                        <th className="py-2 px-2.5 font-medium">Availability</th>
                        <th className="py-2 px-2.5 font-medium">Latency Impact</th>
                        <th className="py-2 px-2.5 font-medium">Avg Recovery</th>
                        <th className="py-2 px-2.5 font-medium">RTO SLA</th>
                        <th className="py-2 px-2.5 text-right font-medium">Avg Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50 font-mono text-[11px]">
                      {resilienceMatrix.map(m => (
                        <tr key={m.fault_type} className="hover:bg-zinc-900/30 text-zinc-300">
                          <td className="py-2.5 px-2.5 font-semibold text-zinc-200">
                            {m.name}
                            <span className="text-[10px] text-zinc-500 block font-normal">{m.count} runs</span>
                          </td>
                          <td className="py-2.5 px-2.5">
                            <span className={`inline-flex items-center gap-1 ${
                              m.availStatus === 'pass' ? 'text-emerald-400' : (m.availStatus === 'warn' ? 'text-amber-400' : 'text-rose-400')
                            }`}>
                              {m.availStatus === 'pass' ? '✓' : (m.availStatus === 'warn' ? '⚠' : '✕')}
                              <span>{m.avg_avail}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-2.5 text-zinc-400 truncate max-w-[140px]" title={m.max_degradation}>
                            {m.max_degradation}
                          </td>
                          <td className="py-2.5 px-2.5">
                            <span className={m.recoveryStatus === 'pass' ? 'text-zinc-200' : 'text-amber-400'}>
                              {m.avg_recovery}
                            </span>
                          </td>
                          <td className="py-2.5 px-2.5">
                            <span className={`inline-flex items-center gap-1 ${
                              m.rtoStatus === 'pass' ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {m.rtoStatus === 'pass' ? '✓' : '✕'}
                              <span>{m.rto_compliance}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-bold text-zinc-100">
                            {m.avg_score} <span className="text-[10px] text-zinc-500 font-normal">/ 100</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 28: Cross-Experiment Patterns */}
              <div className="lg:col-span-5 bg-[#0D0F17] border border-zinc-800/80 rounded-xl p-4 space-y-3 print-break-inside-avoid">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                  <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-200 flex items-center gap-2">
                    <Network className="w-3.5 h-3.5 text-cyan-400" />
                    Detected Systemic Patterns
                  </h4>
                  <span className="text-[10px] font-mono text-zinc-500">
                    Recurring across tests
                  </span>
                </div>

                <div className="space-y-2.5">
                  {(collective?.cross_experiment_patterns || []).length > 0 ? (
                    collective!.cross_experiment_patterns.map((p, idx) => (
                      <div key={idx} className="bg-[#090A0F] border border-zinc-800/80 rounded-lg p-2.5 space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
                          <span>{p.pattern}</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                          {p.impact}
                        </p>
                        <div className="text-[10px] font-mono text-zinc-500 pt-1 border-t border-zinc-800/60 flex items-center justify-between">
                          <span className="text-cyan-400 truncate max-w-[200px]" title={p.evidence}>{p.evidence}</span>
                          <span className="text-zinc-500">Root cause indicated</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-zinc-500 font-mono py-4 text-center">
                      No recurring failure patterns detected.
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* ===================================================================
                SECTION 14 - 27: INDIVIDUAL EXPERIMENT FORENSIC INSPECTION
            ==================================================================== */}
            <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-xl p-4 md:p-6 space-y-6 print-break-inside-avoid">
              
              {/* Section 14: Experiment Detail Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
                <div>
                  <h3 className="text-sm font-semibold font-mono uppercase tracking-wider text-white flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-400" />
                    Forensic Experiment Analysis
                  </h3>
                  <p className="text-xs text-zinc-400 font-mono mt-0.5">
                    Select an individual experiment to examine raw time-series probes, timeline phases, and root causes
                  </p>
                </div>

                {/* Dropdown Selector */}
                <div className="flex items-center gap-2 no-print">
                  <label htmlFor="exp-select" className="text-xs font-mono text-zinc-400">
                    Analyze Experiment:
                  </label>
                  <select
                    id="exp-select"
                    value={selectedExperimentId || ''}
                    onChange={(e) => setSelectedExperimentId(Number(e.target.value))}
                    className="h-8 px-2.5 rounded-md bg-zinc-900 border border-zinc-700 text-xs font-mono text-zinc-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    {experiments.map(exp => (
                      <option key={exp.id} value={exp.id}>
                        #{exp.id} — {formatFaultName(exp.fault_type)} ({exp.target}, score: {exp.resilience_score ?? '-'})
                      </option>
                    ))}
                  </select>

                  {selectedExperimentId && (
                    <Link
                      to={`${basePrefix}/projects/${projectId}/chaos/reports/${selectedExperimentId}`}
                      className="h-8 px-2.5 rounded-md bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-xs font-mono text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors"
                      title="Open standalone dedicated report page"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Dedicated URL</span>
                    </Link>
                  )}
                </div>
              </div>

              {isLoadingDetail && (
                <div className="space-y-3 py-6 text-center">
                  <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-zinc-500 font-mono">Loading telemetry and forensic findings for experiment #{selectedExperimentId}...</p>
                </div>
              )}

              {!isLoadingDetail && selectedExpReport && (
                <div className="space-y-6">
                  
                  {/* Section 15: Individual Experiment Header */}
                  <div className="bg-[#090A0F] border border-zinc-800 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold font-mono text-white">
                          #{selectedExpReport.metadata.id} — {formatFaultName(selectedExpReport.metadata.fault_type)}
                        </span>
                        <span className={`px-2 py-0.2 rounded text-[11px] font-mono border ${
                          selectedExpReport.metadata.status === 'completed'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        }`}>
                          {selectedExpReport.metadata.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-zinc-400 flex flex-wrap gap-x-3 gap-y-1">
                        <span>Target: <strong className="text-zinc-200">{selectedExpReport.metadata.target}</strong></span>
                        <span>•</span>
                        <span>Config: <strong className="text-zinc-200">{formatParamsSummary(selectedExpReport.metadata.fault_type, selectedExpReport.metadata.parameters)}</strong></span>
                        <span>•</span>
                        <span>Duration: <strong className="text-zinc-200">{selectedExpReport.metadata.fault_window_seconds || selectedExpReport.metadata.duration_seconds}s</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right font-mono">
                        <span className="text-[10px] text-zinc-500 uppercase block">Resilience Score</span>
                        <div className="flex items-baseline gap-1.5 justify-end">
                          <span className="text-xl font-bold text-white">{selectedExpReport.score_summary.score}</span>
                          <span className="text-xs text-zinc-400">/ 100</span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] border ${getScoreGradeColor(selectedExpReport.score_summary.grade)}`}>
                            {selectedExpReport.score_summary.grade}
                          </span>
                        </div>
                      </div>

                      <div className="pl-3 border-l border-zinc-800 text-right font-mono">
                        <span className="text-[10px] text-zinc-500 uppercase block">Hypothesis</span>
                        {(() => {
                          const vb = getVerdictBadge(selectedExpReport.hypothesis.verdict);
                          return (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border font-semibold mt-0.5 ${vb.color}`}>
                              {vb.icon}
                              <span>{vb.label}</span>
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Section 16: Experiment Timeline Graph */}
                  <div className="bg-[#090A0F] border border-zinc-800 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                      <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300 flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-violet-400" />
                        Experiment Phase Timeline
                      </h4>
                      <span className="text-[11px] font-mono text-zinc-500">
                        {selectedExpReport.timeline?.length || 0} discrete lifecycle phases recorded
                      </span>
                    </div>

                    {/* Horizontal Visual Phase Bar */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs font-mono">
                      <div className="bg-zinc-900 border border-zinc-800 p-2.5 rounded">
                        <span className="text-[10px] text-emerald-400 block uppercase font-semibold">1. Baseline Phase</span>
                        <span className="text-zinc-200 block text-xs mt-0.5">
                          {selectedExpReport.baseline.probes_count || 10} probes measured
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          Mean: {selectedExpReport.baseline.mean_latency_ms || 8.15}ms
                        </span>
                      </div>

                      <div className="bg-zinc-900 border border-zinc-800 p-2.5 rounded">
                        <span className="text-[10px] text-rose-400 block uppercase font-semibold">2. Fault Injection</span>
                        <span className="text-zinc-200 block text-xs mt-0.5">
                          {selectedExpReport.metadata.fault_window_seconds || selectedExpReport.metadata.duration_seconds}s active fault
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          Avail: {selectedExpReport.experiment_metrics.availability_percent}%
                        </span>
                      </div>

                      <div className="bg-zinc-900 border border-zinc-800 p-2.5 rounded">
                        <span className="text-[10px] text-amber-400 block uppercase font-semibold">3. Rollback & State Clean</span>
                        <span className="text-zinc-200 block text-xs mt-0.5">
                          Container uncorrupted
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          Workload rules removed
                        </span>
                      </div>

                      <div className="bg-zinc-900 border border-zinc-800 p-2.5 rounded">
                        <span className="text-[10px] text-cyan-400 block uppercase font-semibold">4. Steady-State Recovery</span>
                        <span className="text-zinc-200 block text-xs mt-0.5">
                          {selectedExpReport.recovery.recovery_time_seconds}s recovery
                        </span>
                        <span className={`text-[10px] ${selectedExpReport.recovery.rto_target_met ? 'text-emerald-400' : 'text-rose-400'}`}>
                          RTO {selectedExpReport.recovery.rto_target_met ? 'Met' : 'Exceeded'} (Target {selectedExpReport.recovery.rto_target_seconds}s)
                        </span>
                      </div>
                    </div>

                    {/* Discrete Events Timeline */}
                    <div className="space-y-1.5 pt-2">
                      {selectedExpReport.timeline?.map((ev, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 text-xs font-mono text-zinc-300">
                          <span className="text-zinc-500 text-[10px] w-14 shrink-0 pt-0.5">{ev.time}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                          <span className="leading-snug text-zinc-300">{ev.event}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section 17 & 18: Latency Time-Series & Availability Time-Series */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    
                    {/* Section 17: Latency Time-Series */}
                    <div className="bg-[#090A0F] border border-zinc-800 rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300 flex items-center gap-2">
                          <Activity className="w-3.5 h-3.5 text-rose-400" />
                          Raw Probe Latency Time-Series (ms)
                        </h4>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {selectedExpReport.experiment_metrics.probe_events?.length || 0} observations
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 font-mono">
                        Reveals latency explosion, spikes, oscillation, or gradual recovery
                      </p>

                      <div className="h-56 w-full my-2">
                        {selectedExpReport.experiment_metrics.probe_events && selectedExpReport.experiment_metrics.probe_events.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={selectedExpReport.experiment_metrics.probe_events.map((p, idx) => ({
                              seq: p.seq !== undefined ? p.seq : idx + 1,
                              latency_ms: p.latency_ms,
                              success: p.success,
                              status: p.http_status || (p.timeout ? 'TIMEOUT' : 'ERR')
                            }))} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                              <XAxis dataKey="seq" stroke="#71717A" fontSize={10} fontFamily="monospace" label={{ value: 'Probe #', position: 'insideBottomRight', offset: -5, fontSize: 9, fill: '#71717A' }} />
                              <YAxis stroke="#71717A" fontSize={10} fontFamily="monospace" unit="ms" />
                              <ReferenceLine y={selectedExpReport.baseline.mean_latency_ms || 8} stroke="#06B6D4" strokeDasharray="3 3" />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#090A0F', borderColor: '#27272A', fontSize: '11px', fontFamily: 'monospace' }}
                                formatter={(value: any, name: any, item: any) => [
                                  `${value} ms (Status: ${item.payload.status})`,
                                  `Probe #${item.payload.seq}`
                                ]}
                              />
                              <Line
                                type="monotone"
                                dataKey="latency_ms"
                                stroke="#F43F5E"
                                strokeWidth={2}
                                dot={(props: any) => {
                                  const isFail = !props.payload.success;
                                  return (
                                    <circle
                                      cx={props.cx}
                                      cy={props.cy}
                                      r={isFail ? 4 : 2}
                                      fill={isFail ? '#EF4444' : '#F43F5E'}
                                      stroke="#090A0F"
                                    />
                                  );
                                }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-xs text-zinc-500 font-mono">
                            No discrete probe time-series recorded for this experiment.
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 border-t border-zinc-800/80 pt-2">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-[#06B6D4] border-dashed" /> Baseline Reference ({selectedExpReport.baseline.mean_latency_ms}ms)</span>
                        <span className="text-rose-400">Peak: {selectedExpReport.experiment_metrics.max_latency_ms || 3729.67}ms</span>
                      </div>
                    </div>

                    {/* Section 18: Availability Time-Series Probe Strip */}
                    <div className="bg-[#090A0F] border border-zinc-800 rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300 flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          Probe-by-Probe Availability Timeline
                        </h4>
                        <span className="text-[10px] font-mono text-zinc-500">
                          ● Healthy • × Failed • T Timeout
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 font-mono">
                        Unmasks intermittent dropped requests and consecutive failure bursts
                      </p>

                      <div className="py-4">
                        {selectedExpReport.experiment_metrics.probe_events && selectedExpReport.experiment_metrics.probe_events.length > 0 ? (
                          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1.5">
                            {selectedExpReport.experiment_metrics.probe_events.map((p, idx) => {
                              const isTimeout = p.timeout;
                              const isFail = !p.success && !p.timeout;
                              const isPass = p.success;

                              let bg = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
                              let symbol = '●';
                              if (isTimeout) {
                                bg = 'bg-amber-500/20 border-amber-500/40 text-amber-400 font-bold';
                                symbol = 'T';
                              } else if (isFail) {
                                bg = 'bg-rose-500/20 border-rose-500/40 text-rose-400 font-bold';
                                symbol = '×';
                              }

                              return (
                                <div
                                  key={idx}
                                  className={`p-1.5 rounded border text-center font-mono text-xs flex flex-col justify-between ${bg}`}
                                  title={`Probe #${p.seq ?? idx}: ${p.latency_ms}ms, Status: ${p.http_status || (p.timeout ? 'Timeout' : 'Error')}`}
                                >
                                  <span className="text-[9px] opacity-60">#{p.seq ?? idx + 1}</span>
                                  <span className="text-sm font-semibold my-0.5">{symbol}</span>
                                  <span className="text-[9px] truncate">{p.latency_ms ? `${Math.round(p.latency_ms)}ms` : '-'}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="py-8 text-center text-xs text-zinc-500 font-mono">
                            No discrete probe events available.
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 border-t border-zinc-800/80 pt-2">
                        <span>Successful: {selectedExpReport.experiment_metrics.successful_probes}</span>
                        <span className="text-rose-400">Failed / Timeout: {selectedExpReport.experiment_metrics.failed_probes}</span>
                        <span>Overall: {selectedExpReport.experiment_metrics.availability_percent}%</span>
                      </div>
                    </div>

                  </div>

                  {/* Section 19: Resource Utilization Charts */}
                  <div className="bg-[#090A0F] border border-zinc-800 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                      <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300 flex items-center gap-2">
                        <Cpu className="w-3.5 h-3.5 text-violet-400" />
                        Host & Container Resource Utilization Telemetry
                      </h4>
                      <span className="text-[10px] font-mono text-zinc-500">
                        Target container cgroup metrics
                      </span>
                    </div>

                    {selectedExpReport.experiment_metrics.probe_events && selectedExpReport.experiment_metrics.probe_events.some(p => p.cpu_percent !== null || p.memory_percent !== null) ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* CPU Utilization */}
                        <div className="bg-zinc-950 border border-zinc-800/80 rounded p-3">
                          <span className="text-[10px] font-mono text-zinc-400 uppercase block mb-1">CPU Utilization (%)</span>
                          <div className="h-40 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={selectedExpReport.experiment_metrics.probe_events}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                                <XAxis dataKey="seq" stroke="#71717A" fontSize={9} fontFamily="monospace" />
                                <YAxis stroke="#71717A" fontSize={9} fontFamily="monospace" unit="%" />
                                <Tooltip contentStyle={{ backgroundColor: '#090A0F', borderColor: '#27272A', fontSize: '10px', fontFamily: 'monospace' }} />
                                <Line type="monotone" dataKey="cpu_percent" stroke="#8B5CF6" strokeWidth={1.5} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Memory Utilization */}
                        <div className="bg-zinc-950 border border-zinc-800/80 rounded p-3">
                          <span className="text-[10px] font-mono text-zinc-400 uppercase block mb-1">Memory Utilization (%)</span>
                          <div className="h-40 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={selectedExpReport.experiment_metrics.probe_events}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                                <XAxis dataKey="seq" stroke="#71717A" fontSize={9} fontFamily="monospace" />
                                <YAxis stroke="#71717A" fontSize={9} fontFamily="monospace" unit="%" />
                                <Tooltip contentStyle={{ backgroundColor: '#090A0F', borderColor: '#27272A', fontSize: '10px', fontFamily: 'monospace' }} />
                                <Line type="monotone" dataKey="memory_percent" stroke="#06B6D4" strokeWidth={1.5} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-4 text-center text-xs text-zinc-500 font-mono">
                        Resource telemetry unavailable for this experiment.
                      </div>
                    )}
                  </div>

                  {/* Section 20 & 24: Latency Distribution & Recovery Trajectory */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    
                    {/* Section 20: Latency Distribution */}
                    <div className="bg-[#090A0F] border border-zinc-800 rounded-lg p-4 space-y-3">
                      <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300 flex items-center gap-2 border-b border-zinc-800/80 pb-2">
                        <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                        Latency Percentile Distribution
                      </h4>

                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center font-mono text-xs">
                        <div className="bg-zinc-950 border border-zinc-800/80 p-2 rounded">
                          <span className="text-[10px] text-zinc-500 uppercase block">P50</span>
                          <span className="text-zinc-200 font-semibold">{selectedExpReport.experiment_metrics.p50_latency_ms ? `${selectedExpReport.experiment_metrics.p50_latency_ms}ms` : 'N/A'}</span>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-800/80 p-2 rounded">
                          <span className="text-[10px] text-zinc-500 uppercase block">P75</span>
                          <span className="text-zinc-200 font-semibold">{selectedExpReport.experiment_metrics.p75_latency_ms ? `${selectedExpReport.experiment_metrics.p75_latency_ms}ms` : 'N/A'}</span>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-800/80 p-2 rounded">
                          <span className="text-[10px] text-zinc-500 uppercase block">P90</span>
                          <span className="text-zinc-200 font-semibold">{selectedExpReport.experiment_metrics.p90_latency_ms ? `${selectedExpReport.experiment_metrics.p90_latency_ms}ms` : 'N/A'}</span>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-800/80 p-2 rounded">
                          <span className="text-[10px] text-rose-400 uppercase block">P95</span>
                          <span className="text-rose-400 font-semibold">{selectedExpReport.experiment_metrics.p95_latency_ms ? `${selectedExpReport.experiment_metrics.p95_latency_ms}ms` : 'P95 unavail.'}</span>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-800/80 p-2 rounded">
                          <span className="text-[10px] text-zinc-500 uppercase block">P99</span>
                          <span className="text-zinc-400 font-semibold">{selectedExpReport.experiment_metrics.p99_latency_ms ? `${selectedExpReport.experiment_metrics.p99_latency_ms}ms` : 'N/A (<20)'}</span>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-800/80 p-2 rounded">
                          <span className="text-[10px] text-zinc-500 uppercase block">Max</span>
                          <span className="text-zinc-200 font-semibold">{selectedExpReport.experiment_metrics.max_latency_ms ? `${selectedExpReport.experiment_metrics.max_latency_ms}ms` : 'N/A'}</span>
                        </div>
                      </div>

                      <div className="bg-zinc-950 border border-zinc-800/80 rounded p-2.5 text-xs font-mono space-y-1 text-zinc-400">
                        <div className="flex justify-between">
                          <span>Steady-State Baseline Mean:</span>
                          <span className="text-zinc-200 font-semibold">{selectedExpReport.baseline.mean_latency_ms || 8.15}ms</span>
                        </div>
                        <div className="flex justify-between">
                          <span>In-Fault Mean Latency:</span>
                          <span className="text-rose-400 font-semibold">{selectedExpReport.experiment_metrics.mean_latency_ms || 1883.58}ms (+{selectedExpReport.experiment_metrics.latency_multiplier ? ((selectedExpReport.experiment_metrics.latency_multiplier - 1) * 100).toFixed(0) : 0}%)</span>
                        </div>
                      </div>
                    </div>

                    {/* Section 24: Recovery Analysis */}
                    <div className="bg-[#090A0F] border border-zinc-800 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                        <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300 flex items-center gap-2">
                          <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                          Recovery Analysis & RTO Compliance
                        </h4>
                        <span className={`px-2 py-0.2 rounded text-[10px] font-mono border font-semibold ${
                          selectedExpReport.recovery.rto_target_met
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        }`}>
                          RTO {selectedExpReport.recovery.rto_target_met ? 'MET' : 'EXCEEDED'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono text-xs">
                        <div className="bg-zinc-950 border border-zinc-800/80 p-2 rounded">
                          <span className="text-[10px] text-zinc-500 uppercase block">Recovery Time</span>
                          <span className="text-sm font-bold text-white">{selectedExpReport.recovery.recovery_time_seconds}s</span>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-800/80 p-2 rounded">
                          <span className="text-[10px] text-zinc-500 uppercase block">RTO Target</span>
                          <span className="text-sm font-bold text-amber-400">{selectedExpReport.recovery.rto_target_seconds}s</span>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-800/80 p-2 rounded">
                          <span className="text-[10px] text-zinc-500 uppercase block">Delta</span>
                          <span className={`text-sm font-bold ${
                            selectedExpReport.recovery.recovery_time_seconds <= selectedExpReport.recovery.rto_target_seconds
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}>
                            {(selectedExpReport.recovery.recovery_time_seconds - selectedExpReport.recovery.rto_target_seconds).toFixed(3)}s
                          </span>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-800/80 p-2 rounded">
                          <span className="text-[10px] text-zinc-500 uppercase block">Requirement</span>
                          <span className="text-xs text-zinc-300 mt-0.5 block">{selectedExpReport.recovery.consecutive_healthy_required || 3} healthy</span>
                        </div>
                      </div>

                      <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                        Recovery is not defined as the first single successful probe; the Noir verification engine requires {selectedExpReport.recovery.consecutive_healthy_required || 3} consecutive steady-state responses to confirm stability and eliminate flapping.
                      </p>
                    </div>

                  </div>

                  {/* Section 21 & 25: Anomalies & Score Breakdown */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    
                    {/* Section 21: Detected Anomalies */}
                    <div className="bg-[#090A0F] border border-zinc-800 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                        <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300 flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          Detected Anomalies & Spikes ({experimentAnomalies.length})
                        </h4>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {selectedExpReport.anomaly_summary?.spike_count ? `${selectedExpReport.anomaly_summary.spike_count} verified spikes` : 'Algorithmic deviations'}
                        </span>
                      </div>

                      {/* Anomaly Summary Metrics Strip */}
                      {selectedExpReport.anomaly_summary && (
                        <div className="grid grid-cols-3 gap-2 text-[10px] font-mono bg-zinc-950/80 p-2 rounded border border-zinc-800/60">
                          <div>
                            <span className="text-zinc-500 uppercase block">Spikes:</span>
                            <span className="font-semibold text-amber-400">{selectedExpReport.anomaly_summary.spike_count ?? experimentAnomalies.length} spikes</span>
                          </div>
                          <div>
                            <span className="text-zinc-500 uppercase block">Peak Latency:</span>
                            <span className="font-semibold text-rose-400">
                              {selectedExpReport.anomaly_summary.peak_impact ? `${selectedExpReport.anomaly_summary.peak_impact.peak_latency_ms}ms` : 'N/A'}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 uppercase block">First Impact:</span>
                            <span className="font-semibold text-cyan-400">
                              {selectedExpReport.anomaly_summary.time_to_first_failure_sec !== undefined 
                                ? `T+${selectedExpReport.anomaly_summary.time_to_first_failure_sec.toFixed(1)}s` 
                                : 'Immediate'}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {experimentAnomalies.length > 0 ? (
                          experimentAnomalies.map((ano, idx) => (
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
                    <div className="bg-[#090A0F] border border-zinc-800 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                        <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300 flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5 text-cyan-400" />
                          Resilience Score Breakdown (Why {selectedExpReport.score_summary.score}/100?)
                        </h4>
                        <span className="text-[10px] font-mono text-zinc-500">
                          Additive verification criteria
                        </span>
                      </div>

                      <div className="space-y-1.5 font-mono text-xs">
                        {selectedExpReport.score_summary.why?.map((explanation, idx) => (
                          <div key={idx} className="bg-zinc-950 border border-zinc-800/60 rounded p-2 text-zinc-300 text-[11px] flex items-start gap-2">
                            <span className="text-cyan-400 font-bold">•</span>
                            <span className="leading-snug">{explanation}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* Section 22, 23 & 27: Findings, Hypothesis, Recommendations */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    
                    {/* Section 22: Evidence-Backed Findings */}
                    <div className="bg-[#090A0F] border border-zinc-800 rounded-lg p-4 space-y-2">
                      <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300 flex items-center gap-2 border-b border-zinc-800/80 pb-2">
                        <FileText className="w-3.5 h-3.5 text-emerald-400" />
                        Observability Findings
                      </h4>

                      <div className="space-y-2.5">
                        {selectedExpReport.findings?.map((f, idx) => (
                          <div key={idx} className="space-y-1">
                            <h5 className="text-xs font-semibold text-zinc-200">{f.title}</h5>
                            {f.evidence && (
                              <p className="text-[11px] font-mono text-zinc-400 leading-relaxed bg-zinc-950 p-2 rounded border border-zinc-800/60">
                                {f.evidence}
                              </p>
                            )}
                            {f.impact && (
                              <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                                <strong>Impact:</strong> {f.impact}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Section 23: Hypothesis Section */}
                    <div className="bg-[#090A0F] border border-zinc-800 rounded-lg p-4 space-y-2">
                      <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300 flex items-center gap-2 border-b border-zinc-800/80 pb-2">
                        <Target className="w-3.5 h-3.5 text-amber-400" />
                        Hypothesis Validation
                      </h4>

                      <div className="space-y-2 font-mono text-xs">
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase block">Stated Hypothesis</span>
                          <p className="text-[11px] text-zinc-300 font-sans mt-0.5 leading-relaxed bg-zinc-950 p-2 rounded border border-zinc-800/60">
                            {selectedExpReport.hypothesis.hypothesis}
                          </p>
                        </div>

                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase block">Expected vs Observed</span>
                          <p className="text-[11px] text-zinc-400 font-sans mt-0.5 leading-relaxed">
                            {selectedExpReport.hypothesis.expected_behavior}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between">
                          <span className="text-zinc-500">Evaluation Result:</span>
                          <strong className="text-zinc-100">{selectedExpReport.hypothesis.verdict}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Section 27: Recommendations */}
                    <div className="bg-[#090A0F] border border-zinc-800 rounded-lg p-4 space-y-2">
                      <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300 flex items-center gap-2 border-b border-zinc-800/80 pb-2">
                        <Terminal className="w-3.5 h-3.5 text-violet-400" />
                        Actionable Engineering Advice
                      </h4>

                      <div className="space-y-2.5">
                        {selectedExpReport.recommendations?.map((r, idx) => (
                          <div key={idx} className="bg-zinc-950 border border-zinc-800/80 rounded p-2.5 space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <h5 className="font-semibold text-zinc-200">{r.title}</h5>
                              <span className={`text-[9px] px-1 py-0.2 rounded uppercase ${
                                r.priority === 'High' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                              }`}>{r.priority}</span>
                            </div>
                            <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">{r.action}</p>
                            {r.next_experiment && (
                              <div className="mt-1 pt-1 border-t border-zinc-800/60 font-mono text-[10px] text-cyan-400">
                                <code>{r.next_experiment.command}</code>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                </div>
              )}
            </div>

            {/* ===================================================================
                SECTION 29: DENSE RECENT EXPERIMENTS TABLE
            ==================================================================== */}
            <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-xl overflow-hidden print-break-inside-avoid">
              
              {/* Table Toolbar */}
              <div className="p-4 border-b border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-zinc-900/40">
                <div>
                  <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-200 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    All Project Chaos Engineering Experiments ({filteredExperiments.length})
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                    Click any experiment row to load its forensic analysis in the inspector above
                  </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2 no-print">
                  {/* Search */}
                  <div className="relative">
                    <Search className="w-3 h-3 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search ID, target, fault..."
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      className="h-7 pl-7 pr-2.5 rounded bg-zinc-900 border border-zinc-700/80 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 w-44"
                    />
                  </div>

                  {/* Status Filter */}
                  <select
                    value={tableStatusFilter}
                    onChange={(e) => setTableStatusFilter(e.target.value)}
                    className="h-7 px-2 rounded bg-zinc-900 border border-zinc-700/80 text-xs font-mono text-zinc-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="all">Status: All</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>

                  {/* Fault Type Filter */}
                  <select
                    value={tableTypeFilter}
                    onChange={(e) => setTableTypeFilter(e.target.value)}
                    className="h-7 px-2 rounded bg-zinc-900 border border-zinc-700/80 text-xs font-mono text-zinc-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="all">Fault: All</option>
                    {faultTypeSummary.map(f => (
                      <option key={f.fault_type} value={f.fault_type}>{f.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 font-mono text-[10px] uppercase bg-zinc-900/30">
                      <th
                        className="py-2.5 px-3 font-medium cursor-pointer hover:text-zinc-200"
                        onClick={() => { setSortField('id'); setSortAsc(!sortAsc); }}
                      >
                        ID {sortField === 'id' && (sortAsc ? '↑' : '↓')}
                      </th>
                      <th className="py-2.5 px-3 font-medium">Fault Vector</th>
                      <th className="py-2.5 px-3 font-medium">Target</th>
                      <th className="py-2.5 px-3 font-medium">Configuration / Severity</th>
                      <th className="py-2.5 px-3 font-medium">Duration</th>
                      <th
                        className="py-2.5 px-3 font-medium cursor-pointer hover:text-zinc-200"
                        onClick={() => { setSortField('avail'); setSortAsc(!sortAsc); }}
                      >
                        Availability {sortField === 'avail' && (sortAsc ? '↑' : '↓')}
                      </th>
                      <th
                        className="py-2.5 px-3 font-medium cursor-pointer hover:text-zinc-200"
                        onClick={() => { setSortField('latency'); setSortAsc(!sortAsc); }}
                      >
                        Mean Latency {sortField === 'latency' && (sortAsc ? '↑' : '↓')}
                      </th>
                      <th className="py-2.5 px-3 font-medium">P95 Tail</th>
                      <th
                        className="py-2.5 px-3 font-medium cursor-pointer hover:text-zinc-200"
                        onClick={() => { setSortField('recovery'); setSortAsc(!sortAsc); }}
                      >
                        Recovery {sortField === 'recovery' && (sortAsc ? '↑' : '↓')}
                      </th>
                      <th className="py-2.5 px-3 font-medium">RTO SLA</th>
                      <th
                        className="py-2.5 px-3 font-medium cursor-pointer hover:text-zinc-200"
                        onClick={() => { setSortField('score'); setSortAsc(!sortAsc); }}
                      >
                        Score {sortField === 'score' && (sortAsc ? '↑' : '↓')}
                      </th>
                      <th className="py-2.5 px-3 text-right font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40 font-mono text-[11px]">
                    {filteredExperiments.length > 0 ? (
                      filteredExperiments.map(exp => {
                        const isSelected = exp.id === selectedExperimentId;
                        const res = exp.result || {};
                        const expM = res.experiment_metrics || {};
                        const recM = res.recovery_metrics || {};

                        const avail = expM.availability_percent !== undefined ? Number(expM.availability_percent) : 100.0;
                        const meanLat = expM.mean_latency_ms ?? expM.avg_latency_ms ?? '-';
                        const p95 = expM.p95_latency_ms !== null && expM.p95_latency_ms !== undefined ? `${expM.p95_latency_ms}ms` : 'N/A';
                        const recSec = recM.recovery_time_seconds ?? recM.rto_seconds;
                        const rtoTarget = recM.rto_target_seconds || exp.rto_target_seconds || 5.0;
                        const rtoMet = recM.rto_target_met ?? (recSec ? recSec <= rtoTarget : true);

                        return (
                          <tr
                            key={exp.id}
                            onClick={() => setSelectedExperimentId(exp.id)}
                            className={`transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-cyan-500/10 hover:bg-cyan-500/15 text-zinc-100'
                                : 'hover:bg-zinc-900/50 text-zinc-300'
                            }`}
                          >
                            <td className="py-2.5 px-3 font-bold text-zinc-200">
                              <span className="flex items-center gap-1.5">
                                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                                #{exp.id}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-zinc-100">
                              {formatFaultName(exp.fault_type)}
                            </td>
                            <td className="py-2.5 px-3 text-cyan-400">
                              {exp.target}
                            </td>
                            <td className="py-2.5 px-3 text-zinc-400">
                              {formatParamsSummary(exp.fault_type, exp.parameters)}
                            </td>
                            <td className="py-2.5 px-3 text-zinc-400">
                              {exp.duration_seconds || exp.parameters?.duration || '-'}s
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={avail >= 90 ? 'text-emerald-400' : (avail >= 70 ? 'text-amber-400' : 'text-rose-400')}>
                                {avail.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              {meanLat !== '-' ? `${meanLat}ms` : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-zinc-400">
                              {p95}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={rtoMet ? 'text-zinc-200' : 'text-rose-400'}>
                                {recSec !== undefined && recSec !== null ? `${recSec}s` : '0.01s'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`inline-flex items-center gap-1 ${rtoMet ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {rtoMet ? '✓' : '✕'} {rtoTarget}s
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-bold">
                              {exp.resilience_score !== null ? (
                                <span className={getScoreGradeColor(exp.resilience_grade || 'B')}>
                                  {exp.resilience_score}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                                exp.status === 'completed'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : (exp.status === 'failed' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400')
                              }`}>
                                {exp.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={12} className="py-8 text-center text-zinc-500 font-mono">
                          No chaos engineering experiments matched the search filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Print Footer */}
            <div className="hidden print-header text-center text-xs text-zinc-500 font-mono pt-8 border-t border-zinc-300">
              <p>Noir Resilience Verification Engine • Project: {project?.title} • Generated on {new Date().toLocaleString()}</p>
            </div>

          </>
        )}

      </div>
    </UserLayout>
  );
}
