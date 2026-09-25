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
      <div className="space-y-4 pt-1">
        
        {/* ===================================================================
            PAGE HEADER & CONTROLS
        ==================================================================== */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-zinc-800/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-semibold px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                Admin Console
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-xs font-mono text-zinc-400">
                Workspace Infrastructure
              </span>
            </div>
            <div className="flex items-center gap-2.5 mt-1">
              <h1 className="text-xl font-bold tracking-tight text-white font-sans">
                Projects
              </h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                {projects.length}
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">
              Inspect, configure, and maintain registered project nodes across the platform
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              type="button"
              onClick={fetchProjects}
              disabled={isLoading}
              title="Refresh project list"
              className="h-8 px-2.5 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-purple-400' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAdd}
              className="h-8 px-3 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shadow-purple-900/30"
            >
              <FolderPlus className="w-3.5 h-3.5" />
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
            SEARCH & FILTERS TOOLBAR
        ==================================================================== */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-zinc-950/70 border border-zinc-800/80 p-2.5 rounded-lg text-xs font-mono">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by name, code, owner, language..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500/70 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns & Sorting */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Status Filter */}
            <div className="flex items-center gap-1">
              <span className="text-zinc-500 text-[11px]">Status:</span>
              <select
                aria-label="Filter projects by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-7 px-2 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 focus:outline-none focus:border-purple-500 cursor-pointer text-xs"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {/* Runtime Filter */}
            {availableRuntimes.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-zinc-500 text-[11px]">Runtime:</span>
                <select
                  aria-label="Filter projects by runtime"
                  value={runtimeFilter}
                  onChange={(e) => setRuntimeFilter(e.target.value)}
                  className="h-7 px-2 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 focus:outline-none focus:border-purple-500 cursor-pointer text-xs"
                >
                  <option value="all">All Runtimes</option>
                  {availableRuntimes.map(lang => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Sort Field */}
            <div className="flex items-center gap-1">
              <span className="text-zinc-500 text-[11px]">Sort:</span>
              <select
                aria-label="Sort projects"
                value={sortField}
                onChange={(e: any) => setSortField(e.target.value)}
                className="h-7 px-2 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 focus:outline-none focus:border-purple-500 cursor-pointer text-xs"
              >
                <option value="updated">Last Updated</option>
                <option value="name">Name</option>
                <option value="created">Created Date</option>
                <option value="status">Status</option>
              </select>
              <button
                type="button"
                onClick={() => setSortAsc(!sortAsc)}
                title={sortAsc ? 'Ascending' : 'Descending'}
                className="h-7 px-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <ArrowUpDown className="w-3 h-3" />
              </button>
            </div>

          </div>
        </div>

        {/* ===================================================================
            COMPACT PROFESSIONAL LIST / TABLE
        ==================================================================== */}
        <div className="overflow-x-auto rounded-lg border border-zinc-800/80 bg-[#090A0F] shadow-sm">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-zinc-800/80 bg-zinc-950/80 text-[10px] text-zinc-400 uppercase tracking-wider">
                <th className="py-2.5 px-3 font-semibold">Project Name & Owner</th>
                <th className="py-2.5 px-3 font-semibold">Identifier</th>
                <th className="py-2.5 px-3 font-semibold">Architecture / Mode</th>
                <th className="py-2.5 px-3 font-semibold">Runtime / Stack</th>
                <th className="py-2.5 px-3 font-semibold">Environment</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th className="py-2.5 px-3 font-semibold text-center">Tests</th>
                <th className="py-2.5 px-3 font-semibold text-center">Experiments</th>
                <th className="py-2.5 px-3 font-semibold">Last Activity</th>
                <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850/60">
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={`loading-row-${i}`} className="animate-pulse">
                    <td className="py-3 px-3"><Skeleton className="h-4 w-36 bg-zinc-800/60" /></td>
                    <td className="py-3 px-3"><Skeleton className="h-4 w-24 bg-zinc-800/60" /></td>
                    <td className="py-3 px-3"><Skeleton className="h-4 w-28 bg-zinc-800/60" /></td>
                    <td className="py-3 px-3"><Skeleton className="h-4 w-20 bg-zinc-800/60" /></td>
                    <td className="py-3 px-3"><Skeleton className="h-4 w-24 bg-zinc-800/60" /></td>
                    <td className="py-3 px-3"><Skeleton className="h-4 w-16 bg-zinc-800/60" /></td>
                    <td className="py-3 px-3 text-center"><Skeleton className="h-4 w-8 mx-auto bg-zinc-800/60" /></td>
                    <td className="py-3 px-3 text-center"><Skeleton className="h-4 w-8 mx-auto bg-zinc-800/60" /></td>
                    <td className="py-3 px-3"><Skeleton className="h-4 w-20 bg-zinc-800/60" /></td>
                    <td className="py-3 px-3 text-right"><Skeleton className="h-4 w-16 ml-auto bg-zinc-800/60" /></td>
                  </tr>
                ))
              ) : paginatedProjects.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-zinc-500 font-mono">
                    <Layers className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-zinc-300">No project nodes found</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {searchQuery || statusFilter !== 'all' || runtimeFilter !== 'all'
                        ? 'Try clearing or changing your filters.'
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
                      className="hover:bg-purple-950/20 hover:border-purple-500/30 transition-colors cursor-pointer group"
                    >
                      {/* Name & Owner */}
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-zinc-100 group-hover:text-purple-300 transition-colors flex items-center gap-1.5">
                          <span>{p.title}</span>
                          <span className="text-[10px] text-zinc-500 font-normal">#{p.id}</span>
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          Owner: <span className="text-zinc-300">{p.owner?.username || 'admin'}</span>
                        </div>
                      </td>

                      {/* Connection Code Pill */}
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={(e) => handleCopyCode(e, p.connection_code, p.id)}
                          title="Copy connection code"
                          className="h-6 px-1.5 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-[11px] font-mono text-zinc-300 hover:text-white flex items-center gap-1 transition-colors"
                        >
                          <span className="tracking-wider">{p.connection_code}</span>
                          {copiedCodeId === p.id ? (
                            <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                          ) : (
                            <Copy className="w-3 h-3 text-zinc-500 hover:text-zinc-300 shrink-0" />
                          )}
                        </button>
                      </td>

                      {/* Architecture & Mode */}
                      <td className="py-2.5 px-3 text-[11px] text-zinc-300">
                        <span className="capitalize">{p.architecture}</span>
                        <span className="text-zinc-600 block text-[10px] capitalize">
                          {p.analysis_mode} mode • {p.visibility}
                        </span>
                      </td>

                      {/* Runtime / Primary Language */}
                      <td className="py-2.5 px-3">
                        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-200">
                          <Cpu className="w-3 h-3 text-cyan-400 shrink-0" />
                          <span>{frameworkLang}</span>
                          {frameworkName !== 'Generic' && (
                            <span className="text-zinc-500 text-[10px]">({frameworkName})</span>
                          )}
                        </div>
                      </td>

                      {/* Environment */}
                      <td className="py-2.5 px-3 text-[11px] text-zinc-300">
                        <div className="flex items-center gap-1.5">
                          <Server className="w-3 h-3 text-zinc-500 shrink-0" />
                          <span>{p.profile?.operating_system || 'Linux'}</span>
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          {containersCount > 0 ? `${containersCount} container(s)` : 'Host process'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          p.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : p.status === 'completed'
                            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                            : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/60'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            p.status === 'active' ? 'bg-emerald-400' : p.status === 'completed' ? 'bg-cyan-400' : 'bg-zinc-500'
                          }`} />
                          <span>{p.status}</span>
                        </span>
                      </td>

                      {/* Tests Count */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                          (p.tests_count || 0) > 0 ? 'bg-violet-500/15 text-violet-300 border border-violet-500/30' : 'text-zinc-500'
                        }`}>
                          {p.tests_count || 0}
                        </span>
                      </td>

                      {/* Experiments Count */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                          (p.experiments_count || 0) > 0 ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30' : 'text-zinc-500'
                        }`}>
                          {p.experiments_count || 0}
                        </span>
                      </td>

                      {/* Last Activity */}
                      <td className="py-2.5 px-3 text-[11px] text-zinc-400 whitespace-nowrap">
                        {p.updated_at ? formatLastUpdated(p.updated_at) : 'N/A'}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/projects/${p.id}`)}
                            title="View Project Details"
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleOpenEdit(e, p)}
                            title="Edit Project Configuration"
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-purple-300 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleOpenDelete(e, p)}
                            title="Delete Project Node"
                            className="p-1.5 rounded hover:bg-rose-500/10 text-zinc-400 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Table Footer with Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between px-3 py-2.5 border-t border-zinc-800/80 bg-zinc-950/60 text-xs font-mono gap-2">
            <div className="text-zinc-500 text-[11px]">
              Showing <span className="text-zinc-200">{filteredProjects.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> to <span className="text-zinc-200">{Math.min(currentPage * pageSize, filteredProjects.length)}</span> of <span className="text-zinc-200">{filteredProjects.length}</span> projects
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="h-7 px-2.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              
              <span className="px-2 text-zinc-400 text-[11px]">
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="h-7 px-2.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
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
