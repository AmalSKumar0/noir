import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Printer,
  ArrowLeft,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Clock,
  Shield,
  Activity,
  Layers,
  Server,
  Download,
  Terminal,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertOctagon,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  Minus,
  Sparkles,
  Zap,
} from 'lucide-react';
import UserLayout from '../components/UserLayout';
import { Skeleton } from '../components/Skeleton';
import { apiFetch } from '../utils/api';

interface ExperimentReportData {
  metadata: {
    id: number;
    project_id: number;
    project_title: string;
    project_code: string;
    fault_type: string;
    target: string;
    status: string;
    duration_seconds: number;
    requested_at: string | null;
    started_at: string | null;
    completed_at: string | null;
    requested_by: { username: string; email: string } | null;
    parameters: Record<string, any>;
  };
  score_summary: {
    score: number;
    grade: string;
    classification: string;
    why: string[];
  };
  executive_summary: string;
  hypothesis: {
    hypothesis: string;
    expected_behavior: string;
    verdict: 'VALIDATED' | 'PARTIALLY VALIDATED' | 'VIOLATED' | 'INCONCLUSIVE';
    confidence: string;
    reason: string;
    criteria_evaluated: Array<{
      criterion: string;
      expected: string;
      actual: string;
      passed: boolean;
    }>;
  };
  timeline: Array<{ time: string; event: string }>;
  baseline: {
    available: boolean;
    probe_url: string;
    http_method: string;
    expected_status: number;
    actual_status: number | null;
    probes_count: number;
    availability_percent: number;
    p50_latency_ms: number | null;
    p95_latency_ms: number | null;
    p99_latency_ms: number | null;
    mean_latency_ms: number | null;
    min_latency_ms: number | null;
    max_latency_ms: number | null;
    connection_errors_count: number;
    http_5xx_count: number;
  };
  experiment_metrics: {
    probes_count: number;
    successful_probes: number;
    failed_probes: number;
    availability_percent: number;
    p50_latency_ms: number | null;
    p95_latency_ms: number | null;
    p99_latency_ms: number | null;
    mean_latency_ms: number | null;
    min_latency_ms: number | null;
    max_latency_ms: number | null;
    latency_multiplier: number;
    connection_errors_count: number;
    http_5xx_count: number;
    sample_errors: string[];
  };
  recovery: {
    recovery_time_seconds: number;
    rto_target_seconds: number;
    rto_target_met: boolean;
    recovered: boolean;
    timed_out: boolean;
    post_recovery_latency_ms: number | null;
    metrics_returned_to_baseline: boolean;
  };
  comparison_table: {
    availability: { baseline: string; during_fault: string; delta: string; percent_change: number | null; status: string };
    p50_latency: { baseline: string; during_fault: string; delta: string; percent_change: number | null; status: string };
    p95_latency: { baseline: string; during_fault: string; delta: string; percent_change: number | null; status: string };
    http_5xx: { baseline: string; during_fault: string; delta: string; percent_change: number | null; status: string };
    connection_errors: { baseline: string; during_fault: string; delta: string; percent_change: number | null; status: string };
  };
  findings: Array<{
    id: string;
    title: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational';
    description: string;
    evidence: string;
    impact: string;
    affected_components: string[];
  }>;
  anomalies: string[];
  root_causes: Array<{
    issue: string;
    confidence: 'High' | 'Medium' | 'Low';
    evidence: string;
    reasoning: string;
  }>;
  recommendations: Array<{
    title: string;
    category: string;
    priority: 'High' | 'Medium' | 'Low';
    reason: string;
    action: string;
    next_experiment?: {
      fault_type: string;
      target: string;
      goal: string;
      command: string;
    };
  }>;
  error_message?: string;
}

interface ChaosExperimentReportPageProps {
  isCompanyView?: boolean;
}

