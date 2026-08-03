import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowRight, Facebook, Instagram, Twitter, Menu, Plus, Activity
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import AdminLayout from '../components/AdminLayout';
import { Skeleton } from '../components/Skeleton';

const analyticsData = [
  { time: '00:00', users: 1200, requests: 900 },
  { time: '04:00', users: 2100, requests: 1400 },
  { time: '08:00', users: 800, requests: 600 },
  { time: '12:00', users: 1600, requests: 1100 },
  { time: '16:00', users: 2400, requests: 1800 },
  { time: '20:00', users: 3200, requests: 2600 },
  { time: '24:00', users: 2800, requests: 2200 },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    // Assuming simple role check logic can be added later
    // if (!token) {
    //   navigate('/login');
    // }
    
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <AdminLayout>
        
        {/* Real-time Analytics Summary Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-6 md:mt-10 px-2 md:px-6"
        >
          <div className="w-full bg-white/5 border border-white/10 rounded-[2rem] p-6 md:p-8 backdrop-blur-md shadow-lg flex flex-col lg:flex-row gap-8 lg:items-center">
            {/* KPI Metrics */}
            <div className="flex flex-col gap-6 lg:w-1/3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-violet-400" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-white">Project Performance</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {isLoading ? (
                  <>
                    <Skeleton className="h-[76px] rounded-2xl" />
                    <Skeleton className="h-[76px] rounded-2xl" />
                  </>
                ) : (
                  <>
                    <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                      <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-1">Active Users</p>
                      <p className="text-3xl font-bold text-white">3,200<span className="text-sm text-emerald-400 ml-2">↑ 12%</span></p>
                    </div>
                    <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                      <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-1">Requests</p>
                      <p className="text-3xl font-bold text-white">2.6k<span className="text-sm text-emerald-400 ml-2">↑ 8%</span></p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Recharts Graph */}
            <div className="h-[200px] lg:h-[250px] flex-1 w-full min-w-0">
              {isLoading ? (
                <Skeleton className="w-full h-full rounded-2xl" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analyticsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D946EF" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#D946EF" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                    <XAxis 
                      dataKey="time" 
                      stroke="rgba(255,255,255,0.3)" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      dy={10}
                    />
                    <YAxis 
                      stroke="rgba(255,255,255,0.3)" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(value) => `${value}`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(10, 7, 24, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem', color: '#fff' }}
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
              transition={{ delay: 0.4 }}
              className="text-5xl md:text-7xl lg:text-[5.5rem] font-bold leading-[0.95] tracking-tight mb-8 text-white"
            >
              Platform<br />
              admin<br />
              control
            </motion.h1>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="relative flex items-center w-full max-w-md"
            >
              <input 
                type="text" 
                placeholder="Search users, projects, or settings" 
                className="w-full pl-6 pr-14 py-4 rounded-full border border-white/20 bg-white/5 text-white text-sm font-medium placeholder-white/50 focus:outline-none focus:border-violet-500 backdrop-blur-sm"
              />
              <button className="absolute right-2 w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform">
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          </div>

          {/* Middle Column (Widgets) */}
          <div className="lg:col-span-6 flex flex-col md:flex-row gap-6 mt-4 lg:mt-0 lg:pt-16">
            
            {/* Dark Widget */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex-1 bg-white/5 border border-white/10 rounded-[2rem] p-6 text-white flex flex-col justify-between shadow-lg relative overflow-hidden backdrop-blur-md"
            >
              {isLoading ? (
                <Skeleton className="absolute inset-0 m-6 rounded-xl" />
              ) : (
                <>
                  <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                    <ArrowRight className="w-3.5 h-3.5 text-white/70 rotate-[-45deg]" />
                  </div>
                  
                  <div className="mt-4 mb-8">
                    <h3 className="text-4xl font-bold mb-2">15.2 k</h3>
                    <p className="text-xs text-white/50">Total Active Users</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <span className="px-4 py-1.5 rounded-full border border-white/20 text-[10px] uppercase tracking-wider">Growth</span>
                    <span className="px-4 py-1.5 rounded-full border border-white/20 text-[10px] uppercase tracking-wider">Metrics</span>
                  </div>
                </>
              )}
            </motion.div>

            {/* Light Widget */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="flex-1 bg-violet-900/20 border border-violet-500/20 rounded-[2rem] p-6 flex flex-col justify-between shadow-lg relative overflow-hidden backdrop-blur-md"
            >
              {isLoading ? (
                <Skeleton className="absolute inset-0 m-6 rounded-xl bg-violet-500/10" />
              ) : (
                <>
                  <div className="relative z-10">
                    <h3 className="text-4xl font-bold text-violet-300 mb-2">99.9%</h3>
                    <p className="text-xs text-violet-300/70 font-medium">System Uptime</p>
                  </div>
                  
                  {/* Fake Graph */}
                  <div className="absolute bottom-0 left-0 right-0 h-24 opacity-40">
                    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full stroke-violet-400 fill-none">
                      <path d="M0,40 Q10,30 20,35 T40,20 T60,25 T80,5 T100,20" strokeWidth="1" />
                      <path d="M0,40 Q10,30 20,35 T40,20 T60,25 T80,5 T100,20 L100,40 L0,40 Z" strokeWidth="0" className="fill-violet-400/20" />
                    </svg>
                  </div>
                </>
              )}
            </motion.div>
          </div>

          {/* Right Column (Socials) */}
          <div className="lg:col-span-1 flex lg:flex-col justify-center lg:items-end gap-3 mt-6 lg:mt-0 lg:pt-16">
            <button className="w-10 h-10 rounded-full border border-white/20 bg-white/5 text-white flex items-center justify-center hover:bg-white/10 transition-colors">
              <Facebook className="w-4 h-4" />
            </button>
            <button className="w-10 h-10 rounded-full border border-white/20 bg-white/5 text-white flex items-center justify-center hover:bg-white/10 transition-colors">
              <Instagram className="w-4 h-4" />
            </button>
            <button className="w-10 h-10 rounded-full border border-white/20 bg-white/5 text-white flex items-center justify-center hover:bg-white/10 transition-colors">
              <Twitter className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Bottom Section (Projects) */}
        <div className="mt-12 md:mt-20 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 px-2 md:px-6 pb-6">
          
          <div className="lg:col-span-4 h-64 md:h-[320px] rounded-[2rem] bg-gradient-to-tr from-[#311756] to-[#45276B] shadow-md border border-white/10 flex items-center justify-center relative overflow-hidden">
             {/* Fake 3D balls */}
             <div className="absolute w-24 h-24 rounded-full bg-white/10 backdrop-blur-md shadow-2xl border border-white/20 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
             <div className="absolute w-10 h-10 rounded-full bg-white/5 backdrop-blur-md shadow-xl border border-white/20 bottom-10 left-10"></div>
          </div>
          
          <div className="lg:col-span-4 h-64 md:h-[320px] rounded-[2rem] bg-[#1A1838] border border-white/10 shadow-md flex items-end overflow-hidden relative">
             <div className="absolute inset-0 bg-gradient-to-b from-transparent to-violet-500/10"></div>
             {/* Fake ice shapes */}
             <div className="w-full h-[60%] bg-white/10 backdrop-blur-md rounded-t-[3rem] translate-y-10 skew-y-6 transform-origin-bottom border-t border-white/20"></div>
          </div>
          
          <div className="lg:col-span-4 flex flex-col justify-center px-4 md:px-8 py-8 lg:py-0 relative">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
              System<br />settings
            </h2>
            <p className="text-xs font-medium text-white/60 leading-relaxed max-w-[250px]">
              Manage global configurations, user roles, security policies, and monitor system performance from a centralized hub.
            </p>
            
            {/* Circular text graphic */}
            <div className="absolute top-0 right-0 lg:top-[-40px] lg:right-[-20px] w-28 h-28 opacity-60">
              <svg viewBox="0 0 100 100" className="w-full h-full animate-[spin_20s_linear_infinite]">
                <path id="circle" d="M 50, 50 m -37, 0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" fill="transparent" />
                <text className="text-[10px] uppercase font-bold tracking-widest fill-white">
                  <textPath href="#circle">
                    Centralized platform administration and global management.
                  </textPath>
                </text>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center font-bold text-xl text-white">*</div>
            </div>
            
            <Link to="#" className="mt-8 flex items-center gap-2 text-sm font-bold w-fit group text-white">
              Open Settings
              <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus className="w-4 h-4" />
              </div>
            </Link>
          </div>

        </div>
    </AdminLayout>
  );
}

