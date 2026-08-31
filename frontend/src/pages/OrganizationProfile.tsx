import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  Users, 
  Folder, 
  Globe, 
  Phone, 
  ShieldCheck, 
  Sparkles, 
  Copy, 
  Check, 
  ExternalLink, 
  UserCheck, 
  Layers, 
  FolderGit2,
  RefreshCw,
  Server
} from 'lucide-react';
import UserLayout from '../components/UserLayout';
import { Skeleton } from '../components/Skeleton';
import { apiFetch } from '../utils/api';
import { checkAndRefreshToken } from '../utils/auth';

interface CompanyData {
  id: number;
  company_name: string;
  logo: string | null;
  status: string;
  industry: string;
  company_size: string;
  website: string;
  phone_number: string;
  created_at: string;
}

interface ActiveDev {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface TeamData {
  id: number;
  name: string;
  description: string;
  members: ActiveDev[];
  projects_data: {
    id: number;
    title: string;
    architecture: string;
    status: string;
    connection_code: string;
  }[];
  created_at: string;
}

interface ProjectData {
  id: number;
  title: string;
  description: string;
  architecture: string;
  visibility: string;
  analysis_mode: string;
  status: string;
  connection_code: string;
  created_at: string;
  assigned_teams: string[];
}

export default function OrganizationProfile() {
  const navigate = useNavigate();
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [activeDevs, setActiveDevs] = useState<ActiveDev[]>([]);
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);

  const fetchOrgData = async () => {
    setIsLoading(true);
    try {
      const token = await checkAndRefreshToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };

      // Get user info
      const meRes = await apiFetch(`${baseUrl}/api/accounts/me/`, { headers });
      if (meRes.ok) {
        const meData = await meRes.json();
        setCurrentUsername(meData.username || meData.email);
      }

      const res = await apiFetch(`${baseUrl}/api/accounts/organization/`, { headers });
      if (res.ok) {
        const data = await res.json();
        setCompany(data.company || null);
        setActiveDevs(data.active_devs || []);
        setTeams(data.teams || []);
        setProjects(data.projects || []);
      }
    } catch (err) {
      console.error('Error fetching organization profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgData();
  }, []);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <UserLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mt-6 md:mt-10 px-2 md:px-6 pb-20"
      >
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8 pb-6 border-b border-white/5">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white flex items-center gap-3">
              <Building2 className="w-8 h-8 text-violet-400" />
              Organization & Teams
            </h1>
            <p className="text-xs text-white/50 font-mono mt-1 uppercase tracking-widest">
              View your company profile, assigned engineering teams, and enterprise projects
            </p>
          </div>

