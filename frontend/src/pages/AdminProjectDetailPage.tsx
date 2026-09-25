import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import AdminLayout from '../components/AdminLayout';
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Check,
  Edit2,
  Trash2,
  RefreshCw,
  ExternalLink,
  Shield,
  Activity,
  Layers,
  Cpu,
  Server,
  Zap,
  Terminal,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  FileText,
  Boxes,
  Calendar,
  User,
  X
} from 'lucide-react';
import Modal from '../components/Modal';
import { Skeleton } from '../components/Skeleton';
import { apiFetch } from '../utils/api';
import { checkAndRefreshToken } from '../utils/auth';
import { formatLastUpdated } from './Dashboard';

// -----------------------------------------------------------------------------
// TYPES & INTERFACES
// -----------------------------------------------------------------------------

interface ProjectDetailData {
  id: number;
  connection_code: string;
  owner?: { id: number; username: string; email?: string };
  title: string;
  description: string;
  architecture: string;
  visibility: string;
  analysis_mode: string;
  status: string;
  profile?: {
    framework?: { id: number; name: string; language: string; supported: boolean };
    runtime_version?: string;
    package_manager?: string;
    operating_system?: string;
    analysis_data?: Record<string, any>;
    docker_containers?: Array<{
      id?: string;
      name?: string;
      service?: string;
      image?: string;
      status?: string;
      ports?: string[];
      source?: string;
    }>;
    detected_at?: string;
  };
  assigned_teams?: string[];
  is_daemon_active?: boolean;
  is_stream_active?: boolean;
  containers_count?: number;
  created_at: string;
  updated_at: string;
}

interface TestRunItem {
  id: number;
  project: number;
  project_id: number;
  project_title: string;
  executor_id?: number;
  executor_username?: string;
  executor_email?: string;
  team_id?: number;
  team_name?: string;
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

interface FaultItem {
  id: number;
  fault_type: string;
  target: string;
  parameters: Record<string, any>;
  status: string;
  resilience_score: number | null;
  resilience_grade: string | null;
  duration_seconds: number | null;
  rto_target_seconds?: number | null;
  requested_at: string;
  completed_at: string | null;
  result?: {
    recovery_metrics?: {
      recovery_time_seconds?: number;
      rto_target_seconds?: number;
      rto_target_met?: boolean;
      rto_seconds?: number;
    };
    experiment_metrics?: {
      availability_percent?: number;
      mean_latency_ms?: number;
    };
  };
}

interface CollectiveReportSummary {
  total_experiments: number;
  completed: number;
  failed: number;
  overall_resilience_score: number;
  overall_resilience_grade: string;
  avg_recovery_seconds: number;
  rto_violations_count: number;
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

function formatParams(type: string, params: Record<string, any> = {}): string {
  const parts: string[] = [];
  if (params.duration) parts.push(`${params.duration}s`);
  if (params.rto_target_seconds) parts.push(`RTO ${params.rto_target_seconds}s`);
  if (type === 'network_loss' && params.loss_percent !== undefined) {
    parts.unshift(`${params.loss_percent}% loss`);
  } else if (type === 'network_delay' && params.latency_ms !== undefined) {
    parts.unshift(`${params.latency_ms}ms delay`);
  } else if (type === 'cpu_stress' && params.workers !== undefined) {
    parts.unshift(`${params.workers} worker(s)`);
  }
  return parts.join(' • ') || 'Default';
}

function getGradeBadge(grade: string | null) {
  switch (grade?.toUpperCase()) {
    case 'A': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    case 'B': return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
    case 'C': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    case 'D':
    case 'F': return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    default: return 'text-zinc-400 bg-zinc-800/40 border-zinc-700/40';
  }
}

export default function AdminProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // Data States
  const [project, setProject] = useState<ProjectDetailData | null>(null);
  const [testRuns, setTestRuns] = useState<TestRunItem[]>([]);
  const [faults, setFaults] = useState<FaultItem[]>([]);
  const [collectiveReport, setCollectiveReport] = useState<CollectiveReportSummary | null>(null);

  // Loading & Error States
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // CRUD Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [selectedTestRun, setSelectedTestRun] = useState<TestRunItem | null>(null);

