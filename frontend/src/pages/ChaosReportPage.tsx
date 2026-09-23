import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Printer,
  ArrowLeft,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  Filter,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Square,
  Wifi,
  Radio,
  Cpu,
  HardDrive,
  FileText,
  Activity,
  Layers,
  Server,
  Download,
  ChevronDown,
} from 'lucide-react';
import { apiFetch } from '../utils/api';
import { Skeleton } from '../components/Skeleton';
import { FaultRecord } from '../components/FaultInjectionPanel';

interface ProjectInfo {
  id: number;
  connection_code: string;
  title: string;
  architecture?: string;
  owner?: { username: string; email: string };
}

interface ChaosReportPageProps {
  isCompanyView?: boolean;
}

export default function ChaosReportPage({ isCompanyView = false }: ChaosReportPageProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const faultIdParam = searchParams.get('faultId');
  const initialMode = faultIdParam ? 'single' : 'collective';

  const [mode, setMode] = useState<'single' | 'collective'>(initialMode);
  const [selectedFaultId, setSelectedFaultId] = useState<number | null>(
    faultIdParam ? Number(faultIdParam) : null
  );
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'failed' | 'cancelled'>('all');

  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [faults, setFaults] = useState<FaultRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Sync mode if faultIdParam changes
  useEffect(() => {
    if (faultIdParam) {
      setMode('single');
      setSelectedFaultId(Number(faultIdParam));
    }
  }, [faultIdParam]);

  // Fetch project and faults data
  useEffect(() => {
    if (!projectId) return;

    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      try {
        const [projResp, faultsResp] = await Promise.all([
          apiFetch(`/api/projects/${projectId}/`),
          apiFetch(`/api/projects/${projectId}/faults/`),
        ]);

        if (isMounted) {
          if (projResp.ok) {
            const projData = await projResp.json();
            setProject(projData);
          }
          if (faultsResp.ok) {
            const faultsData = await faultsResp.json();
            setFaults(faultsData);
            // If in single mode and no fault selected yet, pick first
            if (faultIdParam) {
              setSelectedFaultId(Number(faultIdParam));
            } else if (faultsData.length > 0 && mode === 'single') {
              setSelectedFaultId(faultsData[0].id);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load report data:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [projectId]);

  // Selected single fault record
  const currentSingleRecord = useMemo(() => {
    if (!selectedFaultId) return faults[0] || null;
    return faults.find((f) => f.id === selectedFaultId) || faults[0] || null;
  }, [faults, selectedFaultId]);

  // Filtered records for collective view
  const filteredRecords = useMemo(() => {
    if (mode === 'single') return currentSingleRecord ? [currentSingleRecord] : [];
    if (statusFilter === 'all') return faults;
    return faults.filter((r) => r.status === statusFilter);
  }, [mode, currentSingleRecord, faults, statusFilter]);

  // Aggregate metrics for collective view
  const metrics = useMemo(() => {
    const total = faults.length;
    if (total === 0) {
      return { total: 0, completed: 0, failed: 0, cancelled: 0, successRate: 0, totalDuration: 0, containerStats: {}, strategyStats: {} };
    }
    const completed = faults.filter((r) => r.status === 'completed').length;
    const failed = faults.filter((r) => r.status === 'failed').length;
    const cancelled = faults.filter((r) => r.status === 'cancelled').length;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const totalDuration = faults.reduce(
      (acc, r) => acc + (r.duration_seconds || r.result?.duration_seconds || 0),
      0
    );

    const containerStats: Record<string, number> = {};
    const strategyStats: Record<string, number> = {};

    faults.forEach((r) => {
      containerStats[r.target] = (containerStats[r.target] || 0) + 1;
      strategyStats[r.fault_type] = (strategyStats[r.fault_type] || 0) + 1;
    });

    return { total, completed, failed, cancelled, successRate, totalDuration, containerStats, strategyStats };
  }, [faults]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyMarkdown = () => {
    let md = '';
    const now = new Date().toLocaleString();
    const projName = project?.title || `Project ${projectId}`;
    const code = project?.connection_code || '';

    if (mode === 'single' && currentSingleRecord) {
      md = `# Noir Chaos Engineering Experiment Report
**Project:** ${projName} (${code})  
**Report Generated:** ${now}  
**Experiment ID:** #${currentSingleRecord.id}  
**Status:** ${currentSingleRecord.status.toUpperCase()}  

## Specifications
- **Strategy:** ${currentSingleRecord.fault_type}
- **Target Container:** ${currentSingleRecord.target}
- **Hold Duration:** ${currentSingleRecord.duration_seconds ?? currentSingleRecord.result?.duration_seconds ?? 0}s
- **Rollback Recovered:** ${currentSingleRecord.result?.recovered !== false ? 'Yes' : 'No'}
- **Requested By:** ${currentSingleRecord.requested_by?.username || 'User'} (${currentSingleRecord.requested_at})

## Verdict & Message
${currentSingleRecord.result?.message || currentSingleRecord.error_message || 'N/A'}

## Injected Parameters
\`\`\`json
${JSON.stringify(currentSingleRecord.parameters || {}, null, 2)}
\`\`\`
`;
    } else {
      md = `# Noir Chaos Resilience Audit Report
**Project:** ${projName} (${code})  
**Report Date:** ${now}  
**Total Injections:** ${metrics.total} | **Completed:** ${metrics.completed} | **Failed:** ${metrics.failed}  
**System Resilience Score:** ${metrics.successRate}%  

## Audit Matrix
| ID | Strategy | Target | Duration | Status | Requested At |
|---|---|---|---|---|---|
${faults
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

  const handleExportJSON = () => {
    const dataToExport = mode === 'single' ? currentSingleRecord : { project, metrics, records: faults };
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = mode === 'single' ? `fault-report-${currentSingleRecord?.id}.json` : `chaos-resilience-report-${project?.connection_code || projectId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const backLink = isCompanyView
    ? `/company/projects/${projectId}`
    : `/dashboard/projects/${projectId}`;

  return (
    <div className="min-h-screen bg-[#090B10] text-slate-100 font-sans print:bg-white print:text-black">
      {/* TOP APPLICATION CONTROL BAR (no-print) */}
      <header className="no-print sticky top-0 z-40 bg-[#0D0F17]/95 backdrop-blur-md border-b border-white/10 px-4 sm:px-8 py-3">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 font-mono text-xs">
          <div className="flex items-center gap-3">
            <Link
              to={backLink}
              className="h-8 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Project</span>
            </Link>
            <div className="h-4 w-px bg-white/10 hidden sm:block" />
            <div>
              <span className="text-[10px] text-white/40 uppercase block">Report Engine</span>
              <span className="font-bold text-white flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-violet-400" />
                {mode === 'single' ? 'Individual Experiment Report' : 'Project Chaos Resilience Audit'}
              </span>
            </div>
          </div>

          {/* Action & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto justify-end">
            {/* Mode Switcher */}
            <div className="flex items-center bg-black/50 border border-white/10 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => {
                  setMode('collective');
                  setSearchParams({});
                }}
                className={`px-3 py-1 rounded text-xs transition-colors cursor-pointer ${
                  mode === 'collective'
                    ? 'bg-violet-600 text-white font-bold shadow'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Collective Audit
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('single');
                  if (currentSingleRecord) {
                    setSearchParams({ faultId: String(currentSingleRecord.id) });
                  }
                }}
                className={`px-3 py-1 rounded text-xs transition-colors cursor-pointer ${
                  mode === 'single'
                    ? 'bg-violet-600 text-white font-bold shadow'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Single Experiment
              </button>
            </div>

            {/* Individual Fault Selector if in Single Mode */}
            {mode === 'single' && faults.length > 0 && (
              <div className="relative">
                <select
                  value={selectedFaultId || ''}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedFaultId(id);
                    setSearchParams({ faultId: String(id) });
                  }}
                  className="h-8 pl-2.5 pr-7 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-xs font-mono appearance-none cursor-pointer focus:outline-none focus:border-violet-500"
                >
                  {faults.map((f) => (
                    <option key={f.id} value={f.id}>
                      #{f.id} - {f.fault_type} ({f.target}) [{f.status}]
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-white/40 absolute right-2 top-2.5 pointer-events-none" />
              </div>
            )}

            {/* Status Filter for Collective View */}
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

            {/* Copy MD */}
            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="h-8 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Copy markdown summary"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'MD'}</span>
            </button>

            {/* Export JSON */}
            <button
              type="button"
              onClick={handleExportJSON}
              className="h-8 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Download raw audit JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>

            {/* Print Action */}
            <button
              type="button"
              onClick={handlePrint}
              className="h-8 px-4 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-bold transition-all shadow-md shadow-violet-900/30 flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* DOCUMENT PREVIEW CONTAINER */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {isLoading ? (
          <div className="bg-slate-900 border border-white/10 p-12 rounded-2xl max-w-4xl mx-auto space-y-4 font-mono text-xs text-center text-white/50">
            <Skeleton className="h-8 w-64 mx-auto mb-4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6 mx-auto" />
            <Skeleton className="h-32 w-full mt-6" />
          </div>
        ) : (
          <div className="printable-report-container max-w-4xl mx-auto bg-white text-slate-900 p-8 sm:p-14 rounded-2xl shadow-2xl border border-slate-200 font-sans print:border-none print:shadow-none print:m-0 print:p-0 print:max-w-none print:rounded-none">
            {/* REPORT LETTERHEAD */}
            <div className="border-b-2 border-slate-900 pb-5 mb-6 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black tracking-widest text-violet-700 uppercase font-sans">
                      NOIR
                    </span>
                    <span className="text-xs font-mono text-slate-500 tracking-wider">
                      // RESILIENCE & CHAOS AUDIT
                    </span>
                  </div>
                  <h1 className="text-2xl font-black text-slate-950 uppercase mt-1 tracking-tight">
                    {mode === 'single'
                      ? `CHAOS EXPERIMENT REPORT #${currentSingleRecord?.id}`
                      : 'PROJECT RESILIENCE & CHAOS AUDIT REPORT'}
                  </h1>
                </div>

                <div className="text-right space-y-1">
                  <span className="inline-block px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider font-bold rounded bg-slate-100 text-slate-700 border border-slate-300">
                    OFFICIAL DEV/QA AUDIT
                  </span>
                  <div className="text-xs font-mono text-slate-500">
                    Date: {new Date().toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* PROJECT METADATA STRIP */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 font-mono text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase block">Project Title</span>
                  <span className="font-bold text-slate-900">{project?.title || `Project ${projectId}`}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase block">Connection Code</span>
                  <span className="font-bold text-violet-700">{project?.connection_code || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase block">
                    {mode === 'single' ? 'Audit ID' : 'Total Executions'}
                  </span>
                  <span className="font-bold text-slate-900">
                    {mode === 'single' ? `#${currentSingleRecord?.id}` : `${metrics.total} Injections`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase block">Report Generated</span>
                  <span className="font-bold text-slate-700">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>

            {/* SINGLE EXPERIMENT REPORT BODY */}
            {mode === 'single' && currentSingleRecord && (
              <div className="space-y-6">
                {/* STATUS CALLOUT */}
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                    currentSingleRecord.status === 'completed'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : currentSingleRecord.status === 'failed'
                      ? 'bg-rose-50 border-rose-300 text-rose-900'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {currentSingleRecord.status === 'completed' ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                    ) : currentSingleRecord.status === 'failed' ? (
                      <XCircle className="w-6 h-6 text-rose-600 shrink-0" />
                    ) : (
                      <Clock className="w-6 h-6 text-violet-600 shrink-0" />
                    )}
                    <div>
                      <span className="text-xs font-mono uppercase font-bold tracking-wider block">
                        Experiment Outcome: {currentSingleRecord.status.toUpperCase()}
                      </span>
                      <p className="text-xs text-slate-700 mt-0.5">
                        {currentSingleRecord.result?.message || currentSingleRecord.error_message || 'Experiment completed.'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 font-mono">
                    <span className="text-[10px] text-slate-500 uppercase block">Active Hold</span>
                    <span className="text-base font-bold text-slate-900">
                      {(currentSingleRecord.duration_seconds ?? currentSingleRecord.result?.duration_seconds ?? 0).toFixed(2)}s
                    </span>
                  </div>
                </div>

                {/* TECHNICAL SPECIFICATIONS */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1 font-mono">
                    1. Technical Experiment Specifications
                  </h3>
                  <table className="w-full text-left text-xs border border-slate-200 font-mono">
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="p-2.5 text-slate-500 bg-slate-50 w-1/3">Chaos Strategy</td>
                        <td className="p-2.5 font-bold text-violet-700 capitalize">
                          {currentSingleRecord.fault_type.replace('_', ' ')}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-slate-500 bg-slate-50">Target Container / Service</td>
                        <td className="p-2.5 font-bold text-cyan-800">{currentSingleRecord.target}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-slate-500 bg-slate-50">State Rollback Verification</td>
                        <td className="p-2.5 font-bold text-emerald-700">
                          {currentSingleRecord.result?.recovered !== false
                            ? 'Verified Clean Rollback (Passed)'
                            : 'Rollback Incomplete / Degraded'}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-slate-500 bg-slate-50">Requested By</td>
                        <td className="p-2.5 text-slate-800">
                          {currentSingleRecord.requested_by?.username || 'User'} (
                          {currentSingleRecord.requested_by?.email || '-'})
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-slate-500 bg-slate-50">Timestamps</td>
                        <td className="p-2.5 text-slate-800">
                          Dispatched: {new Date(currentSingleRecord.requested_at).toLocaleString()}{' '}
                          {currentSingleRecord.completed_at &&
                            `| Completed: ${new Date(currentSingleRecord.completed_at).toLocaleString()}`}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* PARAMETERS APPLIED */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1 font-mono">
                    2. Injected Parameters & Stress Thresholds
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 font-mono text-xs">
                    {Object.entries(currentSingleRecord.parameters || {}).map(([k, v]) => (
                      <div key={k} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase block">{k.replace('_', ' ')}</span>
                        <span className="font-bold text-violet-800">{String(v)}</span>
                      </div>
                    ))}
                    {(!currentSingleRecord.parameters ||
                      Object.keys(currentSingleRecord.parameters).length === 0) && (
                      <div className="col-span-full p-3 text-slate-500 text-center bg-slate-50 rounded-lg">
                        Standard default execution parameters applied.
                      </div>
                    )}
                  </div>
                </div>

                {/* DIAGNOSTIC ERROR ANALYSIS IF FAILED */}
                {currentSingleRecord.error_message && (
                  <div className="space-y-2 print-avoid-break">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700 border-b border-slate-200 pb-1 font-mono">
                      3. Diagnostics & Failure Root Cause
                    </h3>
                    <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 text-xs font-mono space-y-1">
                      <span className="font-bold block">Observed Error:</span>
                      <pre className="text-xs whitespace-pre-wrap">{currentSingleRecord.error_message}</pre>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* COLLECTIVE RESILIENCE REPORT BODY */}
            {mode === 'collective' && (
              <div className="space-y-6">
                {/* RESILIENCE SCORECARD */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Resilience Score</span>
                    <div className="text-3xl font-black text-emerald-700">{metrics.successRate}%</div>
                    <span className="text-[10px] text-slate-500 block">Rollback & Pass Rate</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Injections</span>
                    <div className="text-3xl font-black text-slate-900">{metrics.total}</div>
                    <span className="text-[10px] text-slate-500 block">Experiments</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Completed / Failed</span>
                    <div className="text-3xl font-black text-cyan-800">
                      {metrics.completed} / {metrics.failed}
                    </div>
                    <span className="text-[10px] text-slate-500 block">Clean vs Degraded</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Stress Time</span>
                    <div className="text-3xl font-black text-amber-700">{metrics.totalDuration.toFixed(1)}s</div>
                    <span className="text-[10px] text-slate-500 block">Active Chaos Duration</span>
                  </div>
                </div>

                {/* DISTRIBUTION GRIDS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <h4 className="font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 text-[11px]">
                      Containers Stress-Tested
                    </h4>
                    <div className="space-y-1.5">
                      {Object.entries(metrics.containerStats).map(([name, count]) => (
                        <div key={name} className="flex justify-between items-center">
                          <span className="text-cyan-800 font-bold">{name}</span>
                          <span className="text-slate-500">{count} test(s)</span>
                        </div>
                      ))}
                      {Object.keys(metrics.containerStats).length === 0 && (
                        <div className="text-slate-400 py-1">No containers recorded.</div>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <h4 className="font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 text-[11px]">
                      Strategies Evaluated
                    </h4>
                    <div className="space-y-1.5">
                      {Object.entries(metrics.strategyStats).map(([st, count]) => (
                        <div key={st} className="flex justify-between items-center">
                          <span className="text-violet-800 font-bold capitalize">{st.replace('_', ' ')}</span>
                          <span className="text-slate-500">{count} execution(s)</span>
                        </div>
                      ))}
                      {Object.keys(metrics.strategyStats).length === 0 && (
                        <div className="text-slate-400 py-1">No strategies recorded.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* AUDIT MATRIX TABLE */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-1 font-mono">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Comprehensive Chaos Injections Audit Log ({filteredRecords.length})
                    </h3>
                    {statusFilter !== 'all' && (
                      <span className="text-xs font-bold text-violet-700">Filter: {statusFilter.toUpperCase()}</span>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border border-slate-200 font-mono">
                      <thead className="bg-slate-100 text-slate-600 uppercase tracking-wider border-b border-slate-200 text-[10px]">
                        <tr>
                          <th className="p-2.5">#ID</th>
                          <th className="p-2.5">Strategy</th>
                          <th className="p-2.5">Target</th>
                          <th className="p-2.5">Parameters</th>
                          <th className="p-2.5">Duration</th>
                          <th className="p-2.5">Rollback</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-slate-800">
                        {filteredRecords.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-500">#{r.id}</td>
                            <td className="p-2.5 font-bold text-violet-800 capitalize">
                              {r.fault_type.replace('_', ' ')}
                            </td>
                            <td className="p-2.5 text-cyan-800 font-semibold">{r.target}</td>
                            <td className="p-2.5 text-slate-500 max-w-[160px] truncate" title={JSON.stringify(r.parameters)}>
                              {Object.entries(r.parameters || {})
                                .map(([k, v]) => `${k}=${v}`)
                                .join(', ') || '-'}
                            </td>
                            <td className="p-2.5 font-bold text-emerald-800">
                              {(r.duration_seconds ?? r.result?.duration_seconds ?? 0).toFixed(1)}s
                            </td>
                            <td className="p-2.5">
                              {r.result?.recovered !== false ? (
                                <span className="text-emerald-700 font-bold">Clean</span>
                              ) : (
                                <span className="text-rose-700 font-bold">Degraded</span>
                              )}
                            </td>
                            <td className="p-2.5 uppercase font-bold text-[11px]">
                              <span
                                className={
                                  r.status === 'completed'
                                    ? 'text-emerald-700'
                                    : r.status === 'failed'
                                    ? 'text-rose-700'
                                    : 'text-slate-500'
                                }
                              >
                                {r.status}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-500 text-[11px]">
                              {new Date(r.requested_at).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                          </tr>
                        ))}
                        {filteredRecords.length === 0 && (
                          <tr>
                            <td colSpan={8} className="p-6 text-center text-slate-400">
                              No records found matching current criteria.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* FAILURE LOG */}
                {metrics.failed > 0 && (
                  <div className="space-y-2 print-avoid-break">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800 border-b border-slate-200 pb-1 font-mono">
                      Recorded Failures & Incidents ({metrics.failed})
                    </h3>
                    <div className="space-y-2 font-mono">
                      {faults
                        .filter((r) => r.status === 'failed' || !!r.error_message)
                        .slice(0, 5)
                        .map((r) => (
                          <div
                            key={r.id}
                            className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1"
                          >
                            <div className="flex justify-between font-bold">
                              <span>
                                #{r.id} — {r.fault_type} on {r.target}
                              </span>
                              <span className="text-rose-600 text-[10px]">
                                {new Date(r.requested_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-xs text-rose-800 font-mono">
                              {r.error_message || r.result?.error || 'Unknown execution failure.'}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AUDITOR SIGN-OFF / FOOTER BLOCK */}
            <div className="print-avoid-break border-t-2 border-slate-900 pt-6 mt-8 space-y-4 font-mono text-xs">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                Audit Verification & Engineering Approval
              </h4>
              <div className="grid grid-cols-3 gap-6 text-slate-600">
                <div className="border-b border-slate-400 pb-2">
                  <span className="block text-[10px] uppercase text-slate-400">Audited By (Lead Engineer)</span>
                  <span className="font-bold text-slate-900">
                    {currentSingleRecord?.requested_by?.username || 'DevOps / QA Engineer'}
                  </span>
                </div>
                <div className="border-b border-slate-400 pb-2">
                  <span className="block text-[10px] uppercase text-slate-400">Signature / Approval</span>
                  <span className="font-bold text-slate-900">VERIFIED — NOIR SYSTEM AUDIT</span>
                </div>
                <div className="border-b border-slate-400 pb-2">
                  <span className="block text-[10px] uppercase text-slate-400">Sign-Off Date</span>
                  <span className="font-bold text-slate-900">{new Date().toLocaleDateString()}</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 flex justify-between pt-2">
                <span>Noir Continuous Resilience & Chaos Engineering Framework</span>
                <span>Page 1 of 1 // Internal Confidential Report</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
