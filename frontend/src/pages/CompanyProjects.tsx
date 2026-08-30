import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  FolderPlus, 
  Folder, 
  Trash2, 
  Edit3,
  Sparkles, 
  Check, 
  Copy, 
  Server,
  ArrowRight,
  Shield,
  Building2,
  AlertTriangle
} from 'lucide-react';
import UserLayout from '../components/UserLayout';
import Modal from '../components/Modal';
import { Skeleton } from '../components/Skeleton';
import { apiFetch } from '../utils/api';
import { checkAndRefreshToken } from '../utils/auth';
import { getUserProjects, getCachedProjects, setCachedProjects, Project } from '../utils/projectCache';

export default function CompanyProjects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>(() => getCachedProjects());
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectArch, setNewProjectArch] = useState('monolith');
  const [newProjectVis, setNewProjectVis] = useState('private');
  const [newProjectAnalysisMode, setNewProjectAnalysisMode] = useState('manual');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit Modal State
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editArch, setEditArch] = useState('monolith');
  const [editVis, setEditVis] = useState('private');
  const [isEditing, setIsEditing] = useState(false);

  // Delete State
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  // Clipboard copy state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const prjs = await getUserProjects({ forceRefresh: true });
        setProjects(prjs);
      } catch (err) {
        console.error('Error fetching company projects:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadProjects();
  }, []);

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

        const updated = [newPrj, ...projects];
        setProjects(updated);
        setCachedProjects(updated);
        
        setNewProjectTitle('');
        setNewProjectDesc('');
        setNewProjectArch('monolith');
        setNewProjectVis('private');
        setNewProjectAnalysisMode('manual');
        setIsCreateModalOpen(false);
      } else {
        const errData = await response.json().catch(() => ({}));
        setError(errData.detail || 'Failed to register company project.');
      }
    } catch (err: any) {
      console.error(err);
      setError('A network error occurred. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setEditTitle(project.name);
    setEditDesc('');
    setEditArch('monolith');
    setEditVis('private');
  };

  const handleEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !editTitle.trim()) return;

    setIsEditing(true);
    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      
      const payload = {
        title: editTitle,
        architecture: editArch,
        visibility: editVis
      };

      const response = await apiFetch(`${baseUrl}/api/projects/${editingProject.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      const updated = projects.map(p => 
        p.id === editingProject.id ? { ...p, name: editTitle } : p
      );

      setProjects(updated);
      setCachedProjects(updated);
      setEditingProject(null);
    } catch (err) {
      console.error('Error updating project:', err);
      // Fallback local update
      const updated = projects.map(p => 
        p.id === editingProject.id ? { ...p, name: editTitle } : p
      );
      setProjects(updated);
      setCachedProjects(updated);
      setEditingProject(null);
    } finally {
      setIsEditing(false);
    }
  };

  const confirmDeleteProject = async () => {
    if (!deletingProjectId) return;

    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      
      await apiFetch(`${baseUrl}/api/projects/${deletingProjectId}/`, {
        method: 'DELETE',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
    } catch (err) {
      console.error('Error deleting project from backend:', err);
    }

    const updated = projects.filter(p => p.id !== deletingProjectId);
    setProjects(updated);
    setCachedProjects(updated);
    setDeletingProjectId(null);
  };

  const copyToken = (projId: string, tokenVal: string) => {
    navigator.clipboard.writeText(tokenVal);
    setCopiedId(projId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <UserLayout>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-6 md:mt-10 px-2 md:px-6 pb-12"
      >
        {/* Header Panel */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10 pb-6 border-b border-white/5">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white flex items-center gap-3">
              <Building2 className="w-8 h-8 text-violet-400" />
              Company Projects
            </h1>
            <p className="text-xs text-white/50 font-mono mt-1 uppercase tracking-widest">
              Manage & Monitor Organization Projects ({projects.length})
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input 
                type="text" 
                placeholder="Search company projects..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-full border border-white/20 bg-white/5 text-white text-xs font-medium placeholder-white/40 focus:outline-none focus:border-violet-500/50 backdrop-blur-sm transition-all"
              />
            </div>

            {/* Create Project Button */}
            <button 
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-5 py-2.5 bg-white hover:bg-stone-200 text-stone-950 text-xs font-semibold uppercase tracking-widest rounded-full shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-102 active:scale-98"
            >
              <FolderPlus className="w-4 h-4" />
              New Project
            </button>
          </div>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div 
                key={`skeleton-${i}`} 
                className="bg-white/5 border border-white/10 rounded-[2rem] p-6 backdrop-blur-md shadow-lg flex flex-col h-[260px]"
              >
                <div className="flex justify-between items-start mb-4">
                  <Skeleton className="w-12 h-12 rounded-2xl bg-white/5" />
                  <Skeleton className="w-16 h-6 rounded-full bg-white/5" />
                </div>
                <Skeleton className="w-3/4 h-6 mb-2 bg-white/5" />
                <Skeleton className="w-1/2 h-4 mb-6 bg-white/5" />
                <div className="mt-auto pt-4 border-t border-white/5 flex justify-between items-center">
                  <Skeleton className="w-1/3 h-4 bg-white/5" />
                  <Skeleton className="w-8 h-8 rounded-full bg-white/5" />
                </div>
              </div>
            ))
          ) : filteredProjects.length === 0 ? (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-center bg-white/5 border border-white/10 border-dashed rounded-[2rem] p-6">
              <Folder className="w-12 h-12 text-white/20 mb-4" />
              <h3 className="text-lg font-semibold text-white">No company projects found</h3>
              <p className="text-xs text-white/50 mt-1 max-w-[320px]">
                {searchQuery ? "Your search filter didn't match any company projects." : "Add your first company telemetry node project to start managing organization telemetry."}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="mt-6 px-4 py-2 border border-violet-500/30 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 text-xs uppercase tracking-widest font-bold rounded-full transition-colors cursor-pointer"
                >
                  Create Company Project
                </button>
              )}
            </div>
          ) : (
            filteredProjects.map((project) => (
              <motion.div 
                layout
                key={project.id} 
                className="bg-white/5 border border-white/10 rounded-[2rem] p-6 backdrop-blur-md shadow-lg flex flex-col justify-between group hover:border-violet-500/30 transition-all duration-300 relative overflow-hidden"
              >
                {/* Glowing hover accent */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-violet-600/5 blur-2xl rounded-full group-hover:bg-violet-600/10 transition-all duration-500 pointer-events-none" />
                
                <div>
                  {/* Card Top Row */}
                  <div className="flex justify-between items-start mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/80 group-hover:bg-violet-500/20 group-hover:border-violet-500/30 group-hover:text-violet-400 transition-all">
                      <Folder className="w-5 h-5" />
                    </div>
                    
                    {/* Status indicator badge */}
                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest flex items-center gap-1.5 border ${
                      project.status === 'active' 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                        : project.status === 'error'
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 animate-pulse'
                        : 'bg-stone-500/10 border-white/10 text-white/40'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        project.status === 'active' 
                          ? 'bg-emerald-400' 
                          : project.status === 'error'
                          ? 'bg-rose-400'
                          : 'bg-white/30'
                      }`} />
                      {project.status}
                    </span>
                  </div>

                  {/* Workspace Metadata */}
                  <Link to={`/company/projects/${project.id}`} className="block mt-2">
                    <h3 className="text-xl font-bold text-white group-hover:text-violet-300 transition-colors cursor-pointer flex items-center gap-1.5">
                      {project.name}
                      <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-violet-400" />
                    </h3>
                  </Link>
                  <p className="text-[10px] text-white/40 font-mono mt-1 uppercase tracking-widest">
                    ID: {project.id}
                  </p>

                  {/* Connection Code Pill */}
                  {project.connectionCode && (
                    <div className="mt-4 p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between gap-2">
                      <code className="text-[10px] font-mono text-violet-300 truncate">
                        {project.connectionCode}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyToken(project.id, project.connectionCode!)}
                        className="text-white/40 hover:text-white transition-colors cursor-pointer"
                        title="Copy connection code"
                      >
                        {copiedId === project.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>

                {/* Card Bottom Actions row */}
                <div className="mt-8 pt-4 border-t border-white/5 flex justify-between items-center">
                  <Link
                    to={`/company/projects/${project.id}`}
                    className="text-xs text-violet-400 font-mono hover:underline flex items-center gap-1"
                  >
                    <span>View Details</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>

                  <div className="flex items-center gap-2">
                    {/* Edit action */}
                    <button
                      type="button"
                      onClick={() => openEditModal(project)}
                      className="p-1.5 rounded-full bg-white/5 border border-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                      title="Edit Project"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete action */}
                    <button
                      type="button"
                      onClick={() => setDeletingProjectId(project.id)}
                      className="p-1.5 rounded-full bg-white/5 border border-white/5 text-white/40 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 transition-all cursor-pointer"
                      title="Delete Project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>

      {/* Modal 1: Register New Project */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Register Company Project"
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
              placeholder="e.g. Core organization microservice node"
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

      {/* Modal 2: Edit Project */}
      <Modal
        isOpen={!!editingProject}
        onClose={() => setEditingProject(null)}
        title="Edit Project Configuration"
      >
        <form onSubmit={handleEditProject} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[9px] font-mono uppercase tracking-widest text-stone-400 block">Project Title</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-xs font-mono text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 transition-colors"
              required
              disabled={isEditing}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-mono uppercase tracking-widest text-stone-400 block">Architecture</label>
              <select
                value={editArch}
                onChange={(e) => setEditArch(e.target.value)}
                className="w-full bg-[#100C1F] border border-white/10 rounded-xl py-2.5 px-3 text-xs font-mono text-white focus:outline-none focus:border-violet-500/50 transition-colors"
                disabled={isEditing}
              >
                <option value="monolith">Monolith</option>
                <option value="microservice">Microservice</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-mono uppercase tracking-widest text-stone-400 block">Visibility</label>
              <select
                value={editVis}
                onChange={(e) => setEditVis(e.target.value)}
                className="w-full bg-[#100C1F] border border-white/10 rounded-xl py-2.5 px-3 text-xs font-mono text-white focus:outline-none focus:border-violet-500/50 transition-colors"
                disabled={isEditing}
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-3 border-t border-white/5 mt-4">
            <button
              type="submit"
              disabled={isEditing}
              className="flex-1 py-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50"
            >
              {isEditing ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => setEditingProject(null)}
              className="px-6 py-2.5 rounded-full border border-white/10 text-stone-400 hover:text-white hover:border-white/20 text-xs font-semibold uppercase tracking-widest transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 3: Confirm Delete */}
      <Modal
        isOpen={!!deletingProjectId}
        onClose={() => setDeletingProjectId(null)}
        title="Delete Project Workspace"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p className="text-xs font-mono">
              Warning: This will permanently delete the project node and clear all associated telemetry logs.
            </p>
          </div>

          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={confirmDeleteProject}
              className="flex-1 py-2.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold uppercase tracking-widest transition-all cursor-pointer"
            >
              Confirm Delete
            </button>
            <button
              type="button"
              onClick={() => setDeletingProjectId(null)}
              className="px-6 py-2.5 rounded-full border border-white/10 text-stone-400 hover:text-white hover:border-white/20 text-xs font-semibold uppercase tracking-widest transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </UserLayout>
  );
}
