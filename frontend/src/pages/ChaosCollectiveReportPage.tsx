import React, { useState, useEffect, useMemo } from 'react';
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
  Sparkles,
  Zap,
  Filter,
  Flame,
  Search,
} from 'lucide-react';
import UserLayout from '../components/UserLayout';
import { Skeleton } from '../components/Skeleton';
import { apiFetch } from '../utils/api';

interface CollectiveReportData {
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
    priority: 'High' | 'Medium' | 'Low';
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
  follow_up_roadmap: Array<{
    fault_type: string;
    target: string;
    goal: string;
    command: string;
  }>;
}

interface ChaosCollectiveReportPageProps {
  isCompanyView?: boolean;
}

export default function ChaosCollectiveReportPage({ isCompanyView = false }: ChaosCollectiveReportPageProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<CollectiveReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [copiedMd, setCopiedMd] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedCmdIdx, setCopiedCmdIdx] = useState<number | null>(null);

  // Filters for Matrix
  const [strategyFilter, setStrategyFilter] = useState<string>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    if (!projectId) return;

    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const resp = await apiFetch(`/api/projects/${projectId}/chaos/collective-report/`);
        if (!resp.ok) {
          throw new Error(`Failed to load collective chaos report (HTTP ${resp.status})`);
        }
        const raw = await resp.json();
        // Normalize to prevent render crashes on missing/null fields
        const json: CollectiveReportData = {
          project: {
            id: 0,
            title: '',
            connection_code: '',
            architecture: undefined,
            ...(raw.project || {}),
          },
          summary: {
            total_experiments: 0,
            completed: 0,
            failed: 0,
            cancelled: 0,
            hypotheses_validated: 0,
            hypotheses_partially_validated: 0,
            hypotheses_violated: 0,
            hypotheses_inconclusive: 0,
            avg_recovery_seconds: 0,
            longest_recovery_seconds: 0,
            rto_violations_count: 0,
            overall_resilience_score: 0,
            overall_resilience_grade: 'N/A',
            ...(raw.summary || {}),
          },
          overview_matrix: Array.isArray(raw.overview_matrix) ? raw.overview_matrix : [],
          outliers: Array.isArray(raw.outliers) ? raw.outliers : [],
          cross_experiment_patterns: Array.isArray(raw.cross_experiment_patterns) ? raw.cross_experiment_patterns : [],
          consolidated_recommendations: Array.isArray(raw.consolidated_recommendations) ? raw.consolidated_recommendations : [],
          follow_up_roadmap: Array.isArray(raw.follow_up_roadmap) ? raw.follow_up_roadmap : [],
        };
        if (isMounted) {
          setData(json);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Unable to retrieve collective chaos report.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [projectId]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyMarkdown = () => {
    if (!data) return;
    const p = data.project;
    const s = data.summary;

    const md = `# Noir Collective Chaos Engineering Audit Report
**Project:** ${p.title} (${p.connection_code})  
**Report Generated:** ${new Date().toLocaleString()}  
**Total Experiments Executed:** ${s.total_experiments}  
**Hypotheses Validated:** ${s.hypotheses_validated} / ${s.total_experiments} (Violations: ${s.hypotheses_violated})  
**Average Recovery Time:** ${s.avg_recovery_seconds}s (RTO Violations: ${s.rto_violations_count})  
**Secondary Resilience Score:** ${s.overall_resilience_score}/100 (Grade ${s.overall_resilience_grade})  

---

## 1. Outlier-First Analysis (Standout Experiments)
${data.outliers.length === 0 ? 'No extreme degradation outliers observed.' : data.outliers.map(o => `### Exp #${o.id}: ${o.fault_type.toUpperCase()} on ${o.target}
- **Standout Reason:** ${o.standout_reason}
- **Availability:** ${o.availability} | **P95 Latency:** ${o.p95_latency} | **Recovery Time:** ${o.recovery_time}
- **Likely Issue:** ${o.likely_issue}
- **Remediation:** ${o.recommended_action}
`).join('\n')}

---

## 2. Cross-Experiment Recurring Failure Patterns
${data.cross_experiment_patterns.length === 0 ? 'No recurring cross-experiment failure patterns detected.' : data.cross_experiment_patterns.map(cp => `### Pattern: ${cp.pattern}
- **Evidence:** ${cp.evidence}
- **Service Impact:** ${cp.impact}
- **Root Cause Direction:** ${cp.root_cause_direction}
`).join('\n')}

---

## 3. Consolidated & Deduplicated Recommendations
${data.consolidated_recommendations.map(cr => `### [${cr.priority}] ${cr.title} (${cr.occurrences}x detected)
- **Category:** ${cr.category}
- **Rationale:** ${cr.reason}
- **Action:** ${cr.action}
${cr.next_experiment ? `- **Follow-up Validation:** \`${cr.next_experiment.command}\`
` : ''}`).join('\n')}

---

## 4. Complete Experiment Matrix
| ID | Fault Strategy | Target Container | Status | Outcome | Recovery Time | RTO Target | Key Technical Finding |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${data.overview_matrix.map(m => `| #${m.id} | ${m.fault_type} | ${m.target} | ${m.status} | ${m.outcome} | ${m.recovery_time} | ${m.rto_target} | ${m.key_finding} |`).join('\n')}
`;

    navigator.clipboard.writeText(md);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  const handleCopyJson = () => {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleCopyCmd = (cmd: string, idx: number) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmdIdx(idx);
    setTimeout(() => setCopiedCmdIdx(null), 2000);
  };

  const projectBaseRoute = isCompanyView
    ? `/company/projects/${projectId}`
    : `/dashboard/projects/${projectId}`;

  const getExperimentReportUrl = (expId: number) =>
    isCompanyView
      ? `/company/projects/${projectId}/chaos/reports/${expId}`
      : `/dashboard/projects/${projectId}/chaos/reports/${expId}`;

  // Filtered Overview Matrix
  const filteredMatrix = useMemo(() => {
    if (!data) return [];
    return data.overview_matrix.filter((item) => {
      const matchStrategy = strategyFilter === 'all' || item.fault_type === strategyFilter;
      const matchOutcome = outcomeFilter === 'all' || item.outcome.toLowerCase().includes(outcomeFilter.toLowerCase());
      const matchSearch =
        searchTerm.trim() === '' ||
        item.target.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.fault_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.key_finding.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.id.toString() === searchTerm.trim();
      return matchStrategy && matchOutcome && matchSearch;
    });
  }, [data, strategyFilter, outcomeFilter, searchTerm]);

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
            <span className="text-xs font-mono text-foreground font-medium flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              Collective Chaos Report
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyMarkdown}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border/60 bg-background/50 hover:bg-muted text-foreground transition-all shadow-sm"
              title="Copy collective report in Markdown format"
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
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        )}

        {/* ERROR STATE */}
        {!isLoading && error && (
          <div className="p-6 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive space-y-3">
            <div className="flex items-center gap-2 text-base font-semibold">
              <AlertTriangle className="w-5 h-5" />
              <span>Unable to Load Collective Chaos Report</span>
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

        {/* REPORT CONTENT */}
        {!isLoading && data && (
          <div className="space-y-8">
            {/* 1. SRE COLLECTIVE AUDIT HEADER */}
            <div className="p-6 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm print-card space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/30">
                      SRE Collective Resilience Audit
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      Ref: {data.project.connection_code || 'NOIR'}
                    </span>
                  </div>
                  <h1 className="text-2xl font-bold text-foreground mt-2 tracking-tight">
                    Project Chaos Engineering Audit Report
                  </h1>
                  <p className="text-xs text-muted-foreground mt-1">
                    Target Project: <span className="font-semibold text-foreground">{data.project.title}</span> • Generated: {new Date().toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Secondary Score</div>
                    <div className="text-lg font-bold font-mono text-foreground">
                      {data.summary.overall_resilience_score}/100
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center font-bold font-mono text-base text-primary">
                    {data.summary.overall_resilience_grade}
                  </div>
                </div>
              </div>

              {/* AUDIT SUMMARY STATS STRIP */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-xs pt-1">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-mono">Total Experiments</span>
                  <span className="font-mono font-medium text-foreground text-sm block">{data.summary.total_experiments}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-mono">Hypotheses Validated</span>
                  <span className="font-mono font-medium text-emerald-400 text-sm block">
                    {data.summary.hypotheses_validated} / {data.summary.total_experiments}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-mono">Hypotheses Violated</span>
                  <span className={`font-mono font-medium text-sm block ${data.summary.hypotheses_violated > 0 ? 'text-rose-400' : 'text-muted-foreground'}`}>
                    {data.summary.hypotheses_violated}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-mono">Avg Recovery Time</span>
                  <span className="font-mono font-medium text-foreground text-sm block">{data.summary.avg_recovery_seconds}s</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-mono">Max Recovery Time</span>
                  <span className="font-mono font-medium text-foreground text-sm block">{data.summary.longest_recovery_seconds}s</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-mono">RTO Target Breaches</span>
                  <span className={`font-mono font-medium text-sm block ${data.summary.rto_violations_count > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {data.summary.rto_violations_count}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. OUTLIER-FIRST ANALYSIS (STANDOUT EXPERIMENTS) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Flame className="w-4 h-4 text-rose-400" />
                    <span>Outlier-First Analysis (Standout Degradations)</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Experiments that exposed critical failure modes: availability drops, severe tail spikes, or violated hypotheses.
                  </p>
                </div>
              </div>

              {data.outliers.length === 0 ? (
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-xs text-emerald-300">
                  No statistical outliers or critical degradation anomalies detected across executed experiments.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.outliers.map((outlier) => (
                    <div key={outlier.id} className="p-4 rounded-xl border border-border/60 bg-card/40 print-card space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            Outlier #{outlier.id}
                          </span>
                          <span className="text-xs font-mono font-medium text-foreground">
                            {outlier.fault_type.replace(/_/g, ' ')} on {outlier.target}
                          </span>
                        </div>
                        <Link
                          to={getExperimentReportUrl(outlier.id)}
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-mono no-print"
                        >
                          <span>View Audit</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </Link>
                      </div>

                      <div className="p-2.5 rounded bg-rose-500/5 border border-rose-500/20 text-xs font-mono text-rose-300">
                        {outlier.standout_reason}
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs font-mono text-muted-foreground pt-1">
                        <div>
                          <span className="text-[10px] block uppercase">Availability</span>
                          <span className="font-semibold text-foreground">{outlier.availability}</span>
                        </div>
                        <div>
                          <span className="text-[10px] block uppercase">P95 Latency</span>
                          <span className="font-semibold text-foreground">{outlier.p95_latency}</span>
                        </div>
                        <div>
                          <span className="text-[10px] block uppercase">Recovery</span>
                          <span className="font-semibold text-foreground">{outlier.recovery_time}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border/40 space-y-1 text-xs">
                        <div>
                          <span className="text-muted-foreground text-[10px] uppercase font-mono block">Likely Technical Issue:</span>
                          <span className="text-foreground/90">{outlier.likely_issue}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-[10px] uppercase font-mono block">Remediation Action:</span>
                          <span className="text-foreground/80">{outlier.recommended_action}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. CROSS-EXPERIMENT PATTERN DETECTION */}
            {data.cross_experiment_patterns.length > 0 && (
              <div className="p-5 rounded-xl border border-border/60 bg-card/40 print-card space-y-4">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  <span>Cross-Experiment Failure Patterns ({data.cross_experiment_patterns.length})</span>
                </div>

                <div className="space-y-3">
                  {data.cross_experiment_patterns.map((pat, idx) => (
                    <div key={idx} className="p-4 rounded-lg bg-background/50 border border-border/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-foreground">{pat.pattern}</h4>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-purple-500/10 text-purple-400">
                          Recurring Pattern
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground/80">Observed Evidence:</span> {pat.evidence}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                        <div>
                          <span className="text-muted-foreground font-mono text-[10px] uppercase block">Service Impact:</span>
                          <span className="text-foreground/90">{pat.impact}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-mono text-[10px] uppercase block">Root Cause Direction:</span>
                          <span className="text-foreground/90">{pat.root_cause_direction}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. CONSOLIDATED & DEDUPLICATED RECOMMENDATIONS */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>Consolidated Recommendations & Roadmap</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Deduplicated action items prioritized by impact and paired with follow-up validation experiments.
                </p>
              </div>

              <div className="space-y-3">
                {data.consolidated_recommendations.map((rec, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-border/60 bg-card/40 print-card space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          rec.priority === 'High' ? 'bg-rose-500/20 text-rose-400' :
                          rec.priority === 'Medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {rec.priority} Priority
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">
                          {rec.category} • Detected in {rec.occurrences} experiment{rec.occurrences > 1 ? 's' : ''}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-foreground">{rec.title}</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground font-mono text-[10px] uppercase block mb-1">Reason:</span>
                        <p className="text-foreground/90">{rec.reason}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground font-mono text-[10px] uppercase block mb-1">Action:</span>
                        <p className="text-foreground/90">{rec.action}</p>
                      </div>
                    </div>

                    {rec.next_experiment && (
                      <div className="mt-2 p-3 rounded-lg bg-purple-500/5 border border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-mono uppercase text-purple-400 font-bold block">Next Validation Experiment</span>
                          <span className="text-foreground/90">{rec.next_experiment.goal}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono bg-background/60 p-1.5 rounded border border-border/40 shrink-0">
                          <code className="text-[11px] truncate max-w-xs">{rec.next_experiment.command}</code>
                          <button
                            onClick={() => handleCopyCmd(rec.next_experiment!.command, idx)}
                            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground no-print"
                            title="Copy command"
                          >
                            {copiedCmdIdx === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 5. COMPLETE EXPERIMENTS MATRIX TABLE */}
            <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden print-card space-y-0">
              <div className="p-4 border-b border-border/40 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-400" />
                    <span>Complete Experiment Audit Matrix</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Historical record of all chaos experiments executed against project containers.
                  </p>
                </div>

                {/* FILTERS */}
                <div className="flex flex-wrap items-center gap-2 no-print">
                  <div className="relative">
                    <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search container/target..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-7 pr-2.5 py-1 text-xs rounded-lg border border-border/60 bg-background/50 text-foreground w-40 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <select
                    value={strategyFilter}
                    onChange={(e) => setStrategyFilter(e.target.value)}
                    className="py-1 px-2.5 text-xs rounded-lg border border-border/60 bg-background/50 text-foreground focus:outline-none"
                  >
                    <option value="all">All Strategies</option>
                    <option value="container_stop">container_stop</option>
                    <option value="container_restart">container_restart</option>
                    <option value="network_delay">network_delay</option>
                    <option value="network_loss">network_loss</option>
                    <option value="cpu_stress">cpu_stress</option>
                    <option value="memory_stress">memory_stress</option>
                  </select>

                  <select
                    value={outcomeFilter}
                    onChange={(e) => setOutcomeFilter(e.target.value)}
                    className="py-1 px-2.5 text-xs rounded-lg border border-border/60 bg-background/50 text-foreground focus:outline-none"
                  >
                    <option value="all">All Outcomes</option>
                    <option value="validated">Validated</option>
                    <option value="violated">Violated</option>
                    <option value="partially">Partially Validated</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left print-table">
                  <thead className="bg-muted/40 text-muted-foreground font-mono uppercase text-[10px] border-b border-border/40">
                    <tr>
                      <th className="py-3 px-4">ID</th>
                      <th className="py-3 px-4">Fault Strategy</th>
                      <th className="py-3 px-4">Target Container</th>
                      <th className="py-3 px-4">Hypothesis Outcome</th>
                      <th className="py-3 px-4">Recovery Time</th>
                      <th className="py-3 px-4">RTO Target</th>
                      <th className="py-3 px-4">Key Finding</th>
                      <th className="py-3 px-4 text-right no-print">Audit Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30 font-mono">
                    {filteredMatrix.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-muted-foreground font-sans">
                          No chaos experiments matched your filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredMatrix.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/20">
                          <td className="py-3 px-4 font-bold text-foreground">#{item.id}</td>
                          <td className="py-3 px-4 capitalize font-sans">{item.fault_type.replace(/_/g, ' ')}</td>
                          <td className="py-3 px-4 text-foreground/90">{item.target}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                              item.outcome === 'VALIDATED' ? 'bg-emerald-500/10 text-emerald-400' :
                              item.outcome === 'PARTIALLY VALIDATED' ? 'bg-amber-500/10 text-amber-400' :
                              item.outcome === 'VIOLATED' ? 'bg-rose-500/10 text-rose-400' : 'bg-muted text-muted-foreground'
                            }`}>
                              {item.outcome}
                            </span>
                          </td>
                          <td className="py-3 px-4">{item.recovery_time}</td>
                          <td className="py-3 px-4 text-muted-foreground">{item.rto_target}</td>
                          <td className="py-3 px-4 font-sans text-muted-foreground max-w-xs truncate" title={item.key_finding}>
                            {item.key_finding}
                          </td>
                          <td className="py-3 px-4 text-right no-print">
                            <Link
                              to={getExperimentReportUrl(item.id)}
                              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                            >
                              <span>View Report</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* FOOTER */}
            <div className="pt-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground no-print">
              <span>Noir Chaos Engineering SRE Audit System</span>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="hover:text-foreground transition-colors"
              >
                Back to Top ↑
              </button>
            </div>
          </div>
        )}
      </div>
    </UserLayout>
  );
}
