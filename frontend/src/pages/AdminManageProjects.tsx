import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import AdminLayout from '../components/AdminLayout';
import { Search, FolderPlus, MoreVertical, Layout, ArrowRight, Edit2, Trash2, Eye } from 'lucide-react';
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
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view'>('add');
  const [currentProject, setCurrentProject] = useState<any>(null);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        const mapped: Project[] = data.results.map((p: any) => ({
          id: p.id,
          name: p.title,
          ownerName: p.owner?.username || 'Unknown',
          status: p.status === 'active' ? 'Active' : p.status === 'error' ? 'Error' : 'Archived',
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
    setIsModalOpen(true);
  };

  const handleEdit = (project: any) => {
    setModalMode('edit');
    setCurrentProject(project);
    setIsModalOpen(true);
    setActiveDropdown(null);
  };

  const handleView = (project: any) => {
    setModalMode('view');
    setCurrentProject(project);
    setIsModalOpen(true);
    setActiveDropdown(null);
  };

  const handleDelete = (project: any) => {
    console.log('Delete project:', project);
    setActiveDropdown(null);
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
        className="mt-6 md:mt-10 px-2 md:px-6"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white">Manage Projects</h1>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <input 
                type="text" 
                placeholder="Search projects..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-full border border-white/20 bg-white/5 text-white text-sm font-medium placeholder-white/50 focus:outline-none focus:border-violet-500 backdrop-blur-sm"
              />
            </div>
            <button 
              onClick={handleAdd}
              className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-full shadow-lg transition-colors flex items-center gap-2 animate-pulse hover:animate-none"
            >
              <FolderPlus className="w-4 h-4" />
              New Project
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={`skeleton-${i}`} className="bg-white/5 border border-white/10 rounded-[2rem] p-6 backdrop-blur-md shadow-lg flex flex-col h-[280px]">
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
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-center bg-white/5 border border-white/10 border-dashed rounded-[2rem] p-6">
              <Layout className="w-12 h-12 text-white/20 mb-4" />
              <h3 className="text-lg font-semibold text-white">No projects found</h3>
              <p className="text-xs text-white/50 mt-1 max-w-[280px]">
                {searchQuery ? "No workspaces match your query." : "No projects exist on the platform yet."}
              </p>
            </div>
          ) : (
            filteredProjects.map((project) => (
              <div key={project.id} className="bg-white/5 border border-white/10 rounded-[2rem] p-6 backdrop-blur-md shadow-lg flex flex-col group hover:bg-white/10 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center text-violet-300">
                    <Layout className="w-6 h-6" />
                  </div>
                  <div className="relative">
                    <button 
                      onClick={() => toggleDropdown(project.id)}
                      className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    <AnimatePresence>
                      {activeDropdown === project.id && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          className="absolute right-0 top-full mt-2 w-48 bg-[#100C1F] border border-white/10 rounded-xl shadow-xl overflow-hidden z-10"
                        >
                          <button onClick={() => handleView(project)} className="w-full text-left px-4 py-3 text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-2">
                            <Eye className="w-4 h-4" />
                            View Details
                          </button>
                          <button onClick={() => handleEdit(project)} className="w-full text-left px-4 py-3 text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-2">
                            <Edit2 className="w-4 h-4" />
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
                <p className="text-sm text-white/50 mb-6">Owner: {project.ownerName}</p>
                
                <div className="mt-auto">
                  <div className="flex justify-between text-xs font-medium text-white/70 mb-2">
                    <span>{project.status}</span>
                    <span>{project.progress}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5 mb-4 overflow-hidden">
                    <div 
                      className="bg-violet-400 h-1.5 rounded-full" 
                      style={{ width: `${project.progress}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-4 border-t border-white/10">
                    <span className="text-xs text-white/40">Updated {project.lastUpdated}</span>
                    <button onClick={() => handleView(project)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/70 hover:bg-white hover:text-black transition-all group-hover:scale-110">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="flex flex-col sm:flex-row items-center justify-between mt-8 px-2 gap-4">
          <div className="text-sm text-white/50">
            Showing <span className="font-medium text-white">
              {filteredProjects.length > 0 ? 1 : 0}
            </span> to <span className="font-medium text-white">
              {filteredProjects.length}
            </span> of <span className="font-medium text-white">
              {projects.length}
            </span> results
          </div>
          <div className="flex items-center gap-2">
            <button disabled className="px-3 py-1.5 rounded-lg border border-white/10 text-sm font-medium text-white/50 bg-white/5 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              Previous
            </button>
            <div className="flex items-center gap-1">
              <button className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-500/20 text-violet-300 text-sm font-medium border border-violet-500/30">
                1
              </button>
            </div>
            <button disabled className="px-3 py-1.5 rounded-lg border border-white/10 text-sm font-medium text-white/50 bg-white/5 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              Next
            </button>
          </div>
        </div>
      </motion.div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === 'add' ? 'Add New Project' : modalMode === 'edit' ? 'Edit Project' : 'Project Details'}
      >
        {modalMode === 'view' ? (
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
              <label className="block text-xs font-mono uppercase tracking-wider text-violet-400 mb-1.5 font-bold">
                Connection Code
              </label>
              <div className="flex items-center gap-2 bg-black/40 border border-violet-500/20 rounded-xl p-3 font-mono text-sm text-violet-300 font-bold tracking-widest select-all">
                {currentProject?.raw?.connection_code || 'NR-PENDING'}
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-full shadow-lg transition-colors"
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
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 placeholder-white/30" 
                placeholder="e.g. Mobile App V2"
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Project Owner</label>
              <input 
                type="text" 
                defaultValue={currentProject?.ownerName || ''} 
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 placeholder-white/30" 
                placeholder="e.g. John Smith"
                required 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Status</label>
                <select 
                  defaultValue={currentProject?.status || 'Planning'} 
                  className="w-full bg-[#100C1F] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 appearance-none"
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
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 placeholder-white/30" 
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
                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-full shadow-lg transition-colors"
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
