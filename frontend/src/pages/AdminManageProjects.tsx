import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import AdminLayout from '../components/AdminLayout';
import { Search, FolderPlus, MoreVertical, Layout, ArrowRight, Edit2, Trash2, Eye } from 'lucide-react';
import Modal from '../components/Modal';
import { Skeleton } from '../components/Skeleton';

const mockProjects = [
  { id: 1, name: 'E-commerce Platform', owner: 'Amal Kumar', status: 'In Progress', progress: 65, lastUpdated: '2 hours ago' },
  { id: 2, name: 'Brand Identity', owner: 'Jane Doe', status: 'Completed', progress: 100, lastUpdated: '1 day ago' },
  { id: 3, name: 'Mobile App V2', owner: 'John Smith', status: 'Planning', progress: 15, lastUpdated: '3 days ago' },
];

export default function AdminManageProjects() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [currentProject, setCurrentProject] = useState<any>(null);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
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
    console.log('View project:', project);
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-full border border-white/20 bg-white/5 text-white text-sm font-medium placeholder-white/50 focus:outline-none focus:border-violet-500 backdrop-blur-sm"
                />
              </div>
              <button 
                onClick={handleAdd}
                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-full shadow-lg transition-colors flex items-center gap-2"
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
            ) : (
              mockProjects.map((project) => (
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
                  <p className="text-sm text-white/50 mb-6">Owner: {project.owner}</p>
                  
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
              Showing <span className="font-medium text-white">1</span> to <span className="font-medium text-white">3</span> of <span className="font-medium text-white">3</span> results
            </div>
            <div className="flex items-center gap-2">
              <button disabled className="px-3 py-1.5 rounded-lg border border-white/10 text-sm font-medium text-white/50 bg-white/5 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Previous
              </button>
              <div className="flex items-center gap-1">
                <button className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-500/20 text-violet-300 text-sm font-medium border border-violet-500/30">
                  1
                </button>
                <button className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-colors text-sm font-medium">
                  2
                </button>
                <button className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-colors text-sm font-medium">
                  3
                </button>
              </div>
              <button className="px-3 py-1.5 rounded-lg border border-white/10 text-sm font-medium text-white/70 bg-white/5 hover:bg-white/10 hover:text-white transition-colors">
                Next
              </button>
            </div>
          </div>
        </motion.div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === 'add' ? 'Add New Project' : 'Edit Project'}
      >
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
              defaultValue={currentProject?.owner || ''} 
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
      </Modal>
    </AdminLayout>
  );
}
