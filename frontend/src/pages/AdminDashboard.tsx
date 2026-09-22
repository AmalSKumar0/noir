import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Building2,
  FolderKanban,
  Plus,
  Users,
} from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { checkAndRefreshToken } from '../utils/auth';
import { apiFetch } from '../utils/api';

type ActivityKind = 'user' | 'company' | 'project';
type StatusFilter = 'all' | 'users' | 'companies' | 'projects';

interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  subtitle: string;
  status: string;
  amountLabel: string;
  daysLabel: string;
  raw: any;
}

const AVATAR_COLORS = ['#f4c7b8', '#c9e4de', '#d4c1ec', '#f7d6a6', '#b8d4f4', '#e8c4d4'];

const DEMO_USERS = [
  { id: 404, first_name: 'Maya', last_name: 'Chen', username: 'maya', email: 'maya@noir.ai', role: 'developer', is_active: true, date_joined: '2026-09-17T10:00:00Z', social: [{ provider: 'github' }] },
  { id: 436, first_name: 'Leo', last_name: 'Park', username: 'leo', email: 'leo@noir.ai', role: 'developer', is_active: true, date_joined: '2026-08-12T10:00:00Z', social: [{ provider: 'google' }] },
  { id: 427, first_name: 'Aria', last_name: 'Jones', username: 'aria', email: 'aria@bluerock.io', role: 'company', is_active: true, date_joined: '2026-09-18T10:00:00Z', social: [] },
  { id: 424, first_name: 'Noah', last_name: 'Iyer', username: 'noah', email: 'noah@noir.ai', role: 'developer', is_active: false, date_joined: '2026-07-05T10:00:00Z', social: [] },
  { id: 417, first_name: 'Sable', last_name: 'Ortiz', username: 'sable', email: 'sable@noir.ai', role: 'admin', is_active: true, date_joined: '2026-06-02T10:00:00Z', social: [{ provider: 'password' }] },
];

const DEMO_COMPANIES = [
  { id: 12, company_name: 'BlueRock', industry: 'CRM Development', status: 'pending', user_email: 'aria@bluerock.io', size: '51-200', created_at: '2026-09-18T10:00:00Z' },
  { id: 8, company_name: 'Helix Labs', industry: 'Security', status: 'approved', user_email: 'ops@helix.dev', size: '11-50', created_at: '2026-08-01T10:00:00Z' },
  { id: 4, company_name: 'Northwind', industry: 'Analytics', status: 'rejected', user_email: 'it@northwind.io', size: '201-500', created_at: '2026-07-21T10:00:00Z' },
];

const DEMO_PROJECTS = [
  { id: 177210, title: 'Concept Development', status: 'active', updated_at: '2026-09-20T10:00:00Z', owner: { username: 'Aria Jones', email: 'aria@bluerock.io' }, connection_code: 'NR-427012' },
  { id: 711221, title: 'CRM Integration', status: 'active', updated_at: '2026-09-19T10:00:00Z', owner: { username: 'Maya Chen', email: 'maya@noir.ai' }, connection_code: 'NR-711221' },
];

function initials(value: string) {
  return (value || 'NA')
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2);
}

