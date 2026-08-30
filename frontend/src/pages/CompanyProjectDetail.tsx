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
  Building2,
  FlaskConical,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import UserLayout from '../components/UserLayout';
import { Skeleton } from '../components/Skeleton';
import { apiFetch } from '../utils/api';
import { checkAndRefreshToken } from '../utils/auth';

interface FrameworkData {
  id: number;
  name: string;
  language: string;
  supported: boolean;
}

interface ProfileData {
  framework: FrameworkData | null;
  runtime_version: string;
  package_manager: string;
  operating_system: string;
  detected_at: string;
}

interface ProjectDetailData {
  id: number;
  connection_code: string;
  owner: {
    id: number;
    username: string;
  };
  title: string;
  description: string;
  architecture: string;
  visibility: string;
  analysis_mode: string;
  status: string;
  profile: ProfileData | null;
  created_at: string;
  updated_at: string;
}

interface TestRunItem {
  id: number;
  project: number;
  project_id: number;
  project_title: string;
  executor_id: number;
  executor_username: string;
  executor_email: string;
  executor_first_name: string;
  executor_last_name: string;
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


export default function CompanyProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [project, setProject] = useState<ProjectDetailData | null>(null);
  const [testRuns, setTestRuns] = useState<TestRunItem[]>([]);
  const [isCopied, setIsCopied] = useState(false);
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
              connection_code: found.connectionCode || 'NR-COMP-8F93A',
              owner: {
                id: 9,
                username: 'CompanyAdmin'
              },
              title: found.name,
              description: 'Company Telemetry Node Workspace.',
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
                operating_system: 'Linux Enterprise',
                detected_at: new Date().toISOString()
              },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
        }
      }

      // Fetch test execution runs for this specific project
      const testRes = await apiFetch(`${baseUrl}/api/project/test-runs/?project_id=${projectId}`, { headers });
      if (testRes.ok) {
        const testData = await testRes.json();
        setTestRuns(testData);
      }

    } catch (err) {
      console.error(err);
      setError('Failed to load company project details.');
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
          to="/company/projects" 
          className="inline-flex items-center gap-2 text-white/40 hover:text-white text-xs font-mono uppercase tracking-widest transition-colors mb-8 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Company Projects
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
              {error || 'The requested company project could not be found or retrieved.'}
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

            {/* Main Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left & Middle Column: Stack Profiler & Guide */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Auto Detected System Profile Card */}
                <div className="relative overflow-hidden bg-white/5 border border-white/10 rounded-[2.5rem] p-6 md:p-8 backdrop-blur-md shadow-lg">
                  {/* Neon radial light */}
                  <div className="absolute -top-12 -right-12 w-48 h-48 bg-violet-500/10 blur-3xl rounded-full pointer-events-none" />
                  
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-violet-400" />
                      Company Runtime Stack
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
                        Deploy company CLI daemon to stream telemetry profiles into this workspace node.
                      </p>
                    </div>
                  )}
                </div>

                {/* Technical Integration CLI Card */}
                <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 md:p-8 backdrop-blur-md shadow-lg space-y-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-violet-400" />
                    Company Telemetry Stream Registration
                  </h2>
                  <p className="text-xs text-white/50 leading-relaxed font-light">
                    Run the central agent in your company cluster or deployment pipeline:
                  </p>
                  
                  <div className="bg-black/60 border border-white/5 rounded-xl p-4 font-mono text-xs text-violet-300 space-y-2 overflow-x-auto">
                    <div># 1. Install Noir Agent</div>
                    <div className="text-stone-300">$ npm install -g @noir/agent</div>
                    
                    <div className="pt-2"># 2. Connect project to company telemetry endpoint</div>
                    <div className="text-stone-300">$ noir-agent connect --code={project.connection_code} --company</div>
                  </div>
                </div>

                {/* Test Execution Telemetry Card */}
                <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 md:p-8 backdrop-blur-md shadow-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <FlaskConical className="w-5 h-5 text-emerald-400" />
                      Project Test Execution History
                    </h2>
                    <span className="text-xs font-mono text-white/40">
                      {testRuns.length} runs recorded
                    </span>
                  </div>

                  {testRuns.length === 0 ? (
                    <div className="py-6 text-center bg-black/20 border border-white/5 rounded-2xl p-4">
                      <FlaskConical className="w-6 h-6 text-white/20 mx-auto mb-2" />
                      <p className="text-xs text-white/50 font-mono">No test executions logged for this workload yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {testRuns.map((tr) => (
                        <div
                          key={tr.id}
                          className="p-4 rounded-2xl bg-black/40 border border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 font-mono text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                                tr.status === 'passed'
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                              }`}>
                                {tr.status}
                              </span>
                              <span className="font-bold text-white text-xs">{tr.suite_name}</span>
                            </div>
                            <p className="text-[10px] text-white/40 mt-1">
                              Executor: <span className="text-white/80">{tr.executor_username}</span> • Team: <span className="text-purple-300">{tr.team_name || 'Individual'}</span>
                            </p>
                          </div>

                          <div className="text-left sm:text-right">
                            <p className="text-emerald-400 font-bold text-xs">
                              {tr.passed_tests}/{tr.total_tests} passed <span className="text-white/40 font-normal">({(tr.duration_ms/1000).toFixed(2)}s)</span>
                            </p>
                            <p className="text-[9px] text-white/30 mt-0.5">
                              {new Date(tr.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>


              {/* Right Column: Spec Sidebar */}
              <div className="space-y-6">
                <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 backdrop-blur-md shadow-lg space-y-6">
                  <h3 className="text-base font-bold flex items-center gap-2 border-b border-white/5 pb-4">
                    <Building2 className="w-4 h-4 text-violet-400" />
                    Specifications
                  </h3>

                  <div className="space-y-4 font-mono text-xs">
                    <div>
                      <span className="text-white/40 block text-[9px] uppercase tracking-wider mb-0.5">Architecture</span>
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
                      <span className="text-white/40 block text-[9px] uppercase tracking-wider mb-0.5">Organization Owner</span>
                      <span className="text-white font-semibold">{project.owner?.username || 'Company Owner'}</span>
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
          </motion.div>
        )}
      </div>
    </UserLayout>
  );
}
