import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import AdminLayout from '../components/AdminLayout';
import {
  Search,
  FolderPlus,
  ArrowRight,
  Edit2,
  Trash2,
  Eye,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  Filter,
  CheckCircle2,
  Layers,
  Cpu,
  Server,
  Terminal,
  Activity,
  Calendar,
  ExternalLink,
  ChevronDown,
  ArrowUpDown,
  X,
  Zap,
  Boxes
} from 'lucide-react';
import Modal from '../components/Modal';
import { Skeleton } from '../components/Skeleton';
import { apiFetch } from '../utils/api';
import { checkAndRefreshToken } from '../utils/auth';
import { formatLastUpdated } from './Dashboard';

// -----------------------------------------------------------------------------
// TYPES & INTERFACES
// -----------------------------------------------------------------------------

export interface AdminProject {
  id: number;
  title: string;
  description: string;
  architecture: string;
  visibility: string;
  analysis_mode: string;
  status: string;
  connection_code: string;
  owner?: { id: number; username: string };
  profile?: {
    framework?: { id: number; name: string; language: string; supported: boolean };
    runtime_version?: string;
    package_manager?: string;
    operating_system?: string;
    docker_containers?: Array<any>;
    detected_at?: string;
  };
  containers_count?: number;
  tests_count?: number;
  experiments_count?: number;
  is_stream_active?: boolean;
  is_daemon_active?: boolean;
  created_at: string;
  updated_at: string;
}

interface ProjectFormData {
  title: string;
  description: string;
  architecture: string;
  visibility: string;
  analysis_mode: string;
  status: string;
}

const DEFAULT_FORM_DATA: ProjectFormData = {
  title: '',
  description: '',
  architecture: 'monolith',
  visibility: 'private',
  analysis_mode: 'manual',
  status: 'active',
};

