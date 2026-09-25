import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  Check, 
  Copy, 
  Layers, 
  Settings, 
  Calendar, 
  Clock,
  Sparkles,
  Terminal,
  Activity,
  Cpu,
  Laptop,
  Package,
  Code,
  Globe,
  Info,
  BarChart3,
  Zap,
  Boxes,
  ArrowUpRight,
  ChevronRight,
  Server,
  Shield,
  FileText
} from 'lucide-react';
import UserLayout from '../components/UserLayout';
import { Skeleton } from '../components/Skeleton';
import LiveStreamTerminal from '../components/LiveStreamTerminal';
import TestHistoryAnalytics, { TestRunItem } from '../components/TestHistoryAnalytics';
import FaultInjectionPanel from '../components/FaultInjectionPanel';
import { apiFetch } from '../utils/api';
import { checkAndRefreshToken } from '../utils/auth';
import { formatLastUpdated } from './Dashboard';

export interface DockerContainerData {
  id: string;
  name: string;
  service: string;
  image: string;
  status: string;
  ports?: string[];
  source?: string;
}

interface FrameworkData {
  id: number;
  name: string;
  language: string;
  supported: boolean;
}

interface ProfileData {
  id: number;
  runtime_version: string;
  operating_system: string;
  package_manager: string;
  detected_at: string;
  framework: FrameworkData | null;
  docker_containers?: DockerContainerData[];
}

