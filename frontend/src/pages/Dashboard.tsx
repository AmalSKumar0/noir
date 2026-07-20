import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Plus, Download, Terminal, Settings, Activity, Clock, Folder, Code2, Copy, Check } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

interface Project {
  id: string;
  name: string;
  status: 'active' | 'archived' | 'error';
  lastUpdated: string;
  environments: number;
}

export default function Dashboard() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('access_token');
    if (!token) {
      navigate('/login');
      return;
    }

    // Mock projects for now
    setProjects([
      {
        id: 'prj-1',
        name: 'Nexus API Gateway',
        status: 'active',
        lastUpdated: '2 hours ago',
        environments: 3
      },
      {
        id: 'prj-2',
        name: 'Quantum Worker Pool',
        status: 'error',
        lastUpdated: '1 day ago',
        environments: 1
      },
      {
        id: 'prj-3',
        name: 'Starlight Frontend App',
        status: 'active',
        lastUpdated: '3 days ago',
        environments: 2
      }
    ]);
  }, [navigate]);

  const copyCommand = () => {
    navigator.clipboard.writeText('npm install -g noir-agent\nnoir-agent init');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white font-sans selection:bg-violet-600 selection:text-white pb-24">
      {/* Background gradients */}
      <div className="fixed inset-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-violet-900/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-900/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10">
        <Navbar isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} />
        
        <main className="max-w-7xl mx-auto px-6 md:px-12 pt-16 md:pt-24">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-4xl md:text-5xl font-light tracking-tight mb-3">
                Welcome back, <span className="font-medium">Engineer</span>
              </h1>
              <p className="text-stone-400 text-lg font-light tracking-wide">
                Manage your telemetry, projects, and autonomous agents.
              </p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex gap-4"
            >
              <button className="flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black font-semibold text-xs uppercase tracking-widest hover:bg-stone-200 transition-colors shadow-[0_5px_20px_rgba(139,92,246,0.15)]">
                <Plus className="w-4 h-4" />
                New Project
              </button>
            </motion.div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Projects list */}
            <div className="lg:col-span-2 space-y-6">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex items-center justify-between mb-2"
              >
                <h2 className="text-xl font-medium tracking-tight flex items-center gap-2">
                  <Folder className="w-5 h-5 text-violet-400" />
                  Your Projects
                </h2>
                <Link to="/projects" className="text-sm font-mono text-stone-400 hover:text-white transition-colors">
                  View all
                </Link>
              </motion.div>

              <div className="grid gap-4">
                {projects.map((project, idx) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 + idx * 0.1 }}
                    className="group relative p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer overflow-hidden backdrop-blur-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-medium text-white group-hover:text-violet-300 transition-colors">
                            {project.name}
                          </h3>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${
                            project.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' :
                            project.status === 'error' ? 'bg-red-500/20 text-red-300' :
                            'bg-stone-500/20 text-stone-300'
                          }`}>
                            {project.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-mono text-stone-400">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {project.lastUpdated}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5" />
                            {project.environments} envs
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <button className="p-2 rounded-full hover:bg-white/10 text-stone-400 hover:text-white transition-colors">
                          <Settings className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {/* Hover gradient effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-600/0 via-violet-600/0 to-violet-600/5 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out"></div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right Column: Agent & Instructions */}
            <div className="space-y-6">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <h2 className="text-xl font-medium tracking-tight flex items-center gap-2 mb-6">
                  <Terminal className="w-5 h-5 text-violet-400" />
                  Agent Tools
                </h2>

                <div className="p-6 rounded-2xl bg-violet-950/20 border border-violet-500/20 backdrop-blur-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/20 blur-[50px] rounded-full"></div>
                  
                  <div className="relative z-10">
                    <h3 className="text-lg font-medium text-white mb-2">Download CLI Agent</h3>
                    <p className="text-sm text-stone-400 font-light mb-6">
                      Deploy the autonomous reliability agent to your local environment or CI/CD pipeline.
                    </p>
                    
                    <button className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-sm transition-colors shadow-[0_0_20px_rgba(124,58,237,0.3)]">
                      <Download className="w-4 h-4" />
                      Download Agent Binary
                    </button>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm"
              >
                <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-stone-400" />
                  Quick Start Guide
                </h3>
                
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-mono text-stone-300">1</div>
                      <h4 className="text-sm font-medium text-white">Install via NPM</h4>
                    </div>
                    <div className="relative group">
                      <pre className="p-3 rounded-lg bg-black border border-white/10 text-xs font-mono text-stone-300 overflow-x-auto">
                        <code className="block">npm install -g noir-agent</code>
                        <code className="block text-violet-400 mt-1">noir-agent init</code>
                      </pre>
                      <button 
                        onClick={copyCommand}
                        className="absolute top-2 right-2 p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-stone-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-mono text-stone-300">2</div>
                      <h4 className="text-sm font-medium text-white">Authenticate</h4>
                    </div>
                    <p className="text-xs text-stone-400 font-light ml-9">
                      Run <code className="text-violet-300 font-mono">noir-agent auth</code> to link your local workspace to this dashboard.
                    </p>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-mono text-stone-300">3</div>
                      <h4 className="text-sm font-medium text-white">Start Monitoring</h4>
                    </div>
                    <p className="text-xs text-stone-400 font-light ml-9">
                      Execute <code className="text-violet-300 font-mono">noir-agent start</code> in your project directory to begin autonomous telemetry gathering.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