export default function AdminManageProjects() {
  const navigate = useNavigate();

  // Data & Loading States
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [runtimeFilter, setRuntimeFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'name' | 'created' | 'updated' | 'status'>('updated');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Pagination States
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // CRUD Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'delete'>('add');
  const [currentProject, setCurrentProject] = useState<AdminProject | null>(null);
  const [formData, setFormData] = useState<ProjectFormData>(DEFAULT_FORM_DATA);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Clipboard Copied State
  const [copiedCodeId, setCopiedCodeId] = useState<number | null>(null);

  // ---------------------------------------------------------------------------
  // FETCH PROJECTS
  // ---------------------------------------------------------------------------
  const fetchProjects = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const response = await apiFetch(`${baseUrl}/api/project/all/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (response.ok) {
        const data = await response.json();
        const rawList: AdminProject[] = Array.isArray(data) ? data : (data.results || []);
        setProjects(rawList);
      } else {
        const errData = await response.json().catch(() => ({}));
        setFetchError(errData.detail || errData.error || `Failed to fetch projects (HTTP ${response.status})`);
      }
    } catch (err: any) {
      setFetchError(err.message || 'An error occurred while connecting to the backend API.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // ---------------------------------------------------------------------------
  // DYNAMIC RUNTIME/LANGUAGE OPTIONS
  // ---------------------------------------------------------------------------
  const availableRuntimes = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => {
      const lang = p.profile?.framework?.language;
      if (lang) set.add(lang);
    });
    return Array.from(set).sort();
  }, [projects]);

  // ---------------------------------------------------------------------------
  // FILTERED & SORTED PROJECTS
  // ---------------------------------------------------------------------------
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = p.title.toLowerCase().includes(q);
        const codeMatch = p.connection_code?.toLowerCase().includes(q);
        const ownerMatch = p.owner?.username?.toLowerCase().includes(q);
        const langMatch = p.profile?.framework?.language?.toLowerCase().includes(q);
        const fwMatch = p.profile?.framework?.name?.toLowerCase().includes(q);
        if (!titleMatch && !codeMatch && !ownerMatch && !langMatch && !fwMatch) return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;

      // 3. Runtime Filter
      if (runtimeFilter !== 'all') {
        const lang = p.profile?.framework?.language;
        if (lang !== runtimeFilter) return false;
      }

      return true;
    }).sort((a, b) => {
      let comp = 0;
      switch (sortField) {
        case 'name':
          comp = a.title.localeCompare(b.title);
          break;
        case 'created':
          comp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'status':
          comp = a.status.localeCompare(b.status);
          break;
        case 'updated':
        default:
          comp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          break;
      }
      return sortAsc ? comp : -comp;
    });
  }, [projects, searchQuery, statusFilter, runtimeFilter, sortField, sortAsc]);

  // Paginated Slice
  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / pageSize));
  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProjects.slice(start, start + pageSize);
  }, [filteredProjects, currentPage, pageSize]);

  // Reset page when search/filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, runtimeFilter]);

  // ---------------------------------------------------------------------------
  // ACTIONS / HANDLERS
  // ---------------------------------------------------------------------------
  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const handleCopyCode = (e: React.MouseEvent, code: string, id: number) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handleOpenAdd = () => {
    setModalMode('add');
    setCurrentProject(null);
    setFormData(DEFAULT_FORM_DATA);
    setActionError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (e: React.MouseEvent, p: AdminProject) => {
    e.stopPropagation();
    setModalMode('edit');
    setCurrentProject(p);
    setFormData({
      title: p.title,
      description: p.description,
      architecture: p.architecture || 'monolith',
      visibility: p.visibility || 'private',
      analysis_mode: p.analysis_mode || 'manual',
      status: p.status || 'active',
    });
    setActionError(null);
    setIsModalOpen(true);
  };

  const handleOpenDelete = (e: React.MouseEvent, p: AdminProject) => {
    e.stopPropagation();
    setModalMode('delete');
    setCurrentProject(p);
    setActionError(null);
    setIsModalOpen(true);
  };

  // Submit Create or Edit Form
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsActionLoading(true);
    setActionError(null);

    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      if (modalMode === 'add') {
        // CREATE: POST /api/project/create/
        const response = await apiFetch(`${baseUrl}/api/project/create/`, {
          method: 'POST',
          headers,
          body: JSON.stringify(formData),
        });

        if (response.ok) {
          const newProj = await response.json();
          setIsModalOpen(false);
          showToast(`Project "${newProj.title}" created successfully.`);
          fetchProjects();
        } else {
          const errData = await response.json().catch(() => ({}));
          const msg = errData.title?.[0] || errData.description?.[0] || errData.detail || errData.error || 'Failed to create project.';
          setActionError(msg);
        }
      } else if (modalMode === 'edit' && currentProject) {
        // UPDATE: PATCH /api/project/:id/
        const response = await apiFetch(`${baseUrl}/api/project/${currentProject.id}/`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(formData),
        });

        if (response.ok) {
          const updatedProj = await response.json();
          setIsModalOpen(false);
          showToast(`Project "${updatedProj.title}" updated successfully.`);
          fetchProjects();
        } else {
          const errData = await response.json().catch(() => ({}));
          const msg = errData.title?.[0] || errData.description?.[0] || errData.detail || errData.error || 'Failed to update project.';
          setActionError(msg);
        }
      }
    } catch (err: any) {
      setActionError(err.message || 'An error occurred during submission.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Confirm Deletion
  const handleConfirmDelete = async () => {
    if (!currentProject) return;
    setIsActionLoading(true);
    setActionError(null);

    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const response = await apiFetch(`${baseUrl}/api/project/${currentProject.id}/`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (response.ok) {
        setIsModalOpen(false);
        showToast(`Project "${currentProject.title}" was permanently deleted.`);
        setProjects(prev => prev.filter(p => p.id !== currentProject.id));
        fetchProjects();
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
      <div className="pt-2">
        {/* ===================================================================
            PAGE HEADER & CONTROLS (MATCHING USERS & COMPANIES PAGES)
        ==================================================================== */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Manage Projects</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-[#c4b5fd]/15 text-[#e9d5ff] border border-[#c4b5fd]/30">
              {projects.length}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
            {/* Search Input */}
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#d8b4fe]/60 pointer-events-none" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-8 py-2 rounded-full border border-[#c4b5fd]/25 bg-[#120f1e]/80 text-white text-xs sm:text-sm font-medium placeholder-[#e9d5ff]/40 focus:outline-none focus:border-[#c4b5fd] focus:ring-1 focus:ring-[#c4b5fd]/30 backdrop-blur-sm transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#e9d5ff]/50 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <select
              aria-label="Filter projects by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3.5 py-2 rounded-full border border-[#c4b5fd]/25 bg-[#120f1e]/80 text-[#e9d5ff] text-xs font-medium focus:outline-none focus:border-[#c4b5fd] backdrop-blur-sm cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>

            {/* Runtime Filter */}
            {availableRuntimes.length > 0 && (
              <select
                aria-label="Filter projects by runtime"
                value={runtimeFilter}
                onChange={(e) => setRuntimeFilter(e.target.value)}
                className="px-3.5 py-2 rounded-full border border-[#c4b5fd]/25 bg-[#120f1e]/80 text-[#e9d5ff] text-xs font-medium focus:outline-none focus:border-[#c4b5fd] backdrop-blur-sm cursor-pointer"
              >
                <option value="all">All Runtimes</option>
                {availableRuntimes.map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            )}

            {/* Sort Toggle */}
            <button
              type="button"
              onClick={() => setSortAsc(!sortAsc)}
              title={sortAsc ? 'Ascending' : 'Descending'}
              className="p-2 rounded-full border border-[#c4b5fd]/25 bg-[#120f1e]/80 text-[#e9d5ff]/70 hover:text-white hover:border-[#c4b5fd] transition-all cursor-pointer"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>

            {/* Refresh Action */}
            <button
              type="button"
              onClick={fetchProjects}
              disabled={isLoading}
              title="Refresh project list"
              className="p-2 rounded-full border border-[#c4b5fd]/25 bg-[#120f1e]/80 text-[#e9d5ff]/70 hover:text-white hover:border-[#c4b5fd] transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#c4b5fd]' : ''}`} />
            </button>

            {/* New Project Button */}
            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-[#c4b5fd] hover:bg-[#d8b4fe] text-[#0a0812] text-xs sm:text-sm font-semibold rounded-full shadow-[0_0_20px_rgba(196,181,253,0.3)] transition-all flex items-center gap-2 cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" />
              <span>New Project</span>
            </button>
          </div>
        </div>

        {/* SUCCESS TOAST BANNER */}
        <AnimatePresence>
          {successToast && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successToast}</span>
              </div>
              <button
                type="button"
                onClick={() => setSuccessToast(null)}
                className="text-emerald-400 hover:text-emerald-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ERROR STATE BANNER */}
        {fetchError && (
          <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{fetchError}</span>
            </div>
            <button
              type="button"
              onClick={fetchProjects}
              className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 underline"
            >
              Retry
            </button>
          </div>
        )}



        {/* ===================================================================
            PROJECTS TABLE (MATCHING OTHER ADMIN PAGES)
        ==================================================================== */}
        <div className="bg-[#0c0a16]/90 border border-[#c4b5fd]/20 rounded-2xl p-1 backdrop-blur-md shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#c4b5fd]/15">
                  <th className="px-5 py-3.5 text-xs font-semibold text-[#d8b4fe]/60 uppercase tracking-wider">Project</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-[#d8b4fe]/60 uppercase tracking-wider">Runtime & Stack</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-[#d8b4fe]/60 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-[#d8b4fe]/60 uppercase tracking-wider">Tests & Chaos</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-[#d8b4fe]/60 uppercase tracking-wider">Last Activity</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-[#d8b4fe]/60 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c4b5fd]/10">
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={`loading-row-${i}`} className="hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap"><Skeleton className="h-6 w-44" /></td>
                      <td className="px-5 py-3.5 whitespace-nowrap"><Skeleton className="h-6 w-32" /></td>
                      <td className="px-5 py-3.5 whitespace-nowrap"><Skeleton className="h-6 w-24 rounded-full" /></td>
                      <td className="px-5 py-3.5 whitespace-nowrap"><Skeleton className="h-6 w-32" /></td>
                      <td className="px-5 py-3.5 whitespace-nowrap"><Skeleton className="h-6 w-24" /></td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-right"><Skeleton className="h-7 w-20 rounded-full ml-auto" /></td>
                    </tr>
                  ))
                ) : paginatedProjects.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-[#e9d5ff]/40 font-mono text-sm">
                      <Layers className="w-8 h-8 text-[#c4b5fd]/30 mx-auto mb-2" />
                      <p className="font-semibold text-stone-200">No project workspaces found</p>
                      <p className="text-xs text-[#e9d5ff]/50 mt-1">
                        {searchQuery || statusFilter !== 'all' || runtimeFilter !== 'all'
                          ? 'Try clearing or adjusting your search filters.'
                          : 'No projects registered on the platform yet.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                paginatedProjects.map((p) => {
                  const frameworkLang = p.profile?.framework?.language || 'Unknown';
                  const frameworkName = p.profile?.framework?.name || 'Generic';
                  const containersCount = p.containers_count ?? (p.profile?.docker_containers?.length || 0);

                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/admin/projects/${p.id}`)}
                      className="hover:bg-[#c4b5fd]/5 transition-colors cursor-pointer group"
                    >
                      {/* Project Identity */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#c4b5fd]/15 border border-[#c4b5fd]/30 flex items-center justify-center text-[#c4b5fd] shrink-0 group-hover:bg-[#c4b5fd]/25 transition-colors">
                            <Boxes className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-white text-sm group-hover:text-[#c4b5fd] transition-colors truncate flex items-center gap-1.5">
                              <span>{p.title}</span>
                              <span className="text-[11px] text-[#e9d5ff]/40 font-mono font-normal">#{p.id}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <button
                                type="button"
                                onClick={(e) => handleCopyCode(e, p.connection_code, p.id)}
                                title="Copy connection code"
                                className="inline-flex items-center gap-1 text-[11px] font-mono text-[#c4b5fd]/80 hover:text-white bg-[#c4b5fd]/10 hover:bg-[#c4b5fd]/20 px-1.5 py-0.5 rounded border border-[#c4b5fd]/20 transition-colors"
                              >
                                <span>{p.connection_code}</span>
                                {copiedCodeId === p.id ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3 opacity-60" />
                                )}
                              </button>
                              <span className="text-[11px] text-[#e9d5ff]/40 font-mono">
                                by {p.owner?.username || 'admin'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Runtime & Stack */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-stone-200 font-medium">
                          <Cpu className="w-3.5 h-3.5 text-[#c4b5fd]" />
                          <span>{frameworkLang}</span>
                          {frameworkName !== 'Generic' && (
                            <span className="text-stone-400 font-mono text-[11px]">({frameworkName})</span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#e9d5ff]/40 font-mono capitalize mt-0.5">
                          {p.architecture} • {containersCount > 0 ? `${containersCount} container(s)` : (p.profile?.operating_system || 'Host')}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                          p.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            : p.status === 'completed'
                            ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                            : 'bg-zinc-500/10 text-zinc-300 border-zinc-500/30'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            p.status === 'active' ? 'bg-emerald-400' : p.status === 'completed' ? 'bg-cyan-400' : 'bg-zinc-400'
                          }`} />
                          <span className="capitalize">{p.status}</span>
                        </span>
                      </td>

                      {/* Tests & Chaos Telemetry */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#c4b5fd]/10 text-[#d8b4fe] border border-[#c4b5fd]/20 text-xs font-mono" title="Test Runs">
                            <Activity className="w-3 h-3 text-[#c4b5fd]" />
                            <span>{p.tests_count || 0} tests</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20 text-xs font-mono" title="Chaos Experiments">
                            <Zap className="w-3 h-3 text-purple-400" />
                            <span>{p.experiments_count || 0} chaos</span>
                          </span>
                        </div>
                      </td>

                      {/* Last Activity */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="text-xs text-stone-300 font-mono">
                          {formatLastUpdated(p.updated_at || p.created_at)}
                        </div>
                        <div className="text-[11px] text-[#e9d5ff]/40 font-mono mt-0.5">
                          Created {new Date(p.created_at).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/projects/${p.id}`)}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-[#c4b5fd] cursor-pointer"
                            title="View Project Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleOpenEdit(e, p)}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-[#c4b5fd] cursor-pointer"
                            title="Edit Project"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleOpenDelete(e, p)}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-rose-400 cursor-pointer"
                            title="Delete Project"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

            {/* PAGINATION (MATCHING OTHER ADMIN PAGES) */}
            <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3.5 border-t border-[#c4b5fd]/15 gap-4">
              <div className="text-xs text-[#e9d5ff]/50 font-mono">
                Showing {filteredProjects.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredProjects.length)} of {filteredProjects.length} projects
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className="px-3 py-1 rounded-lg border border-[#c4b5fd]/20 text-xs font-medium text-[#e9d5ff]/75 bg-[#120f1e]/80 hover:bg-[#c4b5fd]/15 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium transition-colors cursor-pointer ${
                        p === currentPage
                          ? 'bg-[#c4b5fd] text-[#0a0812] font-semibold shadow-[0_0_12px_rgba(196,181,253,0.3)]'
                          : 'text-[#e9d5ff]/70 hover:bg-[#c4b5fd]/15 hover:text-white'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className="px-3 py-1 rounded-lg border border-[#c4b5fd]/20 text-xs font-medium text-[#e9d5ff]/75 bg-[#120f1e]/80 hover:bg-[#c4b5fd]/15 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================
          CREATE / EDIT / DELETE MODAL
      ==================================================================== */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { if (!isActionLoading) setIsModalOpen(false); }}
        title={
          modalMode === 'add'
            ? 'Create Project Workspace'
            : modalMode === 'edit'
            ? `Edit Project: ${currentProject?.title}`
            : `Delete Project: ${currentProject?.title}`
        }
      >
        {modalMode === 'delete' ? (
          <div className="space-y-4 font-mono text-xs">
            <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Destructive Operation</span>
              </div>
              <p className="leading-relaxed">
                Are you sure you want to permanently delete project <strong className="text-white">"{currentProject?.title}"</strong>?
              </p>
              <p className="text-[11px] text-rose-400/80 leading-relaxed font-sans">
                This will delete the project record and cascade-delete all associated test execution runs, chaos injection histories, telemetry events, and report benchmarks from the database. This action cannot be undone.
              </p>
            </div>

            <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800 text-[11px] space-y-1 text-zinc-400">
              <div className="flex justify-between">
                <span>Project ID:</span>
                <span className="text-zinc-200 font-semibold">#{currentProject?.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Connection Code:</span>
                <span className="text-purple-300 font-semibold">{currentProject?.connection_code}</span>
              </div>
              <div className="flex justify-between">
                <span>Recorded Tests / Experiments:</span>
                <span className="text-zinc-200">
                  {currentProject?.tests_count || 0} tests • {currentProject?.experiments_count || 0} experiments
                </span>
              </div>
            </div>

            {actionError && (
              <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {actionError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isActionLoading}
                className="h-8 px-3 rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isActionLoading}
                className="h-8 px-4 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shadow-rose-900/40 disabled:opacity-50"
              >
                {isActionLoading ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3 h-3" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleFormSubmit} className="space-y-3 font-mono text-xs">
            {/* Title Field */}
            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider block">
                Project Title <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={100}
                placeholder="e.g. DormCare App"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 text-xs"
              />
            </div>

            {/* Description Field */}
            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider block">
                Description <span className="text-rose-400">*</span>
              </label>
              <textarea
                required
                rows={2}
                placeholder="Brief engineering summary of the service or system..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 text-xs resize-none"
              />
            </div>

            {/* Architecture & Visibility Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider block">
                  Architecture <span className="text-rose-400">*</span>
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

            {/* Analysis Mode & Status Grid */}
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
                onClick={() => setIsModalOpen(false)}
                disabled={isActionLoading}
                className="h-8 px-3 rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isActionLoading}
                className="h-8 px-4 rounded bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shadow-purple-900/30 disabled:opacity-50"
              >
                {isActionLoading ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>{modalMode === 'add' ? 'Create Project' : 'Save Changes'}</span>
                )}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </AdminLayout>
  );
}
