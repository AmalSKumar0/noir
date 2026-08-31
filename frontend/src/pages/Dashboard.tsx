import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  Facebook,
  Instagram,
  Twitter,
  Plus,
  Activity,
  Copy,
  Check,
  Terminal,
  Folder,
  Shield,
  Zap,
  Sparkles,
  RefreshCw,
  Building2,
  UserCheck,
  X
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import UserLayout from '../components/UserLayout';
import { Skeleton } from '../components/Skeleton';
import Modal from '../components/Modal';
import { apiFetch } from '../utils/api';
import { checkAndRefreshToken } from '../utils/auth';
import { getUserProjects, getCachedProjects, Project, formatLastUpdated } from '../utils/projectCache';


// Analytics data mapped per project to make the dashboard dynamic
const projectAnalyticsData: Record<string, Array<{ time: string; users: number; requests: number }>> = {
  'prj-1': [
    { time: '00:00', users: 1200, requests: 900 },
    { time: '04:00', users: 2100, requests: 1400 },
    { time: '08:00', users: 800, requests: 600 },
    { time: '12:00', users: 1600, requests: 1100 },
    { time: '16:00', users: 2400, requests: 1800 },
    { time: '20:00', users: 3200, requests: 2600 },
    { time: '24:00', users: 2800, requests: 2200 },
  ],
  'prj-2': [
    { time: '00:00', users: 800, requests: 400 },
    { time: '04:00', users: 1500, requests: 700 },
    { time: '08:00', users: 500, requests: 250 },
    { time: '12:00', users: 1000, requests: 500 },
    { time: '16:00', users: 1400, requests: 800 },
    { time: '20:00', users: 1900, requests: 1100 },
    { time: '24:00', users: 1700, requests: 950 },
  ],
  'prj-3': [
    { time: '00:00', users: 950, requests: 750 },
    { time: '04:00', users: 1800, requests: 1200 },
    { time: '08:00', users: 700, requests: 550 },
    { time: '12:00', users: 1400, requests: 1000 },
    { time: '16:00', users: 2000, requests: 1500 },
    { time: '20:00', users: 2800, requests: 2100 },
    { time: '24:00', users: 2300, requests: 1750 },
  ],
  'prj-4': [
    { time: '00:00', users: 1400, requests: 1000 },
    { time: '04:00', users: 2500, requests: 1700 },
    { time: '08:00', users: 1100, requests: 800 },
    { time: '12:00', users: 1900, requests: 1300 },
    { time: '16:00', users: 2900, requests: 2000 },
    { time: '20:00', users: 3800, requests: 2900 },
    { time: '24:00', users: 3400, requests: 2500 },
  ],
  'prj-5': [
    { time: '00:00', users: 300, requests: 200 },
    { time: '04:00', users: 500, requests: 350 },
    { time: '08:00', users: 200, requests: 150 },
    { time: '12:00', users: 400, requests: 300 },
    { time: '16:00', users: 600, requests: 450 },
    { time: '20:00', users: 800, requests: 600 },
    { time: '24:00', users: 700, requests: 500 },
  ]
};