  // Edit Form Data
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    architecture: 'monolith',
    visibility: 'private',
    analysis_mode: 'manual',
    status: 'active',
  });
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // FETCH PROJECT DATA, TESTS, FAULTS, REPORTS
  // ---------------------------------------------------------------------------
  const fetchAllProjectData = async () => {
    if (!projectId) return;
    setIsLoading(true);
    setFetchError(null);

    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      // 1. Fetch Project Details: GET /api/project/:id/
      const projectRes = await apiFetch(`${baseUrl}/api/project/${projectId}/`, { headers });
      if (!projectRes.ok) {
        throw new Error(`Failed to load project details (HTTP ${projectRes.status})`);
      }
      const projectData: ProjectDetailData = await projectRes.json();
      setProject(projectData);
      setFormData({
        title: projectData.title,
        description: projectData.description,
        architecture: projectData.architecture || 'monolith',
        visibility: projectData.visibility || 'private',
        analysis_mode: projectData.analysis_mode || 'manual',
        status: projectData.status || 'active',
      });

      // 2. Fetch Test Runs: GET /api/project/test-runs/?project_id=:projectId
      try {
        const testsRes = await apiFetch(`${baseUrl}/api/project/test-runs/?project_id=${projectId}`, { headers });
        if (testsRes.ok) {
          const testsData = await testsRes.json();
          setTestRuns(Array.isArray(testsData) ? testsData : (testsData.results || []));
        }
      } catch (tErr) {
        console.warn('Failed to load test runs:', tErr);
      }

      // 3. Fetch Faults / Experiments: GET /api/project/:projectId/faults/
      try {
        const faultsRes = await apiFetch(`${baseUrl}/api/project/${projectId}/faults/`, { headers });
        if (faultsRes.ok) {
          const faultsData = await faultsRes.json();
          setFaults(Array.isArray(faultsData) ? faultsData : (faultsData.results || []));
        }
      } catch (fErr) {
        console.warn('Failed to load faults:', fErr);
      }

      // 4. Fetch Collective Chaos Report Summary: GET /api/project/:projectId/chaos/collective-report/
      try {
        const repRes = await apiFetch(`${baseUrl}/api/project/${projectId}/chaos/collective-report/`, { headers });
        if (repRes.ok) {
          const repData = await repRes.json();
          if (repData.summary) {
            setCollectiveReport(repData.summary);
          }
        }
      } catch (rErr) {
        console.warn('Failed to load collective report:', rErr);
      }

    } catch (err: any) {
      setFetchError(err.message || 'Error fetching project details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllProjectData();
  }, [projectId]);

  // ---------------------------------------------------------------------------
  // COMPUTED STATISTICS
  // ---------------------------------------------------------------------------
  const stats = useMemo(() => {
    const totalTests = testRuns.length;
    const passedTests = testRuns.filter(t => t.status === 'passed').length;
    const failedTests = testRuns.filter(t => t.status === 'failed' || t.status === 'error').length;
    const passRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 100;

    const totalExperiments = faults.length;
    const completedExperiments = faults.filter(f => f.status === 'completed').length;
    const failedExperiments = faults.filter(f => f.status === 'failed').length;

    // Resilience score from collective report or latest completed fault
    const latestScore = collectiveReport?.overall_resilience_score ?? 
      faults.find(f => f.status === 'completed' && f.resilience_score !== null)?.resilience_score ?? null;
    const latestGrade = collectiveReport?.overall_resilience_grade ?? 
      faults.find(f => f.status === 'completed' && f.resilience_grade)?.resilience_grade ?? null;

    // Recovery time
    const avgRecovery = collectiveReport?.avg_recovery_seconds !== undefined
      ? `${collectiveReport.avg_recovery_seconds.toFixed(2)}s`
      : 'N/A';

    return {
      totalTests,
      passedTests,
      failedTests,
      passRate,
      totalExperiments,
      completedExperiments,
      failedExperiments,
      latestScore,
      latestGrade,
      avgRecovery,
    };
  }, [testRuns, faults, collectiveReport]);

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------
  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const handleCopyCode = () => {
    if (!project?.connection_code) return;
    navigator.clipboard.writeText(project.connection_code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    setIsActionLoading(true);
    setActionError(null);

    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const response = await apiFetch(`${baseUrl}/api/project/${project.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const updated = await response.json();
        setProject(updated);
        setIsEditModalOpen(false);
        showToast('Project updated successfully.');
      } else {
        const errData = await response.json().catch(() => ({}));
        setActionError(errData.detail || errData.title?.[0] || 'Failed to update project.');
      }
    } catch (err: any) {
      setActionError(err.message || 'An error occurred while updating project.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    setIsActionLoading(true);
    setActionError(null);

    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const response = await apiFetch(`${baseUrl}/api/project/${project.id}/`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (response.ok) {
        setIsDeleteModalOpen(false);
        navigate('/admin/projects');
      } else {
        const errData = await response.json().catch(() => ({}));
        setActionError(errData.detail || errData.error || 'Failed to delete project.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete project.');
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 pt-1 font-mono text-xs">
        
        {/* ===================================================================
            HEADER: BACK BUTTON, IDENTITY & PRIMARY ACTIONS
        ==================================================================== */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Link
                to="/admin/projects"
                className="text-zinc-400 hover:text-purple-300 transition-colors flex items-center gap-1 font-semibold"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Projects</span>
              </Link>
              <span className="text-zinc-600">/</span>
              <span className="text-purple-400 font-semibold">
                Node #{project?.id || projectId}
              </span>
            </div>

            <div className="flex items-center flex-wrap gap-2.5 mt-1.5">
              <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
                {project?.title || 'Loading Project...'}
              </h1>
              {project && (
                <>
                  {/* Connection Code Pill */}
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    title="Copy connection code"
                    className="h-6 px-2 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-[11px] text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>{project.connection_code}</span>
                    {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-zinc-500" />}
                  </button>

                  {/* Status Badge */}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                    project.status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : project.status === 'completed'
                      ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                      : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/60'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      project.status === 'active' ? 'bg-emerald-400' : project.status === 'completed' ? 'bg-cyan-400' : 'bg-zinc-500'
                    }`} />
                    <span>{project.status}</span>
                  </span>
                </>
              )}
            </div>

            <p className="text-xs text-zinc-400 mt-0.5">
              {project?.description || 'Project infrastructure node and reliability audit center'}
            </p>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center flex-wrap gap-2 self-start md:self-auto">
            <button
              type="button"
              onClick={fetchAllProjectData}
              disabled={isLoading}
              title="Refresh project data"
              className="h-8 px-2.5 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-purple-400' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="h-8 px-3 rounded-md bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Edit</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              className="h-8 px-3 rounded-md bg-rose-600/15 border border-rose-500/30 hover:bg-rose-600/30 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Delete</span>
            </button>

            <Link
              to={`/dashboard/projects/${projectId}`}
              className="h-8 px-3 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="Open User Workspace Dashboard"
            >
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
              <span>User Workspace</span>
            </Link>
          </div>
        </div>

        {/* SUCCESS TOAST */}
        <AnimatePresence>
          {successToast && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successToast}</span>
              </div>
              <button type="button" onClick={() => setSuccessToast(null)} className="text-emerald-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ERROR STATE */}
        {fetchError && (
          <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-2">
            <div className="flex items-center gap-2 font-bold text-rose-400">
              <AlertCircle className="w-4 h-4" />
              <span>Failed to Load Project Data</span>
            </div>
            <p className="text-xs">{fetchError}</p>
            <button
              type="button"
              onClick={fetchAllProjectData}
              className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-200 text-xs underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* LOADING SKELETON */}
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-lg bg-zinc-900/60" />
            <Skeleton className="h-64 w-full rounded-lg bg-zinc-900/60" />
            <Skeleton className="h-48 w-full rounded-lg bg-zinc-900/60" />
          </div>
        )}

        {/* MAIN CONTENT */}
        {!isLoading && project && (
          <div className="space-y-6">

            {/* ===================================================================
                SECTION 5: PROJECT STATISTICS BAR
            ==================================================================== */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-lg p-3">
                <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Total Tests</span>
                <span className="text-base font-bold text-zinc-100">{stats.totalTests} runs</span>
                <span className="text-[10px] text-zinc-500 block mt-0.5">
                  {stats.passedTests} passed • {stats.failedTests} failed
                </span>
              </div>

              <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-lg p-3">
                <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Test Pass Rate</span>
                <span className={`text-base font-bold ${stats.passRate >= 90 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {stats.totalTests > 0 ? `${stats.passRate}%` : 'N/A'}
                </span>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Integration status</span>
              </div>

              <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-lg p-3">
                <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Chaos Experiments</span>
                <span className="text-base font-bold text-purple-300">{stats.totalExperiments} runs</span>
                <span className="text-[10px] text-zinc-500 block mt-0.5">
                  {stats.completedExperiments} completed
                </span>
              </div>

              <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-lg p-3">
                <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Resilience Score</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-bold text-zinc-100">
                    {stats.latestScore !== null ? `${stats.latestScore}/100` : 'Unscored'}
                  </span>
                  {stats.latestGrade && (
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${getGradeBadge(stats.latestGrade)}`}>
                      Grade {stats.latestGrade}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Collective benchmark</span>
              </div>

              <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-lg p-3">
                <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Avg Recovery</span>
                <span className="text-base font-bold text-cyan-400">{stats.avgRecovery}</span>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Steady state restore</span>
              </div>

              <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-lg p-3">
                <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Docker Containers</span>
                <span className="text-base font-bold text-zinc-100">
                  {project.profile?.docker_containers?.length || 0}
                </span>
                <span className="text-[10px] text-zinc-500 block mt-0.5">
                  {project.profile?.operating_system || 'Host environment'}
                </span>
              </div>
            </div>

            {/* ===================================================================
                SECTION 4: COMPACT PROJECT OVERVIEW
            ==================================================================== */}
            <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                <h3 className="text-xs uppercase tracking-wider font-semibold text-zinc-200 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  Project Configuration & Detected Environment
                </h3>
                <span className="text-[10px] text-zinc-500">
                  Detected: {project.profile?.detected_at ? new Date(project.profile.detected_at).toLocaleString() : 'N/A'}
                </span>
              </div>

              {/* Information Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Primary Language</span>
                  <div className="flex items-center gap-1.5 text-zinc-200 font-semibold">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{project.profile?.framework?.language || 'Unknown'}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Framework</span>
                  <span className="text-zinc-200 font-semibold">
                    {project.profile?.framework?.name || 'Generic / None'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Runtime Version</span>
                  <span className="text-zinc-300 font-semibold">
                    {project.profile?.runtime_version || 'Default System'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Package Manager</span>
                  <span className="text-zinc-300">
                    {project.profile?.package_manager || 'Standard'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Operating System</span>
                  <span className="text-zinc-300">
                    {project.profile?.operating_system || 'Linux'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Architecture</span>
                  <span className="text-zinc-200 capitalize">
                    {project.architecture} ({project.analysis_mode} mode)
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Visibility</span>
                  <span className="text-zinc-300 capitalize">{project.visibility}</span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Owner</span>
                  <span className="text-zinc-200 font-semibold flex items-center gap-1">
                    <User className="w-3 h-3 text-zinc-500" />
                    <span>{project.owner?.username || 'admin'}</span>
                  </span>
                </div>
              </div>

              {/* Docker Containers Sub-table */}
              {project.profile?.docker_containers && project.profile.docker_containers.length > 0 && (
                <div className="pt-2 border-t border-zinc-850/60">
                  <div className="flex items-center justify-between text-[11px] mb-2 text-zinc-400">
                    <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
                      <Boxes className="w-3 h-3 text-cyan-400" />
                      <span>Docker & Compose Specification ({project.profile.docker_containers.length} containers)</span>
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded border border-zinc-800/60">
                    <table className="w-full text-left text-[11px] font-mono">
                      <thead className="bg-zinc-900/80 text-[10px] text-zinc-500 uppercase">
                        <tr>
                          <th className="py-1.5 px-2.5">Container / Service</th>
                          <th className="py-1.5 px-2.5">Image</th>
                          <th className="py-1.5 px-2.5">Status</th>
                          <th className="py-1.5 px-2.5">Ports</th>
                          <th className="py-1.5 px-2.5">Source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/40">
                        {project.profile.docker_containers.map((c, idx) => (
                          <tr key={idx} className="hover:bg-zinc-900/30 text-zinc-300">
                            <td className="py-1.5 px-2.5 font-semibold text-zinc-200">
                              {c.name || c.service || 'Container'}
                            </td>
                            <td className="py-1.5 px-2.5 text-zinc-400 font-sans text-xs">
                              {c.image || '-'}
                            </td>
                            <td className="py-1.5 px-2.5">
                              <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                                c.status === 'running'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-zinc-800 text-zinc-400'
                              }`}>
                                {c.status || 'defined'}
                              </span>
                            </td>
                            <td className="py-1.5 px-2.5 text-zinc-400 text-[10px]">
                              {c.ports && c.ports.length > 0 ? c.ports.join(', ') : '-'}
                            </td>
                            <td className="py-1.5 px-2.5 text-zinc-500 text-[10px]">
                              {c.source || 'compose'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* ===================================================================
                SECTION 6: TESTS SECTION
            ==================================================================== */}
            <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                <div>
                  <h3 className="text-xs uppercase tracking-wider font-semibold text-zinc-200 flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                    Test Runs & Automated Verification ({testRuns.length})
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Integration and unit test execution records from platform runners
                  </p>
                </div>
                
                <Link
                  to={`/dashboard/projects/${projectId}/analytics`}
                  className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                >
                  <span>Test Analytics</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              <div className="overflow-x-auto rounded border border-zinc-800/60">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-zinc-900/80 text-[10px] text-zinc-500 uppercase">
                    <tr>
                      <th className="py-2 px-2.5">ID</th>
                      <th className="py-2 px-2.5">Suite Name</th>
                      <th className="py-2 px-2.5">Command</th>
                      <th className="py-2 px-2.5">Status</th>
                      <th className="py-2 px-2.5 text-center">Passed / Total</th>
                      <th className="py-2 px-2.5">Duration</th>
                      <th className="py-2 px-2.5">Executed</th>
                      <th className="py-2 px-2.5 text-right">Logs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {testRuns.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-zinc-500 font-mono">
                          No test runs recorded for this project yet.
                        </td>
                      </tr>
                    ) : (
                      testRuns.map((tr) => (
                        <tr key={tr.id} className="hover:bg-zinc-900/30 text-zinc-300">
                          <td className="py-2 px-2.5 text-zinc-500">#{tr.id}</td>
                          <td className="py-2 px-2.5 font-semibold text-zinc-200">{tr.suite_name}</td>
                          <td className="py-2 px-2.5 text-zinc-400 text-[11px] font-mono">
                            <code>{tr.command}</code>
                          </td>
                          <td className="py-2 px-2.5">
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                              tr.status === 'passed'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            }`}>
                              {tr.status}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 text-center">
                            <span className="text-emerald-400 font-semibold">{tr.passed_tests}</span>
                            <span className="text-zinc-600"> / </span>
                            <span className="text-zinc-300">{tr.total_tests}</span>
                          </td>
                          <td className="py-2 px-2.5 text-zinc-400">
                            {tr.duration_ms > 1000 ? `${(tr.duration_ms / 1000).toFixed(2)}s` : `${tr.duration_ms}ms`}
                          </td>
                          <td className="py-2 px-2.5 text-zinc-500 text-[11px]">
                            {new Date(tr.created_at).toLocaleString()}
                          </td>
                          <td className="py-2 px-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTestRun(tr);
                                setIsLogsModalOpen(true);
                              }}
                              className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 hover:border-purple-500 text-zinc-300 hover:text-white text-[10px] transition-colors"
                            >
                              Logs
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ===================================================================
                SECTION 7: CHAOS / EXPERIMENT SECTION
            ==================================================================== */}
            <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                <div>
                  <h3 className="text-xs uppercase tracking-wider font-semibold text-zinc-200 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-purple-400" />
                    Chaos Engineering Experiments ({faults.length})
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Fault injection audits, resilience scores, and recovery SLAs
                  </p>
                </div>

                <Link
                  to={`/dashboard/projects/${projectId}/reports`}
                  className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                >
                  <span>Resilience Center</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              <div className="overflow-x-auto rounded border border-zinc-800/60">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-zinc-900/80 text-[10px] text-zinc-500 uppercase">
                    <tr>
                      <th className="py-2 px-2.5">ID</th>
                      <th className="py-2 px-2.5">Fault Type</th>
                      <th className="py-2 px-2.5">Target</th>
                      <th className="py-2 px-2.5">Parameters</th>
                      <th className="py-2 px-2.5">Status</th>
                      <th className="py-2 px-2.5">Recovery Time</th>
                      <th className="py-2 px-2.5 text-center">Score</th>
                      <th className="py-2 px-2.5">Executed</th>
                      <th className="py-2 px-2.5 text-right">Report</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {faults.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-zinc-500 font-mono">
                          No chaos experiments executed on this project node yet.
                        </td>
                      </tr>
                    ) : (
                      faults.map((f) => {
                        const recM = f.result?.recovery_metrics;
                        const recTime = recM?.recovery_time_seconds ?? recM?.rto_seconds;
                        const rtoTarget = recM?.rto_target_seconds || f.rto_target_seconds || 5.0;
                        const rtoMet = recM?.rto_target_met ?? (recTime ? recTime <= rtoTarget : true);

                        return (
                          <tr key={f.id} className="hover:bg-zinc-900/30 text-zinc-300">
                            <td className="py-2 px-2.5 text-zinc-500 font-semibold">#{f.id}</td>
                            <td className="py-2 px-2.5 font-semibold text-zinc-200">
                              {formatFaultName(f.fault_type)}
                            </td>
                            <td className="py-2 px-2.5 text-zinc-300">{f.target}</td>
                            <td className="py-2 px-2.5 text-zinc-400 text-[11px]">
                              {formatParams(f.fault_type, f.parameters)}
                            </td>
                            <td className="py-2 px-2.5">
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                                f.status === 'completed'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                  : (f.status === 'failed' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' : 'bg-amber-500/10 text-amber-400')
                              }`}>
                                {f.status}
                              </span>
                            </td>
                            <td className="py-2 px-2.5 text-[11px]">
                              {recTime !== undefined ? (
                                <span className={rtoMet ? 'text-zinc-200' : 'text-amber-400'}>
                                  {recTime.toFixed(2)}s <span className="text-[10px] text-zinc-500">(RTO {rtoTarget}s)</span>
                                </span>
                              ) : '-'}
                            </td>
                            <td className="py-2 px-2.5 text-center">
                              {f.resilience_score !== null ? (
                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${getGradeBadge(f.resilience_grade)}`}>
                                  {f.resilience_score}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="py-2 px-2.5 text-zinc-500 text-[11px]">
                              {new Date(f.completed_at || f.requested_at).toLocaleString()}
                            </td>
                            <td className="py-2 px-2.5 text-right">
                              <Link
                                to={`/dashboard/projects/${projectId}/chaos/reports/${f.id}`}
                                className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 hover:border-purple-500 text-purple-300 hover:text-white text-[10px] transition-colors inline-flex items-center gap-1"
                              >
                                <span>Report</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ===================================================================
                SECTION 8: PROJECT REPORTS
            ==================================================================== */}
            <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-lg p-4 space-y-3">
              <div className="border-b border-zinc-800/80 pb-2">
                <h3 className="text-xs uppercase tracking-wider font-semibold text-zinc-200 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-cyan-400" />
                  Available Reliability & Analytics Reports
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Forensic audit documents and test historical reports
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* 1. Resilience Report */}
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 hover:border-purple-500/40 transition-colors flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <h4 className="text-xs font-bold text-zinc-100 font-sans">
                        Resilience & Chaos Engineering Report
                      </h4>
                    </div>
                    <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                      Comprehensive project chaos report with score trends, recovery analysis, and fault degradation matrix.
                    </p>
                    <div className="text-[10px] text-zinc-500 pt-1">
                      {faults.length} experiments evaluated • Benchmark score: {stats.latestScore ?? 'N/A'}/100
                    </div>
                  </div>
                  <Link
                    to={`/dashboard/projects/${projectId}/reports`}
                    className="h-7 px-2.5 rounded bg-zinc-800 hover:bg-purple-600 text-white text-xs font-semibold flex items-center gap-1 transition-colors shrink-0"
                  >
                    <span>Open</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                {/* 2. Integration Test Analytics */}
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 hover:border-purple-500/40 transition-colors flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      <h4 className="text-xs font-bold text-zinc-100 font-sans">
                        Test & Integration Analytics
                      </h4>
                    </div>
                    <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                      Historical test run telemetry, pass/fail trends, duration tracking, and test suite execution logs.
                    </p>
                    <div className="text-[10px] text-zinc-500 pt-1">
                      {testRuns.length} test executions recorded • Pass rate: {stats.passRate}%
                    </div>
                  </div>
                  <Link
                    to={`/dashboard/projects/${projectId}/analytics`}
                    className="h-7 px-2.5 rounded bg-zinc-800 hover:bg-cyan-600 text-white text-xs font-semibold flex items-center gap-1 transition-colors shrink-0"
                  >
                    <span>Open</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* ===================================================================
          EDIT PROJECT MODAL
      ==================================================================== */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => { if (!isActionLoading) setIsEditModalOpen(false); }}
        title={`Edit Project Configuration: ${project?.title}`}
      >
        <form onSubmit={handleUpdateProject} className="space-y-3 font-mono text-xs">
          <div className="space-y-1">
            <label className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider block">
              Project Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-purple-500 text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider block">
              Description <span className="text-rose-400">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-purple-500 text-xs resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider block">
                Architecture
              </label>
              <select
                value={formData.architecture}
                onChange={(e) => setFormData({ ...formData, architecture: e.target.value })}
                className="w-full h-8 px-2.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-purple-500 text-xs cursor-pointer"
              >
                <option value="monolith">Monolith</option>
                <option value="microservice">Microservice</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider block">
                Visibility
              </label>
              <select
                value={formData.visibility}
                onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
                className="w-full h-8 px-2.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-purple-500 text-xs cursor-pointer"
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider block">
                Analysis Mode
              </label>
              <select
                value={formData.analysis_mode}
                onChange={(e) => setFormData({ ...formData, analysis_mode: e.target.value })}
                className="w-full h-8 px-2.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-purple-500 text-xs cursor-pointer"
              >
                <option value="manual">Manual</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider block">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full h-8 px-2.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-purple-500 text-xs cursor-pointer"
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          {actionError && (
            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
              <span>{actionError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isActionLoading}
              className="h-8 px-3 rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isActionLoading}
              className="h-8 px-4 rounded bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isActionLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ===================================================================
          DELETE PROJECT MODAL
      ==================================================================== */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => { if (!isActionLoading) setIsDeleteModalOpen(false); }}
        title={`Delete Project: ${project?.title}`}
      >
        <div className="space-y-4 font-mono text-xs">
          <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-2">
            <div className="flex items-center gap-2 font-bold text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Destructive Operation</span>
            </div>
            <p className="leading-relaxed">
              Are you sure you want to permanently delete workspace <strong className="text-white">"{project?.title}"</strong>?
            </p>
            <p className="text-[11px] text-rose-400/80 leading-relaxed font-sans">
              This action will remove the workspace node and cascade-delete all {testRuns.length} test run logs, {faults.length} chaos experiment records, and collective resilience audits. This action cannot be reversed.
            </p>
          </div>

          {actionError && (
            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {actionError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isActionLoading}
              className="h-8 px-3 rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteProject}
              disabled={isActionLoading}
              className="h-8 px-4 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isActionLoading ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ===================================================================
          TEST RUN LOGS MODAL
      ==================================================================== */}
      <Modal
        isOpen={isLogsModalOpen}
        onClose={() => setIsLogsModalOpen(false)}
        title={`Execution Logs: ${selectedTestRun?.suite_name} (#${selectedTestRun?.id})`}
        maxWidthClass="max-w-2xl"
      >
        <div className="space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between text-[11px] text-zinc-400 bg-zinc-900 p-2 rounded border border-zinc-800">
            <span>Command: <code className="text-cyan-400">{selectedTestRun?.command}</code></span>
            <span>Duration: {selectedTestRun?.duration_ms}ms</span>
            <span className={`px-1.5 py-0.2 rounded font-bold uppercase ${
              selectedTestRun?.status === 'passed' ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {selectedTestRun?.status}
            </span>
          </div>

          <div className="bg-black/80 border border-zinc-800 rounded-lg p-3 max-h-96 overflow-y-auto font-mono text-[11px] text-zinc-300 whitespace-pre-wrap leading-relaxed">
            {selectedTestRun?.logs || 'No logs recorded for this test execution.'}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsLogsModalOpen(false)}
              className="h-8 px-3 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

    </AdminLayout>
  );
}