function daysAgo(iso?: string) {
  if (!iso) return 'Recently';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'Recently';
  const days = Math.max(0, Math.floor((Date.now() - then) / 86400000));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function formatCount(n: number) {
  return n.toLocaleString();
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [companies, setCompanies] = useState<any[]>([]);
  const [companyCount, setCompanyCount] = useState(0);
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const token = await checkAndRefreshToken();
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
        const headers = {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        const [usersRes, companiesRes, projectsRes] = await Promise.all([
          apiFetch(`${baseUrl}/api/user/all/?page=1&page_size=20`, { headers }),
          apiFetch(`${baseUrl}/api/accounts/admin/companies/?page=1&page_size=20`, { headers }),
          apiFetch(`${baseUrl}/api/project/all/`, { headers }),
        ]);

        if (cancelled) return;

        if (usersRes.ok) {
          const data = await usersRes.json();
          const list = Array.isArray(data) ? data : data.results || [];
          setUsers(list);
          setUserCount(typeof data.count === 'number' ? data.count : list.length);
        } else {
          setUsers(DEMO_USERS);
          setUserCount(DEMO_USERS.length);
        }

        if (companiesRes.ok) {
          const data = await companiesRes.json();
          const list = Array.isArray(data) ? data : data.results || [];
          setCompanies(list);
          setCompanyCount(typeof data.count === 'number' ? data.count : list.length);
        } else {
          setCompanies(DEMO_COMPANIES);
          setCompanyCount(DEMO_COMPANIES.length);
        }

        if (projectsRes.ok) {
          const data = await projectsRes.json();
          const list = Array.isArray(data) ? data : data.results || [];
          setProjects(list);
        } else {
          setProjects(DEMO_PROJECTS);
        }
      } catch (err) {
        console.error('Failed to load admin overview', err);
        setUsers(DEMO_USERS);
        setUserCount(DEMO_USERS.length);
        setCompanies(DEMO_COMPANIES);
        setCompanyCount(DEMO_COMPANIES.length);
        setProjects(DEMO_PROJECTS);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const inactiveUsers = users.filter((u) => u.is_active === false).length;
  const pendingCompanies = companies.filter((c) => c.status === 'pending').length;
  const activeProjects = projects.filter((p) => p.status === 'active').length;
  const avgJoinDays = useMemo(() => {
    const dates = users
      .map((u) => (u.date_joined ? new Date(u.date_joined).getTime() : NaN))
      .filter((t) => !Number.isNaN(t));
    if (!dates.length) return 12;
    const avgAge = dates.reduce((sum, t) => sum + (Date.now() - t), 0) / dates.length;
    return Math.max(1, Math.round(avgAge / 86400000));
  }, [users]);

  const monthBars = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 4 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (3 - i), 1);
      return {
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleString('en-US', { month: 'short' }),
        users: [] as any[],
      };
    });
    users.forEach((u) => {
      if (!u.date_joined) return;
      const d = new Date(u.date_joined);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const bucket = months.find((m) => m.key === key);
      if (bucket) bucket.users.push(u);
    });
    const max = Math.max(1, ...months.map((m) => m.users.length));
    return months.map((m) => ({
      ...m,
      fill: Math.max(0.12, m.users.length / max),
    }));
  }, [users]);

  const roleTiles = useMemo(() => {
    const counts = {
      developer: users.filter((u) => u.role === 'developer').length,
      company: users.filter((u) => u.role === 'company').length,
      admin: users.filter((u) => u.role === 'admin').length,
    };
    return [
      { key: 'Devs', count: counts.developer, highlight: false },
      { key: 'Orgs', count: counts.company, highlight: true },
      { key: 'Staff', count: counts.admin, highlight: false },
    ];
  }, [users]);

  const activity: ActivityItem[] = useMemo(() => {
    const userItems: ActivityItem[] = users.slice(0, 8).map((u) => {
      const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || u.email;
      return {
        id: `user-${u.id}`,
        kind: 'user',
        title: `#${String(u.id).padStart(3, '0')}`,
        subtitle: name,
        status: u.is_active === false ? 'Inactive' : 'Active',
        amountLabel: u.email || '—',
        daysLabel: daysAgo(u.date_joined),
        raw: u,
      };
    });

    const companyItems: ActivityItem[] = companies.slice(0, 8).map((c) => ({
      id: `company-${c.id}`,
      kind: 'company',
      title: `#${String(c.id).padStart(3, '0')}`,
      subtitle: c.company_name || 'Untitled company',
      status: (c.status || 'pending').replace(/^\w/, (ch: string) => ch.toUpperCase()),
      amountLabel: c.industry || c.user_email || 'Enterprise',
      daysLabel: daysAgo(c.created_at || c.updated_at),
      raw: c,
    }));

    const projectItems: ActivityItem[] = projects.slice(0, 8).map((p) => ({
      id: `project-${p.id}`,
      kind: 'project',
      title: `#${String(p.id).padStart(3, '0')}`,
      subtitle: p.title || p.name || 'Untitled project',
      status: (p.status || 'active').replace(/^\w/, (ch: string) => ch.toUpperCase()),
      amountLabel: p.owner?.username || p.owner?.email || 'Unassigned',
      daysLabel: daysAgo(p.updated_at || p.created_at),
      raw: p,
    }));

    return [...companyItems, ...userItems, ...projectItems];
  }, [users, companies, projects]);

  const filteredActivity = activity.filter((item) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'users') return item.kind === 'user';
    if (statusFilter === 'companies') return item.kind === 'company';
    return item.kind === 'project';
  });

  const selected = filteredActivity.find((item) => item.id === selectedId) || filteredActivity[0] || null;

  useEffect(() => {
    if (!filteredActivity.length) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!filteredActivity.some((item) => item.id === selectedId)) {
      setSelectedId(filteredActivity[0].id);
    }
  }, [filteredActivity, selectedId]);

  const selectedName =
    selected?.kind === 'user'
      ? `${selected.raw.first_name || ''} ${selected.raw.last_name || ''}`.trim() || selected.raw.username
      : selected?.kind === 'company'
        ? selected.raw.company_name
        : selected?.raw.title || selected?.raw.name;

  return (
    <AdminLayout>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="w-8 h-8 rounded-full bg-[#161224] border border-[#c4b5fd]/20 text-[#d8b4fe] hover:border-[#c4b5fd]/45 hover:text-white flex items-center justify-center transition-colors"
            aria-label="Back"
          >
            <span className="text-lg leading-none">‹</span>
          </button>
          <h1 className="text-[28px] md:text-[32px] font-semibold tracking-tight text-white">Overview</h1>
        </div>
        <Link
          to="/admin/users"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#161224] border border-[#c4b5fd]/30 text-[13px] text-[#e9d5ff] hover:bg-[#c4b5fd]/15 hover:border-[#c4b5fd]/50 transition-colors shadow-sm"
        >
          <span className="w-6 h-6 rounded-full bg-[#c4b5fd]/20 text-[#e9d5ff] flex items-center justify-center">
            <Plus className="w-3.5 h-3.5" />
          </span>
          Create an account
        </Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <section className="xl:col-span-7 bg-[#0f0c1a]/95 border border-[#c4b5fd]/15 rounded-[1.6rem] p-5 md:p-6 shadow-lg">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[11px] text-[#e9d5ff]/50 mb-1.5">Inactive users</p>
              <p className="text-2xl md:text-[28px] font-semibold tracking-tight text-white">
                {isLoading ? '—' : formatCount(inactiveUsers)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#e9d5ff]/50 mb-1.5">Pending companies</p>
              <p className="text-2xl md:text-[28px] font-semibold tracking-tight text-white">
                {isLoading ? '—' : formatCount(pendingCompanies)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#e9d5ff]/50 mb-1.5">Average time to join</p>
              <p className="text-2xl md:text-[28px] font-semibold tracking-tight text-white">
                {isLoading ? '—' : `${avgJoinDays} days`}
              </p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-4 gap-4">
            {monthBars.map((month) => (
              <div key={month.key}>
                <p className="text-[11px] text-[#e9d5ff]/50 mb-2">{month.label}</p>
                <div className="h-1.5 rounded-full bg-[#1e1832] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#a78bfa] to-[#c4b5fd] shadow-[0_0_8px_rgba(196,181,253,0.5)]"
                    style={{ width: `${Math.round(month.fill * 100)}%` }}
                  />
                </div>
                <div className="flex -space-x-2 mt-3 min-h-7">
                  {month.users.slice(0, 5).map((u, i) => (
                    <div
                      key={u.id || i}
                      className="w-7 h-7 rounded-full border-2 border-[#0f0c1a] flex items-center justify-center text-[9px] font-semibold text-stone-800"
                      style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                      title={`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username}
                    >
                      {initials(u.first_name || u.username || u.email || 'U')}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="xl:col-span-5 bg-[#0f0c1a]/95 border border-[#c4b5fd]/15 rounded-[1.6rem] p-5 md:p-6 flex flex-col shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] text-[#e9d5ff]/50 mb-1.5">Available workspace capacity</p>
              <p className="text-2xl md:text-[28px] font-semibold tracking-tight text-white">
                {isLoading ? '—' : formatCount(userCount + companyCount + projects.length)}
              </p>
            </div>
            <button
              type="button"
              className="w-8 h-8 rounded-full bg-[#181328] border border-[#c4b5fd]/20 text-[#d8b4fe] hover:border-[#c4b5fd]/45 flex items-center justify-center transition-colors"
              aria-label="Capacity alerts"
            >
              <Bell className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-auto pt-8 grid grid-cols-2 sm:grid-cols-[1fr_1.15fr_1fr_auto] gap-2 items-end">
            {roleTiles.map((tile) => (
              <div
                key={tile.key}
                className={`rounded-2xl px-3 py-3 min-h-[92px] flex flex-col justify-end transition-all ${
                  tile.highlight 
                    ? 'bg-gradient-to-br from-[#c4b5fd] to-[#d8b4fe] text-[#0a0812] shadow-[0_0_25px_rgba(196,181,253,0.35)] min-h-[112px] -mt-3' 
                    : 'bg-[#08060e] text-white border border-[#c4b5fd]/15'
                }`}
              >
                <p className={`text-[10px] mb-1 ${tile.highlight ? 'text-[#0a0812]/70 font-semibold' : 'text-[#e9d5ff]/50'}`}>
                  {tile.key === 'Devs' ? 'Developers' : tile.key === 'Orgs' ? 'Companies' : 'Admins'}
                </p>
                <p className="text-lg font-semibold leading-none">#{tile.count || 0}</p>
                <p className={`text-[11px] mt-1 ${tile.highlight ? 'text-[#0a0812]/80 font-semibold' : 'text-[#e9d5ff]/60'}`}>
                  {tile.key}
                </p>
              </div>
            ))}
            <Link
              to="/admin/companies"
              className="h-[42px] px-4 rounded-full bg-[#c4b5fd] hover:bg-[#d8b4fe] text-[#0a0812] text-[12px] font-semibold flex items-center justify-center whitespace-nowrap transition-all shadow-[0_0_15px_rgba(196,181,253,0.3)]"
            >
              Review now
            </Link>
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-5 mb-4">
        <span className="text-[12px] text-[#e9d5ff]/50 mr-1">Active filters</span>
        {(
          [
            ['all', 'All records'],
            ['users', 'Users'],
            ['companies', 'Companies'],
            ['projects', 'Projects'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(key)}
            className={`px-3.5 py-1.5 rounded-full text-[12px] border transition-all ${
              statusFilter === key
                ? 'bg-[#c4b5fd] border-[#c4b5fd] text-[#0a0812] font-semibold shadow-[0_0_14px_rgba(196,181,253,0.35)]'
                : 'bg-[#120f1e]/60 border-[#c4b5fd]/20 text-[#d8b4fe]/70 hover:text-white hover:border-[#c4b5fd]/45'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="relative bg-[#0c0a16] border border-[#c4b5fd]/20 rounded-[1.7rem] min-h-[340px] text-white overflow-hidden shadow-2xl">
        <div className="flex flex-col lg:flex-row">
          <div className="lg:w-[38%] p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-semibold text-white">Platform queue</h2>
              <div className="flex items-center bg-black/60 border border-[#c4b5fd]/20 rounded-full p-0.5 text-[11px] font-medium">
                <span className="px-2.5 py-1 text-[#e9d5ff]/60">Users</span>
                <span className="px-2.5 py-1 text-[#e9d5ff]/60">Companies</span>
                <span className="px-2.5 py-1 rounded-full bg-[#c4b5fd] text-[#0a0812] font-semibold shadow-[0_0_10px_rgba(196,181,253,0.3)]">Live</span>
              </div>
            </div>

            <div className="space-y-1">
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-2xl bg-[#181328] animate-pulse" />
                ))}
              {!isLoading && filteredActivity.length === 0 && (
                <p className="text-sm text-[#e9d5ff]/40 py-10 text-center">Nothing in this queue yet.</p>
              )}
              {!isLoading &&
                filteredActivity.slice(0, 6).map((item) => {
                  const active = selected?.id === item.id;
                  const name =
                    item.kind === 'user'
                      ? `${item.raw.first_name || ''} ${item.raw.last_name || ''}`.trim() || item.raw.username
                      : item.kind === 'company'
                        ? item.raw.company_name
                        : item.raw.title || item.raw.name;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-2xl text-left transition-all ${
                        active ? 'bg-[#1e1733] border border-[#c4b5fd]/35 text-white shadow-md' : 'text-white/80 hover:bg-[#141022]/80 border border-transparent'
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0"
                        style={{
                          background: active ? '#342552' : AVATAR_COLORS[Number(item.raw.id || 0) % AVATAR_COLORS.length],
                          color: active ? '#f3e8ff' : '#2d1b46',
                        }}
                      >
                        {initials(name || item.title)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium truncate">{item.title}</p>
                        <p className={`text-[10px] truncate ${active ? 'text-[#c4b5fd]' : 'text-[#e9d5ff]/50'}`}>
                          {item.status}
                        </p>
                      </div>
                      {active ? (
                        <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#c4b5fd] text-[#0a0812] font-semibold shrink-0 shadow-[0_0_8px_rgba(196,181,253,0.3)]">
                          Open
                        </span>
                      ) : (
                        <span className="text-[12px] text-[#d8b4fe]/70 shrink-0 max-w-[42%] truncate">
                          {item.kind === 'user' ? item.amountLabel : item.subtitle}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="flex-1 p-4 md:p-5 lg:pr-6 lg:py-6">
            {selected ? (
              <div className="bg-[#06050b] border border-[#c4b5fd]/20 text-white rounded-[1.5rem] p-5 md:p-6 h-full min-h-[300px] flex flex-col shadow-inner">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] text-[#e9d5ff]/50 mb-1">
                      {selected.kind === 'user' ? 'User details' : selected.kind === 'company' ? 'Company details' : 'Project details'}
                    </p>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-semibold text-white">{selected.title}</h3>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#c4b5fd]/15 text-[#e9d5ff] border border-[#c4b5fd]/30">
                        {selected.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-[#e9d5ff]/50 mb-1">
                      {selected.kind === 'company' ? 'Organization' : selected.kind === 'project' ? 'Owner' : 'Account'}
                    </p>
                    <p className="text-sm font-medium text-white">{selectedName}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-2">
                    <div className="text-right mr-1">
                      <p className="text-[11px] text-[#e9d5ff]/50">Contact</p>
                      <p className="text-[12px] text-[#e9d5ff]/80 max-w-[140px] truncate">
                        {selected.raw.email || selected.raw.user_email || selected.raw.owner?.email || '—'}
                      </p>
                    </div>
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold text-stone-800"
                      style={{ background: AVATAR_COLORS[1] }}
                    >
                      {initials(selectedName || 'NA')}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-6">
                  <div className="rounded-2xl bg-[#100d1c] border border-[#c4b5fd]/15 px-3 py-4">
                    <p className="text-[10px] text-[#c4b5fd]/70 mb-2 uppercase tracking-wide">
                      {selected.kind === 'project' ? 'Status' : selected.kind === 'company' ? 'Industry' : 'Role'}
                    </p>
                    <p className="text-sm font-medium truncate text-white">
                      {selected.kind === 'project'
                        ? selected.raw.status || 'active'
                        : selected.kind === 'company'
                          ? selected.raw.industry || '—'
                          : selected.raw.role || 'developer'}
                    </p>
                    <p className="text-[10px] text-[#e9d5ff]/40 mt-2 truncate">
                      {selected.kind === 'company' ? selected.raw.size || 'Workspace' : selected.daysLabel}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[#100d1c] border border-[#c4b5fd]/15 px-3 py-4">
                    <p className="text-[10px] text-[#c4b5fd]/70 mb-2 uppercase tracking-wide">
                      {selected.kind === 'project' ? 'Updated' : 'Created'}
                    </p>
                    <p className="text-sm font-medium text-white">
                      {selected.daysLabel}
                    </p>
                    <p className="text-[10px] text-[#e9d5ff]/40 mt-2">Queue age</p>
                  </div>
                  <div className="rounded-2xl bg-[#100d1c] border border-[#c4b5fd]/15 px-3 py-4">
                    <p className="text-[10px] text-[#c4b5fd]/70 mb-2 uppercase tracking-wide">
                      {selected.kind === 'user' ? 'Auth' : selected.kind === 'company' ? 'Review' : 'Code'}
                    </p>
                    <p className="text-sm font-medium truncate text-white">
                      {selected.kind === 'project'
                        ? selected.raw.connection_code || 'NR-PENDING'
                        : selected.kind === 'company'
                          ? selected.raw.status || 'pending'
                          : selected.raw.social?.[0]?.provider || 'password'}
                    </p>
                    <p className="text-[10px] text-[#e9d5ff]/40 mt-2">Source</p>
                  </div>
                </div>

                <div className="mt-auto pt-6 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-6 text-[12px] text-[#e9d5ff]/70">
                    <span>
                      Users <span className="text-white ml-1 font-medium">{formatCount(userCount)}</span>
                    </span>
                    <span>
                      Orgs <span className="text-white ml-1 font-medium">{formatCount(companyCount)}</span>
                    </span>
                    <span>
                      Projects <span className="text-white ml-1 font-medium">{formatCount(projects.length)}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-[#181328] border border-[#c4b5fd]/20 flex items-center justify-center">
                      {selected.kind === 'company' ? (
                        <Building2 className="w-3.5 h-3.5 text-[#c4b5fd]" />
                      ) : selected.kind === 'project' ? (
                        <FolderKanban className="w-3.5 h-3.5 text-[#c4b5fd]" />
                      ) : (
                        <Users className="w-3.5 h-3.5 text-[#c4b5fd]" />
                      )}
                    </span>
                    <Link
                      to={
                        selected.kind === 'company'
                          ? '/admin/companies'
                          : selected.kind === 'project'
                            ? '/admin/projects'
                            : '/admin/users'
                      }
                      className="h-9 px-4 rounded-full bg-[#c4b5fd] text-[#0a0812] text-[12px] font-semibold flex items-center hover:bg-[#d8b4fe] transition-all shadow-[0_0_16px_rgba(196,181,253,0.35)]"
                    >
                      Open record
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#06050b] border border-[#c4b5fd]/20 rounded-[1.5rem] h-full min-h-[300px]" />
            )}
          </div>
        </div>
      </section>
    </AdminLayout>
  );
}
