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
  BarChart3
} from 'lucide-react';
import UserLayout from '../components/UserLayout';
import { Skeleton } from '../components/Skeleton';
import LiveStreamTerminal from '../components/LiveStreamTerminal';
import TestHistoryAnalytics, { TestRunItem } from '../components/TestHistoryAnalytics';
import { apiFetch } from '../utils/api';
import { checkAndRefreshToken } from '../utils/auth';
import { formatLastUpdated } from './Dashboard';

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
  const [activeTab, setActiveTab] = useState<'monitoring' | 'specs'>('monitoring');
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
                id: 9,
                username: 'AmalSKumar0'
              },
              title: found.name,
              description: 'Reliability Engineering Platform Workspace Node.',
              architecture: 'monolith',
              visibility: 'private',
              analysis_mode: 'manual',
              status: found.status,
              profile: {
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
      <div className="max-w-6xl mx-auto mt-6 md:mt-10 px-4 md:px-8 pb-24 text-white">
        {/* Back Link */}
        <Link 
          to="/dashboard/projects" 
          className="inline-flex items-center gap-2 text-white/40 hover:text-white text-xs font-mono uppercase tracking-widest transition-colors mb-8 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Projects
        </Link>

        {isLoading ? (
          <div className="space-y-8">
            <div className="flex justify-between items-start">
              <div className="space-y-2 w-1/2">
                <Skeleton className="w-full h-10 rounded-xl bg-white/5" />
                <Skeleton className="w-1/3 h-4 rounded-xl bg-white/5" />
              </div>
              <Skeleton className="w-24 h-8 rounded-full bg-white/5" />
            </div>
            <Skeleton className="w-full h-64 rounded-[2rem] bg-white/5" />
          </div>
        ) : error || !project ? (
          <div className="py-16 text-center bg-white/5 border border-white/10 rounded-[2rem] p-6">
            <Activity className="w-12 h-12 text-rose-500/50 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white">Error Loading Project</h3>
            <p className="text-xs text-white/50 mt-1 max-w-[280px] mx-auto font-mono">
              {error || 'The requested project could not be found or retrieved.'}
            </p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-white/5">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                    {project.title}
                  </h1>
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-widest border ${
                    project.status === 'active' 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                      : 'bg-stone-500/10 border-white/10 text-white/40'
                  }`}>
                    {project.status}
                  </span>
                </div>
                <p className="text-sm text-white/50 mt-1 font-light">{project.description || 'No description provided.'}</p>
              </div>
              
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-3.5 w-full md:w-auto">
                <div>
                  <p className="text-[9px] font-mono text-white/40 uppercase tracking-widest">Connection Code</p>
                  <p className="font-mono text-sm text-violet-300 font-bold tracking-wider mt-0.5">{project.connection_code}</p>
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="ml-auto p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-white/60 hover:text-white transition-all cursor-pointer"
                  title="Copy connection code"
                >
                  {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Sub-Page Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-3 border-b border-white/5 pb-4 font-mono text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('monitoring')}
                className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'monitoring'
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/30'
                    : 'bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white'
                }`}
              >
                <Activity className="w-4 h-4 text-emerald-400" />
                Live Telemetry Monitoring
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('specs')}
                className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'specs'
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/30'
                    : 'bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white'
                }`}
              >
                <Cpu className="w-4 h-4 text-violet-400" />
                System Stack & Specs
              </button>

              <Link
                to={`/dashboard/projects/${projectId}/analytics`}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all flex items-center gap-2 cursor-pointer"
              >
                <BarChart3 className="w-4 h-4 text-violet-400" />
                Test Analytics & Failure Logs
                <span className="bg-violet-500/20 text-violet-300 text-[10px] px-2 py-0.5 rounded-full border border-violet-500/30 font-bold">
                  {testRuns.length}
                </span>
              </Link>
            </div>

            {/* DEFAULT TAB: LIVE MONITORING */}
            {activeTab === 'monitoring' && (
              <div className="space-y-8">
                {/* Real-time Telemetry & Container Stream Terminal */}
                <LiveStreamTerminal connectionCode={project.connection_code} />

                {/* Bottom Section: Minor Details of Project */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-white/5">
                  
                  {/* Card 1: Connection & CLI Quick Run */}
                  <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 backdrop-blur-md space-y-4">
                    <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-violet-400 flex items-center gap-2">
                      <Terminal className="w-4 h-4" />
                      Agent Command Link
                    </h3>
                    <div className="bg-black/60 border border-white/5 rounded-xl p-3 font-mono text-[11px] text-stone-300 space-y-1">
                      <div className="text-white/40"># Run container & stream telemetry</div>
                      <div className="text-emerald-400 font-bold">$ noir run</div>
                      <div className="text-white/40 pt-1"># Connect workspace</div>
                      <div className="text-violet-300">$ noir connect {project.connection_code}</div>
                    </div>
                  </div>

                  {/* Card 2: Scanned Runtime Stack Quick Glance */}
                  <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 backdrop-blur-md space-y-4">
                    <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-violet-400 flex items-center gap-2">
                      <Cpu className="w-4 h-4" />
                      Scanned Stack
                    </h3>
                    {project.profile ? (
                      <div className="space-y-2 font-mono text-xs">
                        <div className="flex justify-between items-center py-1 border-b border-white/5">
                          <span className="text-white/40">Language</span>
                          <span className="text-white font-semibold">{project.profile.framework?.language || 'Python / Node'}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-white/5">
                          <span className="text-white/40">Framework</span>
                          <span className="text-white font-semibold">{project.profile.framework?.name || 'Custom'}</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-white/40">Package Mgr</span>
                          <span className="text-violet-300 uppercase">{project.profile.package_manager || 'pip/npm'}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs font-mono text-white/40 py-2">No runtime scanned yet. Run <code className="text-violet-300">noir connect</code>.</p>
                    )}
                  </div>

                  {/* Card 3: Project Metadata Specifications */}
                  <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 backdrop-blur-md space-y-4">
                    <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-violet-400 flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      Project Specifications
                    </h3>
                    <div className="space-y-2 font-mono text-xs">
                      <div className="flex justify-between items-center py-1 border-b border-white/5">
                        <span className="text-white/40">Architecture</span>
                        <span className="text-white font-semibold uppercase">{project.architecture}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-white/5">
                        <span className="text-white/40">Analysis Mode</span>
                        <span className="text-white font-semibold uppercase">{project.analysis_mode}</span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-white/40">Created</span>
                        <span className="text-white/70">{new Date(project.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* OPTIONAL TAB 2: SYSTEM STACK & SPECS OVERVIEW */}
            {activeTab === 'specs' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left & Middle Column: Stack Profiler & Guide */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Auto Detected System Profile Card */}
                  <div className="relative overflow-hidden bg-white/5 border border-white/10 rounded-[2.5rem] p-6 md:p-8 backdrop-blur-md shadow-lg">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold flex items-center gap-2">
                        <Cpu className="w-5 h-5 text-violet-400" />
                        Auto-Detected Runtime Stack
                      </h2>
                      {project.profile && (
                        <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          SYNCED
                        </span>
                      )}
                    </div>

                    {project.profile ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-violet-500/20 transition-all">
                          <p className="text-[9px] font-mono text-white/40 uppercase tracking-widest mb-1.5">Language</p>
                          <div className="flex items-center gap-2">
                            <Code className="w-4 h-4 text-violet-400" />
                            <span className="text-sm font-semibold">{project.profile.framework?.language || 'Unknown'}</span>
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-violet-500/20 transition-all">
                          <p className="text-[9px] font-mono text-white/40 uppercase tracking-widest mb-1.5">Framework</p>
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-violet-400" />
                            <span className="text-sm font-semibold">{project.profile.framework?.name || 'Vanilla'}</span>
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-violet-500/20 transition-all">
                          <p className="text-[9px] font-mono text-white/40 uppercase tracking-widest mb-1.5">Runtime Version</p>
                          <div className="flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-violet-400" />
                            <span className="text-sm font-mono font-semibold">{project.profile.runtime_version}</span>
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-violet-500/20 transition-all">
                          <p className="text-[9px] font-mono text-white/40 uppercase tracking-widest mb-1.5">Package Manager</p>
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-violet-400" />
                            <span className="text-sm font-semibold uppercase font-mono">{project.profile.package_manager}</span>
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-violet-500/20 transition-all">
                          <p className="text-[9px] font-mono text-white/40 uppercase tracking-widest mb-1.5">Operating System</p>
                          <div className="flex items-center gap-2">
                            <Laptop className="w-4 h-4 text-violet-400" />
                            <span className="text-sm font-semibold">{project.profile.operating_system}</span>
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-violet-500/20 transition-all col-span-2 sm:col-span-1">
                          <p className="text-[9px] font-mono text-white/40 uppercase tracking-widest mb-1.5">Profile Scanned</p>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-violet-400" />
                            <span className="text-xs font-mono">{new Date(project.profile.detected_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 flex flex-col items-center justify-center text-center bg-black/20 border border-white/5 rounded-2xl p-6">
                        <Sparkles className="w-8 h-8 text-white/20 mb-3 animate-pulse" />
                        <h4 className="text-sm font-semibold text-white/80">No runtime profile detected</h4>
                        <p className="text-xs text-white/40 mt-1 max-w-[340px]">
                          Start your local daemon using the connection key to scan runtime, operating system, and language environment profiles.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Technical Integration CLI Card */}
                  <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 md:p-8 backdrop-blur-md shadow-lg space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Terminal className="w-5 h-5 text-violet-400" />
                      Agent Registration Instructions
                    </h2>
                    <p className="text-xs text-white/50 leading-relaxed font-light">
                      Install the central telemetry daemon inside your application workspace environment:
                    </p>
                    
                    <div className="bg-black/60 border border-white/5 rounded-xl p-4 font-mono text-xs text-violet-300 space-y-2 overflow-x-auto">
                      <div># 1. Connect workspace</div>
                      <div className="text-stone-300">$ noir connect {project.connection_code}</div>
                      
                      <div className="pt-2"># 2. Run container with live WebSocket telemetry stream</div>
                      <div className="text-stone-300">$ noir run</div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Spec Sidebar */}
                <div className="space-y-6">
                  <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 backdrop-blur-md shadow-lg space-y-6">
                    <h3 className="text-base font-bold flex items-center gap-2 border-b border-white/5 pb-4">
                      <Settings className="w-4 h-4 text-violet-400" />
                      Specifications
                    </h3>

                    <div className="space-y-4 font-mono text-xs">
                      <div>
                        <span className="text-white/40 block text-[9px] uppercase tracking-wider mb-0.5">Deployment Type</span>
                        <span className="text-white font-semibold uppercase">{project.architecture}</span>
                      </div>
                      <div>
                        <span className="text-white/40 block text-[9px] uppercase tracking-wider mb-0.5">Visibility Mode</span>
                        <span className="text-white font-semibold uppercase">{project.visibility}</span>
                      </div>
                      <div>
                        <span className="text-white/40 block text-[9px] uppercase tracking-wider mb-0.5">Analysis Routine</span>
                        <span className="text-white font-semibold uppercase">{project.analysis_mode}</span>
                      </div>
                      <div>
                        <span className="text-white/40 block text-[9px] uppercase tracking-wider mb-0.5">Workspace Owner</span>
                        <span className="text-white font-semibold">{project.owner?.username || 'Unknown'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 backdrop-blur-md shadow-lg space-y-4 font-mono text-xs">
                    <div className="flex items-center gap-2.5 text-white/50">
                      <Calendar className="w-4 h-4 text-violet-400" />
                      <div>
                        <span className="block text-[8px] uppercase text-white/30 tracking-wider">Created</span>
                        <span>{new Date(project.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 text-white/50 border-t border-white/5 pt-3">
                      <Clock className="w-4 h-4 text-violet-400" />
                      <div>
                        <span className="block text-[8px] uppercase text-white/30 tracking-wider">Last Sync</span>
                        <span>{new Date(project.updated_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </motion.div>
        )}
      </div>
    </UserLayout>
  );
}