// Default analytics fallback
const defaultAnalytics = [
  { time: '00:00', users: 1000, requests: 800 },
  { time: '04:00', users: 1800, requests: 1200 },
  { time: '08:00', users: 600, requests: 400 },
  { time: '12:00', users: 1200, requests: 900 },
  { time: '16:00', users: 1900, requests: 1400 },
  { time: '20:00', users: 2600, requests: 2000 },
  { time: '24:00', users: 2100, requests: 1600 },
];
export { formatLastUpdated };

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [projects, setProjects] = useState<Project[]>(() => getCachedProjects());
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => projects[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [isCopiedKey, setIsCopiedKey] = useState(false);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isQuickstartOpen, setIsQuickstartOpen] = useState(false);

  useEffect(() => {
    if (location.hash === '#quickstart') {
      setIsQuickstartOpen(true);
    }
  }, [location.hash]);
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

  // Terminal log stream state
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);

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

  useEffect(() => {
    const userRole = localStorage.getItem('user_role');
    if (userRole === 'company') {
      navigate('/company/dashboard');
      return;
    }

    // Check authentication
    const token = localStorage.getItem('access_token');
    if (!token) {
      navigate('/login');
      return;
    }

    fetchDeveloperCompanyInfo();

    const loadProjects = async () => {
      const prjs = await getUserProjects();
      setProjects(prjs);
      if (prjs.length > 0) {
        setSelectedProjectId(prev => {
          if (prjs.some(m => m.id === prev)) return prev;
          return prjs[0].id;
        });
      } else {
        setSelectedProjectId('');
      }
      setIsLoading(false);
    };

    loadProjects();
  }, [navigate]);


  // Terminal logs feed simulation
  useEffect(() => {
    if (isLoading) return;

    const phrases = [
      'GET /api/v1/telemetry 200 OK - 32ms',
      'POST /api/v1/spans/batch 202 Accepted - 18ms',
      '✔ Agent heartbeat synchronized with central cluster',
      'Connection status: STABLE',
      'GET /api/v1/projects 200 OK - 12ms',
      'Streaming active spans on environment: production',
      '[INFO] Telemetry compression ratio: 4.8x',
      '[DEBUG] garbage-collector runs: reclaimed 14.2 MB',
      'GET /api/v1/metrics/stream 200 OK - 45ms',
    ];

    setTerminalLogs([
      '$ noir-agent start',
      '[INFO] Starting Noir Telemetry Agent v1.0...',
      '[INFO] Hooking into process hooks...',
      '✔ Successfully authenticated as engineer@noir.sh',
    ]);

    const interval = setInterval(() => {
      const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
      setTerminalLogs(prev => {
        const nextLogs = [...prev, randomPhrase];
        if (nextLogs.length > 12) nextLogs.shift();
        return nextLogs;
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [isLoading]);

  const copyCommand = () => {
    navigator.clipboard.writeText('npm install -g noir-agent\nnoir-agent init');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText('nr_live_83ba9a102bc0f1c322b7a95');
    setIsCopiedKey(true);
    setTimeout(() => setIsCopiedKey(false), 2000);
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
          connectionCode: data.connection_code || ''
        };

        // Inject dummy analytics data for new project
        projectAnalyticsData[newPrj.id] = [
          { time: '00:00', users: Math.floor(Math.random() * 1000) + 500, requests: Math.floor(Math.random() * 800) + 400 },
          { time: '04:00', users: Math.floor(Math.random() * 1500) + 800, requests: Math.floor(Math.random() * 1200) + 600 },
          { time: '08:00', users: Math.floor(Math.random() * 600) + 300, requests: Math.floor(Math.random() * 500) + 200 },
          { time: '12:00', users: Math.floor(Math.random() * 1200) + 600, requests: Math.floor(Math.random() * 1000) + 500 },
          { time: '16:00', users: Math.floor(Math.random() * 2000) + 1000, requests: Math.floor(Math.random() * 1500) + 800 },
          { time: '20:00', users: Math.floor(Math.random() * 3000) + 1500, requests: Math.floor(Math.random() * 2500) + 1200 },
          { time: '24:00', users: Math.floor(Math.random() * 2500) + 1200, requests: Math.floor(Math.random() * 2000) + 1000 },
        ];

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
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0];
  const activeAnalytics = projectAnalyticsData[selectedProjectId] || defaultAnalytics;

  return (
    <UserLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-6 md:mt-10 px-2 md:px-6 space-y-6"
      >
        {/* Company Affiliation Banner / Pending Invitations */}
        {developerCompany ? (
          <div className="w-full bg-gradient-to-r from-violet-900/30 via-purple-900/20 to-black/40 border border-violet-500/20 rounded-2xl p-4 px-6 backdrop-blur-md flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-violet-300">Organization Affiliation</p>
                <p className="text-sm font-bold text-white">{developerCompany.company_name} <span className="text-xs text-emerald-400 font-mono font-normal ml-2">✓ Verified Team Member</span></p>
              </div>
            </div>
          </div>
        ) : companyRequests.length > 0 ? (
          <div className="space-y-3">
            {companyRequests.map((req) => (
              <div 
                key={req.id}
                className="w-full bg-gradient-to-r from-amber-950/60 via-purple-950/40 to-black/60 border border-amber-500/40 rounded-2xl p-4 px-6 backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Company Invitation from {req.company_name}</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">Action Required</span>
                    </h3>
                    <p className="text-xs text-stone-300/80 mt-0.5 italic">"{req.message || `${req.company_name} wants to invite you to join their engineering team.`}"</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => handleRespondCompanyRequest(req.id, 'accept')}
                    className="px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer shadow-lg flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Accept & Join</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRespondCompanyRequest(req.id, 'reject')}
                    className="px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-rose-500/20 hover:border-rose-500/30 text-rose-300 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <X className="w-4 h-4" />
                    <span>Decline</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Real-time Analytics Summary Card */}
        <div className="w-full bg-white/5 border border-white/10 rounded-[2rem] p-6 md:p-8 backdrop-blur-md shadow-lg flex flex-col lg:flex-row gap-8 lg:items-center">
          {/* KPI Metrics */}
          <div className="flex flex-col gap-6 lg:w-1/3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                <Activity className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white">
                  {selectedProject ? selectedProject.name : 'Telemetry Stream'}
                </h2>
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono mt-0.5">
                  Live System Metrics
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {isLoading ? (
                <>
                  <Skeleton className="h-[76px] rounded-2xl bg-white/5" />
                  <Skeleton className="h-[76px] rounded-2xl bg-white/5" />
                </>
              ) : (
                <>
                  <div className="p-4 rounded-2xl bg-black/40 border border-white/5 hover:border-violet-500/30 transition-colors">
                    <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-1">Active Spans</p>
                    <p className="text-3xl font-bold text-white">
                      {selectedProject ? '3,200' : '0'}
                      <span className="text-xs text-emerald-400 ml-1.5 font-normal font-mono">↑ {selectedProject ? '12%' : '0%'}</span>
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-black/40 border border-white/5 hover:border-pink-500/30 transition-colors">
                    <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-1">Ingested Vol</p>
                    <p className="text-3xl font-bold text-white">
                      {selectedProject ? '2.6k' : '0k'}
                      <span className="text-xs text-emerald-400 ml-1.5 font-normal font-mono">↑ {selectedProject ? '8%' : '0%'}</span>
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Project Switcher */}
            {!isLoading && (
              <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-white/5">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProjectId(p.id)}
                    className={`px-3 py-1.5 rounded-full text-[9px] font-mono uppercase tracking-wider transition-all border cursor-pointer ${p.id === selectedProjectId
                        ? 'bg-white text-stone-950 border-white font-bold shadow-md'
                        : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white'
                      }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recharts Graph */}
          <div className="h-[200px] lg:h-[250px] flex-1 w-full min-w-0">
            {isLoading ? (
              <Skeleton className="w-full h-full rounded-2xl bg-white/5" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activeAnalytics} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D946EF" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#D946EF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="time"
                    stroke="rgba(255,255,255,0.3)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                    fontFamily="monospace"
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.3)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    fontFamily="monospace"
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(10, 7, 24, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem', color: '#fff' }}
                    itemStyle={{ color: '#E9D5FF' }}
                  />
                  <Area type="monotone" dataKey="users" stroke="#8B5CF6" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
                  <Area type="monotone" dataKey="requests" stroke="#D946EF" strokeWidth={3} fillOpacity={1} fill="url(#colorRequests)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </motion.div>

      {/* Main Content Grid */}
      <div className="mt-6 md:mt-10 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 px-2 md:px-6">

        {/* Left Column (Title & Search) */}
        <div className="lg:col-span-5 flex flex-col justify-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-5xl md:text-7xl lg:text-[5.5rem] font-bold leading-[0.95] tracking-tight mb-8 text-white"
          >
            Telemetry<br />
            systems<br />
            workspace
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="relative flex items-center w-full max-w-md"
          >
            <input
              type="text"
              placeholder="Search projects by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-6 pr-14 py-4 rounded-full border border-white/20 bg-white/5 text-white text-sm font-medium placeholder-white/40 focus:outline-none focus:border-violet-500 backdrop-blur-sm transition-all"
            />
             <button 
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="absolute right-2 w-10 h-10 bg-white rounded-full flex items-center justify-center text-black shadow hover:scale-105 active:scale-95 transition-transform cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </motion.div>
        </div>

        {/* Middle Column (KPI Widgets) */}
        <div className="lg:col-span-6 flex flex-col md:flex-row gap-6 mt-4 lg:mt-0 lg:pt-16">

          {/* Telemetry traces widget */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex-1 bg-white/5 border border-white/10 rounded-[2rem] p-6 text-white flex flex-col justify-between shadow-lg relative overflow-hidden backdrop-blur-md hover:border-violet-500/20 transition-colors"
          >
            {isLoading ? (
              <Skeleton className="absolute inset-0 m-6 rounded-xl bg-white/5" />
            ) : (
              <>
                <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5 text-white/70" />
                </div>

                <div className="mt-4 mb-8">
                  <h3 className="text-4xl font-bold mb-2">48.2 k</h3>
                  <p className="text-xs text-white/50">Trace Triggers Today</p>
                </div>

                <div className="flex gap-2">
                  <span className="px-4 py-1.5 rounded-full border border-white/20 text-[10px] uppercase tracking-wider font-mono">Real-time</span>
                  <span className="px-4 py-1.5 rounded-full border border-white/20 text-[10px] uppercase tracking-wider font-mono">Agent v1</span>
                </div>
              </>
            )}
          </motion.div>

          {/* SLA / Uptime widget */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex-1 bg-violet-900/20 border border-violet-500/20 rounded-[2rem] p-6 flex flex-col justify-between shadow-lg relative overflow-hidden backdrop-blur-md hover:border-violet-500/40 transition-colors"
          >
            {isLoading ? (
              <Skeleton className="absolute inset-0 m-6 rounded-xl bg-violet-500/10" />
            ) : (
              <>
                <div className="relative z-10">
                  <div className="flex items-center gap-1.5 text-violet-400 mb-1">
                    <Shield className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Cascades Guard</span>
                  </div>
                  <h3 className="text-4xl font-bold text-violet-300 mb-2">99.98%</h3>
                  <p className="text-xs text-violet-300/70 font-medium">Platform Reliability Score</p>
                </div>

                {/* Fake Graph */}
                <div className="absolute bottom-0 left-0 right-0 h-24 opacity-40">
                  <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full stroke-violet-400 fill-none">
                    <path d="M0,35 Q15,10 30,28 T60,5 T80,18 T100,10" strokeWidth="1.5" />
                    <path d="M0,35 Q15,10 30,28 T60,5 T80,18 T100,10 L100,40 L0,40 Z" strokeWidth="0" className="fill-violet-400/10" />
                  </svg>
                </div>
              </>
            )}
          </motion.div>
        </div>

        {/* Right Column (Socials/Actions) */}
        <div className="lg:col-span-1 flex lg:flex-col justify-center lg:items-end gap-3 mt-6 lg:mt-0 lg:pt-16">
          <a href="https://github.com" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full border border-white/20 bg-white/5 text-white flex items-center justify-center hover:bg-white/10 hover:border-violet-500/30 transition-all">
            <Facebook className="w-4 h-4" />
          </a>
          <a href="https://instagram.com" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full border border-white/20 bg-white/5 text-white flex items-center justify-center hover:bg-white/10 hover:border-violet-500/30 transition-all">
            <Instagram className="w-4 h-4" />
          </a>
          <a href="https://twitter.com" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full border border-white/20 bg-white/5 text-white flex items-center justify-center hover:bg-white/10 hover:border-violet-500/30 transition-all">
            <Twitter className="w-4 h-4" />
          </a>
        </div>

      </div>

      {/* Bottom Section (Projects list, CLI stream log, Setup commands) */}
      <div className="mt-12 md:mt-20 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 px-2 md:px-6 pb-6">

        {/* Card 1: Robotic Synergy Panel */}
        <div className="lg:col-span-4 h-64 md:h-[320px] rounded-[2rem] bg-gradient-to-tr from-[#311756] to-[#45276B] shadow-lg border border-white/10 flex flex-col justify-between p-6 relative overflow-hidden group hover:border-violet-500/30 transition-all">
          <div className="absolute inset-0 bg-radial-gradient from-violet-500/10 via-transparent to-transparent pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between">
            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono uppercase tracking-widest text-violet-300">
              01 / Autonomous Agent
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          <img
            src="/robotic_hand.png"
            className="absolute bottom-0 right-0 w-[60%] h-[70%] object-contain object-bottom-right pointer-events-none opacity-40 group-hover:scale-105 transition-transform duration-700"
            alt="Robotic Hand Asset"
          />

          <div className="relative z-10 mt-auto">
            <h3 className="text-xl font-bold tracking-tight text-white mb-1">
              Engine Control
            </h3>
            <p className="text-[10px] text-white/50 font-mono">
              Host process telemetry attached
            </p>
          </div>
        </div>

        {/* Card 2: Human Interface Synergy Panel */}
        <div className="lg:col-span-4 h-64 md:h-[320px] rounded-[2rem] bg-[#1A1838] border border-white/10 shadow-lg flex flex-col justify-between p-6 relative overflow-hidden group hover:border-pink-500/30 transition-all">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-violet-500/10 pointer-events-none"></div>

          <div className="relative z-10">
            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono uppercase tracking-widest text-pink-300">
              02 / Workspace Synergy
            </span>
          </div>

          <img
            src="/human_hand.png"
            className="absolute bottom-0 right-0 w-[60%] h-[70%] object-contain object-bottom-right pointer-events-none opacity-40 group-hover:scale-105 transition-transform duration-700"
            alt="Human Hand Asset"
          />

          <div className="relative z-10 mt-auto">
            <h3 className="text-xl font-bold tracking-tight text-white mb-1">
              Active Session
            </h3>
            <p className="text-[10px] text-white/50 font-mono">
              Secure JWT authentication synced
            </p>
          </div>
        </div>

        {/* Setup Config settings info (Interactive Card 3) */}
        <div className="lg:col-span-4 flex flex-col justify-center px-4 md:px-8 py-8 lg:py-0 relative">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
            Telemetry<br />configuration
          </h2>
          <p className="text-xs font-medium text-white/60 leading-relaxed max-w-[280px]">
            Run instructions to deploy telemetry. Connect and watch traces automatically stream directly to your selected workspace.
          </p>

          {/* Premium circular text badge graphic */}
          <div className="absolute top-0 right-0 lg:top-[-45px] lg:right-[-20px] w-28 h-28 opacity-75">
            <svg viewBox="0 0 100 100" className="w-full h-full animate-[spin_25s_linear_infinite]">
              <path id="circle" d="M 50, 50 m -37, 0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" fill="transparent" />
              <text className="text-[9.5px] uppercase font-bold tracking-widest fill-violet-400">
                <textPath href="#circle">
                  &bull; Autonomous reliability telemetry agent &bull; deploy live
                </textPath>
              </text>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center font-bold text-lg text-white">*</div>
          </div>

          <button
            onClick={() => navigate('/quickstart')}
            className="mt-8 flex items-center gap-2 text-sm font-bold w-fit group text-white bg-transparent border-none cursor-pointer focus:outline-none"
          >
            Quickstart Guide
            <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center group-hover:scale-110 active:scale-95 transition-transform shadow-md">
              <Plus className="w-4 h-4" />
            </div>
          </button>
        </div>

      </div>



      {/* MODAL 1: Create Project Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Register Telemetry Node"
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          <div className="flex items-center gap-2 text-violet-400">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs uppercase font-mono tracking-wider font-bold">New Node Setup</span>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[9px] font-mono uppercase tracking-widest text-stone-400 block">Project Title</label>
            <input
              type="text"
              placeholder="e.g. Noir"
              value={newProjectTitle}
              onChange={(e) => setNewProjectTitle(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-xs font-mono text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 transition-colors"
              required
              disabled={isCreating}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-mono uppercase tracking-widest text-stone-400 block">Description</label>
            <textarea
              placeholder="e.g. Reliability Engineering Platform"
              value={newProjectDesc}
              onChange={(e) => setNewProjectDesc(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-xs font-mono text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 transition-colors h-16 resize-none"
              disabled={isCreating}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-mono uppercase tracking-widest text-stone-400 block">Architecture</label>
              <select
                value={newProjectArch}
                onChange={(e) => setNewProjectArch(e.target.value)}
                className="w-full bg-[#100C1F] border border-white/10 rounded-xl py-2.5 px-3 text-xs font-mono text-white focus:outline-none focus:border-violet-500/50 transition-colors"
                disabled={isCreating}
              >
                <option value="monolith">Monolith</option>
                <option value="microservice">Microservice</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-mono uppercase tracking-widest text-stone-400 block">Visibility</label>
              <select
                value={newProjectVis}
                onChange={(e) => setNewProjectVis(e.target.value)}
                className="w-full bg-[#100C1F] border border-white/10 rounded-xl py-2.5 px-3 text-xs font-mono text-white focus:outline-none focus:border-violet-500/50 transition-colors"
                disabled={isCreating}
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-mono uppercase tracking-widest text-stone-400 block">Analysis Mode</label>
              <select
                value={newProjectAnalysisMode}
                onChange={(e) => setNewProjectAnalysisMode(e.target.value)}
                className="w-full bg-[#100C1F] border border-white/10 rounded-xl py-2.5 px-3 text-xs font-mono text-white focus:outline-none focus:border-violet-500/50 transition-colors"
                disabled={isCreating}
              >
                <option value="manual">Manual</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-3 border-t border-white/5 mt-4">
            <button
              type="submit"
              disabled={isCreating}
              className="flex-1 py-2.5 rounded-full bg-white hover:bg-stone-200 text-black text-xs font-semibold uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                'Register Project'
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-6 py-2.5 rounded-full border border-white/10 text-stone-400 hover:text-white hover:border-white/20 text-xs font-semibold uppercase tracking-widest transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

    </UserLayout>
  );
}
