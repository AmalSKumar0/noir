import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import AdminLayout from '../components/AdminLayout';
import { Search, FolderPlus, MoreVertical, Layout, ArrowRight, Edit2, Trash2, Eye, AlertCircle } from 'lucide-react';
import Modal from '../components/Modal';
import { Skeleton } from '../components/Skeleton';
import { apiFetch } from '../utils/api';
import { checkAndRefreshToken } from '../utils/auth';
import { formatLastUpdated } from './Dashboard';

interface Project {
  id: number;
  name: string;
  ownerName: string;
  status: string;
  progress: number;
  lastUpdated: string;
  raw: any;
}

export default function AdminManageProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view' | 'delete'>('add');
  const [currentProject, setCurrentProject] = useState<any>(null);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const fetchProjects = async () => {
    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const response = await apiFetch(`${baseUrl}/api/project/all/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      if (response.ok) {
        const data = await response.json();
        const rawList = Array.isArray(data) ? data : (data.results || []);
        const mapped: Project[] = rawList.map((p: any) => ({
          id: p.id,
          name: p.title,
          ownerName: p.owner?.username || p.owner?.email || 'Unknown',
          status: p.status === 'active' ? 'Active' : p.status === 'error' ? 'Error' : (p.status || 'Archived'),
          progress: p.status === 'active' ? 80 : p.status === 'error' ? 35 : 100,
          lastUpdated: p.updated_at ? formatLastUpdated(p.updated_at) : 'Just now',
          raw: p
        }));
        setProjects(mapped);
      }
    } catch (err) {
      console.error('Failed to fetch admin projects:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleAdd = () => {
    setModalMode('add');
    setCurrentProject(null);
    setActionError('');
    setIsModalOpen(true);
  };

  const handleEdit = (project: any) => {
    setModalMode('edit');
    setCurrentProject(project);
    setActionError('');
    setIsModalOpen(true);
    setActiveDropdown(null);
  };

  const handleView = (project: any) => {
    setModalMode('view');
    setCurrentProject(project);
    setActionError('');
    setIsModalOpen(true);
    setActiveDropdown(null);
  };

  const handleDelete = (project: any) => {
    setModalMode('delete');
    setCurrentProject(project);
    setActionError('');
    setIsModalOpen(true);
    setActiveDropdown(null);
  };

  const confirmDelete = async () => {
    if (!currentProject) return;
    setIsActionLoading(true);
    setActionError('');
    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const response = await apiFetch(`${baseUrl}/api/projects/${currentProject.id}/`, {
        method: 'DELETE',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      if (response.ok) {
        setIsModalOpen(false);
        setProjects(prev => prev.filter(p => p.id !== currentProject.id));
        fetchProjects();
      } else {
        const errData = await response.json().catch(() => ({}));
        setActionError(errData.detail || errData.error || 'Failed to delete project');
      }
    } catch (err: any) {
      setActionError(err.message || 'An error occurred while deleting project');
    } finally {
      setIsActionLoading(false);
    }
  };

  const toggleDropdown = (id: number) => {
    if (activeDropdown === id) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown(id);
    }
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.ownerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="pt-2"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white">Manage Projects</h1>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#d8b4fe]/60" />
              <input 
                type="text" 
                placeholder="Search projects..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-full border border-[#c4b5fd]/25 bg-[#120f1e]/80 text-white text-sm font-medium placeholder-[#e9d5ff]/40 focus:outline-none focus:border-[#c4b5fd] focus:ring-1 focus:ring-[#c4b5fd]/30 backdrop-blur-sm"
              />
            </div>
            <button 
              onClick={handleAdd}
              className="px-5 py-2.5 bg-[#c4b5fd] hover:bg-[#d8b4fe] text-[#0a0812] text-sm font-semibold rounded-full shadow-[0_0_20px_rgba(196,181,253,0.3)] transition-all flex items-center gap-2 animate-pulse hover:animate-none"
            >
              <FolderPlus className="w-4 h-4" />
              New Project
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={`skeleton-${i}`} className="bg-[#0c0a16]/90 border border-[#c4b5fd]/20 rounded-[2rem] p-6 backdrop-blur-md shadow-lg flex flex-col h-[280px]">
                <div className="flex justify-between items-start mb-4">
                  <Skeleton className="w-12 h-12 rounded-xl" />
                  <Skeleton className="w-8 h-8 rounded-full" />
                </div>
                <Skeleton className="w-3/4 h-6 mb-2" />
                <Skeleton className="w-1/2 h-4 mb-6" />
                <div className="mt-auto">
                  <div className="flex justify-between mb-2">
                    <Skeleton className="w-1/4 h-3" />
                    <Skeleton className="w-1/4 h-3" />
                  </div>
                  <Skeleton className="w-full h-1.5 rounded-full mb-4" />
                  <div className="flex justify-between items-center pt-4 border-t border-white/10">
                    <Skeleton className="w-1/3 h-3" />
                    <Skeleton className="w-8 h-8 rounded-full" />
                  </div>
                </div>
              </div>
            ))
          ) : filteredProjects.length === 0 ? (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-center bg-[#0c0a16]/80 border border-[#c4b5fd]/20 border-dashed rounded-[2rem] p-6">
              <Layout className="w-12 h-12 text-[#c4b5fd]/30 mb-4" />
              <h3 className="text-lg font-semibold text-white">No projects found</h3>
              <p className="text-xs text-[#e9d5ff]/50 mt-1 max-w-[280px]">
                {searchQuery ? "No workspaces match your query." : "No projects exist on the platform yet."}
              </p>
            </div>
          ) : (
            filteredProjects.map((project) => (
              <div key={project.id} className="bg-[#0c0a16]/90 border border-[#c4b5fd]/20 rounded-[2rem] p-6 backdrop-blur-md shadow-xl flex flex-col group hover:border-[#c4b5fd]/45 hover:bg-[#120f22] transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-[#c4b5fd]/15 border border-[#c4b5fd]/25 flex items-center justify-center text-[#c4b5fd]">
                    <Layout className="w-6 h-6" />
                  </div>
                  <div className="relative">
                    <button 
                      onClick={() => toggleDropdown(project.id)}
                      className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-[#c4b5fd]"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    <AnimatePresence>
                      {activeDropdown === project.id && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          className="absolute right-0 top-full mt-2 w-48 bg-[#0e0b1a] border border-[#c4b5fd]/25 rounded-xl shadow-2xl overflow-hidden z-10"
                        >
                          <button onClick={() => handleView(project)} className="w-full text-left px-4 py-3 text-sm text-white/80 hover:bg-[#c4b5fd]/10 hover:text-white transition-colors flex items-center gap-2">
                            <Eye className="w-4 h-4 text-[#c4b5fd]" />
                            View Details
                          </button>
                          <button onClick={() => handleEdit(project)} className="w-full text-left px-4 py-3 text-sm text-white/80 hover:bg-[#c4b5fd]/10 hover:text-white transition-colors flex items-center gap-2">
                            <Edit2 className="w-4 h-4 text-[#c4b5fd]" />
                            Edit Project
                          </button>
                          <button onClick={() => handleDelete(project)} className="w-full text-left px-4 py-3 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-2 border-t border-white/5">
                            <Trash2 className="w-4 h-4" />
                            Delete Project
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                
                <h3 className="text-xl font-bold text-white mb-1">{project.name}</h3>
                <p className="text-sm text-[#e9d5ff]/50 mb-6">Owner: {project.ownerName}</p>
                
                <div className="mt-auto">
                  <div className="flex justify-between text-xs font-medium text-[#e9d5ff]/70 mb-2">
                    <span>{project.status}</span>
                    <span className="text-[#c4b5fd]">{project.progress}%</span>
                  </div>
                  <div className="w-full bg-[#181328] rounded-full h-1.5 mb-4 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-[#a78bfa] to-[#c4b5fd] h-1.5 rounded-full shadow-[0_0_8px_rgba(196,181,253,0.4)]" 
                      style={{ width: `${project.progress}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-4 border-t border-[#c4b5fd]/15">
                    <span className="text-xs text-[#e9d5ff]/40">Updated {project.lastUpdated}</span>
                    <button onClick={() => handleView(project)} className="w-8 h-8 rounded-full bg-[#181328] border border-[#c4b5fd]/20 flex items-center justify-center text-[#e9d5ff] hover:bg-[#c4b5fd] hover:text-[#0a0812] hover:border-[#c4b5fd] transition-all group-hover:scale-110 shadow-sm">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="flex flex-col sm:flex-row items-center justify-between mt-8 px-2 gap-4">
          <div className="text-sm text-[#e9d5ff]/50">
            Showing <span className="font-medium text-white">
              {filteredProjects.length > 0 ? 1 : 0}
            </span> to <span className="font-medium text-white">
              {filteredProjects.length}
            </span> of <span className="font-medium text-white">
              {projects.length}
            </span> results
          </div>
          <div className="flex items-center gap-2">
            <button disabled className="px-3 py-1.5 rounded-lg border border-[#c4b5fd]/20 text-sm font-medium text-[#e9d5ff]/50 bg-[#120f1e]/80 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              Previous
            </button>
            <div className="flex items-center gap-1">
              <button className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#c4b5fd] text-[#0a0812] text-sm font-semibold border border-[#c4b5fd] shadow-[0_0_12px_rgba(196,181,253,0.35)]">
                1
              </button>
            </div>
            <button disabled className="px-3 py-1.5 rounded-lg border border-[#c4b5fd]/20 text-sm font-medium text-[#e9d5ff]/50 bg-[#120f1e]/80 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              Next
            </button>
          </div>
        </div>
      </motion.div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalMode === 'add'
            ? 'Add New Project'
            : modalMode === 'edit'
            ? 'Edit Project'
            : modalMode === 'delete'
            ? 'Delete Project Workspace'
            : 'Project Details'
        }
      >
        {modalMode === 'delete' ? (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-200">
              <p className="text-sm leading-relaxed">
                Are you sure you want to delete workspace <span className="font-bold text-white">{currentProject?.name}</span>?
              </p>
              <p className="text-xs text-rose-300/80 mt-2">
                This will permanently delete this project node and all associated test runs, chaos injections, and streaming telemetry logs. This action cannot be undone.
              </p>
            </div>

            <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-xs font-mono space-y-1">
              <div className="flex justify-between">
                <span className="text-white/50">Project ID:</span>
                <span className="text-white font-semibold">#{currentProject?.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Connection Code:</span>
                <span className="text-[#c4b5fd] font-semibold">{currentProject?.raw?.connection_code || 'NR-PENDING'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Owner:</span>
                <span className="text-white">{currentProject?.ownerName}</span>
              </div>
            </div>

            {actionError && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono flex items-center gap-3">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isActionLoading}
                className="px-5 py-2.5 rounded-full text-xs font-medium text-white/50 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isActionLoading}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs uppercase tracking-wider font-semibold rounded-full shadow-lg transition-colors flex items-center gap-2"
              >
                {isActionLoading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        ) : modalMode === 'view' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">Project Name</label>
              <div className="text-white text-base font-semibold bg-white/5 border border-white/5 rounded-xl px-4 py-2.5">
                {currentProject?.name}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">Project Owner</label>
              <div className="text-white text-sm bg-white/5 border border-white/5 rounded-xl px-4 py-2.5">
                {currentProject?.ownerName}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1">Status</label>
                <div className="text-white text-sm bg-white/5 border border-white/5 rounded-xl px-4 py-2.5">
                  {currentProject?.status}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1">Progress</label>
                <div className="text-white text-sm bg-white/5 border border-white/5 rounded-xl px-4 py-2.5">
                  {currentProject?.progress}%
                </div>
              </div>
            </div>
            <div className="pt-4 border-t border-white/10">
              <label className="block text-xs font-mono uppercase tracking-wider text-[#c4b5fd] mb-1.5 font-bold">
                Connection Code
              </label>
              <div className="flex items-center gap-2 bg-black/60 border border-[#c4b5fd]/30 rounded-xl p-3 font-mono text-sm text-[#e9d5ff] font-bold tracking-widest select-all">
                {currentProject?.raw?.connection_code || 'NR-PENDING'}
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="px-6 py-2 bg-[#c4b5fd] hover:bg-[#d8b4fe] text-[#0a0812] text-sm font-semibold rounded-full shadow-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setIsModalOpen(false); }}>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Project Name</label>
              <input 
                type="text" 
                defaultValue={currentProject?.name || ''} 
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#c4b5fd] placeholder-white/30" 
                placeholder="e.g. Mobile App V2" 
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Project Owner</label>
              <input 
                type="text" 
                defaultValue={currentProject?.ownerName || ''} 
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#c4b5fd] placeholder-white/30" 
                placeholder="e.g. John Smith" 
                required 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Status</label>
                <select 
                  defaultValue={currentProject?.status || 'Planning'} 
                  className="w-full bg-[#100C1F] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#c4b5fd] appearance-none"
                >
                  <option>Planning</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                  <option>On Hold</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Progress (%)</label>
                <input 
                  type="number" 
                  min="0" 
                  max="100" 
                  defaultValue={currentProject?.progress || 0} 
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#c4b5fd] placeholder-white/30" 
                  required 
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/10">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="px-5 py-2.5 rounded-full text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="px-5 py-2.5 bg-[#c4b5fd] hover:bg-[#d8b4fe] text-[#0a0812] text-sm font-semibold rounded-full shadow-[0_0_15px_rgba(196,181,253,0.3)] transition-all"
              >
                {modalMode === 'add' ? 'Create Project' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </AdminLayout>
  );
}
