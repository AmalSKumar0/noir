import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Plus, 
  Folder, 
  Trash2, 
  Sparkles, 
  Check, 
  Copy, 
  Server,
  ArrowUpRight,
  Cpu,
  Layers
} from 'lucide-react';
import UserLayout from '../components/UserLayout';
import Modal from '../components/Modal';
import { Skeleton } from '../components/Skeleton';
import { apiFetch } from '../utils/api';
import { checkAndRefreshToken } from '../utils/auth';
import { getUserProjects, getCachedProjects, setCachedProjects, Project } from '../utils/projectCache';

export default function UserProjects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>(() => getCachedProjects());
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectArch, setNewProjectArch] = useState('monolith');
  const [newProjectVis, setNewProjectVis] = useState('private');
  const [newProjectAnalysisMode, setNewProjectAnalysisMode] = useState('manual');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clipboard copies
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  useEffect(() => {
    // Auth check
    const token = localStorage.getItem('access_token');
    if (!token) {
      navigate('/login');
      return;
    }

    const loadProjects = async () => {
      const prjs = await getUserProjects();
      setProjects(prjs);
      setIsLoading(false);
    };

    loadProjects();
  }, [navigate]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectTitle.trim()) {
      setError("Workspace title is required.");
      return;
    }
    if (!newProjectDesc.trim()) {
      setError("Project description is required.");
      return;
    }
    if (!newProjectArch.trim()) {
      setError("Architecture is required.");
      return;
    }
    if (!newProjectVis.trim()) {
      setError("Visibility is required.");
      return;
    }
    if (!newProjectAnalysisMode.trim()) {
      setError("Analysis mode is required.");
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      
      const payload = {
        title: newProjectTitle.trim(),
        description: newProjectDesc.trim(),
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

        const updated = [newPrj, ...projects];
        setProjects(updated);
        setCachedProjects(updated);
        getUserProjects({ forceRefresh: true }).then(fresh => setProjects(fresh));
        
        // Reset form fields
        setNewProjectTitle('');
        setNewProjectDesc('');
        setNewProjectArch('monolith');
        setNewProjectVis('private');
        setNewProjectAnalysisMode('manual');
        setIsCreateModalOpen(false);
      } else {
        const errData = await response.json().catch(() => ({}));
        let errorMsg = errData.detail;
        if (!errorMsg && typeof errData === 'object' && errData !== null) {
          const firstKey = Object.keys(errData)[0];
          if (firstKey && Array.isArray(errData[firstKey])) {
            errorMsg = `${firstKey}: ${errData[firstKey][0]}`;
          } else if (firstKey && typeof errData[firstKey] === 'string') {
            errorMsg = `${firstKey}: ${errData[firstKey]}`;
          }
        }
        setError(errorMsg || 'Failed to register project on the server.');
      }
    } catch (err: any) {
      console.error(err);
      setError('A network error occurred. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (window.confirm('Are you sure you want to delete this project and clear all associated telemetry streams?')) {
      try {
        const token = await checkAndRefreshToken();
        const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
        await apiFetch(`${baseUrl}/api/projects/${projectId}/`, {
          method: 'DELETE',
          headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });
      } catch (err) {
        console.error('Error deleting project from backend:', err);
      }
      const updated = projects.filter(p => p.id !== projectId);
      setProjects(updated);
      setCachedProjects(updated);
    }
  };

  const copyConnectionCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.connectionCode && p.connectionCode.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <UserLayout>
      <div className="space-y-3.5">
        
        {/* Compact Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
              <Link to="/dashboard" className="hover:text-zinc-300">Noir</Link>
              <span className="text-zinc-600">/</span>
              <span className="text-zinc-300">Developer Console</span>
              <span className="text-zinc-600">/</span>
              <span className="text-zinc-400">Workspaces</span>
            </div>
            <div className="flex items-center gap-2.5 mt-0.5">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
                Registered Workspaces
              </h1>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-800 text-zinc-400">
                {projects.length} nodes
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              <input 
                type="text" 
                placeholder="Filter workspaces..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-3 text-xs bg-zinc-900/90 border border-zinc-800 rounded-md text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 w-48 sm:w-60 transition-all"
              />
            </div>

            {/* Create Project Button */}
            <button 
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="h-8 px-3 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register Node</span>
            </button>
          </div>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div 
                key={`skeleton-${i}`} 
                className="bg-[#0D0F17] border border-zinc-800/80 rounded-lg p-3.5 flex flex-col h-[160px]"
              >
                <Skeleton className="w-1/2 h-5 mb-2 bg-zinc-800/40" />
                <Skeleton className="w-3/4 h-3.5 mb-4 bg-zinc-800/30" />
                <div className="mt-auto flex justify-between items-center pt-2 border-t border-zinc-800/60">
                  <Skeleton className="w-1/3 h-4 bg-zinc-800/40" />
                  <Skeleton className="w-12 h-6 rounded bg-zinc-800/40" />
                </div>
              </div>
            ))
          ) : filteredProjects.length === 0 ? (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-center bg-[#0D0F17] border border-zinc-800/80 border-dashed rounded-lg p-6">
              <Folder className="w-8 h-8 text-zinc-600 mb-2" />
              <h3 className="text-sm font-semibold text-zinc-300">No workspaces found</h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-[280px]">
                {searchQuery ? "No workspaces match your query filter." : "Register your first workspace node to route live telemetry."}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="mt-4 h-8 px-3 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Register Workspace
                </button>
              )}
            </div>
          ) : (
            filteredProjects.map((project) => {
              return (
                <div 
                  key={project.id} 
                  className="bg-[#0D0F17] border border-zinc-800/80 rounded-lg p-3.5 flex flex-col justify-between hover:border-zinc-700 transition-colors group"
                >
                  <div>
                    {/* Top Row: Title + Status */}
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <Link 
                        to={`/dashboard/projects/${project.id}`}
                        className="font-semibold text-sm text-zinc-200 group-hover:text-violet-300 transition-colors flex items-center gap-1 truncate"
                      >
                        <span className="truncate">{project.name}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-violet-400 shrink-0" />
                      </Link>

                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>Active</span>
                      </span>
                    </div>

                    {/* Metadata strip */}
                    <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500 mb-3">
                      <span>ID: {project.id}</span>
                      <span>•</span>
                      <span>{project.environments || 1} Env</span>
                      <span>•</span>
                      <span className="text-zinc-400">Docker Synced</span>
                    </div>

                    {/* Connection Code box */}
                    {project.connectionCode && (
                      <div className="bg-zinc-900/90 border border-zinc-800/80 rounded px-2 py-1 flex items-center justify-between text-[11px] font-mono text-zinc-300">
                        <span className="text-zinc-500 select-none">CODE:</span>
                        <span className="text-zinc-200 font-semibold">{project.connectionCode}</span>
                        <button
                          type="button"
                          onClick={() => copyConnectionCode(project.connectionCode!, project.id)}
                          className="text-zinc-400 hover:text-white p-0.5 transition-colors cursor-pointer"
                          title="Copy connection code"
                        >
                          {copiedCodeId === project.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom: Last Sync & Actions */}
                  <div className="mt-3 pt-2.5 border-t border-zinc-800/60 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-mono text-zinc-500">
                      Sync: {project.lastUpdated || 'Just now'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <Link
                        to={`/dashboard/projects/${project.id}`}
                        className="h-6 px-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium inline-flex items-center gap-1 transition-colors"
                      >
                        Inspect
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDeleteProject(project.id)}
                        className="h-6 w-6 rounded bg-zinc-800/40 hover:bg-rose-500/20 hover:text-rose-400 text-zinc-400 flex items-center justify-center transition-colors cursor-pointer"
                        title="Delete Workspace"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* Register Project Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Register Telemetry Node"
      >
        <form onSubmit={handleCreateProject} className="space-y-3.5">
          <div className="flex items-center gap-2 text-zinc-300">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-xs uppercase font-mono tracking-wider font-semibold">New Monitored Node</span>
          </div>

          {error && (
            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
              Workspace Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. DormCare Microservices"
              value={newProjectTitle}
              onChange={(e) => setNewProjectTitle(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
              required
              disabled={isCreating}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
              Description <span className="text-rose-400">*</span>
            </label>
            <textarea
              placeholder="e.g. Core microservices cluster fault injection monitoring"
              value={newProjectDesc}
              onChange={(e) => setNewProjectDesc(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors h-14 resize-none"
              required
              disabled={isCreating}
            />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
                Architecture <span className="text-rose-400">*</span>
              </label>
              <select
                value={newProjectArch}
                onChange={(e) => setNewProjectArch(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-1.5 px-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-600 transition-colors"
                required
                disabled={isCreating}
              >
                <option value="monolith">Monolith</option>
                <option value="microservice">Microservice</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
                Visibility <span className="text-rose-400">*</span>
              </label>
              <select
                value={newProjectVis}
                onChange={(e) => setNewProjectVis(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-1.5 px-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-600 transition-colors"
                required
                disabled={isCreating}
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
                Analysis <span className="text-rose-400">*</span>
              </label>
              <select
                value={newProjectAnalysisMode}
                onChange={(e) => setNewProjectAnalysisMode(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-1.5 px-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-600 transition-colors"
                required
                disabled={isCreating}
              >
                <option value="manual">Manual</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2.5 pt-2 border-t border-zinc-800/80 mt-3">
            <button
              type="submit"
              disabled={isCreating}
              className="flex-1 h-8 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <>
                  <div className="w-3 h-3 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                'Register Node'
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="h-8 px-4 rounded-md border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </UserLayout>
  );
}
