import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Folder, Code2, Users, LogOut, Bell, Building2, User, Menu, X, ArrowRight, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getUserRole, checkAndRefreshToken } from '../utils/auth';
import { apiFetch, getApiBaseUrl } from '../utils/api';
import NotificationInbox from './NotificationInbox';
import ThemeToggle from './ThemeToggle';

export default function UserNavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  
  // Mobile Menu State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Notification State
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const role = getUserRole();
  const isCompany = role === 'company';

  const isActive = (path: string) => {
    if (path === '/download') {
      return location.pathname === '/download' || location.pathname.includes('/download') || location.pathname.includes('/cli');
    }
    return location.pathname === path;
  };

  // Auto-close mobile menu on route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    navigate('/logout');
  };

  const fetchUnreadCount = async () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    try {
      const token = await checkAndRefreshToken();
      if (!token) return;

      const baseUrl = getApiBaseUrl();
      const res = await apiFetch(`${baseUrl}/api/accounts/notifications/unread-count/`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unread_count || 0);
      }
    } catch (err) {
      console.error('Error fetching unread notification count:', err);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000); // 60s central background polling

    const handleVisibility = () => {
      if (!document.hidden) {
        fetchUnreadCount();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const navLinks = isCompany
    ? [
        { to: '/company/dashboard', icon: Home, label: 'Overview' },
        { to: '/company/projects', icon: Folder, label: 'Projects' },
        { to: '/company/developers', icon: Users, label: 'Add & Manage Devs' },
        { to: '/company/quickstart', icon: Code2, label: 'Quick Start Guide' },
        { to: '/download', icon: Download, label: 'Download CLI' },
        { to: '/profile', icon: User, label: 'My Profile' },
      ]
    : [
        { to: '/dashboard', icon: Home, label: 'Overview' },
        { to: '/dashboard/projects', icon: Folder, label: 'Projects' },
        { to: '/organization', icon: Building2, label: 'Organization & Teams' },
        { to: '/quickstart', icon: Code2, label: 'Quick Start Guide' },
        { to: '/download', icon: Download, label: 'Download CLI' },
        { to: '/profile', icon: User, label: 'My Profile' },
      ];

  const NavButton = ({ 
    to, 
    icon: Icon, 
    label, 
    onClick,
    badge,
    size = 'md'
  }: { 
    to?: string, 
    icon: any, 
    label: string, 
    onClick?: () => void,
    badge?: number,
    size?: 'md' | 'sm'
  }) => {
    const active = to ? isActive(to) : false;
    
    const content = (
      <div 
        className="relative group flex items-center justify-center"
        onMouseEnter={() => setHoveredLabel(label)}
        onMouseLeave={() => setHoveredLabel(null)}
      >
        <div className={`
          rounded-full transition-all duration-200 cursor-pointer relative flex items-center justify-center
          ${size === 'sm' ? 'p-1.5' : 'p-2.5'}
          ${active 
            ? 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-medium shadow-sm' 
            : 'bg-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100'}
        `}>
          <Icon className={size === 'sm' ? 'w-4 h-4' : 'w-4.5 h-4.5'} strokeWidth={1.75} />
          
          {badge !== undefined && badge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-3.5 h-3.5 px-1 bg-rose-500 text-white text-[8px] font-bold font-mono rounded-full flex items-center justify-center border border-white dark:border-[#090A0F] shadow-sm">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </div>
        
        <AnimatePresence>
          {hoveredLabel === label && (
            <motion.div
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.12 }}
              className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white dark:bg-zinc-900 dark:border dark:border-zinc-800 dark:text-zinc-200 text-xs font-medium rounded-md whitespace-nowrap z-50 shadow-lg"
            >
              {label}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );

    if (to) {
      return (
        <Link to={to} onClick={onClick}>
          {content}
        </Link>
      );
    }
    
    return (
      <button onClick={onClick} className="w-full focus:outline-none">
        {content}
      </button>
    );
  };

  return (
    <>
      {/* Mobile Top Header Bar (md:hidden) */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white/90 dark:bg-[#090A0F]/90 backdrop-blur-xl border-b border-slate-200 dark:border-zinc-800/80 z-50 px-4 flex items-center justify-between transition-colors">
        {/* Brand Logo & Context */}
        <Link 
          to={isCompany ? "/company/dashboard" : "/dashboard"} 
          className="flex items-center gap-2.5"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div className="flex flex-col text-slate-950 dark:text-white font-bold leading-[0.8] tracking-tighter" style={{ fontSize: '22px' }}>
            <div className="relative">
              <div className="absolute -top-1.5 left-0 w-3 h-[2px] bg-violet-600"></div>
              NO
            </div>
            <div className="flex items-end">
              IR<div className="w-3 h-[2px] bg-violet-600 ml-0.5 mb-0.5"></div>
            </div>
          </div>
          <span className="text-[10px] tracking-wider uppercase font-semibold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30">
            {isCompany ? 'Company' : 'Developer'}
          </span>
        </Link>

        {/* Right Controls: Theme, Notifications & Hamburger */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <ThemeToggle variant="compact" />

          {/* Notifications Trigger */}
          <button
            type="button"
            onClick={() => setIsInboxOpen(true)}
            className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900/80 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white transition-all cursor-pointer"
            aria-label="View notifications"
          >
            <Bell className="w-4 h-4" strokeWidth={1.75} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-rose-500 text-white text-[9px] font-bold font-mono rounded-full flex items-center justify-center border border-white dark:border-[#090A0F] shadow-sm">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Mobile Hamburger Button */}
          <motion.button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/90 dark:bg-zinc-900/90 border border-slate-300 dark:border-white/15 text-slate-700 dark:text-stone-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/90 transition-all shadow-md focus:outline-none"
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <X className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            ) : (
              <Menu className="w-5 h-5 text-slate-700 dark:text-stone-200" />
            )}
          </motion.button>
        </div>
      </header>

      {/* Mobile Menu Overlay Drawer (md:hidden) */}
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
              className="md:hidden fixed inset-0 top-16 bg-slate-900/40 dark:bg-black/70 backdrop-blur-md z-40"
            />

            {/* Mobile Menu Sheet */}
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="md:hidden fixed top-16 left-0 right-0 mx-3 mt-2 bg-white/95 dark:bg-[#090A0F]/95 backdrop-blur-2xl border border-slate-200 dark:border-white/15 rounded-2xl p-4 shadow-2xl z-50 flex flex-col gap-3 max-h-[calc(100vh-5rem)] overflow-y-auto text-slate-900 dark:text-white"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-stone-400">Workspace Menu</span>
                <div className="flex items-center gap-2">
                  <ThemeToggle variant="segmented" />
                  <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30">
                    {isCompany ? 'Company' : 'Developer'}
                  </span>
                </div>
              </div>

              {/* Navigation Items */}
              <div className="flex flex-col gap-1.5">
                {navLinks.map((item) => {
                  const active = isActive(item.to);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center justify-between p-3 rounded-xl transition-all text-sm font-medium ${
                        active
                          ? 'bg-violet-600/15 border border-violet-500/40 text-violet-900 dark:text-white shadow-sm'
                          : 'bg-slate-100/80 hover:bg-violet-50 dark:bg-white/[0.03] dark:hover:bg-violet-600/10 border border-slate-200/80 dark:border-transparent dark:hover:border-violet-500/20 text-slate-700 dark:text-stone-300 hover:text-slate-950 dark:hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${active ? 'text-violet-600 dark:text-violet-400' : 'text-slate-500 dark:text-stone-400'}`} strokeWidth={active ? 2 : 1.75} />
                        <span>{item.label}</span>
                      </div>
                      <ArrowRight className={`w-3.5 h-3.5 ${active ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400 dark:text-stone-600'}`} />
                    </Link>
                  );
                })}
              </div>

              {/* Action Buttons: Notifications & Logout */}
              <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsInboxOpen(true);
                  }}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.03] dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-stone-200 transition-all text-sm font-medium cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Bell className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    <span>Notifications & Inbox</span>
                  </div>
                  {unreadCount > 0 ? (
                    <span className="min-w-5 h-5 px-1.5 bg-rose-500 text-white text-[10px] font-bold font-mono rounded-full flex items-center justify-center">
                      {unreadCount}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-stone-500">0 unread</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-red-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-stone-400 hover:text-red-600 dark:hover:text-red-400 hover:border-red-500/30 transition-all text-sm font-medium cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Floating Left Dock (hidden on mobile, visible on md+) */}
      <div className="hidden md:flex fixed left-3 md:left-5 top-0 bottom-0 py-5 flex-col justify-between w-12 z-50">
        <div className="bg-white/90 dark:bg-[#0e1017]/80 backdrop-blur-xl rounded-full flex flex-col items-center py-3.5 gap-2.5 shadow-xl border border-slate-200/90 dark:border-zinc-800/80">
          {navLinks.map((item) => (
            <NavButton key={item.to} to={item.to} icon={item.icon} label={item.label} />
          ))}
        </div>

        <div className="bg-white/90 dark:bg-[#0e1017]/80 backdrop-blur-xl rounded-full flex flex-col items-center py-2.5 gap-2 shadow-xl border border-slate-200/90 dark:border-zinc-800/80">
          <ThemeToggle variant="compact" />
          <NavButton 
            icon={Bell} 
            label="Notifications & Inbox" 
            onClick={() => setIsInboxOpen(true)}
            badge={unreadCount}
            size="sm"
          />
          <NavButton icon={LogOut} label="Log Out" onClick={handleLogout} size="sm" />
        </div>
      </div>

      {/* Notification Inbox Drawer */}
      <NotificationInbox
        isOpen={isInboxOpen}
        onClose={() => setIsInboxOpen(false)}
        onUnreadCountChange={(count) => setUnreadCount(count)}
      />
    </>
  );
}
