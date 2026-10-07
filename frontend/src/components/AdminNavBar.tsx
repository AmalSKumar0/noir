import React, { useMemo, useState, useEffect } from 'react';
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
  Users,
  Building2,
  Home,
  Menu,
  X,
  ArrowRight,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const tabs = [
  { to: '/admin/dashboard', label: 'Overview', icon: Home },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/companies', label: 'Companies', icon: Building2 },
  { to: '/admin/projects', label: 'Projects', icon: Folder },
  { to: '/download', label: 'Download CLI', icon: Download },
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const iconBtn =
    'w-9 h-9 rounded-full bg-[#141024]/80 border border-[#c4b5fd]/20 text-[#d8b4fe]/80 hover:text-white hover:bg-[#c4b5fd]/20 hover:border-[#c4b5fd]/45 transition-colors flex items-center justify-center';

  return (
    <header className="px-4 sm:px-6 md:px-8 pt-3 sm:pt-4 md:pt-5 pb-2 relative z-50">
      <div className="flex items-center justify-between gap-3">
        {/* Brand Logo & Context */}
        <Link 
          to="/admin/dashboard" 
          className="flex items-center gap-2 shrink-0 group"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <Sparkles className="w-4 h-4 text-[#c4b5fd] group-hover:text-[#e9d5ff] transition-colors" strokeWidth={1.75} />
          <span className="text-sm font-semibold tracking-tight text-white">noir</span>
          <span className="text-[10px] tracking-wider uppercase font-semibold px-2.5 py-0.5 rounded-full bg-[#c4b5fd]/15 text-[#e9d5ff] border border-[#c4b5fd]/30 shadow-[0_0_10px_rgba(196,181,253,0.15)]">
            Admin
          </span>
        </Link>

        {/* Desktop Navigation Tabs (hidden on mobile) */}
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

        {/* Desktop Controls (hidden on mobile) */}
        <div className="hidden md:flex items-center gap-1.5 sm:gap-2">
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
          <button type="button" className={`${iconBtn}`} aria-label="Help">
            <HelpCircle className="w-4 h-4" strokeWidth={1.6} />
          </button>
          <button type="button" className={`${iconBtn}`} aria-label="Settings">
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

        {/* Mobile Header Controls (md:hidden) */}
        <div className="flex md:hidden items-center gap-2">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-[#c4b5fd]/40 bg-gradient-to-br from-[#3b2d54] to-[#161224] flex items-center justify-center text-[10px] font-semibold text-[#f3e8ff]">
            {initials}
          </div>

          <motion.button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#141024]/90 border border-[#c4b5fd]/30 text-[#e9d5ff] hover:text-white transition-all shadow-md focus:outline-none"
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <X className="w-4.5 h-4.5 text-[#c4b5fd]" />
            ) : (
              <Menu className="w-4.5 h-4.5 text-[#e9d5ff]" />
            )}
          </motion.button>
        </div>
      </div>

      {/* Mobile Drawer Menu (md:hidden) */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden fixed inset-0 top-[60px] bg-black/75 backdrop-blur-md z-40"
            />

            {/* Mobile Sheet Menu */}
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="md:hidden absolute top-full left-0 right-0 mx-4 mt-2 bg-[#0d0a1a]/95 backdrop-blur-2xl border border-[#c4b5fd]/30 rounded-2xl p-4 shadow-[0_24px_50px_rgba(0,0,0,0.9),0_0_40px_rgba(196,181,253,0.18)] z-50 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-[#c4b5fd]/20">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-[#d8b4fe]/80">Admin Navigation</span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-[#c4b5fd]/20 text-[#e9d5ff] border border-[#c4b5fd]/30">
                  Superadmin
                </span>
              </div>

              {/* Navigation Tabs */}
              <div className="flex flex-col gap-1.5">
                {tabs.map((tab) => {
                  const active = location.pathname === tab.to;
                  const Icon = tab.icon;
                  return (
                    <Link
                      key={tab.to}
                      to={tab.to}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center justify-between p-3 rounded-xl transition-all text-sm font-medium ${
                        active
                          ? 'bg-gradient-to-r from-[#b185db]/25 to-[#c4b5fd]/25 border border-[#c4b5fd]/50 text-white shadow-[0_0_15px_rgba(196,181,253,0.25)]'
                          : 'bg-[#141024]/60 hover:bg-[#c4b5fd]/15 border border-[#c4b5fd]/15 text-[#e9d5ff]/70 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${active ? 'text-[#c4b5fd]' : 'text-[#d8b4fe]/60'}`} strokeWidth={1.75} />
                        <span>{tab.label}</span>
                      </div>
                      <ArrowRight className={`w-3.5 h-3.5 ${active ? 'text-[#c4b5fd]' : 'text-[#d8b4fe]/30'}`} />
                    </Link>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="pt-2.5 border-t border-[#c4b5fd]/20 flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-[#141024]/80 border border-[#c4b5fd]/20 text-[#d8b4fe] hover:text-white transition-all text-xs font-medium"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>Alerts</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-[#141024]/80 border border-[#c4b5fd]/20 text-[#d8b4fe] hover:text-white transition-all text-xs font-medium"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Settings</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    navigate('/logout');
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 hover:text-red-200 hover:bg-red-500/20 transition-all text-xs font-medium cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out of Admin</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