          <button
            onClick={fetchOrgData}
            className="p-2.5 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            title="Refresh organization data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-48 rounded-[2.5rem] bg-white/5" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton className="h-64 rounded-[2rem] bg-white/5" />
              <Skeleton className="h-64 rounded-[2rem] bg-white/5" />
            </div>
          </div>
        ) : !company ? (
          <div className="py-20 text-center bg-white/5 border border-white/10 border-dashed rounded-[2.5rem] p-8 max-w-xl mx-auto">
            <Building2 className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white">No Company Affiliation</h3>
            <p className="text-xs text-white/50 mt-1 max-w-md mx-auto font-mono leading-relaxed">
              You are not currently affiliated with an enterprise organization on Noir. If a company admin sends you an invite, accept it from your inbox notifications.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Company Hero Profile Banner */}
            <div className="relative bg-gradient-to-r from-violet-950/40 via-purple-950/20 to-black/80 border border-white/10 rounded-[2.5rem] p-8 md:p-10 backdrop-blur-xl shadow-2xl overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-violet-600/10 blur-3xl rounded-full pointer-events-none" />

              <div className="flex flex-col md:flex-row items-start md:items-center gap-6 relative z-10">
                {/* Logo */}
                <div className="w-24 h-24 rounded-3xl bg-black/60 border border-white/15 p-2 flex items-center justify-center shadow-xl flex-shrink-0">
                  {company.logo ? (
                    <img
                      src={
                        company.logo.startsWith('data:') || company.logo.startsWith('http://') || company.logo.startsWith('https://')
                          ? company.logo
                          : `${(import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/api$/, '')}${company.logo.startsWith('/') ? '' : '/'}${company.logo}`
                      }
                      alt={company.company_name}
                      className="w-full h-full object-contain rounded-2xl"
                    />
                  ) : (
                    <Building2 className="w-10 h-10 text-violet-400" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                      {company.company_name}
                    </h2>
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono uppercase tracking-wider font-semibold flex items-center gap-1.5">
                      <ShieldCheck className="w-3 h-3" />
                      {company.status} Enterprise
                    </span>
                  </div>

                  <p className="text-xs font-mono text-white/50 mt-1 flex items-center gap-4 flex-wrap">
                    <span>Industry: <strong className="text-white">{company.industry || 'Technology'}</strong></span>
                    <span>•</span>
                    <span>Company Size: <strong className="text-white">{company.company_size || 'N/A'}</strong></span>
                  </p>

                  <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/10 text-xs text-white/70 flex-wrap">
                    {company.website && (
                      <a
                        href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-violet-400 hover:text-violet-300 font-mono transition-colors"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>{company.website.replace(/^https?:\/\//, '')}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {company.phone_number && (
                      <div className="flex items-center gap-1.5 text-white/60 font-mono">
                        <Phone className="w-3.5 h-3.5" />
                        <span>{company.phone_number}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-white/60 font-mono ml-auto">
                      <Users className="w-3.5 h-3.5 text-violet-400" />
                      <span>{activeDevs.length} Active Engineers</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 1: Developer Teams & Assigned Projects */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    <FolderGit2 className="w-5 h-5 text-violet-400" />
                    <span>Company Developer Teams</span>
                  </h2>
                  <p className="text-xs text-white/50 font-mono mt-0.5">
                    Engineering squads and assigned project responsibilities
                  </p>
                </div>
                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-mono text-white/60">
                  {teams.length} Teams
                </span>
              </div>

              {teams.length === 0 ? (
                <div className="py-12 text-center bg-white/5 border border-white/10 border-dashed rounded-[2rem] p-6">
                  <FolderGit2 className="w-8 h-8 text-white/20 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-white/70">No Developer Teams Created Yet</p>
                  <p className="text-[10px] font-mono text-white/30 mt-1">
                    Your company admin can organize engineers into teams and assign projects.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {teams.map((team) => {
                    const isMember = team.members.some(
                      (m) => m.username === currentUsername || m.email === currentUsername
                    );

                    return (
                      <motion.div
                        key={team.id}
                        whileHover={{ y: -3 }}
                        className={`rounded-[2rem] p-6 border backdrop-blur-xl transition-all ${
                          isMember
                            ? 'bg-gradient-to-br from-violet-950/30 to-black/60 border-violet-500/40 shadow-xl'
                            : 'bg-white/5 border-white/10'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-bold text-white">{team.name}</h3>
                              {isMember && (
                                <span className="px-2.5 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/40 text-violet-300 text-[10px] font-mono font-bold">
                                  Your Team
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-white/60 font-light mt-1">
                              {team.description || 'No description specified.'}
                            </p>
                          </div>
                        </div>

                        {/* Members */}
                        <div className="mt-4 pt-4 border-t border-white/5">
                          <p className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-2">
                            Team Engineers ({team.members.length})
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {team.members.map((m) => (
                              <span
                                key={m.id}
                                className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/80 text-xs font-mono flex items-center gap-1.5"
                              >
                                <UserCheck className="w-3 h-3 text-emerald-400" />
                                {m.first_name || m.last_name ? `${m.first_name} ${m.last_name}`.trim() : m.username}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Assigned Projects */}
                        <div className="mt-4 pt-4 border-t border-white/5">
                          <p className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-2">
                            Assigned Projects ({team.projects_data.length})
                          </p>
                          {team.projects_data.length === 0 ? (
                            <p className="text-xs font-mono text-white/30 italic">No projects assigned to this team.</p>
                          ) : (
                            <div className="space-y-2">
                              {team.projects_data.map((p) => (
                                <div
                                  key={p.id}
                                  className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-3"
                                >
                                  <div>
                                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                                      <Server className="w-3.5 h-3.5 text-violet-400" />
                                      {p.title}
                                    </h4>
                                    <p className="text-[9px] font-mono text-white/40 uppercase mt-0.5">
                                      Arch: {p.architecture} • Status: {p.status}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleCopyCode(p.connection_code)}
                                      className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-colors"
                                      title="Copy Connection Code"
                                    >
                                      {copiedCode === p.connection_code ? (
                                        <Check className="w-3 h-3 text-emerald-400" />
                                      ) : (
                                        <Copy className="w-3 h-3 text-white/40" />
                                      )}
                                      <span>{p.connection_code}</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECTION 2: All Company Projects Roster */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    <Folder className="w-5 h-5 text-violet-400" />
                    <span>Company Projects Overview</span>
                  </h2>
                  <p className="text-xs text-white/50 font-mono mt-0.5">
                    All telemetry workloads owned by {company.company_name}
                  </p>
                </div>
                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-mono text-white/60">
                  {projects.length} Projects
                </span>
              </div>

              {projects.length === 0 ? (
                <div className="py-12 text-center bg-white/5 border border-white/10 border-dashed rounded-[2rem] p-6">
                  <Folder className="w-8 h-8 text-white/20 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-white/70">No Company Projects Found</p>
                  <p className="text-[10px] font-mono text-white/30 mt-1">
                    Projects created by company admins will be displayed here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects.map((prj) => (
                    <motion.div
                      key={prj.id}
                      whileHover={{ y: -3 }}
                      className="bg-white/5 border border-white/10 hover:border-white/20 rounded-[2rem] p-6 backdrop-blur-xl transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <h3 className="text-base font-bold text-white flex items-center gap-2 truncate">
                            <Server className="w-4 h-4 text-violet-400" />
                            {prj.title}
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-mono uppercase font-semibold">
                            {prj.status}
                          </span>
                        </div>

                        <p className="text-xs text-white/60 line-clamp-2 font-light mb-4">
                          {prj.description || 'No description provided.'}
                        </p>

                        {/* Assigned Teams Badges */}
                        {prj.assigned_teams && prj.assigned_teams.length > 0 && (
                          <div className="mb-4">
                            <p className="text-[9px] font-mono text-white/40 uppercase mb-1">Assigned Teams:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {prj.assigned_teams.map((tName, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 bg-violet-500/15 border border-violet-500/30 text-violet-300 text-[9px] font-mono rounded-md"
                                >
                                  {tName}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-mono text-white/80">
                          <span className="text-white/40 text-[10px]">Key:</span>
                          <span className="bg-black/60 px-2 py-1 rounded-md border border-white/10 text-[10px]">
                            {prj.connection_code}
                          </span>
                          <button
                            onClick={() => handleCopyCode(prj.connection_code)}
                            className="p-1 hover:text-white text-white/40 cursor-pointer"
                            title="Copy code"
                          >
                            {copiedCode === prj.connection_code ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION 3: Active Engineers Roster */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-emerald-400" />
                    <span>Company Engineers Roster</span>
                  </h2>
                  <p className="text-xs text-white/50 font-mono mt-0.5">
                    Active team members on the {company.company_name} engineering roster
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {activeDevs.map((dev) => (
                  <div
                    key={dev.id}
                    className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300 font-bold text-sm">
                      {dev.username.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="text-xs font-bold text-white truncate">
                        {dev.first_name || dev.last_name ? `${dev.first_name} ${dev.last_name}`.trim() : dev.username}
                      </h4>
                      <p className="text-[10px] font-mono text-white/50 truncate">{dev.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </UserLayout>
  );
}
