import React, { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Calendar,
  Folder,
  HelpCircle,
  LogOut,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react';

const tabs = [
  { to: '/admin/dashboard', label: 'Overview' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/companies', label: 'Companies' },
  { to: '/admin/projects', label: 'Projects' },
];

function getInitials() {
  try {
    const stored = localStorage.getItem('user');
    if (stored) {
      const parsed = JSON.parse(stored);
      const name = `${parsed.first_name || ''} ${parsed.last_name || ''}`.trim() || parsed.username || parsed.email || 'A';
      return name
        .split(/\s+/)
        .map((part: string) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    }
  } catch {
    // ignore
  }
  return 'AD';
}

export default function AdminNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const initials = useMemo(getInitials, []);

  const iconBtn =
    'w-9 h-9 rounded-full bg-[#141024]/80 border border-[#c4b5fd]/20 text-[#d8b4fe]/80 hover:text-white hover:bg-[#c4b5fd]/20 hover:border-[#c4b5fd]/45 transition-colors flex items-center justify-center';

  return (
    <header className="px-4 sm:px-6 md:px-8 pt-4 md:pt-5 pb-2">
      <div className="flex items-center justify-between gap-3">
        <Link to="/admin/dashboard" className="flex items-center gap-2 shrink-0 group">
          <Sparkles className="w-4 h-4 text-[#c4b5fd] group-hover:text-[#e9d5ff] transition-colors" strokeWidth={1.75} />
          <span className="text-sm font-semibold tracking-tight text-white">noir</span>
          <span className="text-[10px] tracking-wider uppercase font-semibold px-2.5 py-0.5 rounded-full bg-[#c4b5fd]/15 text-[#e9d5ff] border border-[#c4b5fd]/30 shadow-[0_0_10px_rgba(196,181,253,0.15)]">
            Admin
          </span>
        </Link>

        <nav className="hidden md:flex items-center bg-black/70 border border-[#c4b5fd]/20 rounded-full p-1 shadow-inner">
          {tabs.map((tab) => {
            const active = location.pathname === tab.to;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={`px-5 py-1.5 rounded-full text-[13px] font-medium transition-all ${
                  active
                    ? 'bg-gradient-to-r from-[#b185db] to-[#c4b5fd] text-[#0a0812] font-semibold shadow-[0_0_20px_rgba(196,181,253,0.45)]'
                    : 'text-[#e9d5ff]/60 hover:text-white hover:bg-[#c4b5fd]/10'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button type="button" className={`${iconBtn} hidden sm:flex`} aria-label="Search">
            <Search className="w-4 h-4" strokeWidth={1.6} />
          </button>
          <button type="button" className={`${iconBtn} hidden lg:flex`} aria-label="Calendar">
            <Calendar className="w-4 h-4" strokeWidth={1.6} />
          </button>
          <button type="button" className={`${iconBtn} hidden lg:flex`} aria-label="Folders">
            <Folder className="w-4 h-4" strokeWidth={1.6} />
          </button>
          <button type="button" className={`${iconBtn} hidden sm:flex`} aria-label="Notifications">
            <Bell className="w-4 h-4" strokeWidth={1.6} />
          </button>
          <button type="button" className={`${iconBtn} hidden md:flex`} aria-label="Help">
            <HelpCircle className="w-4 h-4" strokeWidth={1.6} />
          </button>
          <button type="button" className={`${iconBtn} hidden md:flex`} aria-label="Settings">
            <Settings className="w-4 h-4" strokeWidth={1.6} />
          </button>
          <button
            type="button"
            onClick={() => navigate('/logout')}
            className={iconBtn}
            aria-label="Log out"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.6} />
          </button>
          <div className="w-9 h-9 rounded-full overflow-hidden border border-[#c4b5fd]/40 bg-gradient-to-br from-[#3b2d54] to-[#161224] flex items-center justify-center text-[11px] font-semibold text-[#f3e8ff] shadow-[0_0_14px_rgba(196,181,253,0.25)] ml-1">
            {initials}
          </div>
        </div>
      </div>

      <nav className="flex md:hidden gap-1 overflow-x-auto pt-3">
        {tabs.map((tab) => {
          const active = location.pathname === tab.to;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                active
                  ? 'bg-gradient-to-r from-[#b185db] to-[#c4b5fd] text-[#0a0812] font-semibold shadow-[0_0_15px_rgba(196,181,253,0.4)]'
                  : 'text-[#e9d5ff]/60 bg-[#141024]/60 border border-[#c4b5fd]/20 hover:text-white'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