export default function ChaosExperimentReportPage({ isCompanyView = false }: ChaosExperimentReportPageProps) {
  const { projectId, experimentId } = useParams<{ projectId: string; experimentId: string }>();
  const navigate = useNavigate();

  const [report, setReport] = useState<ExperimentReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedMd, setCopiedMd] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedCmdIndex, setCopiedCmdIndex] = useState<number | null>(null);
  const [showScoreWhy, setShowScoreWhy] = useState(false);
  const [showRawEvidence, setShowRawEvidence] = useState(false);

  useEffect(() => {
    if (!projectId || !experimentId) return;

    let isMounted = true;
    async function loadReport() {
      setIsLoading(true);
      setError(null);
      try {
        const resp = await apiFetch(`/api/projects/${projectId}/faults/${experimentId}/report/`);
        if (!resp.ok) {
          throw new Error(`Failed to load experiment report (HTTP ${resp.status})`);
        }
        const data = await resp.json();
        if (isMounted) {
          setReport(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Unable to retrieve chaos experiment report.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadReport();
    return () => {
      isMounted = false;
    };
  }, [projectId, experimentId]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyMarkdown = () => {
    if (!report) return;
    const m = report.metadata;
    const h = report.hypothesis;
    const b = report.baseline;
    const e = report.experiment_metrics;
    const r = report.recovery;

    const md = `# Chaos Engineering Experiment Report: #${m.id} (${m.fault_type.toUpperCase()} on ${m.target})
**Project:** ${m.project_title} (${m.project_code})  
**Date:** ${m.completed_at || m.started_at || 'N/A'}  
**Status:** ${m.status.toUpperCase()}  
**Target Container:** ${m.target}  
**Hold Duration:** ${m.duration_seconds}s  
**Tested By:** ${m.requested_by?.username || 'Engineer'}  

---

## 1. Hypothesis Evaluation
- **Hypothesis:** ${h.hypothesis}
- **Verdict:** **${h.verdict}** (Confidence: ${h.confidence})
- **Verdict Reasoning:** ${h.reason}
- **Expected Behavior:** ${h.expected_behavior}

### Criteria Evaluated
${h.criteria_evaluated.map(c => `- [${c.passed ? 'x' : ' '}] **${c.criterion}**: Expected ${c.expected} | Actual ${c.actual}`).join('\n')}

---

## 2. Resilience Score (Secondary Indicator)
- **Score:** ${report.score_summary.score}/100 (Grade ${report.score_summary.grade}) — ${report.score_summary.classification}
- **Evidence / Why:**
${report.score_summary.why.map(w => `  - ${w}`).join('\n')}

---

## 3. Executive Summary
${report.executive_summary}

---

## 4. Steady-State Baseline vs. In-Fault Impact
| Metric | Steady-State Baseline | During Fault Window | Delta / Change | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Availability** | ${report.comparison_table.availability.baseline} | ${report.comparison_table.availability.during_fault} | ${report.comparison_table.availability.delta} | ${report.comparison_table.availability.status} |
| **P50 Latency** | ${report.comparison_table.p50_latency.baseline} | ${report.comparison_table.p50_latency.during_fault} | ${report.comparison_table.p50_latency.delta} | ${report.comparison_table.p50_latency.status} |
| **P95 Latency** | ${report.comparison_table.p95_latency.baseline} | ${report.comparison_table.p95_latency.during_fault} | ${report.comparison_table.p95_latency.delta} | ${report.comparison_table.p95_latency.status} |
| **HTTP 5xx Errors** | ${report.comparison_table.http_5xx.baseline} | ${report.comparison_table.http_5xx.during_fault} | ${report.comparison_table.http_5xx.delta} | ${report.comparison_table.http_5xx.status} |
| **Connection Errors** | ${report.comparison_table.connection_errors.baseline} | ${report.comparison_table.connection_errors.during_fault} | ${report.comparison_table.connection_errors.delta} | ${report.comparison_table.connection_errors.status} |

---

## 5. Recovery & Rollback Analysis
- **Recovery Time:** ${r.recovery_time_seconds}s
- **RTO Target SLA:** ${r.rto_target_seconds}s (Target Met: ${r.rto_target_met ? 'YES' : 'NO'})
- **Post-Recovery Latency:** ${r.post_recovery_latency_ms ? `${r.post_recovery_latency_ms}ms` : 'Baseline Restored'}
- **Steady State Restored:** ${r.recovered ? 'YES' : 'NO'}

---

## 6. Technical Findings
${report.findings.map(f => `### [${f.severity.toUpperCase()}] ${f.title} (${f.id})
- **Description:** ${f.description}
- **Evidence:** ${f.evidence}
- **Impact:** ${f.impact}
- **Affected Components:** ${f.affected_components.join(', ')}
`).join('\n')}

---

## 7. Root-Cause Indicators
${report.root_causes.map(rc => `- **${rc.issue}** (Confidence: ${rc.confidence})
  - *Evidence:* ${rc.evidence}
  - *Reasoning:* ${rc.reasoning}
`).join('\n')}

---

## 8. Recommendations & Follow-Up Validation Experiments
${report.recommendations.map(rec => `### [${rec.priority}] ${rec.title} (${rec.category})
- **Reason:** ${rec.reason}
- **Action:** ${rec.action}
${rec.next_experiment ? `- **Next Validation Experiment:**
  - *Goal:* ${rec.next_experiment.goal}
  - *Strategy:* ${rec.next_experiment.fault_type} on \`${rec.next_experiment.target}\`
  - *Command:* \`${rec.next_experiment.command}\`
` : ''}`).join('\n')}
`;

    navigator.clipboard.writeText(md);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  const handleCopyJson = () => {
    if (!report) return;
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleCopyCmd = (cmd: string, index: number) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmdIndex(index);
    setTimeout(() => setCopiedCmdIndex(null), 2000);
  };

  const projectBaseRoute = isCompanyView
    ? `/company/projects/${projectId}`
    : `/dashboard/projects/${projectId}`;
  const collectiveRoute = isCompanyView
    ? `/company/projects/${projectId}/chaos/reports`
    : `/dashboard/projects/${projectId}/chaos/reports`;

  return (
    <UserLayout>
      {/* PRINT-SPECIFIC CSS */}
      <style>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 11pt !important;
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
            margin-bottom: 12pt !important;
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
          @page {
            size: A4;
            margin: 15mm;
          }
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 print-full-width">
        {/* TOP BAR / NAVIGATION */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/40 pb-5 no-print">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(projectBaseRoute)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg border border-border/60 hover:bg-muted/40"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Project Overview</span>
            </button>
            <span className="text-muted-foreground/40">/</span>
            <button
              onClick={() => navigate(collectiveRoute)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg border border-border/60 hover:bg-muted/40"
            >
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              <span>Collective Chaos Reports</span>
            </button>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-xs font-mono text-foreground font-medium">Exp #{experimentId}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyMarkdown}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border/60 bg-background/50 hover:bg-muted text-foreground transition-all shadow-sm"
              title="Copy audit report in Markdown format"
            >
              {copiedMd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
              <span>{copiedMd ? 'Copied MD' : 'Copy Markdown'}</span>
            </button>

            <button
              onClick={handleCopyJson}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border/60 bg-background/50 hover:bg-muted text-foreground transition-all shadow-sm"
              title="Export structured report JSON"
            >
              {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5 text-muted-foreground" />}
              <span>{copiedJson ? 'Copied JSON' : 'Export JSON'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-all shadow-sm"
              title="Print native A4 Audit Report or Save to PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Audit / PDF</span>
            </button>
          </div>
        </div>

        {/* LOADING STATE */}
        {isLoading && (
          <div className="space-y-6">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        )}

        {/* ERROR STATE */}
        {!isLoading && error && (
          <div className="p-6 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive space-y-3">
            <div className="flex items-center gap-2 text-base font-semibold">
              <AlertTriangle className="w-5 h-5" />
              <span>Unable to Load Chaos Experiment Report</span>
            </div>
            <p className="text-sm">{error}</p>
            <button
              onClick={() => navigate(projectBaseRoute)}
              className="text-xs underline font-medium text-destructive hover:opacity-80"
            >
              Return to Project Overview
            </button>
          </div>
        )}

        {/* MAIN REPORT CONTENT */}
        {!isLoading && report && (
          <div className="space-y-8">
            {/* 1. SRE AUDIT DOCUMENT HEADER */}
            <div className="p-6 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm print-card space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/30">
                      SRE Chaos Audit
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">
                      ID: #{report.metadata.id}
                    </span>
                    <span className="text-muted-foreground/30">•</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      Ref: {report.metadata.project_code || 'NOIR'}
                    </span>
                  </div>
                  <h1 className="text-2xl font-bold text-foreground mt-2 tracking-tight">
                    Chaos Experiment: {report.metadata.fault_type.replace(/_/g, ' ').toUpperCase()} on {report.metadata.target}
                  </h1>
                  <p className="text-xs text-muted-foreground mt-1">
                    Project: <span className="font-semibold text-foreground">{report.metadata.project_title}</span> • Dispatched: {report.metadata.started_at ? new Date(report.metadata.started_at).toLocaleString() : 'N/A'} • Duration: {report.metadata.duration_seconds}s
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[11px] text-muted-foreground uppercase font-mono tracking-wider">Execution Status</div>
                    <div className={`text-sm font-bold font-mono ${
                      report.metadata.status === 'completed' ? 'text-emerald-400' :
                      report.metadata.status === 'failed' ? 'text-rose-400' : 'text-amber-400'
                    }`}>
                      {report.metadata.status.toUpperCase()}
                    </div>
                  </div>
                  <div className={`w-3.5 h-3.5 rounded-full ${
                    report.metadata.status === 'completed' ? 'bg-emerald-400 animate-pulse' :
                    report.metadata.status === 'failed' ? 'bg-rose-400' : 'bg-amber-400'
                  }`} />
                </div>
              </div>

              {/* TECHNICAL PARAMETERS STRIP */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-xs pt-1">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-mono">Target Container</span>
                  <span className="font-mono font-medium text-foreground truncate block">{report.metadata.target}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-mono">Fault Strategy</span>
                  <span className="font-mono font-medium text-foreground capitalize block">{report.metadata.fault_type.replace(/_/g, ' ')}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-mono">Hold Duration</span>
                  <span className="font-mono font-medium text-foreground block">{report.metadata.duration_seconds}s</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-mono">RTO Target</span>
                  <span className="font-mono font-medium text-foreground block">{report.recovery.rto_target_seconds}s</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-mono">Recovery Time</span>
                  <span className={`font-mono font-medium block ${report.recovery.rto_target_met ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {report.recovery.recovery_time_seconds}s
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-mono">Triggered By</span>
                  <span className="font-medium text-foreground truncate block">{report.metadata.requested_by?.username || 'Engineer'}</span>
                </div>
              </div>
            </div>

            {/* 2. COMPACT HYPOTHESIS STATUS BANNER */}
            <div className={`p-5 rounded-xl border print-card transition-all ${
              report.hypothesis.verdict === 'VALIDATED'
                ? 'bg-emerald-500/5 border-emerald-500/30'
                : report.hypothesis.verdict === 'PARTIALLY VALIDATED'
                ? 'bg-amber-500/5 border-amber-500/30'
                : report.hypothesis.verdict === 'VIOLATED'
                ? 'bg-rose-500/5 border-rose-500/30'
                : 'bg-muted/20 border-border/60'
            }`}>
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className={`px-2.5 py-0.5 rounded text-xs font-bold font-mono uppercase tracking-wider ${
                      report.hypothesis.verdict === 'VALIDATED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : report.hypothesis.verdict === 'PARTIALLY VALIDATED'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : report.hypothesis.verdict === 'VIOLATED'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-muted text-muted-foreground border border-border'
                    }`}>
                      HYPOTHESIS {report.hypothesis.verdict}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      Confidence: {report.hypothesis.confidence}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-foreground pt-1">
                    <span className="text-muted-foreground">Hypothesis:</span> {report.hypothesis.hypothesis}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground/80">Evaluation:</span> {report.hypothesis.reason}
                  </p>
                </div>

                {/* CRITERIA CHECKLIST */}
                <div className="bg-background/40 border border-border/40 rounded-lg p-3 text-xs space-y-1.5 md:min-w-[280px]">
                  <div className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">Evaluation Criteria</div>
                  {report.hypothesis.criteria_evaluated.map((crit, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-muted-foreground truncate">{crit.criterion}</span>
                      <span className={`font-mono font-medium ${crit.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {crit.actual}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. EXPLAINABLE RESILIENCE SUMMARY (SECONDARY CONTEXT) */}
            <div className="p-4 rounded-xl border border-border/50 bg-card/40 print-card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center font-bold font-mono text-sm text-primary">
                    {report.score_summary.grade}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        Resilience Score: {Math.round(report.score_summary.score)}/100
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        ({report.score_summary.classification})
                      </span>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.2 rounded font-mono">
                        Secondary Metric
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      High-level metric derived from availability, tail latency multiplier, and rollback health.
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowScoreWhy(!showScoreWhy)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors self-start sm:self-auto font-mono no-print"
                >
                  <span>{showScoreWhy ? 'Hide calculation details' : 'Why this score?'}</span>
                  {showScoreWhy ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {(showScoreWhy || true) && (
                <div className={`mt-3 pt-3 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground ${!showScoreWhy ? 'hidden sm:grid print:grid' : ''}`}>
                  {report.score_summary.why.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-1.5">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. EXECUTIVE SUMMARY */}
            <div className="p-5 rounded-xl border border-border/60 bg-card/40 print-card space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                <FileText className="w-3.5 h-3.5 text-primary" />
                <span>Executive Summary</span>
              </div>
              <p className="text-sm leading-relaxed text-foreground/90 font-sans">
                {report.executive_summary}
              </p>
            </div>

            {/* 5. STEADY-STATE BASELINE VS. IN-FAULT IMPACT (COMPARATIVE DELTA TABLE) */}
            <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden print-card space-y-0">
              <div className="p-4 border-b border-border/40 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-400" />
                    <span>Steady-State Baseline vs. In-Fault Impact</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Probing Target: <span className="font-mono text-foreground">{report.baseline.probe_url}</span> ({report.baseline.probes_count} baseline probes vs. {report.experiment_metrics.probes_count} in-fault probes)
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left print-table">
                  <thead className="bg-muted/40 text-muted-foreground font-mono uppercase text-[10px] border-b border-border/40">
                    <tr>
                      <th className="py-3 px-4">Metric</th>
                      <th className="py-3 px-4">Steady-State Baseline</th>
                      <th className="py-3 px-4">In-Fault Window</th>
                      <th className="py-3 px-4">Absolute Delta</th>
                      <th className="py-3 px-4">Status / Direction</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30 font-mono">
                    {/* Availability */}
                    <tr className="hover:bg-muted/20">
                      <td className="py-3 px-4 font-sans font-medium text-foreground">Request Availability</td>
                      <td className="py-3 px-4">{report.comparison_table.availability.baseline}</td>
                      <td className="py-3 px-4 font-bold">{report.comparison_table.availability.during_fault}</td>
                      <td className="py-3 px-4">{report.comparison_table.availability.delta}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${
                          report.comparison_table.availability.status === 'Degraded' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                          report.comparison_table.availability.status === 'Improved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-muted text-muted-foreground'
                        }`}>
                          {report.comparison_table.availability.status === 'Degraded' && <TrendingDown className="w-3 h-3" />}
                          {report.comparison_table.availability.status === 'Unchanged' && <Minus className="w-3 h-3" />}
                          <span>{report.comparison_table.availability.status}</span>
                        </span>
                      </td>
                    </tr>

                    {/* P50 Latency */}
                    <tr className="hover:bg-muted/20">
                      <td className="py-3 px-4 font-sans font-medium text-foreground">P50 Latency (Median)</td>
                      <td className="py-3 px-4">{report.comparison_table.p50_latency.baseline}</td>
                      <td className="py-3 px-4 font-bold">{report.comparison_table.p50_latency.during_fault}</td>
                      <td className="py-3 px-4">{report.comparison_table.p50_latency.delta}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${
                          report.comparison_table.p50_latency.status === 'Degraded' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          report.comparison_table.p50_latency.status === 'Improved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-muted text-muted-foreground'
                        }`}>
                          {report.comparison_table.p50_latency.status === 'Degraded' && <TrendingUp className="w-3 h-3" />}
                          {report.comparison_table.p50_latency.status === 'Unchanged' && <Minus className="w-3 h-3" />}
                          <span>{report.comparison_table.p50_latency.status}</span>
                        </span>
                      </td>
                    </tr>

                    {/* P95 Latency */}
                    <tr className="hover:bg-muted/20">
                      <td className="py-3 px-4 font-sans font-medium text-foreground">P95 Tail Latency</td>
                      <td className="py-3 px-4">{report.comparison_table.p95_latency.baseline}</td>
                      <td className="py-3 px-4 font-bold">{report.comparison_table.p95_latency.during_fault}</td>
                      <td className="py-3 px-4">{report.comparison_table.p95_latency.delta}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${
                          report.comparison_table.p95_latency.status === 'Degraded' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          report.comparison_table.p95_latency.status === 'Improved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-muted text-muted-foreground'
                        }`}>
                          {report.comparison_table.p95_latency.status === 'Degraded' && <TrendingUp className="w-3 h-3" />}
                          {report.comparison_table.p95_latency.status === 'Unchanged' && <Minus className="w-3 h-3" />}
                          <span>{report.comparison_table.p95_latency.status}</span>
                        </span>
                      </td>
                    </tr>

                    {/* HTTP 5xx */}
                    <tr className="hover:bg-muted/20">
                      <td className="py-3 px-4 font-sans font-medium text-foreground">HTTP 5xx Server Errors</td>
                      <td className="py-3 px-4">{report.comparison_table.http_5xx.baseline}</td>
                      <td className="py-3 px-4 font-bold">{report.comparison_table.http_5xx.during_fault}</td>
                      <td className="py-3 px-4">{report.comparison_table.http_5xx.delta}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${
                          report.comparison_table.http_5xx.status === 'Degraded' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-muted text-muted-foreground'
                        }`}>
                          <span>{report.comparison_table.http_5xx.status}</span>
                        </span>
                      </td>
                    </tr>

                    {/* Connection Errors */}
                    <tr className="hover:bg-muted/20">
                      <td className="py-3 px-4 font-sans font-medium text-foreground">Socket / Connection Errors</td>
                      <td className="py-3 px-4">{report.comparison_table.connection_errors.baseline}</td>
                      <td className="py-3 px-4 font-bold">{report.comparison_table.connection_errors.during_fault}</td>
                      <td className="py-3 px-4">{report.comparison_table.connection_errors.delta}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${
                          report.comparison_table.connection_errors.status === 'Degraded' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-muted text-muted-foreground'
                        }`}>
                          <span>{report.comparison_table.connection_errors.status}</span>
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 6. RECOVERY & TIMELINE SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* RECOVERY ANALYSIS */}
              <div className="lg:col-span-1 p-5 rounded-xl border border-border/60 bg-card/40 print-card space-y-4">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span>Recovery & Rollback</span>
                </div>

                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-background/50 border border-border/40">
                    <span className="text-[11px] text-muted-foreground block">Measured Recovery Time</span>
                    <span className="text-xl font-bold font-mono text-foreground">
                      {report.recovery.recovery_time_seconds}s
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      Elapsed time after rollback before healthy probes were re-established.
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-background/50 border border-border/40">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">RTO SLA Target</span>
                      <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                        report.recovery.rto_target_met ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                      }`}>
                        {report.recovery.rto_target_met ? 'TARGET MET' : 'RTO EXCEEDED'}
                      </span>
                    </div>
                    <span className="text-base font-bold font-mono text-foreground block mt-1">
                      {report.recovery.rto_target_seconds}s target
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">State Rollback Verified:</span>
                      <span className="font-mono font-medium text-emerald-400">
                        {report.recovery.recovered ? 'Yes (Clean)' : 'No (Failed)'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Post-Recovery Latency:</span>
                      <span className="font-mono font-medium text-foreground">
                        {report.recovery.post_recovery_latency_ms ? `${report.recovery.post_recovery_latency_ms} ms` : 'Nominal'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* CHRONOLOGICAL TIMELINE */}
              <div className="lg:col-span-2 p-5 rounded-xl border border-border/60 bg-card/40 print-card space-y-4">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                  <Terminal className="w-3.5 h-3.5 text-primary" />
                  <span>Chronological Milestones (T-Zero Sequence)</span>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  {report.timeline.map((entry, idx) => (
                    <div key={idx} className="flex items-start gap-3 pb-2 border-b border-border/20 last:border-b-0">
                      <span className="px-2 py-0.5 rounded bg-muted/60 text-muted-foreground font-semibold text-[11px] min-w-[70px] text-center">
                        {entry.time}
                      </span>
                      <span className="text-foreground/90 font-sans text-xs pt-0.5">
                        {entry.event}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 7. TECHNICAL FINDINGS & ANOMALIES */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-rose-400" />
                  <span>Technical Findings ({report.findings.length})</span>
                </h3>
              </div>

              {report.findings.length === 0 ? (
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-xs text-emerald-300">
                  No anomalous failures or severity conditions detected. System handled the injected stress within baseline tolerances.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {report.findings.map((f) => (
                    <div key={f.id} className="p-4 rounded-xl border border-border/60 bg-card/40 print-card space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                          f.severity === 'Critical' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                          f.severity === 'High' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                          f.severity === 'Medium' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          f.severity === 'Low' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                          'bg-muted text-muted-foreground border border-border'
                        }`}>
                          {f.severity} • {f.id}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {f.affected_components.join(', ')}
                        </span>
                      </div>

                      <h4 className="text-sm font-semibold text-foreground pt-1">
                        {f.title}
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {f.description}
                      </p>

                      <div className="pt-2 border-t border-border/40 space-y-1 text-xs">
                        <div>
                          <span className="text-muted-foreground font-mono text-[10px] uppercase block">Evidence:</span>
                          <span className="font-mono text-foreground/90 text-[11px]">{f.evidence}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-mono text-[10px] uppercase block">User / Service Impact:</span>
                          <span className="text-foreground/80 text-[11px]">{f.impact}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 8. ROOT-CAUSE INDICATORS */}
            {report.root_causes.length > 0 && (
              <div className="p-5 rounded-xl border border-border/60 bg-card/40 print-card space-y-4">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                  <Shield className="w-3.5 h-3.5 text-primary" />
                  <span>Root-Cause Indicators ({report.root_causes.length})</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {report.root_causes.map((rc, idx) => (
                    <div key={idx} className="p-3.5 rounded-lg bg-background/50 border border-border/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">{rc.issue}</span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                          rc.confidence === 'High' ? 'bg-purple-500/10 text-purple-400' : 'bg-muted text-muted-foreground'
                        }`}>
                          Confidence: {rc.confidence}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground/80">Reasoning:</span> {rc.reasoning}
                      </p>
                      <div className="text-[11px] font-mono text-foreground/90 bg-muted/30 p-2 rounded border border-border/30">
                        Evidence: {rc.evidence}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 9. ACTIONABLE RECOMMENDATIONS & NEXT VALIDATION EXPERIMENTS */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>Architectural Recommendations & Follow-Up Validation</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Actionable mitigations paired with concrete Noir CLI chaos experiments to re-validate remediation.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {report.recommendations.map((rec, idx) => (
                  <div key={idx} className="p-5 rounded-xl border border-border/60 bg-card/40 print-card space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          rec.priority === 'High' ? 'bg-rose-500/20 text-rose-400' :
                          rec.priority === 'Medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {rec.priority} Priority
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">
                          Category: {rec.category}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-foreground">
                        {rec.title}
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground font-mono text-[10px] uppercase block mb-1">Observed Rationale:</span>
                        <p className="text-foreground/90 leading-relaxed">{rec.reason}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground font-mono text-[10px] uppercase block mb-1">Recommended Action:</span>
                        <p className="text-foreground/90 leading-relaxed">{rec.action}</p>
                      </div>
                    </div>

                    {/* NEXT VALIDATION EXPERIMENT */}
                    {rec.next_experiment && (
                      <div className="mt-3 p-3.5 rounded-lg bg-purple-500/5 border border-purple-500/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-purple-400" />
                            <span>Next Validation Experiment</span>
                          </span>
                          <span className="text-[10px] font-mono text-purple-400 uppercase">
                            Strategy: {rec.next_experiment.fault_type}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground/80">Validation Goal:</span> {rec.next_experiment.goal}
                        </p>
                        <div className="flex items-center justify-between gap-2 bg-background/60 p-2 rounded border border-border/40 font-mono text-xs text-foreground">
                          <code className="truncate">{rec.next_experiment.command}</code>
                          <button
                            onClick={() => handleCopyCmd(rec.next_experiment!.command, idx)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted hover:bg-muted/80 text-[11px] text-muted-foreground hover:text-foreground transition-all shrink-0 no-print"
                            title="Copy command to clipboard"
                          >
                            {copiedCmdIndex === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedCmdIndex === idx ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 10. EXPANDABLE RAW PROBES / SYSTEM EVIDENCE */}
            <div className="rounded-xl border border-border/60 bg-card/40 p-4 print-card">
              <button
                onClick={() => setShowRawEvidence(!showRawEvidence)}
                className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors font-mono no-print"
              >
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Inspect Raw Experiment Data & Probes</span>
                </div>
                {showRawEvidence ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {(showRawEvidence || false) && (
                <div className="mt-4 pt-4 border-t border-border/40 space-y-3 font-mono text-xs">
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground block mb-1">Sample Errors Encountered</span>
                    {report.experiment_metrics.sample_errors.length === 0 ? (
                      <span className="text-muted-foreground italic">None logged.</span>
                    ) : (
                      <pre className="p-3 rounded bg-muted/40 text-rose-300 text-[11px] overflow-x-auto">
                        {report.experiment_metrics.sample_errors.join('\n')}
                      </pre>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground block mb-1">Raw Experiment Parameters</span>
                    <pre className="p-3 rounded bg-muted/40 text-foreground/80 text-[11px] overflow-x-auto">
                      {JSON.stringify(report.metadata.parameters, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* FOOTER */}
            <div className="pt-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground no-print">
              <span>Report Generated by Noir Chaos Engineering Subsystem</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="hover:text-foreground transition-colors"
                >
                  Back to Top ↑
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </UserLayout>
  );
}
