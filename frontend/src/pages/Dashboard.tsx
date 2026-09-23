import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Folder,
  Plus,
  Search,
  Check,
  Copy,
  ArrowUpRight,
  Shield,
  Activity,
  Terminal,
  Building2,
  ChevronRight,
  Cpu,
  Sparkles,
  Radio,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import UserLayout from '../components/UserLayout';
import { Skeleton } from '../components/Skeleton';
import Modal from '../components/Modal';
import { apiFetch } from '../utils/api';
import { checkAndRefreshToken, getAccessToken } from '../utils/auth';
import { getUserProjects, getCachedProjects, Project, formatLastUpdated } from '../utils/projectCache';

export { formatLastUpdated };

export default function Dashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>(() => getCachedProjects());
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [copiedCliCommand, setCopiedCliCommand] = useState(false);

  // Selected project for Agent Daemon Live Feed
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Real test runs data from backend
  const [testRuns, setTestRuns] = useState<any[]>([]);

  // Agent Daemon Live Feed State
  const [daemonStatus, setDaemonStatus] = useState<{
    is_active: boolean;
    is_daemon_active: boolean;
    is_streaming: boolean;
    last_seen?: string;
  } | null>(null);
  const [logs, setLogs] = useState<Array<{ log: string; timestamp?: string; stream?: string }>>([]);
  const [isWsConnected, setIsWsConnected] = useState(false);

  const terminalRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectArch, setNewProjectArch] = useState('monolith');
  const [newProjectVis, setNewProjectVis] = useState('private');
  const [newProjectAnalysisMode, setNewProjectAnalysisMode] = useState('manual');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Company Requests State for Developer
  const [companyRequests, setCompanyRequests] = useState<any[]>([]);
  const [developerCompany, setDeveloperCompany] = useState<any>(null);

  // Computed selected project
  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0] || null;

  // Real statistics computation
  const activeDaemonsCount = projects.filter(p => p.isDaemonActive || p.isStreamActive).length;
  const passedTestRunsCount = testRuns.filter(r => r.status === 'passed').length;
  const testPassRate = testRuns.length > 0 ? Math.round((passedTestRunsCount / testRuns.length) * 100) : null;

  const fetchDeveloperCompanyInfo = async () => {
    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };

      // Whoami info
      const whoRes = await apiFetch(`${baseUrl}/api/accounts/me/`, { headers });
      if (whoRes.ok) {
        const who = await whoRes.json();
        if (who.company) {
          setDeveloperCompany(who.company);
        }
      }

      // Pending invitations
      const reqRes = await apiFetch(`${baseUrl}/api/accounts/developer/company-requests/`, { headers });
      if (reqRes.ok) {
        const reqs = await reqRes.json();
        setCompanyRequests(reqs.filter((r: any) => r.status === 'pending'));
      }
    } catch (err) {
      console.error('Error fetching developer company info:', err);
    }
  };

  const handleRespondCompanyRequest = async (requestId: number, action: 'accept' | 'reject') => {
    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';

      const res = await apiFetch(`${baseUrl}/api/accounts/developer/company-requests/${requestId}/respond/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ action })
      });

      if (res.ok) {
        fetchDeveloperCompanyInfo();
      }
    } catch (err) {
      console.error('Error responding to company request:', err);
    }
  };

  // Fetch real test runs
  const fetchTestRuns = async () => {
    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };

      const res = await apiFetch(`${baseUrl}/api/projects/test-runs/`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setTestRuns(data);
        }
      }
    } catch (err) {
      console.error('Error fetching test runs:', err);
    }
  };

  // Initial load
  useEffect(() => {
    const userRole = localStorage.getItem('user_role');
    if (userRole === 'company') {
      navigate('/company/dashboard');
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      navigate('/login');
      return;
    }

    fetchDeveloperCompanyInfo();
    fetchTestRuns();

    const loadProjects = async () => {
      // Force refresh on dashboard mount to ensure accurate daemon status
      const prjs = await getUserProjects({ forceRefresh: true });
      setProjects(prjs);
      if (prjs.length > 0) {
        setSelectedProjectId(prev => {
          if (prjs.some(p => p.id === prev)) return prev;
          return prjs[0].id;
        });
      }
      setIsLoading(false);
    };

    loadProjects();
  }, [navigate]);

  // Connect WebSocket for live daemon telemetry
  const connectWs = (code: string) => {
    if (!code) return;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    let host = apiBase.replace(/^https?:\/\//, '');
    if (host.endsWith('/api')) host = host.replace(/\/api$/, '');
    const wsProtocol = apiBase.startsWith('https') ? 'wss:' : 'ws:';
    const token = getAccessToken();
    const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
    const wsUrl = `${wsProtocol}//${host}/ws/project/${code}/logs/${tokenQuery}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle daemon status update broadcast
          if (data.event === 'daemon_start') {
            setDaemonStatus(prev => ({
              is_active: true,
              is_daemon_active: true,
              is_streaming: prev?.is_streaming || false
            }));
            setProjects(prev => prev.map(p => p.connectionCode?.toUpperCase() === code.toUpperCase() ? { ...p, isDaemonActive: true } : p));
          } else if (data.event === 'daemon_stop') {
            setDaemonStatus(prev => ({
              is_active: false,
              is_daemon_active: false,
              is_streaming: false
            }));
            setProjects(prev => prev.map(p => p.connectionCode?.toUpperCase() === code.toUpperCase() ? { ...p, isDaemonActive: false } : p));
          }

          // Handle incoming real log line
          if (data.log) {
            setLogs(prev => [...prev.slice(-400), {
              log: data.log,
              timestamp: data.timestamp || new Date().toLocaleTimeString(),
              stream: data.stream || 'stdout'
            }]);
          }

          if (data.event === 'run_end' || data.event === 'analysis_end') {
            fetchTestRuns();
          }
        } catch (err) {
          console.error('Live stream parse error:', err);
        }
      };

      ws.onerror = (err) => {
        console.warn('Stream socket error:', err);
        setIsWsConnected(false);
      };

      ws.onclose = () => {
        setIsWsConnected(false);
        wsRef.current = null;
      };
    } catch (e) {
      console.warn('Stream socket init exception:', e);
    }
  };

  // Poll daemon and stream status for selected project
  useEffect(() => {
    if (!selectedProject || !selectedProject.connectionCode) {
      setDaemonStatus(null);
      setLogs([]);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsWsConnected(false);
      return;
    }

    const code = selectedProject.connectionCode;
    setLogs([]); // Clear logs when switching projects

    const checkStatus = async () => {
      try {
        const token = await checkAndRefreshToken();
        const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
        const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };

        const res = await apiFetch(`${baseUrl}/api/project/${code}/stream-status/`, { headers });
        if (res.ok) {
          const data = await res.json();
          setDaemonStatus({
            is_active: !!data.is_active,
            is_daemon_active: !!data.is_daemon_active,
            is_streaming: !!data.is_streaming,
            last_seen: data.last_seen
          });

          // Sync project list status
          setProjects(prev => prev.map(p => {
            if (p.connectionCode?.toUpperCase() === code.toUpperCase()) {
              return {
                ...p,
                isDaemonActive: !!data.is_daemon_active,
                isStreamActive: !!data.is_streaming
              };
            }
            return p;
          }));
        }
      } catch (err) {
        // Fallback
      }
    };

    checkStatus();
    connectWs(code);

    const interval = setInterval(checkStatus, 3000);

    return () => {
      clearInterval(interval);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [selectedProject?.connectionCode]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const copyConnectionCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const copyCliDaemonCommand = () => {
    if (!selectedProject?.connectionCode) return;
    const cmd = `noir connect ${selectedProject.connectionCode} && noir fault listen`;
    navigator.clipboard.writeText(cmd);
    setCopiedCliCommand(true);
    setTimeout(() => setCopiedCliCommand(false), 2000);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectTitle.trim()) return;

    setIsCreating(true);
    setError(null);
    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      
      const payload = {
        title: newProjectTitle,
        description: newProjectDesc,
        architecture: newProjectArch,
        visibility: newProjectVis,
        analysis_mode: newProjectAnalysisMode
      };

      const response = await apiFetch(`${baseUrl}/api/project/create/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        
        const newPrj: Project = {
          id: data.id ? String(data.id) : `prj-${Date.now()}`,
          name: data.title || newProjectTitle,
          status: 'active',
          lastUpdated: 'Just now',
          environments: 1,
          connectionCode: data.connection_code || '',
          isDaemonActive: false,
          isStreamActive: false,
          containersCount: 0
        };

        setProjects(prev => {
          const updated = [newPrj, ...prev];
          localStorage.setItem('noir_user_projects', JSON.stringify(updated));
          return updated;
        });

        setSelectedProjectId(newPrj.id);
        
        // Reset form
        setNewProjectTitle('');
        setNewProjectDesc('');
        setNewProjectArch('monolith');
        setNewProjectVis('private');
        setNewProjectAnalysisMode('manual');
        setIsCreateModalOpen(false);
      } else {
        const errData = await response.json().catch(() => ({}));
        setError(errData.detail || 'Failed to register project on the server.');
      }
    } catch (err: any) {
      console.error(err);
      setError('A network error occurred. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.connectionCode && p.connectionCode.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const currentTime = new Date().toLocaleTimeString();

  return (
    <UserLayout>
      <div className="max-w-5xl mx-auto space-y-4 py-2">
        
        {/* =========================================================================
            1. MINIMAL HEADER: Clean, Focused, Developer-Grade
           ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100 flex items-center gap-2">
              <span>Overview</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-normal">
                User Workspace
              </span>
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Live telemetry, real agent daemon status, and automated test audits.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-3 text-xs bg-zinc-900 border border-zinc-800 rounded-md text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 w-44 sm:w-56 transition-all"
              />
            </div>

            {/* New Project Button */}
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="h-8 px-3 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>
          </div>
        </div>

        {/* =========================================================================
            2. PENDING INVITATIONS BANNER (Only when active)
           ========================================================================= */}
        {developerCompany ? (
          <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-lg px-3.5 py-2 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-zinc-400 font-mono text-[11px]">Organization:</span>
              <span className="font-semibold text-zinc-200">{developerCompany.company_name}</span>
              <span className="text-emerald-400 font-mono text-[11px]">✓ Team Member</span>
            </div>
            <Link to="/organization" className="text-zinc-400 hover:text-zinc-200 font-mono text-[11px] flex items-center gap-1">
              <span>Teams</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        ) : companyRequests.length > 0 ? (
          <div className="space-y-2">
            {companyRequests.map((req) => (
              <div 
                key={req.id}
                className="bg-amber-950/20 border border-amber-600/30 rounded-lg px-3.5 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-zinc-200">Invitation from {req.company_name}</span>
                    <span className="text-zinc-400 ml-2">"{req.message || 'Wants you to join their engineering team.'}"</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => handleRespondCompanyRequest(req.id, 'accept')}
                    className="h-7 px-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRespondCompanyRequest(req.id, 'reject')}
                    className="h-7 px-2.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* =========================================================================
            3. REAL METRICS STRIP: 100% Accurate Data (No Fake Mock Numbers)
           ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          {/* Metric 1: Total Projects */}
          <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-lg p-3 px-3.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Total Projects</span>
              <div className="text-xl font-bold font-mono text-zinc-100 mt-0.5">
                {isLoading ? <Skeleton className="h-6 w-12 bg-zinc-800/50" /> : projects.length}
              </div>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                {projects.filter(p => p.connectionCode).length} paired with CLI
              </p>
            </div>
            <div className="w-8 h-8 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <Folder className="w-4 h-4 text-zinc-400" />
            </div>
          </div>

          {/* Metric 2: Real Daemon Cluster Status */}
          <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-lg p-3 px-3.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Daemon Status</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${activeDaemonsCount > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
                <span className={`text-sm font-semibold font-mono ${activeDaemonsCount > 0 ? 'text-emerald-400' : 'text-zinc-400'}`}>
                  {activeDaemonsCount > 0 ? `${activeDaemonsCount} Active` : '0 Active (Standby)'}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                {activeDaemonsCount > 0 ? 'Listening for remote faults' : 'Run noir fault listen to connect'}
              </p>
            </div>
            <div className={`w-8 h-8 rounded-md border flex items-center justify-center ${
              activeDaemonsCount > 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
            }`}>
              <Radio className={`w-4 h-4 ${activeDaemonsCount > 0 ? 'animate-pulse' : ''}`} />
            </div>
          </div>

          {/* Metric 3: Real Pipeline Test Audits */}
          <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-lg p-3 px-3.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Test Executions</span>
              <div className="text-xl font-bold font-mono text-zinc-100 mt-0.5">
                {testRuns.length > 0 ? (
                  <span>
                    {testRuns.length} <span className="text-xs text-emerald-400 font-normal">({testPassRate}% Pass)</span>
                  </span>
                ) : (
                  <span className="text-sm font-mono text-zinc-400">0 Runs</span>
                )}
              </div>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                {testRuns.length > 0 
                  ? `${passedTestRunsCount} passed, ${testRuns.length - passedTestRunsCount} failed`
                  : 'Execute tests via noir run'
                }
              </p>
            </div>
            <div className="w-8 h-8 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <Shield className="w-4 h-4 text-violet-400" />
            </div>
          </div>

        </div>

        {/* =========================================================================
            4. CONNECTED PROJECTS TABLE: Accurate Statuses & 1-Click Code Copy
           ========================================================================= */}
        <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-lg overflow-hidden">
          <div className="p-3 px-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/40">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-zinc-400" />
              <span className="text-xs font-semibold text-zinc-200">Connected Projects</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400">
                {filteredProjects.length}
              </span>
            </div>
            <span className="text-[11px] font-mono text-zinc-500 hidden sm:inline">
              Select project to inspect live feed
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800/60 text-zinc-400 font-mono text-[11px] uppercase bg-zinc-900/20">
                  <th className="py-2.5 px-4 font-medium">Project Name</th>
                  <th className="py-2.5 px-3 font-medium">Daemon Status</th>
                  <th className="py-2.5 px-3 font-medium">Connection Code</th>
                  <th className="py-2.5 px-3 font-medium">Containers</th>
                  <th className="py-2.5 px-3 font-medium">Last Sync</th>
                  <th className="py-2.5 px-4 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {isLoading ? (
                  [1, 2, 3].map((n) => (
                    <tr key={n}>
                      <td colSpan={6} className="p-3">
                        <Skeleton className="h-6 w-full bg-zinc-800/40" />
                      </td>
                    </tr>
                  ))
                ) : filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-zinc-500">
                      <Folder className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                      <p className="text-xs text-zinc-300 font-medium">No projects found</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        {searchQuery ? "No projects match your search query." : "Register your first project to start streaming telemetry."}
                      </p>
                      {!searchQuery && (
                        <button
                          type="button"
                          onClick={() => setIsCreateModalOpen(true)}
                          className="mt-3 h-7 px-3 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Register Project</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((prj) => {
                    const isSelected = selectedProjectId === prj.id;
                    const isDaemon = !!prj.isDaemonActive || (selectedProject?.id === prj.id && daemonStatus?.is_daemon_active);
                    const isStream = !!prj.isStreamActive || (selectedProject?.id === prj.id && daemonStatus?.is_streaming);

                    return (
                      <tr
                        key={prj.id}
                        onClick={() => setSelectedProjectId(prj.id)}
                        className={`hover:bg-zinc-900/50 cursor-pointer transition-colors group text-zinc-300 ${
                          isSelected ? 'bg-zinc-900/40 border-l-2 border-violet-500' : ''
                        }`}
                      >
                        {/* Name */}
                        <td className="py-2.5 px-4 font-medium">
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold transition-colors ${isSelected ? 'text-violet-300' : 'text-zinc-200 group-hover:text-violet-300'}`}>
                              {prj.name}
                            </span>
                            {isSelected && (
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                                Monitored
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Daemon Status (Real) */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {isDaemon ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span>Daemon Active</span>
                            </span>
                          ) : isStream ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-cyan-400 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                              <span>Streaming</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-zinc-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                              <span>Inactive (Idle)</span>
                            </span>
                          )}
                        </td>

                        {/* Connection Code with 1-click copy */}
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          {prj.connectionCode ? (
                            <div 
                              onClick={(e) => e.stopPropagation()} 
                              className="inline-flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-zinc-300"
                            >
                              <span>{prj.connectionCode}</span>
                              <button
                                type="button"
                                onClick={() => copyConnectionCode(prj.connectionCode!, prj.id)}
                                title="Copy code"
                                className="text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
                              >
                                {copiedCodeId === prj.id ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-zinc-600 font-mono text-[11px]">Unlinked</span>
                          )}
                        </td>

                        {/* Topology / Containers */}
                        <td className="py-2.5 px-3 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Cpu className="w-3 h-3 text-zinc-500" />
                            <span>Docker ({prj.containersCount || 0})</span>
                          </div>
                        </td>

                        {/* Last Sync */}
                        <td className="py-2.5 px-3 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                          {prj.lastUpdated || 'Just now'}
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setSelectedProjectId(prj.id)}
                              className={`h-6 px-2 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                                isSelected 
                                  ? 'bg-violet-600 text-white font-medium' 
                                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                              }`}
                            >
                              {isSelected ? 'Live Feed' : 'Select'}
                            </button>
                            <Link
                              to={`/dashboard/projects/${prj.id}`}
                              className="h-6 px-2 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium inline-flex items-center gap-0.5 transition-colors"
                              title="Open Project Workspace"
                            >
                              <span>Open</span>
                              <ChevronRight className="w-3 h-3" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* =========================================================================
            5. AGENT DAEMON LIVE FEED: ONLY REAL DATA (Inactive Daemon Warning if Idle)
           ========================================================================= */}
        <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-lg p-3.5 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-violet-400" />
                <h2 className="text-xs font-semibold uppercase tracking-wider font-mono text-zinc-200">
                  Agent Daemon Live Feed
                </h2>
              </div>

              {/* Project selector dropdown */}
              {projects.length > 0 && (
                <div className="flex items-center gap-1.5 ml-0 sm:ml-2">
                  <span className="text-[10px] text-zinc-500 font-mono">Workspace:</span>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="h-6 px-2 text-[11px] font-mono bg-zinc-900 border border-zinc-800 rounded text-zinc-200 focus:outline-none focus:border-zinc-700 cursor-pointer"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.connectionCode || 'No code'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              {/* Daemon Status Badge (Real) */}
              <span className={`flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded border transition-all ${
                daemonStatus?.is_daemon_active
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-medium'
                  : daemonStatus?.is_streaming
                  ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400 font-medium'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  daemonStatus?.is_daemon_active
                    ? 'bg-emerald-400 animate-pulse'
                    : daemonStatus?.is_streaming
                    ? 'bg-cyan-400 animate-pulse'
                    : 'bg-zinc-600'
                }`} />
                {daemonStatus?.is_daemon_active 
                  ? '● DAEMON ACTIVE' 
                  : daemonStatus?.is_streaming 
                  ? '● STREAMING PROCESS' 
                  : '○ DAEMON INACTIVE'}
              </span>

              {/* WebSocket Status Indicator */}
              <span className="text-[10px] font-mono text-zinc-500 hidden md:inline">
                {isWsConnected ? 'WS: CONNECTED' : 'WS: STANDBY'}
              </span>

              {/* Copy quick start CLI command */}
              {selectedProject?.connectionCode && (
                <button
                  type="button"
                  onClick={copyCliDaemonCommand}
                  className="h-6 px-2 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-[10px] font-mono inline-flex items-center gap-1 transition-colors cursor-pointer"
                  title="Copy command to start daemon locally"
                >
                  {copiedCliCommand ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-zinc-500" />
                      <span>Copy CLI Daemon Command</span>
                    </>
                  )}
                </button>
              )}

              {/* Clear Logs Button */}
              {logs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLogs([])}
                  className="text-[10px] font-mono text-zinc-400 hover:text-zinc-200 px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 rounded border border-zinc-800 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Terminal Screen (Real Logs / Inactive Daemon Status) */}
          <div 
            ref={terminalRef}
            className="bg-[#090A0F] border border-zinc-800/80 rounded-md p-3.5 font-mono text-[11px] text-zinc-300 h-64 overflow-y-auto space-y-1 shadow-inner select-text"
          >
            {logs.length === 0 ? (
              daemonStatus?.is_active ? (
                <div className="space-y-1 py-1 text-zinc-400">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <span className="text-zinc-500 text-[10px] select-none">{currentTime}</span>
                    <span>[System] Daemon status: ACTIVE (CONNECTED)</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-300">
                    <span className="text-zinc-500 text-[10px] select-none">{currentTime}</span>
                    <span>[System] Noir telemetry daemon is connected to '{selectedProject?.name}'. Awaiting process events...</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-500">
                    <span className="text-zinc-500 text-[10px] select-none">{currentTime}</span>
                    <span>[System] Trigger tests with 'noir run' or manual chaos injections from the project view.</span>
                  </div>
                </div>
              ) : (
                /* EXPLICIT INACTIVE DAEMON LOG (Required by user prompt) */
                <div className="space-y-1.5 py-1 text-zinc-400">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold">
                    <span className="text-zinc-500 text-[10px] select-none">{currentTime}</span>
                    <span>[System] Daemon status: INACTIVE</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-300">
                    <span className="text-zinc-500 text-[10px] select-none">{currentTime}</span>
                    <span>
                      [System] No active Noir daemon connected to project '{selectedProject?.name || 'Workspace'}' ({selectedProject?.connectionCode || 'UNLINKED'}).
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400 pl-4 border-l border-zinc-800 my-1">
                    <span>
                      To start daemon in this repository, run:
                      <br />
                      <span className="text-emerald-400 font-mono font-medium">
                        $ noir connect {selectedProject?.connectionCode || '<CONNECTION_CODE>'}
                      </span>
                      <br />
                      <span className="text-emerald-400 font-mono font-medium">
                        $ noir fault listen
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-500">
                    <span className="text-zinc-500 text-[10px] select-none">{currentTime}</span>
                    <span>[System] Listening for incoming agent daemon heartbeat on WebSocket...</span>
                  </div>
                </div>
              )
            ) : (
              /* REAL LOG STREAM */
              logs.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 hover:bg-zinc-900/60 p-0.5 rounded transition-colors">
                  <span className="text-zinc-500 text-[10px] select-none min-w-[55px] font-mono shrink-0">
                    {item.timestamp}
                  </span>
                  <span className={item.stream === 'stderr' ? 'text-rose-400' : 'text-emerald-400'}>
                    {item.log}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* =========================================================================
            6. QUICKSTART HELPER BAR: Developer Pairing Guide
           ========================================================================= */}
        <div className="p-3 px-4 bg-[#0D0F17] border border-zinc-800/80 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-4 h-4 text-violet-400 shrink-0" />
            <div>
              <span className="font-semibold text-zinc-200">Terminal CLI pairing:</span>
              <span className="text-zinc-400 ml-1.5 font-mono text-[11px]">
                Run <code className="text-emerald-400 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">noir connect &lt;code&gt;</code> in your repository
              </span>
            </div>
          </div>
          <Link
            to="/quickstart"
            className="text-xs font-medium text-zinc-300 hover:text-white flex items-center gap-1 shrink-0 transition-colors"
          >
            <span>Quickstart guide</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

      </div>

      {/* =========================================================================
          REGISTER PROJECT MODAL
         ========================================================================= */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Register New Project"
      >
        <form onSubmit={handleCreateProject} className="space-y-3.5">
          <div className="flex items-center gap-2 text-zinc-300">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-xs uppercase font-mono tracking-wider font-semibold">New Project Workspace</span>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">Project Title</label>
            <input
              type="text"
              placeholder="e.g. Acme API"
              value={newProjectTitle}
              onChange={(e) => setNewProjectTitle(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors"
              required
              disabled={isCreating}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">Description (Optional)</label>
            <textarea
              placeholder="Brief summary of service dependencies..."
              value={newProjectDesc}
              onChange={(e) => setNewProjectDesc(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors resize-none h-16"
              disabled={isCreating}
            />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">Architecture</label>
              <select
                value={newProjectArch}
                onChange={(e) => setNewProjectArch(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-1.5 px-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-700 transition-colors cursor-pointer"
                disabled={isCreating}
              >
                <option value="monolith">Monolith</option>
                <option value="microservice">Microservice</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">Visibility</label>
              <select
                value={newProjectVis}
                onChange={(e) => setNewProjectVis(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-1.5 px-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-700 transition-colors cursor-pointer"
                disabled={isCreating}
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">Analysis Mode</label>
              <select
                value={newProjectAnalysisMode}
                onChange={(e) => setNewProjectAnalysisMode(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-1.5 px-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-700 transition-colors cursor-pointer"
                disabled={isCreating}
              >
                <option value="manual">Manual</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-3 border-t border-zinc-800 mt-3">
            <button
              type="submit"
              disabled={isCreating}
              className="flex-1 py-2 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isCreating ? (
                <>
                  <div className="w-3 h-3 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                'Register Project'
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 rounded-md border border-zinc-800 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

    </UserLayout>
  );
}
