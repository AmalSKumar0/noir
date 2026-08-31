import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FlaskConical, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Terminal, 
  Search, 
  Copy, 
  Check, 
  Download, 
  Clock, 
  Activity, 
  Filter, 
  TrendingUp, 
  X, 
  ChevronRight,
  ShieldAlert,
  BarChart3
} from 'lucide-react';

export interface TestRunItem {
  id: number;
  project: number;
  project_id: number;
  project_title: string;
  executor_id: number;
  executor_username: string;
  executor_email?: string;
  executor_first_name?: string;
  executor_last_name?: string;
  team_id: number | null;
  team_name: string | null;
  suite_name: string;
  status: 'passed' | 'failed' | 'running' | 'error';
  command: string;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  skipped_tests: number;
  duration_ms: number;
  logs: string;
  created_at: string;
}

interface TestHistoryAnalyticsProps {
  testRuns: TestRunItem[];
  isLoading?: boolean;
}

export default function TestHistoryAnalytics({ testRuns, isLoading = false }: TestHistoryAnalyticsProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'passed' | 'failed'>('all');
  const [developerFilter, setDeveloperFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRun, setSelectedRun] = useState<TestRunItem | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Compute failure matrix & analytics
  const totalRuns = testRuns.length;
  const passedRuns = testRuns.filter(r => r.status === 'passed').length;
  const failedRuns = testRuns.filter(r => r.status === 'failed' || r.status === 'error').length;
  const passRate = totalRuns > 0 ? ((passedRuns / totalRuns) * 100).toFixed(1) : '0';
  const avgDurationMs = totalRuns > 0 ? Math.round(testRuns.reduce((acc, r) => acc + r.duration_ms, 0) / totalRuns) : 0;
  
  // Total individual failed tests across all runs
  const totalIndividualFailedTests = testRuns.reduce((acc, r) => acc + r.failed_tests, 0);

  // Extract unique developers for developer filter dropdown
  const uniqueDevelopers = Array.from(
    new Map(
      testRuns
        .filter(r => r.executor_id || r.executor_username)
        .map(r => [
          r.executor_id || r.executor_username,
          {
            id: String(r.executor_id || r.executor_username),
            username: r.executor_username,
            name: `${r.executor_first_name || ''} ${r.executor_last_name || ''}`.trim() || r.executor_username,
            email: r.executor_email
          }
        ])
    ).values()
  );

  // Filtered runs
  const filteredRuns = testRuns.filter((run) => {
    const matchesStatus = 
      statusFilter === 'all' ? true :
      statusFilter === 'passed' ? run.status === 'passed' :
      (run.status === 'failed' || run.status === 'error');

    const matchesDev = 
      developerFilter === 'all' ? true :
      String(run.executor_id) === developerFilter || run.executor_username === developerFilter;

    const query = searchQuery.toLowerCase();
    const matchesQuery = 
      !query ||
      run.suite_name.toLowerCase().includes(query) ||
      run.command.toLowerCase().includes(query) ||
      (run.project_title && run.project_title.toLowerCase().includes(query)) ||
      (run.executor_username && run.executor_username.toLowerCase().includes(query)) ||
      (run.executor_email && run.executor_email.toLowerCase().includes(query)) ||
      (run.executor_first_name && run.executor_first_name.toLowerCase().includes(query)) ||
      (run.executor_last_name && run.executor_last_name.toLowerCase().includes(query)) ||
      (run.logs && run.logs.toLowerCase().includes(query));

    return matchesStatus && matchesDev && matchesQuery;
  });

  const handleCopyLogs = (logs: string) => {
    navigator.clipboard.writeText(logs);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownloadLogs = (run: TestRunItem) => {
    const element = document.createElement("a");
    const file = new Blob([run.logs || 'No logs captured.'], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `noir-test-run-${run.id}-${run.status}.log`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-6">
      
      {/* Metrics & Analytics Matrix */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Runs Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/10 rounded-full blur-xl group-hover:bg-violet-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Total Test Executions</span>
            <FlaskConical className="w-4 h-4 text-violet-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold font-mono text-white">{totalRuns}</span>
            <span className="text-xs text-white/40">runs recorded</span>
          </div>
        </div>

        {/* Success Pass Rate Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Reliability Pass Rate</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl md:text-3xl font-bold font-mono ${Number(passRate) >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {passRate}%
            </span>
            <span className="text-xs text-emerald-400/60">{passedRuns} passed</span>
          </div>
        </div>

        {/* Failure Count Matrix Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-xl group-hover:bg-rose-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Failed Test Workloads</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl md:text-3xl font-bold font-mono ${failedRuns > 0 ? 'text-rose-400 animate-pulse' : 'text-stone-300'}`}>
              {failedRuns}
            </span>
            <span className="text-xs text-rose-400/60">{totalIndividualFailedTests} failed assertions</span>
          </div>
        </div>

        {/* Avg Execution Latency */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-xl group-hover:bg-blue-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Average Latency</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold font-mono text-white">
              {(avgDurationMs / 1000).toFixed(2)}s
            </span>
            <span className="text-xs text-white/40">{avgDurationMs} ms</span>
          </div>
        </div>
      </div>

      {/* Main Execution Log & History Card */}
      <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 md:p-8 backdrop-blur-md shadow-lg space-y-6">
        
        {/* Title & Filter Control Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-violet-400" />
              Test Execution Logs & Historical Analytics
            </h2>
            <p className="text-xs text-white/50 mt-1 font-light">
              Audit past containerized & CLI test runs, examine error stack traces, and inspect failure logs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 md:w-48">
              <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search logs or suite..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 transition-all font-mono"
              />
            </div>

            {/* Developer Filter Dropdown */}
            {uniqueDevelopers.length > 0 && (
              <select
                value={developerFilter}
                onChange={(e) => setDeveloperFilter(e.target.value)}
                className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-violet-300 font-mono focus:outline-none focus:border-violet-500/50 transition-all"
              >
                <option value="all">All Developers ({uniqueDevelopers.length})</option>
                {uniqueDevelopers.map((dev) => (
                  <option key={dev.id} value={dev.id}>
                    {dev.name} (@{dev.username})
                  </option>
                ))}
              </select>
            )}

            {/* Status Filter Buttons */}
            <div className="flex items-center bg-black/40 border border-white/10 rounded-xl p-1 font-mono text-[10px]">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'all' ? 'bg-violet-600 text-white font-bold' : 'text-white/40 hover:text-white'
                }`}
              >
                ALL ({totalRuns})
              </button>
              <button
                onClick={() => setStatusFilter('passed')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'passed' ? 'bg-emerald-600 text-white font-bold' : 'text-white/40 hover:text-white'
                }`}
              >
                PASSED ({passedRuns})
              </button>
              <button
                onClick={() => setStatusFilter('failed')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'failed' ? 'bg-rose-600 text-white font-bold' : 'text-white/40 hover:text-white'
                }`}
              >
                FAILED ({failedRuns})
              </button>
            </div>
          </div>
        </div>

        {/* Test Run Items List */}
        {isLoading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-white/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredRuns.length === 0 ? (
          <div className="py-12 text-center bg-black/20 border border-white/5 rounded-2xl p-6">
            <FlaskConical className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <h4 className="text-sm font-semibold text-white/80">No Test Runs Found</h4>
            <p className="text-xs text-white/40 mt-1 max-w-[320px] mx-auto font-mono">
              {searchQuery || statusFilter !== 'all' || developerFilter !== 'all'
                ? 'No test execution runs match your selected filter criteria.'
                : 'Execute tests via "$ noir run" or "$ noir test" to record test runs in the backend.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRuns.map((run) => {
              const isPassed = run.status === 'passed';
              const fullName = `${run.executor_first_name || ''} ${run.executor_last_name || ''}`.trim();
              return (
                <div
                  key={run.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                    isPassed 
                      ? 'bg-black/40 border-white/5 hover:border-emerald-500/30' 
                      : 'bg-rose-950/20 border-rose-500/20 hover:border-rose-500/40'
                  }`}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase tracking-wider border ${
                        isPassed 
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      }`}>
                        {isPassed ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {run.status}
                      </span>
                      <span className="font-bold text-white text-sm font-mono">{run.suite_name}</span>
                      {run.project_title && (
                        <span className="text-[10px] font-mono text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded-lg border border-violet-500/20">
                          {run.project_title}
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-white/40 bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                        ${run.command}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono text-white/40">
                      <span>
                        Developer: <strong className="text-violet-300">
                          {fullName ? `${fullName} (@${run.executor_username})` : (run.executor_username || 'CLI Agent')}
                        </strong>
                      </span>
                      {run.executor_email && <span className="text-white/30">({run.executor_email})</span>}
                      {run.team_name && <span>Team: <strong className="text-purple-300">{run.team_name}</strong></span>}
                      <span>Logged: {new Date(run.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto font-mono text-xs border-t md:border-t-0 pt-3 md:pt-0 border-white/5">
                    <div className="text-left md:text-right">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">{run.passed_tests} passed</span>
                        {run.failed_tests > 0 && <span className="text-rose-400 font-bold">{run.failed_tests} failed</span>}
                      </div>
                      <span className="text-[10px] text-white/40">Duration: {(run.duration_ms / 1000).toFixed(2)}s</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedRun(run)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                        isPassed 
                          ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white' 
                          : 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/40 text-rose-300'
                      }`}
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      View Logs
                      <ChevronRight className="w-3 h-3 opacity-60" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Terminal Log Output Drawer Modal */}
      <AnimatePresence>
        {selectedRun && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-stone-900 border border-white/10 rounded-[2rem] w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-black/40">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider border ${
                      selectedRun.status === 'passed' 
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    }`}>
                      {selectedRun.status}
                    </span>
                    <h3 className="text-lg font-bold font-mono text-white">
                      {selectedRun.suite_name} (Run #{selectedRun.id})
                    </h3>
                  </div>
                  <p className="text-xs font-mono text-white/40">
                    Executed: <span className="text-violet-300">${selectedRun.command}</span> • Duration: {(selectedRun.duration_ms / 1000).toFixed(2)}s
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyLogs(selectedRun.logs)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Copy full logs"
                  >
                    {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span className="hidden sm:inline">{isCopied ? 'Copied' : 'Copy'}</span>
                  </button>

                  <button
                    onClick={() => handleDownloadLogs(selectedRun)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Download log file"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Download</span>
                  </button>

                  <button
                    onClick={() => setSelectedRun(null)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-all cursor-pointer ml-2"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Failure Banner if failed */}
              {selectedRun.status === 'failed' && (
                <div className="bg-rose-950/50 border-b border-rose-500/20 px-6 py-3 flex items-center gap-3 text-xs text-rose-300 font-mono">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Test suite execution failed with non-zero exit code. Review traceback logs below.</span>
                </div>
              )}

              {/* Terminal Log Output Body */}
              <div className="p-6 bg-black/90 overflow-y-auto font-mono text-xs text-stone-300 flex-1 space-y-1 scrollbar-thin scrollbar-thumb-white/10 selection:bg-violet-500/30 selection:text-white">
                {selectedRun.logs ? (
                  selectedRun.logs.split('\n').map((line, i) => (
                    <div key={i} className="flex items-start gap-3 hover:bg-white/5 px-1 py-0.5 rounded">
                      <span className="text-white/20 select-none min-w-[30px] text-right font-mono text-[10px]">
                        {i + 1}
                      </span>
                      <span className={
                        line.includes('FAILED') || line.includes('Error') || line.includes('Traceback') || line.includes('FAIL')
                          ? 'text-rose-400 font-semibold'
                          : line.includes('PASSED') || line.includes('OK') || line.includes('SUCCESS')
                          ? 'text-emerald-400 font-semibold'
                          : 'text-stone-300'
                      }>
                        {line}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-white/30 font-mono">
                    No log output buffer recorded for this test execution run.
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
