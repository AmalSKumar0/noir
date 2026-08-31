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
  Building2,
  Users,
  Key,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  CheckCircle2,
  LogOut,
  UserPlus,
  Search,
  Send,
  X,
  Clock,
  UserCheck,
  Mail,
  Trash2,
  XCircle,
  RefreshCw,
  AlertCircle,
  FolderGit2,
  FolderPlus,
  Edit3,
  Server
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import UserLayout from '../components/UserLayout';
import { Skeleton } from '../components/Skeleton';
import Modal from '../components/Modal';
import { apiFetch } from '../utils/api';
import { checkAndRefreshToken } from '../utils/auth';
import { getUserProjects, getCachedProjects, Project } from '../utils/projectCache';

const defaultAnalytics = [
  { time: '00:00', users: 1400, requests: 950 },
  { time: '04:00', users: 2400, requests: 1600 },
  { time: '08:00', users: 900, requests: 700 },
  { time: '12:00', users: 1800, requests: 1300 },
  { time: '16:00', users: 2700, requests: 2100 },
  { time: '20:00', users: 3600, requests: 2800 },
  { time: '24:00', users: 3100, requests: 2400 },
];

interface AvailableDeveloper {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  request_status: string | null;
  request_id: number | null;
}

interface DeveloperRequest {
  id: number;
  company_id: number;
  company_name: string;
  developer_id: number;
  developer_username: string;
  developer_email: string;
  developer_first_name: string;
  developer_last_name: string;
  status: 'pending' | 'accepted' | 'rejected';
  message: string;
  created_at: string;
}

interface ActiveDeveloper {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  company_name: string;
}

interface DeveloperTeamItem {
  id: number;
  name: string;
  description: string;
  company: number;
  members: ActiveDeveloper[];
  projects_data: {
    id: number;
    title: string;
    architecture: string;
    status: string;
    connection_code: string;
  }[];
  created_at: string;
}

interface CompanyProjectSimple {
  id: number;
  title: string;
  architecture: string;
  status: string;
}