interface ProjectDetailData {
  id: number;
  connection_code: string;
  title: string;
  description: string;
  owner?: { username: string; email: string };
  architecture: string;
  visibility: string;
  analysis_mode: string;
  status: string;
  profile: ProfileData | null;
  created_at: string;
  updated_at: string;
}

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [project, setProject] = useState<ProjectDetailData | null>(null);
  const [testRuns, setTestRuns] = useState<TestRunItem[]>([]);
  const [isLoadingTestRuns, setIsLoadingTestRuns] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'monitoring' | 'specs' | 'faults'>('monitoring');
  const [error, setError] = useState<string | null>(null);

  const fetchProjectDetails = async () => {
    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      
      const response = await apiFetch(`${baseUrl}/api/project/${projectId}/`, {
        method: 'GET',
        headers
      });

      if (response.ok) {
        const data = await response.json();
        setProject(data);
      } else {
        const savedProjects = localStorage.getItem('noir_user_projects');
        if (savedProjects) {
          const list = JSON.parse(savedProjects);
          const found = list.find((p: any) => String(p.id) === String(projectId));
          if (found) {
            setProject({
              id: Number(found.id.replace('prj-', '')),
              connection_code: found.connectionCode || 'NR-5BG6IXEL',
              owner: {
                username: 'AmalSKumar0',
                email: 'engineer@noir.sh'
              },
              title: found.name,
              description: 'Reliability Engineering Platform Workspace Node.',
              architecture: 'monolith',
              visibility: 'private',
              analysis_mode: 'manual',
              status: found.status,
              profile: {
                id: 1,
                framework: {
                  id: 1,
                  name: 'Django',
                  language: 'Python',
                  supported: true
                },
                runtime_version: '3.14.3',
                package_manager: 'uv',
                operating_system: 'Arch Linux',
                detected_at: new Date().toISOString()
              },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
        }
        setError('Project details not found.');
      }

      // Fetch test runs history for this project
      try {
        setIsLoadingTestRuns(true);
        const testRes = await apiFetch(`${baseUrl}/api/project/test-runs/?project_id=${projectId}`, { headers });
        if (testRes.ok) {
          const testData = await testRes.json();
          setTestRuns(testData);
        }
      } catch (te) {
        console.warn('Failed to fetch test runs:', te);
      } finally {
        setIsLoadingTestRuns(false);
      }

    } catch (err) {
      console.error(err);
      setError('Failed to load project details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectDetails();
    const handleRunCompleted = () => {
      fetchProjectDetails();
    };
    window.addEventListener('noir_run_completed', handleRunCompleted);
    return () => {
      window.removeEventListener('noir_run_completed', handleRunCompleted);
    };
  }, [projectId]);

  const handleCopy = () => {
    if (project?.connection_code) {
      navigator.clipboard.writeText(project.connection_code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <UserLayout>
      <div className="space-y-3.5 pb-12">
        {/* Navigation Breadcrumb Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
              <Link to="/dashboard" className="hover:text-zinc-300">Noir</Link>
              <span className="text-zinc-600">/</span>
              <Link to="/dashboard/projects" className="hover:text-zinc-300">Workspaces</Link>
              <span className="text-zinc-600">/</span>
              <span className="text-zinc-200 truncate max-w-[200px]">{project?.title || 'Node Details'}</span>
            </div>
            <div className="flex items-center gap-2.5 mt-0.5">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-100 flex items-center gap-2">
                <span>{project?.title || 'Workspace Overview'}</span>
              </h1>
              {project && (
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono border ${
                  project.status === 'active'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-zinc-800/60 border-zinc-700 text-zinc-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${project.status === 'active' ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                  <span>{project.status === 'active' ? 'Active' : project.status}</span>
                </span>
              )}
            </div>
          </div>

          {/* Quick Info & Actions */}
          {project && (
            <div className="flex items-center flex-wrap gap-2">
              {/* Connection Code Pill */}
              <div className="h-8 px-2.5 rounded-md bg-zinc-900 border border-zinc-800 flex items-center gap-2 text-xs font-mono">
                <span className="text-zinc-500 text-[10px] uppercase">Connection:</span>
                <span className="text-zinc-200 font-semibold">{project.connection_code}</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  title="Copy connection code"
                  className="text-zinc-400 hover:text-white p-0.5 transition-colors cursor-pointer"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Analytics Page Link */}
              <Link
                to={`/dashboard/projects/${projectId}/analytics`}
                className="h-8 px-3 rounded-md bg-zinc-900 border border-zinc-800 hover:bg-zinc-800/80 text-zinc-300 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
              >
                <BarChart3 className="w-3.5 h-3.5 text-violet-400" />
                <span>Analytics ({testRuns.length})</span>
              </Link>

              {/* Resilience Reports Page Link */}
              <Link
                to={`/dashboard/projects/${projectId}/reports`}
                className="h-8 px-3 rounded-md bg-zinc-900 border border-zinc-800 hover:bg-zinc-800/80 text-zinc-300 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
              >
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Resilience Reports</span>
              </Link>

              {/* Back to Workspaces */}
              <Link
                to="/dashboard/projects"
                className="h-8 px-3 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>All Workspaces</span>
              </Link>
            </div>
          )}
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="space-y-4">
            <div className="h-10 w-full bg-zinc-900/60 rounded-md animate-pulse" />
            <div className="h-64 w-full bg-zinc-900/60 rounded-lg animate-pulse" />
          </div>
        ) : error || !project ? (
          <div className="py-12 text-center bg-[#0D0F17] border border-zinc-800/80 rounded-lg p-6">
            <Activity className="w-8 h-8 text-rose-500/60 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-zinc-200">Failed to load workspace</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-[320px] mx-auto font-mono">
              {error || 'The requested project could not be found or retrieved.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            
            {/* Sub-Navigation Tab Strip */}
            <div className="flex items-center gap-1 border-b border-zinc-800/80 pb-2 text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('monitoring')}
                className={`h-7 px-3 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'monitoring'
                    ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>Live Telemetry</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('specs')}
                className={`h-7 px-3 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'specs'
                    ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Cpu className="w-3.5 h-3.5 text-violet-400" />
                <span>Stack & Containers</span>
                {project.profile?.docker_containers && project.profile.docker_containers.length > 0 && (
                  <span className="px-1 py-0.2 rounded text-[10px] font-mono bg-zinc-900 text-zinc-400">
                    {project.profile.docker_containers.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('faults')}
                className={`h-7 px-3 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'faults'
                    ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Chaos Injection</span>
              </button>

              <Link
                to={`/dashboard/projects/${projectId}/reports`}
                className="h-7 px-3 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              >
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span>Reports</span>
              </Link>
            </div>

            {/* TAB 1: LIVE MONITORING */}
            {activeTab === 'monitoring' && (
              <div className="space-y-3.5">
                {/* Live Terminal */}
                <LiveStreamTerminal connectionCode={project.connection_code} onRunEnd={fetchProjectDetails} />

                {/* 3 Compact Operational Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  
                  {/* Card 1: Agent CLI Run */}
                  <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-lg p-3 space-y-2">
                    <h3 className="text-[11px] font-semibold font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-violet-400" />
                      CLI Quick Run
                    </h3>
                    <div className="bg-[#090A0F] border border-zinc-800/80 rounded p-2.5 font-mono text-[11px] text-zinc-300 space-y-1">
                      <div className="text-zinc-500"># Connect workspace</div>
                      <div className="text-zinc-200">noir connect {project.connection_code}</div>
                      <div className="text-zinc-500 pt-1"># Stream telemetry</div>
                      <div className="text-emerald-400">noir run</div>
                    </div>
                  </div>

                  {/* Card 2: Scanned Runtime Stack */}
                  <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-lg p-3 space-y-2">
                    <h3 className="text-[11px] font-semibold font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-violet-400" />
                      Runtime Topology
                    </h3>
                    {project.profile ? (
                      <div className="space-y-1.5 font-mono text-[11px]">
                        <div className="flex justify-between items-center text-zinc-400 border-b border-zinc-800/60 pb-1">
                          <span>Language</span>
                          <span className="text-zinc-200">{project.profile.framework?.language || 'Python / Node'}</span>
                        </div>
                        <div className="flex justify-between items-center text-zinc-400 border-b border-zinc-800/60 pb-1">
                          <span>Framework</span>
                          <span className="text-zinc-200">{project.profile.framework?.name || 'Django'}</span>
                        </div>
                        <div className="flex justify-between items-center text-zinc-400">
                          <span>Containers</span>
                          <span className="text-cyan-400 font-semibold">
                            {project.profile.docker_containers?.length || 0} active
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] font-mono text-zinc-500 py-1">
                        Run <code className="text-zinc-300">noir connect</code> to scan topology.
                      </p>
                    )}
                  </div>

                  {/* Card 3: Specifications */}
                  <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-lg p-3 space-y-2">
                    <h3 className="text-[11px] font-semibold font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-violet-400" />
                      Node Parameters
                    </h3>
                    <div className="space-y-1.5 font-mono text-[11px]">
                      <div className="flex justify-between items-center text-zinc-400 border-b border-zinc-800/60 pb-1">
                        <span>Architecture</span>
                        <span className="text-zinc-200 uppercase">{project.architecture}</span>
                      </div>
                      <div className="flex justify-between items-center text-zinc-400 border-b border-zinc-800/60 pb-1">
                        <span>Visibility</span>
                        <span className="text-zinc-200 uppercase">{project.visibility}</span>
                      </div>
                      <div className="flex justify-between items-center text-zinc-400">
                        <span>Analysis Mode</span>
                        <span className="text-zinc-200 uppercase">{project.analysis_mode}</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* TAB 2: SYSTEM STACK & CONTAINERS */}
            {activeTab === 'specs' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                
                {/* Left (8 cols): Runtime Profile & Container Table */}
                <div className="lg:col-span-8 space-y-3.5">
                  
                  {/* Runtime Stack Grid */}
                  <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-lg p-3.5 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
                      <h2 className="text-xs font-semibold uppercase tracking-wider font-mono text-zinc-200 flex items-center gap-2">
                        <Cpu className="w-3.5 h-3.5 text-violet-400" />
                        Scanned Runtime Environment
                      </h2>
                      {project.profile && (
                        <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          PROFILE ACTIVE
                        </span>
                      )}
                    </div>

                    {project.profile ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 font-mono text-[11px]">
                        <div className="p-2.5 rounded bg-zinc-900/80 border border-zinc-800/80">
                          <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Language</span>
                          <span className="font-semibold text-zinc-200">{project.profile.framework?.language || 'Unknown'}</span>
                        </div>
                        <div className="p-2.5 rounded bg-zinc-900/80 border border-zinc-800/80">
                          <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Framework</span>
                          <span className="font-semibold text-zinc-200">{project.profile.framework?.name || 'Vanilla'}</span>
                        </div>
                        <div className="p-2.5 rounded bg-zinc-900/80 border border-zinc-800/80">
                          <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Runtime Version</span>
                          <span className="font-semibold text-zinc-200">{project.profile.runtime_version || '3.14'}</span>
                        </div>
                        <div className="p-2.5 rounded bg-zinc-900/80 border border-zinc-800/80">
                          <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Package Manager</span>
                          <span className="font-semibold text-zinc-200 uppercase">{project.profile.package_manager || 'pip'}</span>
                        </div>
                        <div className="p-2.5 rounded bg-zinc-900/80 border border-zinc-800/80">
                          <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Operating System</span>
                          <span className="font-semibold text-zinc-200">{project.profile.operating_system || 'Linux'}</span>
                        </div>
                        <div className="p-2.5 rounded bg-zinc-900/80 border border-zinc-800/80">
                          <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Detected At</span>
                          <span className="text-zinc-400">{new Date(project.profile.detected_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500 font-mono py-2">
                        No runtime profile scanned yet. Run <code className="text-zinc-300">noir connect</code> in your workspace.
                      </p>
                    )}
                  </div>

                  {/* Docker Containers Table */}
                  <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-lg overflow-hidden">
                    <div className="p-3 px-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/40">
                      <div className="flex items-center gap-2">
                        <Boxes className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-xs font-semibold text-zinc-200">Discovered Docker Containers</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400">
                          {project.profile?.docker_containers?.length || 0}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-zinc-500">
                        Targetable for Chaos Injections
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-zinc-800/60 text-zinc-400 font-mono text-[11px] uppercase bg-zinc-900/20">
                            <th className="py-2 px-3.5 font-medium">Container</th>
                            <th className="py-2 px-3 font-medium">Status</th>
                            <th className="py-2 px-3 font-medium">Service</th>
                            <th className="py-2 px-3 font-medium">Docker Image</th>
                            <th className="py-2 px-3 font-medium">Ports</th>
                            <th className="py-2 px-3.5 text-right font-medium">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/40 font-mono text-[11px]">
                          {project.profile?.docker_containers && project.profile.docker_containers.length > 0 ? (
                            project.profile.docker_containers.map((c, idx) => {
                              const isRunning = c.status?.toLowerCase() === 'running';
                              return (
                                <tr key={c.id && c.id !== '-' ? c.id : `${c.name}-${idx}`} className="hover:bg-zinc-900/40 text-zinc-300">
                                  <td className="py-2 px-3.5 font-semibold text-zinc-200">
                                    {c.name}
                                  </td>
                                  <td className="py-2 px-3">
                                    <span className="inline-flex items-center gap-1 text-[10px]">
                                      <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                                      <span className={isRunning ? 'text-emerald-400' : 'text-zinc-500'}>{c.status || 'unknown'}</span>
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-zinc-400">
                                    {c.service || '-'}
                                  </td>
                                  <td className="py-2 px-3 text-cyan-400 truncate max-w-[140px]">
                                    {c.image || '-'}
                                  </td>
                                  <td className="py-2 px-3 text-zinc-400 truncate max-w-[100px]">
                                    {c.ports && c.ports.length > 0 ? c.ports.join(', ') : '-'}
                                  </td>
                                  <td className="py-2 px-3.5 text-right">
                                    <button
                                      type="button"
                                      onClick={() => setActiveTab('faults')}
                                      className="h-6 px-2 rounded bg-zinc-800 hover:bg-zinc-700 text-amber-300 hover:text-amber-200 text-[10px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                                    >
                                      <Zap className="w-2.5 h-2.5 text-amber-400" />
                                      <span>Inject Fault</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-zinc-500">
                                <p className="text-xs">No local containers detected.</p>
                                <p className="text-[10px] text-zinc-600 mt-0.5">
                                  Run <code className="text-zinc-400">noir fault listen</code> with Docker active to discover services.
                                </p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>

                {/* Right (4 cols): Workspace Configuration Sidebar */}
                <div className="lg:col-span-4 space-y-3.5">
                  <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-lg p-3.5 space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider font-mono text-zinc-200 flex items-center gap-1.5 pb-2 border-b border-zinc-800/80">
                      <Settings className="w-3.5 h-3.5 text-violet-400" />
                      Workspace Metadata
                    </h3>

                    <div className="space-y-2 font-mono text-[11px]">
                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase">Deployment Type</span>
                        <span className="text-zinc-200 font-semibold uppercase">{project.architecture}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase">Visibility</span>
                        <span className="text-zinc-200 font-semibold uppercase">{project.visibility}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase">Analysis Routine</span>
                        <span className="text-zinc-200 font-semibold uppercase">{project.analysis_mode}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase">Owner</span>
                        <span className="text-zinc-200 font-semibold">{project.owner?.username || 'engineer'}</span>
                      </div>
                      <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-zinc-400">
                        <span className="text-zinc-500">Created:</span>
                        <span>{new Date(project.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-400">
                        <span className="text-zinc-500">Last Sync:</span>
                        <span>{new Date(project.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 3: FAULT INJECTION */}
            {activeTab === 'faults' && (
              <FaultInjectionPanel 
                projectIdentifier={project.id || projectId || project.connection_code} 
                projectCode={project.connection_code} 
                initialContainers={project.profile?.docker_containers || []}
              />
            )}

          </div>
        )}
      </div>
    </UserLayout>
  );
}
