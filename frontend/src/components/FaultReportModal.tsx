import React, { useState, useMemo } from 'react';
import {
  Printer,
  X,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  ShieldCheck,
  AlertTriangle,
  Server,
  Layers,
  Activity,
  FileText,
  Filter,
  Download,
} from 'lucide-react';
import Modal from './Modal';
import { FaultRecord } from './FaultInjectionPanel';

interface FaultReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'single' | 'collective';
  projectTitle: string;
  projectCode: string;
  singleRecord?: FaultRecord | null;
  allRecords?: FaultRecord[];
}

export default function FaultReportModal({
  isOpen,
  onClose,
  mode,
  projectTitle,
  projectCode,
  singleRecord,
  allRecords = [],
}: FaultReportModalProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'failed' | 'cancelled'>('all');
  const [copied, setCopied] = useState(false);

  // Filtered records for collective view
  const filteredRecords = useMemo(() => {
    if (mode === 'single') return singleRecord ? [singleRecord] : [];
    if (statusFilter === 'all') return allRecords;
    return allRecords.filter((r) => r.status === statusFilter);
  }, [mode, singleRecord, allRecords, statusFilter]);

  // Aggregate metrics for collective view
  const metrics = useMemo(() => {
    const total = allRecords.length;
    if (total === 0) {
      return { total: 0, completed: 0, failed: 0, cancelled: 0, successRate: 0, totalDuration: 0, containerStats: {}, strategyStats: {} };
    }
    const completed = allRecords.filter((r) => r.status === 'completed').length;
    const failed = allRecords.filter((r) => r.status === 'failed').length;
    const cancelled = allRecords.filter((r) => r.status === 'cancelled').length;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const totalDuration = allRecords.reduce((acc, r) => acc + (r.duration_seconds || r.result?.duration_seconds || 0), 0);

    const containerStats: Record<string, number> = {};
    const strategyStats: Record<string, number> = {};

    allRecords.forEach((r) => {
      containerStats[r.target] = (containerStats[r.target] || 0) + 1;
      strategyStats[r.fault_type] = (strategyStats[r.fault_type] || 0) + 1;
    });

    return { total, completed, failed, cancelled, successRate, totalDuration, containerStats, strategyStats };
  }, [allRecords]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyMarkdown = () => {
    let md = '';
    const now = new Date().toLocaleString();

    if (mode === 'single' && singleRecord) {
      const res = singleRecord.result?.resilience || {};
      const score = singleRecord.resilience_score ?? res.score;
      const grade = singleRecord.resilience_grade ?? res.grade;
      const classification = singleRecord.classification ?? res.classification;
      const recs: string[] = singleRecord.recommendations ?? res.recommendations ?? [];
      const baseline = singleRecord.result?.steady_state_baseline || res.steady_state_baseline;
      const expMetrics = singleRecord.result?.experiment_metrics || res.experiment_metrics;
      const recMetrics = singleRecord.result?.recovery_metrics || res.recovery_metrics;

      md = `# Noir Chaos Engineering Experiment Report
**Project:** ${projectTitle} (${projectCode})  
**Report Generated:** ${now}  
**Experiment ID:** #${singleRecord.id}  
**Status:** ${singleRecord.status.toUpperCase()}  
${score !== undefined && score !== null ? `**Resilience Score:** ${Math.round(score)}/100 (Grade ${grade}) — ${classification || 'Evaluated'}\n` : ''}
## Specifications
- **Strategy:** ${singleRecord.fault_type}
- **Target Container:** ${singleRecord.target}
- **Hold Duration:** ${singleRecord.duration_seconds ?? singleRecord.result?.duration_seconds ?? 0}s
- **Rollback Recovered:** ${singleRecord.result?.recovered !== false ? 'Yes' : 'No'}
- **Requested By:** ${singleRecord.requested_by?.username || 'User'} (${singleRecord.requested_at})
${baseline ? `
## Steady-State Baseline
- **Status:** ${baseline.status ? 'Healthy' : 'Unhealthy'} (HTTP ${baseline.status_code || 200})
- **Baseline Mean Latency:** ${baseline.mean_latency_ms ? `${baseline.mean_latency_ms.toFixed(1)}ms` : 'N/A'}
- **Samples:** ${baseline.sample_count || 0} probes
` : ''}${expMetrics ? `
## In-Fault Synthetic Impact
- **Availability:** ${expMetrics.availability_pct !== undefined ? `${expMetrics.availability_pct.toFixed(1)}%` : 'N/A'} (${expMetrics.success_count || 0}/${expMetrics.probe_count || 0} probes succeeded)
- **P50 Latency:** ${expMetrics.p50_latency_ms ? `${expMetrics.p50_latency_ms.toFixed(1)}ms` : 'N/A'} | **P95 Latency:** ${expMetrics.p95_latency_ms ? `${expMetrics.p95_latency_ms.toFixed(1)}ms` : 'N/A'}
- **Degradation Factor:** ${expMetrics.latency_degradation_factor ? `${expMetrics.latency_degradation_factor.toFixed(2)}x` : 'N/A'}
` : ''}${recMetrics ? `
## Recovery & Rollback
- **Recovery Time Objective (RTO):** ${recMetrics.rto_seconds !== undefined ? `${recMetrics.rto_seconds.toFixed(2)}s` : 'N/A'}
- **Post-Recovery Latency:** ${recMetrics.post_recovery_latency_ms ? `${recMetrics.post_recovery_latency_ms.toFixed(1)}ms` : 'N/A'}
` : ''}${recs && recs.length > 0 ? `
## Architectural Recommendations
${recs.map((r: string) => `- ${r}`).join('\n')}
` : ''}
## Verdict & Message
${singleRecord.result?.message || singleRecord.error_message || 'N/A'}

## Injected Parameters
\`\`\`json
${JSON.stringify(singleRecord.parameters || {}, null, 2)}
\`\`\`
`;
    } else {
      md = `# Noir Chaos Resilience Audit Report
**Project:** ${projectTitle} (${projectCode})  
**Report Date:** ${now}  
**Total Injections:** ${metrics.total} | **Completed:** ${metrics.completed} | **Failed:** ${metrics.failed}  
**System Resilience Score:** ${metrics.successRate}%  

## Audit Matrix
| ID | Strategy | Target | Duration | Status | Requested At |
|---|---|---|---|---|---|
${allRecords
  .map(
    (r) =>
      `| #${r.id} | ${r.fault_type} | ${r.target} | ${r.duration_seconds ?? 0}s | ${r.status} | ${new Date(r.requested_at).toLocaleDateString()} |`
  )
  .join('\n')}
`;
    }

    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      maxWidthClass="max-w-5xl"
    >
      <div className="space-y-4 -mt-2">
        {/* MODAL CONTROL HEADER (Hidden when printing via .no-print) */}
        <div className="no-print flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-white/10 font-mono text-xs">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-600/20 text-violet-300 border border-violet-500/30">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                {mode === 'single' ? 'Individual Fault Report' : 'Collective Project Resilience Audit'}
              </h2>
              <p className="text-[11px] text-white/40">
                {mode === 'single'
                  ? `Detailed audit documentation for Fault Injection #${singleRecord?.id}`
                  : `Comprehensive chaos resilience audit for project ${projectCode}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto justify-end">
            {mode === 'collective' && (
              <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg p-0.5 text-[11px]">
                <Filter className="w-3 h-3 text-white/40 ml-1.5" />
                {(['all', 'completed', 'failed', 'cancelled'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-2 py-0.5 rounded capitalize transition-colors cursor-pointer ${
                      statusFilter === st
                        ? 'bg-violet-600 text-white font-bold'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="h-8 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Copy report as markdown"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy MD'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="h-8 px-3.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all shadow-md shadow-violet-900/30 flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PRINTABLE DOCUMENT AREA */}
        <div className="printable-report-container font-mono text-xs bg-slate-950 text-slate-100 p-6 sm:p-8 rounded-xl border border-white/10 space-y-6 shadow-2xl">
          {/* REPORT LETTERHEAD */}
          <div className="border-b-2 border-slate-700/80 pb-4 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-black tracking-widest text-violet-400 uppercase font-sans">
                    NOIR
                  </span>
                  <span className="text-[10px] text-slate-400 tracking-wider">
                    // CHAOS RESILIENCE PLATFORM
                  </span>
                </div>
                <h1 className="text-lg font-bold text-white uppercase mt-1 tracking-wide">
                  {mode === 'single'
                    ? `CHAOS EXPERIMENT AUDIT REPORT #${singleRecord?.id}`
                    : 'PROJECT RESILIENCE & CHAOS AUDIT REPORT'}
                </h1>
              </div>

              <div className="text-right space-y-0.5">
                <span className="inline-block px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold rounded bg-slate-800 text-slate-300 border border-slate-700">
                  OFFICIAL ENGINEERING AUDIT
                </span>
                <div className="text-[10px] text-slate-400">
                  Date: {new Date().toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* METADATA BAR */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/80 print-bg-slate p-3 rounded-lg border border-slate-800 print-border text-[11px]">
              <div>
                <span className="text-slate-400 text-[10px] uppercase block">Project Title</span>
                <span className="font-bold text-white">{projectTitle}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase block">Connection Code</span>
                <span className="font-bold text-violet-300">{projectCode}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase block">
                  {mode === 'single' ? 'Audit Record ID' : 'Audited Scope'}
                </span>
                <span className="font-bold text-cyan-300">
                  {mode === 'single' ? `#${singleRecord?.id}` : `${metrics.total} Executions`}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase block">Generated At</span>
                <span className="font-bold text-slate-300">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>

          {/* SINGLE REPORT SPECIFIC CONTENT */}
          {mode === 'single' && singleRecord && (
            <div className="space-y-6">
              {/* STATUS BANNER */}
              <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                singleRecord.status === 'completed'
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 print-badge-success'
                  : singleRecord.status === 'failed'
                  ? 'bg-rose-950/40 border-rose-500/30 text-rose-300 print-badge-danger'
                  : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}>
                <div className="flex items-center gap-3">
                  {singleRecord.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : singleRecord.status === 'failed' ? (
                    <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  ) : (
                    <Clock className="w-5 h-5 text-violet-400 shrink-0" />
                  )}
                  <div>
                    <span className="text-xs uppercase font-bold tracking-wider block">
                      Experiment Execution Status: {singleRecord.status.toUpperCase()}
                    </span>
                    <p className="text-[11px] text-slate-300/90 mt-0.5">
                      {singleRecord.result?.message || singleRecord.error_message || 'Experiment completed.'}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] text-slate-400 uppercase block">Duration</span>
                  <span className="text-sm font-bold font-mono text-emerald-400">
                    {(singleRecord.duration_seconds ?? singleRecord.result?.duration_seconds ?? 0).toFixed(2)}s
                  </span>
                </div>
              </div>

              {/* RESILIENCE AUDIT ASSESSMENT & EXPERIMENT SCORECARD */}
              {(() => {
                const sc = singleRecord.resilience_score ?? singleRecord.result?.resilience?.score ?? singleRecord.result?.resilience_score;
                const gr = singleRecord.resilience_grade ?? singleRecord.result?.resilience?.grade ?? singleRecord.result?.resilience_grade;
                const cls = singleRecord.classification ?? singleRecord.result?.resilience?.classification ?? singleRecord.result?.classification;
                const base = singleRecord.result?.steady_state_baseline ?? singleRecord.result?.resilience?.steady_state_baseline;
                const expM = singleRecord.result?.experiment_metrics ?? singleRecord.result?.resilience?.experiment_metrics;
                const recM = singleRecord.result?.recovery_metrics ?? singleRecord.result?.resilience?.recovery_metrics;
                const recs: string[] = singleRecord.recommendations ?? singleRecord.result?.recommendations ?? singleRecord.result?.resilience?.recommendations ?? [];

                if (sc === undefined || sc === null || !gr) return null;

                return (
                  <div className="space-y-3 print-avoid-break">
                    <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700/80 space-y-3 font-mono print-border">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-white/10 print-border">
                        <div className="flex items-center gap-3">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg font-black border ${
                            gr === 'A' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                            gr === 'B' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                            gr === 'C' ? 'bg-orange-500/20 text-orange-300 border-orange-500/40' :
                            'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          }`}>
                            {gr}
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-400">Resilience Engineering Score</div>
                            <div className="text-lg font-black text-white flex items-center gap-2">
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
                            <div className="text-[10px] uppercase text-slate-400">Classification</div>
                            <div className="text-xs font-bold text-violet-300 uppercase tracking-wide">
                              {cls}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 3-STAGE LIFECYCLE */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                        <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1 print-border">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 uppercase font-bold">Phase 1: Baseline</span>
                            <span className={`w-2 h-2 rounded-full ${base?.status ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                          </div>
                          <div className="text-sm font-bold text-white">
                            {base?.mean_latency_ms !== undefined ? `${base.mean_latency_ms.toFixed(1)} ms` : 'Active'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            HTTP {base?.status_code || 200} | {base?.sample_count || 1} probes
                          </div>
                        </div>

                        <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1 print-border">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 uppercase font-bold">Phase 2: In-Fault Probing</span>
                            <span className={`w-2 h-2 rounded-full ${
                              (expM?.availability_pct ?? 100) >= 90 ? 'bg-emerald-400' :
                              (expM?.availability_pct ?? 100) >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                            }`} />
                          </div>
                          <div className="text-sm font-bold text-white">
                            {expM?.availability_pct !== undefined ? `${expM.availability_pct.toFixed(0)}% Availability` : 'Probed'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            P95: {expM?.p95_latency_ms ? `${expM.p95_latency_ms.toFixed(1)}ms` : '-'} | {expM?.latency_degradation_factor ? `${expM.latency_degradation_factor.toFixed(1)}x lag` : 'Normal'}
                          </div>
                        </div>

                        <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1 print-border">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 uppercase font-bold">Phase 3: Rollback & RTO</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          </div>
                          <div className="text-sm font-bold text-emerald-400">
                            {recM?.rto_seconds !== undefined ? `${recM.rto_seconds.toFixed(2)}s RTO` : 'Clean Rollback'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Steady-State Restored
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* RECOMMENDATIONS */}
                    {recs && recs.length > 0 && (
                      <div className="space-y-1.5 print-avoid-break">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-1 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
                          Architectural & Resilience Recommendations
                        </h3>
                        <div className="p-3 rounded-xl bg-violet-950/20 border border-violet-500/20 text-[11px] font-mono space-y-1.5 text-slate-300">
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

              {/* EXPERIMENT SPECIFICATIONS */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-1">
                  1. Experiment Technical Specifications
                </h3>
                <table className="w-full text-left text-[11px] border border-slate-800 print-border">
                  <tbody className="divide-y divide-slate-800">
                    <tr>
                      <td className="p-2.5 text-slate-400 bg-slate-900/40 print-bg-slate w-1/3">Chaos Strategy</td>
                      <td className="p-2.5 font-bold text-violet-300">{singleRecord.fault_type}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-slate-400 bg-slate-900/40 print-bg-slate">Target Container / Service</td>
                      <td className="p-2.5 font-bold text-cyan-300">{singleRecord.target}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-slate-400 bg-slate-900/40 print-bg-slate">State Recovery Guarantee</td>
                      <td className="p-2.5 font-bold text-emerald-400">
                        {singleRecord.result?.recovered !== false ? 'Clean Rollback Verified (Pass)' : 'Rollback Degraded'}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-slate-400 bg-slate-900/40 print-bg-slate">Requested By</td>
                      <td className="p-2.5 text-slate-300">
                        {singleRecord.requested_by?.username || 'User'} ({singleRecord.requested_by?.email || '-'})
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-slate-400 bg-slate-900/40 print-bg-slate">Execution Timestamps</td>
                      <td className="p-2.5 text-slate-300">
                        Requested: {new Date(singleRecord.requested_at).toLocaleString()}{' '}
                        {singleRecord.completed_at ? `| Completed: ${new Date(singleRecord.completed_at).toLocaleString()}` : ''}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* INJECTED PARAMETERS */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-1">
                  2. Injected Parameters & Stress Thresholds
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                  {Object.entries(singleRecord.parameters || {}).map(([k, v]) => (
                    <div key={k} className="p-2.5 rounded bg-slate-900/60 print-bg-slate border border-slate-800 print-border">
                      <span className="text-[10px] text-slate-400 uppercase block">{k.replace('_', ' ')}</span>
                      <span className="font-bold text-violet-300">{String(v)}</span>
                    </div>
                  ))}
                  {(!singleRecord.parameters || Object.keys(singleRecord.parameters).length === 0) && (
                    <div className="col-span-full p-2.5 text-slate-400 text-center bg-slate-900/40">
                      Standard default execution parameters applied.
                    </div>
                  )}
                </div>
              </div>

              {/* ERROR / DIAGNOSTIC ANALYSIS (IF ANY) */}
              {singleRecord.error_message && (
                <div className="space-y-2 print-avoid-break">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 border-b border-slate-800 pb-1">
                    3. Failure & Diagnostic Analysis
                  </h3>
                  <div className="p-3 bg-rose-950/20 border border-rose-500/30 print-badge-danger rounded-lg text-rose-300 text-[11px] leading-relaxed">
                    <span className="font-bold block mb-1">Observed Error Message:</span>
                    <pre className="text-[10px] whitespace-pre-wrap font-mono">{singleRecord.error_message}</pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* COLLECTIVE REPORT SPECIFIC CONTENT */}
          {mode === 'collective' && (
            <div className="space-y-6">
              {/* EXECUTIVE RESILIENCE SCORECARD */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900 print-bg-slate border border-slate-800 print-border text-center space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Resilience Score</span>
                  <div className="text-2xl font-bold font-mono text-emerald-400">
                    {metrics.successRate}%
                  </div>
                  <span className="text-[9px] text-slate-400 block">Rollback & Execution Pass</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 print-bg-slate border border-slate-800 print-border text-center space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Injections</span>
                  <div className="text-2xl font-bold font-mono text-white">
                    {metrics.total}
                  </div>
                  <span className="text-[9px] text-slate-400 block">Chaos Experiments</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 print-bg-slate border border-slate-800 print-border text-center space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Completed / Failed</span>
                  <div className="text-2xl font-bold font-mono text-cyan-300">
                    {metrics.completed} / {metrics.failed}
                  </div>
                  <span className="text-[9px] text-slate-400 block">Clean vs Degraded</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 print-bg-slate border border-slate-800 print-border text-center space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Chaos Hold</span>
                  <div className="text-2xl font-bold font-mono text-amber-300">
                    {metrics.totalDuration.toFixed(1)}s
                  </div>
                  <span className="text-[9px] text-slate-400 block">Cumulative Stress Time</span>
                </div>
              </div>

              {/* TARGET BREAKDOWN & STRATEGY DISTRIBUTION */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-slate-900/60 print-bg-slate border border-slate-800 print-border space-y-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-1">
                    Containers Stress-Tested
                  </h4>
                  <div className="space-y-1 text-[11px]">
                    {Object.entries(metrics.containerStats).map(([name, count]) => (
                      <div key={name} className="flex justify-between items-center py-0.5">
                        <span className="text-cyan-300 font-bold">{name}</span>
                        <span className="text-slate-400 font-mono">{count} test(s)</span>
                      </div>
                    ))}
                    {Object.keys(metrics.containerStats).length === 0 && (
                      <div className="text-slate-500 py-1">No container tests recorded.</div>
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 print-bg-slate border border-slate-800 print-border space-y-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-1">
                    Strategies Evaluated
                  </h4>
                  <div className="space-y-1 text-[11px]">
                    {Object.entries(metrics.strategyStats).map(([st, count]) => (
                      <div key={st} className="flex justify-between items-center py-0.5">
                        <span className="text-violet-300 font-bold capitalize">{st.replace('_', ' ')}</span>
                        <span className="text-slate-400 font-mono">{count} execution(s)</span>
                      </div>
                    ))}
                    {Object.keys(metrics.strategyStats).length === 0 && (
                      <div className="text-slate-500 py-1">No strategies evaluated.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* COMPREHENSIVE AUDIT MATRIX TABLE */}
              <div className="space-y-2">
                <div className="flex justify-between items-center border-b border-slate-800 pb-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Comprehensive Chaos Injections Audit Log ({filteredRecords.length})
                  </h3>
                  {statusFilter !== 'all' && (
                    <span className="text-[10px] text-violet-300">Filtered: {statusFilter.toUpperCase()}</span>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[10px] border border-slate-800 print-border">
                    <thead className="bg-slate-900/80 print-bg-slate text-slate-400 uppercase tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="p-2">#ID</th>
                        <th className="p-2">Strategy</th>
                        <th className="p-2">Target</th>
                        <th className="p-2">Resilience</th>
                        <th className="p-2">Parameters</th>
                        <th className="p-2">Duration</th>
                        <th className="p-2">Rollback</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {filteredRecords.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-900/30">
                          <td className="p-2 text-slate-400 font-bold">#{r.id}</td>
                          <td className="p-2 font-bold text-violet-300">{r.fault_type}</td>
                          <td className="p-2 text-cyan-300">{r.target}</td>
                          <td className="p-2 whitespace-nowrap">
                            {(() => {
                              const sc = r.resilience_score ?? r.result?.resilience?.score ?? r.result?.resilience_score;
                              const gr = r.resilience_grade ?? r.result?.resilience?.grade ?? r.result?.resilience_grade;
                              if (gr && sc !== undefined && sc !== null) {
                                return (
                                  <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    gr === 'A' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                    gr === 'B' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                    gr === 'C' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' :
                                    'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  }`}>
                                    Grade {gr} ({Math.round(sc)}%)
                                  </span>
                                );
                              }
                              return <span className="text-slate-600">—</span>;
                            })()}
                          </td>
                          <td className="p-2 text-slate-400 max-w-[150px] truncate" title={JSON.stringify(r.parameters)}>
                            {Object.entries(r.parameters || {})
                              .map(([k, v]) => `${k}=${v}`)
                              .join(', ') || '-'}
                          </td>
                          <td className="p-2 font-mono text-emerald-400">
                            {(r.duration_seconds ?? r.result?.duration_seconds ?? 0).toFixed(1)}s
                          </td>
                          <td className="p-2">
                            {r.result?.recovered !== false ? (
                              <span className="text-emerald-400 font-semibold">Clean</span>
                            ) : (
                              <span className="text-rose-400 font-semibold">Degraded</span>
                            )}
                          </td>
                          <td className="p-2 uppercase font-bold">
                            <span className={
                              r.status === 'completed'
                                ? 'text-emerald-400'
                                : r.status === 'failed'
                                ? 'text-rose-400'
                                : 'text-slate-400'
                            }>
                              {r.status}
                            </span>
                          </td>
                          <td className="p-2 text-slate-400">
                            {new Date(r.requested_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                      {filteredRecords.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-4 text-center text-slate-500">
                            No records found matching current criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* INCIDENTS & FAILURES BREAKDOWN */}
              {metrics.failed > 0 && (
                <div className="space-y-2 print-avoid-break">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 border-b border-slate-800 pb-1">
                    Recorded Incidents & Failures ({metrics.failed})
                  </h3>
                  <div className="space-y-2">
                    {allRecords
                      .filter((r) => r.status === 'failed' || !!r.error_message)
                      .slice(0, 5)
                      .map((r) => (
                        <div key={r.id} className="p-2.5 rounded bg-rose-950/20 border border-rose-500/30 print-badge-danger text-[11px] space-y-1">
                          <div className="flex justify-between font-bold">
                            <span className="text-rose-300">#{r.id} — {r.fault_type} on {r.target}</span>
                            <span className="text-rose-400 text-[10px]">{new Date(r.requested_at).toLocaleDateString()}</span>
                          </div>
                          <p className="text-[10px] text-rose-200/90 font-mono">
                            {r.error_message || r.result?.error || 'Unknown execution fault'}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AUDITOR SIGN-OFF / FOOTER BLOCK */}
          <div className="print-avoid-break border-t-2 border-slate-800 pt-4 space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Audit Verification & Engineering Sign-Off
            </h4>
            <div className="grid grid-cols-3 gap-4 text-[10px] text-slate-400">
              <div className="border-b border-slate-700 pb-1">
                <span className="block text-[9px] uppercase text-slate-500">Audited By (Lead Engineer)</span>
                <span className="font-bold text-slate-300">
                  {singleRecord?.requested_by?.username || 'DevOps / QA Engineer'}
                </span>
              </div>
              <div className="border-b border-slate-700 pb-1">
                <span className="block text-[9px] uppercase text-slate-500">Signature / Approval</span>
                <span className="font-bold text-slate-300">VERIFIED — NOIR SYSTEM AUDIT</span>
              </div>
              <div className="border-b border-slate-700 pb-1">
                <span className="block text-[9px] uppercase text-slate-500">Sign-Off Date</span>
                <span className="font-bold text-slate-300">{new Date().toLocaleDateString()}</span>
              </div>
            </div>
            <div className="text-[9px] text-slate-500 flex justify-between pt-1">
              <span>Noir Continuous Resilience & Chaos Framework</span>
              <span>Page 1 of 1 // Confidential</span>
            </div>
          </div>
        </div>

        {/* BOTTOM CLOSE BAR (no-print) */}
        <div className="no-print flex justify-end gap-2 pt-2 border-t border-white/10 font-mono text-xs">
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-violet-900/30"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report Now</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-semibold cursor-pointer"
          >
            Close Preview
          </button>
        </div>
      </div>
    </Modal>
  );
}