export default function CompanyDashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  // Projects & Search State
  const [projects, setProjects] = useState<Project[]>(() => getCachedProjects());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [isCopiedKey, setIsCopiedKey] = useState(false);

  // Company info state
  const [companyUser, setCompanyUser] = useState<any>(null);
  const [companyProfile, setCompanyProfile] = useState<any>(null);

  // Box 1 Internal Sub-Tab State ('roster' | 'invite' | 'sent')
  const [box1Tab, setBox1Tab] = useState<'roster' | 'invite' | 'sent'>('roster');

  // Search Developer State (Box 1)
  const [emailInput, setEmailInput] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<AvailableDeveloper[]>([]);

  // Core Data
  const [sentRequests, setSentRequests] = useState<DeveloperRequest[]>([]);
  const [activeDevs, setActiveDevs] = useState<ActiveDeveloper[]>([]);
  const [teams, setTeams] = useState<DeveloperTeamItem[]>([]);
  const [companyProjects, setCompanyProjects] = useState<CompanyProjectSimple[]>([]);

  // Invite Modal State
  const [selectedDev, setSelectedDev] = useState<AvailableDeveloper | null>(null);
  const [inviteMessage, setInviteMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Remove Dev Modal
  const [removingDev, setRemovingDev] = useState<ActiveDeveloper | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Team Modal State
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<DeveloperTeamItem | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamDesc, setTeamDesc] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
  const [isSavingTeam, setIsSavingTeam] = useState(false);
  const [teamModalError, setTeamModalError] = useState<string | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<DeveloperTeamItem | null>(null);

  // Create Project Modal & Quickstart
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

  // Toast notification
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };

      // 1. Fetch Company profile
      const meRes = await apiFetch(`${baseUrl}/api/accounts/company/me/`, {
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      });

      if (meRes.ok) {
        const data = await meRes.json();
        setCompanyUser(data);
        if (data.company_profile) {
          if (data.company_profile.status === 'pending' || data.company_profile.status === 'rejected') {
            navigate('/company/status', { replace: true });
            return;
          }
          setCompanyProfile(data.company_profile);
        }
      }

      // 2. Fetch Projects
      const prjs = await getUserProjects();
      setProjects(prjs);
      if (prjs.length > 0) {
        setSelectedProjectId(prjs[0].id);
      }

      // 3. Fetch Sent Requests
      const reqRes = await apiFetch(`${baseUrl}/api/accounts/company/developer-requests/`, { headers });
      if (reqRes.ok) {
        const reqData = await reqRes.json();
        setSentRequests(reqData);
      }

      // 4. Fetch Active Developers
      const activeRes = await apiFetch(`${baseUrl}/api/accounts/company/developers/`, { headers });
      if (activeRes.ok) {
        const activeData = await activeRes.json();
        setActiveDevs(activeData);
      }

      // 5. Fetch Developer Teams
      const teamsRes = await apiFetch(`${baseUrl}/api/accounts/company/teams/`, { headers });
      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        setTeams(teamsData);
      }

      // 6. Fetch Company Projects List for Teams
      const prjRes = await apiFetch(`${baseUrl}/api/project/list/`, { headers });
      if (prjRes.ok) {
        const prjData = await prjRes.json();
        setCompanyProjects(prjData);
      }

    } catch (err) {
      console.error('Error fetching company dashboard details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [navigate]);

  // Search developer handler
  const handleSearchDeveloper = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!emailInput.trim()) return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };

      const res = await apiFetch(
        `${baseUrl}/api/accounts/company/available-developers/?search=${encodeURIComponent(emailInput.trim())}`, 
        { headers }
      );

      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Error searching developer:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const openInviteModal = (dev: AvailableDeveloper) => {
    setSelectedDev(dev);
    setInviteMessage(`We would love to invite you to join our engineering team on Noir!`);
    setModalError(null);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDev) return;

    setIsSending(true);
    setModalError(null);
    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';

      const res = await apiFetch(`${baseUrl}/api/accounts/company/developer-requests/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          developer_id: selectedDev.id,
          message: inviteMessage
        })
      });

      if (res.ok) {
        showNotification(`Invitation request sent to ${selectedDev.email}!`);
        setSelectedDev(null);
        setInviteMessage('');
        if (hasSearched) handleSearchDeveloper();
        loadAllData();
      } else {
        const errData = await res.json().catch(() => ({}));
        setModalError(errData.detail || 'Failed to send developer invitation.');
      }
    } catch (err) {
      console.error(err);
      setModalError('A network error occurred. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleCancelRequest = async (requestId: number) => {
    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';

      const res = await apiFetch(`${baseUrl}/api/accounts/company/developer-requests/${requestId}/cancel/`, {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });

      if (res.ok) {
        showNotification('Invitation request cancelled.');
        if (hasSearched) handleSearchDeveloper();
        loadAllData();
      }
    } catch (err) {
      console.error('Error cancelling request:', err);
    }
  };

  const handleRemoveDeveloper = async () => {
    if (!removingDev) return;

    setIsRemoving(true);
    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';

      const res = await apiFetch(`${baseUrl}/api/accounts/company/developers/${removingDev.id}/`, {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });

      if (res.ok) {
        showNotification(`Developer ${removingDev.username} removed from organization.`);
        setRemovingDev(null);
        loadAllData();
      }
    } catch (err) {
      console.error('Error removing developer:', err);
    } finally {
      setIsRemoving(false);
    }
  };

  // Team Modal Handlers
  const openCreateTeamModal = () => {
    setEditingTeam(null);
    setTeamName('');
    setTeamDesc('');
    setSelectedMemberIds([]);
    setSelectedProjectIds([]);
    setTeamModalError(null);
    setIsTeamModalOpen(true);
  };

  const openEditTeamModal = (t: DeveloperTeamItem) => {
    setEditingTeam(t);
    setTeamName(t.name);
    setTeamDesc(t.description || '');
    setSelectedMemberIds(t.members.map(m => m.id));
    setSelectedProjectIds(t.projects_data.map(p => p.id));
    setTeamModalError(null);
    setIsTeamModalOpen(true);
  };

  const toggleMemberSelection = (id: number) => {
    setSelectedMemberIds(prev => 
      prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
    );
  };

  const toggleProjectSelection = (id: number) => {
    setSelectedProjectIds(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) {
      setTeamModalError('Team name is required.');
      return;
    }

    setIsSavingTeam(true);
    setTeamModalError(null);
    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const headers = { 
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}) 
      };

      const url = editingTeam 
        ? `${baseUrl}/api/accounts/company/teams/${editingTeam.id}/`
        : `${baseUrl}/api/accounts/company/teams/`;

      const method = editingTeam ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers,
        body: JSON.stringify({
          name: teamName.trim(),
          description: teamDesc.trim(),
          member_ids: selectedMemberIds,
          project_ids: selectedProjectIds
        })
      });

      if (res.ok) {
        showNotification(editingTeam ? `Team '${teamName}' updated!` : `Team '${teamName}' created successfully!`);
        setIsTeamModalOpen(false);
        loadAllData();
      } else {
        const errData = await res.json().catch(() => ({}));
        setTeamModalError(errData.detail || 'Failed to save team.');
      }
    } catch (err) {
      console.error(err);
      setTeamModalError('A network error occurred. Please try again.');
    } finally {
      setIsSavingTeam(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (!deletingTeam) return;

    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';

      const res = await apiFetch(`${baseUrl}/api/accounts/company/teams/${deletingTeam.id}/`, {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });

      if (res.ok) {
        showNotification(`Team '${deletingTeam.name}' deleted.`);
        setDeletingTeam(null);
        loadAllData();
      }
    } catch (err) {
      console.error('Error deleting team:', err);
    }
  };

  const copyCommand = () => {
    navigator.clipboard.writeText('npm install -g noir-agent\nnoir-agent init');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText(companyProfile?.tax_id || 'nr_live_company_8f93a102b54c8e71029487c6');
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

        setProjects(prev => {
          const updated = [newPrj, ...prev];
          localStorage.setItem('noir_user_projects', JSON.stringify(updated));
          return updated;
        });
        setSelectedProjectId(newPrj.id);
        
        setNewProjectTitle('');
        setNewProjectDesc('');
        setNewProjectArch('monolith');
        setNewProjectVis('private');
        setNewProjectAnalysisMode('manual');
        setIsCreateModalOpen(false);
        showNotification(`Project '${newPrj.name}' registered!`);
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

  const pendingCount = sentRequests.filter(r => r.status === 'pending').length;
  const companyName = companyProfile?.company_name || companyUser?.first_name || 'Enterprise Workspace';

  return (
    <UserLayout>
      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl border backdrop-blur-md shadow-2xl flex items-center gap-3 text-xs font-mono font-semibold ${
              notification.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/90 border-rose-500/30 text-rose-300'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Real-time Analytics & Enterprise Header Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-6 md:mt-10 px-2 md:px-6"
      >
        <div className="w-full bg-white/5 border border-white/10 rounded-[2rem] p-6 md:p-8 backdrop-blur-md shadow-lg flex flex-col lg:flex-row gap-8 lg:items-center">
          
          {/* KPI Metrics */}
          <div className="flex flex-col gap-6 lg:w-1/3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center border border-violet-500/30">
                <Building2 className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span>{companyName}</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[9px] uppercase tracking-wider font-semibold">
                    Approved SLA
                  </span>
                </h2>
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono mt-0.5">
                  Enterprise Telemetry Cluster
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {isLoading ? (
                <>
                  <Skeleton className="h-[76px] rounded-2xl bg-white/5" />
                  <Skeleton className="h-[76px] rounded-2xl bg-white/5" />
                  <Skeleton className="h-[76px] rounded-2xl bg-white/5" />
                </>
              ) : (
                <>
                  <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 hover:border-violet-500/30 transition-colors">
                    <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider mb-1">Projects</p>
                    <p className="text-2xl font-bold text-white">{projects.length}</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 hover:border-blue-500/30 transition-colors">
                    <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider mb-1">Team Devs</p>
                    <p className="text-2xl font-bold text-white flex items-baseline gap-1">
                      <span>{activeDevs.length}</span>
                      {pendingCount > 0 && (
                        <span className="text-[9px] text-amber-400 font-mono">+{pendingCount}</span>
                      )}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 hover:border-emerald-500/30 transition-colors">
                    <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider mb-1">SLA Uptime</p>
                    <p className="text-2xl font-bold text-emerald-400">99.9%</p>
                  </div>
                </>
              )}
            </div>

            {/* Quick Link Actions Row */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
              <Link
                to="/company/projects"
                className="px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-mono uppercase tracking-wider transition-all flex items-center gap-1.5"
              >
                <Folder className="w-3.5 h-3.5 text-violet-400" />
                <span>CRUD Projects ({projects.length})</span>
              </Link>
              <button
                onClick={() => setBox1Tab('invite')}
                className="px-3.5 py-1.5 rounded-full bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/30 text-violet-200 text-[10px] font-mono uppercase tracking-wider transition-all flex items-center gap-1.5 font-bold cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5 text-violet-300" />
                <span>+ Invite Dev</span>
              </button>
              <button
                onClick={openCreateTeamModal}
                className="px-3.5 py-1.5 rounded-full bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/30 text-purple-200 text-[10px] font-mono uppercase tracking-wider transition-all flex items-center gap-1.5 font-bold cursor-pointer"
              >
                <FolderGit2 className="w-3.5 h-3.5 text-purple-300" />
                <span>+ Create Team</span>
              </button>
              <button
                onClick={() => navigate('/company/quickstart')}
                className="px-3.5 py-1.5 rounded-full bg-stone-700/40 hover:bg-stone-700/60 border border-white/10 text-stone-200 text-[10px] font-mono uppercase tracking-wider transition-all flex items-center gap-1.5 font-bold cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5 text-stone-300" />
                <span>Quickstart Guide</span>
              </button>
            </div>
          </div>

          {/* Recharts Live Stream Chart */}
          <div className="h-[200px] lg:h-[240px] flex-1 w-full min-w-0">
            {isLoading ? (
              <Skeleton className="w-full h-full rounded-2xl bg-white/5" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={defaultAnalytics} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCompanyUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCompanyRequests" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
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
                  <Area type="monotone" dataKey="users" stroke="#8B5CF6" strokeWidth={3} fillOpacity={1} fill="url(#colorCompanyUsers)" />
                  <Area type="monotone" dataKey="requests" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorCompanyRequests)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </motion.div>

      {/* Main Content Section */}
      <div className="mt-6 md:mt-10 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 px-2 md:px-6">

        {/* Left Column (Title & Project Search / Create) */}
        <div className="lg:col-span-5 flex flex-col justify-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-5xl md:text-7xl lg:text-[5rem] font-bold leading-[0.95] tracking-tight mb-8 text-white"
          >
            Enterprise<br />
            company<br />
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
              placeholder="Search company projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-6 pr-14 py-4 rounded-full border border-white/20 bg-white/5 text-white text-sm font-medium placeholder-white/40 focus:outline-none focus:border-violet-500 backdrop-blur-sm transition-all"
            />
            <button 
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="absolute right-2 w-10 h-10 bg-white rounded-full flex items-center justify-center text-black shadow hover:scale-105 active:scale-95 transition-transform cursor-pointer"
              title="Create New Project"
            >
              <Plus className="w-4 h-4" />
            </button>
          </motion.div>
        </div>

        {/* Middle Column (KPI Widgets) */}
        <div className="lg:col-span-6 flex flex-col md:flex-row gap-6 mt-4 lg:mt-0 lg:pt-16">

          {/* Active Traces & Engineer Telemetry Box */}
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
                  <h3 className="text-4xl font-bold mb-2">128.4 k</h3>
                  <p className="text-xs text-white/50 font-mono">
                    Traces • {activeDevs.length} Active Engineers Online
                  </p>
                </div>

                <div className="flex gap-2">
                  <span className="px-4 py-1.5 rounded-full border border-white/20 text-[10px] uppercase tracking-wider font-mono">Company Tier</span>
                  <span className="px-4 py-1.5 rounded-full border border-white/20 text-[10px] uppercase tracking-wider font-mono">Live Clusters</span>
                </div>
              </>
            )}
          </motion.div>

          {/* SLA Reliability Card */}
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
                    <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Enterprise Shield</span>
                  </div>
                  <h3 className="text-4xl font-bold text-violet-300 mb-2">99.99%</h3>
                  <p className="text-xs text-violet-300/70 font-medium">
                    Guaranteed System SLA Uptime
                  </p>
                </div>

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

        {/* Right Column (Socials & Links) */}
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

      {/* THREE INTEGRATED DASHBOARD BOXES FOR COMPANY DEVELOPER & TELEMETRY MANAGEMENT */}
      <div className="mt-12 md:mt-16 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 px-2 md:px-6 pb-20">

        {/* BOX 1: 01 / Active Engineer Roster, Email Search & Invites */}
        <div className="lg:col-span-4 min-h-[460px] h-[480px] rounded-[2rem] bg-gradient-to-tr from-[#311756] to-[#45276B] shadow-xl border border-white/10 flex flex-col justify-between p-6 relative overflow-hidden group hover:border-violet-500/40 transition-all">
          <div className="absolute inset-0 bg-radial-gradient from-violet-500/10 via-transparent to-transparent pointer-events-none" />

          {/* Card Header & Sub-Tabs */}
          <div className="relative z-10 flex items-center justify-between gap-2 mb-4 border-b border-white/10 pb-3">
            <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[9px] font-mono uppercase tracking-widest text-violet-300 font-bold flex items-center gap-1.5">
              <UserCheck className="w-3 h-3 text-violet-400" />
              01 / Dev Roster
            </span>

            {/* Sub-tab pills inside Box 1 */}
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-full border border-white/10">
              <button
                onClick={() => setBox1Tab('roster')}
                className={`px-2.5 py-1 rounded-full text-[9px] font-mono uppercase tracking-wider transition-all cursor-pointer ${
                  box1Tab === 'roster' ? 'bg-white text-black font-bold' : 'text-white/60 hover:text-white'
                }`}
              >
                Roster ({activeDevs.length})
              </button>
              <button
                onClick={() => setBox1Tab('invite')}
                className={`px-2.5 py-1 rounded-full text-[9px] font-mono uppercase tracking-wider transition-all cursor-pointer ${
                  box1Tab === 'invite' ? 'bg-white text-black font-bold' : 'text-white/60 hover:text-white'
                }`}
              >
                + Invite
              </button>
              <button
                onClick={() => setBox1Tab('sent')}
                className={`px-2.5 py-1 rounded-full text-[9px] font-mono uppercase tracking-wider transition-all cursor-pointer ${
                  box1Tab === 'sent' ? 'bg-white text-black font-bold' : 'text-white/60 hover:text-white'
                }`}
              >
                Sent ({sentRequests.length})
              </button>
            </div>
          </div>

          {/* Body Content of Box 1 */}
          <div className="relative z-10 flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-3">
            {/* SUB-TAB 1: Active Roster */}
            {box1Tab === 'roster' && (
              <>
                {activeDevs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-10">
                    <Users className="w-10 h-10 text-white/20 mb-2" />
                    <p className="text-xs text-white/60 font-bold">No Active Engineers</p>
                    <p className="text-[10px] text-white/40 font-mono mt-1 mb-4">Click "+ Invite" to search and onboard developers.</p>
                    <button
                      onClick={() => setBox1Tab('invite')}
                      className="px-4 py-2 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-mono font-bold uppercase"
                    >
                      + Search & Invite Dev
                    </button>
                  </div>
                ) : (
                  activeDevs.map((dev) => (
                    <div
                      key={dev.id}
                      className="p-3 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between gap-3 hover:border-violet-500/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300 font-bold text-xs shrink-0">
                          {dev.username.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold text-white truncate">
                            {dev.first_name || dev.last_name ? `${dev.first_name} ${dev.last_name}`.trim() : dev.username}
                          </p>
                          <p className="text-[9px] font-mono text-white/40 truncate">{dev.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setRemovingDev(dev)}
                        className="p-1.5 text-white/40 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Remove engineer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </>
            )}

            {/* SUB-TAB 2: Search & Invite */}
            {box1Tab === 'invite' && (
              <div className="space-y-3">
                <form onSubmit={handleSearchDeveloper} className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Enter dev email..."
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-white text-xs font-mono placeholder-white/30 focus:outline-none focus:border-violet-500"
                    required
                  />
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="px-3 py-2 bg-white hover:bg-stone-200 text-black text-xs font-bold uppercase rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSearching ? '...' : <Search className="w-3.5 h-3.5" />}
                  </button>
                </form>

                {isSearching ? (
                  <Skeleton className="h-20 rounded-xl bg-white/5" />
                ) : hasSearched && searchResults.length === 0 ? (
                  <p className="text-[10px] font-mono text-amber-400/80 bg-black/40 p-3 rounded-xl border border-white/5">
                    No available developer found matching "{emailInput}".
                  </p>
                ) : (
                  searchResults.map((dev) => (
                    <div
                      key={dev.id}
                      className="p-3 rounded-2xl bg-black/50 border border-violet-500/30 flex items-center justify-between gap-3"
                    >
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-white truncate">
                          {dev.first_name || dev.last_name ? `${dev.first_name} ${dev.last_name}`.trim() : dev.username}
                        </p>
                        <p className="text-[9px] font-mono text-violet-300 truncate">{dev.email}</p>
                      </div>

                      {dev.request_status === 'pending' ? (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-[9px] font-mono">
                          Pending
                        </span>
                      ) : (
                        <button
                          onClick={() => openInviteModal(dev)}
                          className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-full text-[10px] font-bold uppercase transition-all cursor-pointer flex items-center gap-1"
                        >
                          <UserPlus className="w-3 h-3" />
                          <span>Invite</span>
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* SUB-TAB 3: Sent Requests */}
            {box1Tab === 'sent' && (
              <>
                {sentRequests.length === 0 ? (
                  <p className="text-[10px] font-mono text-white/40 text-center py-8">No invitation requests sent.</p>
                ) : (
                  sentRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-3 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between gap-2"
                    >
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-white truncate">
                          {req.developer_first_name || req.developer_last_name
                            ? `${req.developer_first_name} ${req.developer_last_name}`.trim()
                            : req.developer_username}
                        </p>
                        <p className="text-[9px] font-mono text-white/40 truncate">{req.developer_email}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-mono uppercase font-bold ${
                            req.status === 'pending'
                              ? 'bg-amber-500/20 text-amber-300'
                              : req.status === 'accepted'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {req.status}
                        </span>
                        {req.status === 'pending' && (
                          <button
                            onClick={() => handleCancelRequest(req.id)}
                            className="text-rose-400 hover:text-rose-300 text-[9px] font-mono underline cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>

          {/* Footer inside Box 1 */}
          <div className="relative z-10 mt-auto pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-white/40 font-mono">
            <span>{activeDevs.length} Engineers Active</span>
            <span>{pendingCount} Invites Pending</span>
          </div>
        </div>

        {/* BOX 2: 02 / Developer Teams & Squad Workloads */}
        <div className="lg:col-span-4 min-h-[460px] h-[480px] rounded-[2rem] bg-[#1A1838] border border-white/10 shadow-xl flex flex-col justify-between p-6 relative overflow-hidden group hover:border-pink-500/40 transition-all">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-violet-500/10 pointer-events-none" />

          {/* Header */}
          <div className="relative z-10 flex items-center justify-between gap-2 mb-4 border-b border-white/10 pb-3">
            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono uppercase tracking-widest text-pink-300 font-bold flex items-center gap-1.5">
              <FolderGit2 className="w-3 h-3 text-pink-400" />
              02 / Team Synergy
            </span>

            <button
              onClick={openCreateTeamModal}
              className="px-3 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded-full text-[9px] font-mono font-bold uppercase transition-all flex items-center gap-1 cursor-pointer shadow"
            >
              <Plus className="w-3 h-3" />
              <span>+ Team</span>
            </button>
          </div>

          {/* Body Content */}
          <div className="relative z-10 flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-3">
            {teams.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-10">
                <FolderGit2 className="w-10 h-10 text-white/20 mb-2" />
                <p className="text-xs text-white/60 font-bold">No Developer Teams</p>
                <p className="text-[10px] text-white/40 font-mono mt-1 mb-4">Group engineers into teams and attach telemetry workloads.</p>
                <button
                  onClick={openCreateTeamModal}
                  className="px-4 py-2 rounded-full bg-pink-600 hover:bg-pink-500 text-white text-[10px] font-mono font-bold uppercase"
                >
                  + Create First Team
                </button>
              </div>
            ) : (
              teams.map((t) => (
                <div
                  key={t.id}
                  className="p-3.5 rounded-2xl bg-black/40 border border-white/10 hover:border-pink-500/30 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <FolderGit2 className="w-3.5 h-3.5 text-pink-400" />
                      {t.name}
                    </h4>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditTeamModal(t)}
                        className="p-1 text-white/50 hover:text-white transition-colors cursor-pointer"
                        title="Edit Team"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setDeletingTeam(t)}
                        className="p-1 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                        title="Delete Team"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {t.description && (
                    <p className="text-[10px] text-white/50 font-light truncate">{t.description}</p>
                  )}

                  {/* Team Members */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {t.members.map((m) => (
                      <span
                        key={m.id}
                        className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/80 text-[9px] font-mono"
                      >
                        @{m.username}
                      </span>
                    ))}
                  </div>

                  {/* Assigned Projects */}
                  {t.projects_data.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-1">
                      {t.projects_data.map((p) => (
                        <span
                          key={p.id}
                          className="px-2 py-0.5 rounded-full bg-purple-950/40 border border-purple-500/30 text-purple-300 text-[9px] font-mono"
                        >
                          Prj: {p.title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="relative z-10 mt-auto pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-white/40 font-mono">
            <span>{teams.length} Squads Active</span>
            <span>{companyProjects.length} Workload Projects</span>
          </div>
        </div>

        {/* BOX 3: 03 / Telemetry Setup & Deployment Configuration */}
        <div className="lg:col-span-4 min-h-[460px] h-[480px] rounded-[2rem] bg-gradient-to-br from-stone-900/80 via-black/90 to-purple-950/30 border border-white/10 shadow-xl flex flex-col justify-between p-6 relative overflow-hidden group hover:border-violet-500/40 transition-all">
          
          {/* Header */}
          <div className="relative z-10 flex items-center justify-between gap-2 mb-4 border-b border-white/10 pb-3">
            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono uppercase tracking-widest text-violet-300 font-bold flex items-center gap-1.5">
              <Terminal className="w-3 h-3 text-violet-400" />
              03 / Telemetry Setup
            </span>

            <button
              onClick={() => navigate('/company/quickstart')}
              className="px-3 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded-full text-[9px] font-mono font-bold uppercase transition-all flex items-center gap-1 cursor-pointer shadow"
            >
              <Terminal className="w-3 h-3" />
              <span>Quickstart</span>
            </button>
          </div>

          {/* Body Content */}
          <div className="relative z-10 flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-4">
            <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-2">
              <p className="text-[10px] font-mono text-violet-300 uppercase font-bold flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-violet-500/20 flex items-center justify-center text-[9px]">1</span>
                Install CLI Agent
              </p>
              <pre className="p-2.5 rounded-xl bg-black/80 text-[10px] font-mono text-white/80 overflow-x-auto">
                <code>npm install -g noir-agent</code>
              </pre>
            </div>

            <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-2">
              <p className="text-[10px] font-mono text-violet-300 uppercase font-bold flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-violet-500/20 flex items-center justify-center text-[9px]">2</span>
                Configure Company API Key
              </p>
              <div className="relative">
                <pre className="p-2.5 rounded-xl bg-black/80 text-[9px] font-mono text-white/70 overflow-x-auto pr-10">
                  <code>NOIR_COMPANY_TOKEN={companyProfile?.tax_id || 'nr_live_company_8f93...'}</code>
                </pre>
                <button
                  type="button"
                  onClick={copyApiKey}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/50 hover:text-white transition-colors cursor-pointer"
                  title="Copy Key"
                >
                  {isCopiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-2">
              <p className="text-[10px] font-mono text-violet-300 uppercase font-bold flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-violet-500/20 flex items-center justify-center text-[9px]">3</span>
                Connect Cluster Daemon
              </p>
              <pre className="p-2.5 rounded-xl bg-black/80 text-[10px] font-mono text-white/80 overflow-x-auto">
                <code>noir-agent start --company</code>
              </pre>
            </div>
          </div>

          {/* Footer */}
          <div className="relative z-10 mt-auto pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-white/40 font-mono">
            <span>Daemon Status: Active</span>
            <button
              onClick={() => navigate('/company/quickstart')}
              className="text-violet-400 hover:underline cursor-pointer"
            >
              Full Guide &rarr;
            </button>
          </div>
        </div>

      </div>

      {/* MODAL 1: Create Project Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Register Company Telemetry Project"
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          <div className="flex items-center gap-2 text-violet-400">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs uppercase font-mono tracking-wider font-bold">New Company Node</span>
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
              placeholder="e.g. Noir Enterprise Service"
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
              placeholder="e.g. Core company telemetry & reliability node"
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



      {/* MODAL 3: Send Developer Invite */}
      <Modal
        isOpen={!!selectedDev}
        onClose={() => setSelectedDev(null)}
        title="Invite Developer to Company"
      >
        {selectedDev && (
          <form onSubmit={handleSendInvite} className="space-y-4">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300 font-bold text-sm">
                {selectedDev.username.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  {selectedDev.first_name || selectedDev.last_name
                    ? `${selectedDev.first_name} ${selectedDev.last_name}`.trim()
                    : selectedDev.username}
                </h4>
                <p className="text-xs font-mono text-white/50">{selectedDev.email}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-white/70 uppercase tracking-widest mb-1">
                Invitation Message
              </label>
              <textarea
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                rows={3}
                className="w-full p-3.5 rounded-2xl border border-white/15 bg-black/40 text-white text-xs font-mono placeholder-white/30 focus:outline-none focus:border-violet-500 transition-all"
                placeholder="Include a welcome note..."
              />
            </div>

            {modalError && (
              <p className="text-xs font-mono text-rose-400 bg-rose-950/40 p-3 rounded-xl border border-rose-500/30">
                {modalError}
              </p>
            )}

            <div className="flex gap-3 pt-3 border-t border-white/5">
              <button
                type="submit"
                disabled={isSending}
                className="flex-1 py-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSending ? 'Sending...' : 'Send Request'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedDev(null)}
                className="px-6 py-2.5 rounded-full border border-white/10 text-stone-400 hover:text-white text-xs font-semibold uppercase tracking-widest cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL 4: Confirm Remove Developer */}
      <Modal
        isOpen={!!removingDev}
        onClose={() => setRemovingDev(null)}
        title="Remove Developer from Organization"
      >
        {removingDev && (
          <div className="space-y-4">
            <p className="text-xs text-white/70 leading-relaxed font-light">
              Are you sure you want to remove <strong className="text-white">{removingDev.username}</strong> ({removingDev.email}) from your company team roster? They will no longer have access to company projects.
            </p>

            <div className="flex gap-3 pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={handleRemoveDeveloper}
                disabled={isRemoving}
                className="flex-1 py-2.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50"
              >
                {isRemoving ? 'Removing...' : 'Confirm Remove'}
              </button>
              <button
                type="button"
                onClick={() => setRemovingDev(null)}
                className="px-6 py-2.5 rounded-full border border-white/10 text-stone-400 hover:text-white text-xs font-semibold uppercase tracking-widest cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 5: Create / Edit Developer Team */}
      <Modal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        title={editingTeam ? `Edit Team: ${editingTeam.name}` : 'Create Developer Team'}
      >
        <form onSubmit={handleSaveTeam} className="space-y-5">
          <div>
            <label className="block text-xs font-mono text-white/70 uppercase tracking-widest mb-1">
              Team Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Frontend Core, AI Lynx Squad, DevOps"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full p-3.5 rounded-2xl border border-white/15 bg-black/40 text-white text-xs font-mono placeholder-white/30 focus:outline-none focus:border-violet-500 transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-white/70 uppercase tracking-widest mb-1">
              Description
            </label>
            <textarea
              value={teamDesc}
              onChange={(e) => setTeamDesc(e.target.value)}
              rows={2}
              className="w-full p-3.5 rounded-2xl border border-white/15 bg-black/40 text-white text-xs font-mono placeholder-white/30 focus:outline-none focus:border-violet-500 transition-all"
              placeholder="Team domain and engineering responsibilities..."
            />
          </div>

          {/* Developer Members Checklist */}
          <div>
            <label className="block text-xs font-mono text-white/70 uppercase tracking-widest mb-2">
              Select Engineers ({selectedMemberIds.length} selected)
            </label>
            {activeDevs.length === 0 ? (
              <p className="text-xs font-mono text-amber-400/80 bg-amber-950/30 p-3 rounded-xl border border-amber-500/20">
                No active engineers in your company yet. Invite engineers first to add them to teams.
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {activeDevs.map((dev) => {
                  const isChecked = selectedMemberIds.includes(dev.id);
                  return (
                    <div
                      key={dev.id}
                      onClick={() => toggleMemberSelection(dev.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-violet-950/40 border-violet-500/50 text-white'
                          : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <UserCheck className={`w-4 h-4 ${isChecked ? 'text-violet-400' : 'text-white/30'}`} />
                        <div>
                          <p className="text-xs font-bold">{dev.username}</p>
                          <p className="text-[10px] font-mono text-white/40">{dev.email}</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="rounded border-white/20 text-violet-600 focus:ring-0"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Company Projects Checklist */}
          <div>
            <label className="block text-xs font-mono text-white/70 uppercase tracking-widest mb-2">
              Assign Telemetry Projects ({selectedProjectIds.length} assigned)
            </label>
            {companyProjects.length === 0 ? (
              <p className="text-xs font-mono text-white/40 bg-white/5 p-3 rounded-xl border border-white/10">
                No company projects created yet.
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {companyProjects.map((prj) => {
                  const isChecked = selectedProjectIds.includes(prj.id);
                  return (
                    <div
                      key={prj.id}
                      onClick={() => toggleProjectSelection(prj.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-purple-950/40 border-purple-500/50 text-white'
                          : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Server className={`w-4 h-4 ${isChecked ? 'text-purple-400' : 'text-white/30'}`} />
                        <div>
                          <p className="text-xs font-bold">{prj.title}</p>
                          <p className="text-[10px] font-mono text-white/40 uppercase">Arch: {prj.architecture}</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="rounded border-white/20 text-purple-600 focus:ring-0"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {teamModalError && (
            <p className="text-xs font-mono text-rose-400 bg-rose-950/40 p-3 rounded-xl border border-rose-500/30">
              {teamModalError}
            </p>
          )}

          <div className="flex gap-3 pt-3 border-t border-white/5">
            <button
              type="submit"
              disabled={isSavingTeam}
              className="flex-1 py-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50"
            >
              {isSavingTeam ? 'Saving Team...' : editingTeam ? 'Update Team' : 'Create Team'}
            </button>
            <button
              type="button"
              onClick={() => setIsTeamModalOpen(false)}
              className="px-6 py-2.5 rounded-full border border-white/10 text-stone-400 hover:text-white text-xs font-semibold uppercase tracking-widest cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 6: Delete Team Confirmation */}
      <Modal
        isOpen={!!deletingTeam}
        onClose={() => setDeletingTeam(null)}
        title="Delete Developer Team"
      >
        {deletingTeam && (
          <div className="space-y-4">
            <p className="text-xs text-white/70 leading-relaxed font-light">
              Are you sure you want to delete team <strong className="text-white">{deletingTeam.name}</strong>? Assigned developers and projects will remain intact in your company.
            </p>

            <div className="flex gap-3 pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={handleDeleteTeam}
                className="flex-1 py-2.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold uppercase tracking-widest transition-all cursor-pointer"
              >
                Confirm Delete
              </button>
              <button
                type="button"
                onClick={() => setDeletingTeam(null)}
                className="px-6 py-2.5 rounded-full border border-white/10 text-stone-400 hover:text-white text-xs font-semibold uppercase tracking-widest cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>
    </UserLayout>
  );
}
