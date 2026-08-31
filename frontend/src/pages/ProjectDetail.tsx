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
  Info
} from 'lucide-react';
import UserLayout from '../components/UserLayout';
import { Skeleton } from '../components/Skeleton';
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

function LiveStreamTerminal({ connectionCode }: { connectionCode: string }) {
  const [logs, setLogs] = useState<Array<{ log: string; timestamp?: string; stream?: string }>>([]);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const terminalRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!connectionCode) return;

    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    let host = apiBase.replace(/^https?:\/\//, '');
    if (host.endsWith('/api')) host = host.replace(/\/api$/, '');
    const wsProtocol = apiBase.startsWith('https') ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${host}/ws/project/${connectionCode}/logs/`;

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.log) {
            setLogs((prev) => [...prev.slice(-300), {
              log: data.log,
              timestamp: data.timestamp || new Date().toLocaleTimeString(),
              stream: data.stream || 'stdout'
            }]);
          }
        } catch (err) {
          console.error('WS parse error:', err);
        }
      };

      ws.onerror = (err) => {
        console.warn('WS Connection error:', err);
        setIsWsConnected(false);
      };

      ws.onclose = () => {
        setIsWsConnected(false);
      };
    } catch (e) {
      console.warn('WS Init error:', e);
    }

    return () => {
      if (ws) ws.close();
    };
  }, [connectionCode]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 md:p-8 backdrop-blur-md shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Terminal className="w-5 h-5 text-violet-400" />
          Real-Time Telemetry & Live Container Output
        </h2>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded-full border ${
            isWsConnected 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isWsConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
            {isWsConnected ? 'WEBSOCKET LIVE' : 'WAITING FOR NOIR RUN'}
          </span>
          {logs.length > 0 && (
            <button
              onClick={() => setLogs([])}
              className="text-[10px] font-mono text-white/40 hover:text-white px-2 py-1 bg-white/5 rounded-lg border border-white/5 transition-all"
            >
              Clear Logs
            </button>
          )}
        </div>
      </div>

      <div 
        ref={terminalRef}
        className="bg-black/80 border border-white/10 rounded-2xl p-4 font-mono text-xs text-stone-300 h-64 overflow-y-auto space-y-1 shadow-inner scrollbar-thin scrollbar-thumb-white/10"
      >
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-white/30 space-y-2">
            <Activity className="w-8 h-8 text-violet-400/30 animate-pulse" />
            <p>No container execution stream active.</p>
            <p className="text-[10px] font-mono text-white/20">Execute <span className="text-violet-300">$ noir run</span> in your workspace to stream live telemetry.</p>
          </div>
        ) : (
          logs.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2 hover:bg-white/5 p-0.5 rounded transition-colors">
              <span className="text-violet-400/60 text-[10px] select-none min-w-[55px] font-mono">
                {item.timestamp}
              </span>
              <span className={item.stream === 'stderr' ? 'text-rose-400' : 'text-emerald-300'}>
                {item.log}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [project, setProject] = useState<ProjectDetailData | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjectDetails = async () => {
    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      
      const response = await apiFetch(`${baseUrl}/api/project/${projectId}/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
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
            return;
          }
        }
        setError('Project details not found.');
      }
    } catch (err) {
      console.error(err);
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
            profile: null, // Test empty profile scenario fallback
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          return;
        }
      }
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

                {/* Real-time Telemetry & Container Stream Terminal */}
                <LiveStreamTerminal connectionCode={project.connection_code} />
              </div>

              {/* Right Column: Spec Sidebar */}
              <div className="space-y-6">
                {/* Meta details specs */}
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

                {/* Timestamps */}
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
