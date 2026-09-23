import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Folder, Code2, Users, LogOut, Bell, Building2, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getUserRole, checkAndRefreshToken } from '../utils/auth';
import { apiFetch } from '../utils/api';
import NotificationInbox from './NotificationInbox';

export default function UserNavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  
  // Notification State
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const role = getUserRole();
  const isCompany = role === 'company';


  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    navigate('/logout');
  };

  const fetchUnreadCount = async () => {
    try {
      const token = await checkAndRefreshToken();
      if (!token) return;

      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
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
    const interval = setInterval(fetchUnreadCount, 20000); // 20s polling
    return () => clearInterval(interval);
  }, [location.pathname]);

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
            ? 'bg-zinc-100 text-zinc-950 font-medium shadow-sm' 
            : 'bg-transparent text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100'}
        `}>
          <Icon className={size === 'sm' ? 'w-4 h-4' : 'w-4.5 h-4.5'} strokeWidth={1.75} />
          
          {badge !== undefined && badge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-3.5 h-3.5 px-1 bg-rose-500 text-white text-[8px] font-bold font-mono rounded-full flex items-center justify-center border border-[#090A0F] shadow-sm">
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
              className="absolute left-full ml-3 px-2.5 py-1 bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs font-medium rounded-md whitespace-nowrap z-50 shadow-lg"
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
      <div className="fixed left-3 md:left-5 top-0 bottom-0 py-5 flex flex-col justify-between w-12 z-50">
        <div className="bg-[#0e1017]/80 backdrop-blur-xl rounded-full flex flex-col items-center py-3.5 gap-2.5 shadow-2xl border border-zinc-800/80">
          {isCompany ? (
            <>
              <NavButton to="/company/dashboard" icon={Home} label="Overview" />
              <NavButton to="/company/projects" icon={Folder} label="Projects" />
              <NavButton to="/company/developers" icon={Users} label="Add & Manage Devs" />
              <NavButton to="/company/quickstart" icon={Code2} label="Quick Start Guide" />
              <NavButton to="/profile" icon={User} label="My Profile" />
            </>
          ) : (
            <>
              <NavButton to="/dashboard" icon={Home} label="Overview" />
              <NavButton to="/dashboard/projects" icon={Folder} label="Projects" />
              <NavButton to="/organization" icon={Building2} label="Organization & Teams" />
              <NavButton to="/quickstart" icon={Code2} label="Quick Start Guide" />
              <NavButton to="/profile" icon={User} label="My Profile" />
            </>
          )}
        </div>

        <div className="bg-[#0e1017]/80 backdrop-blur-xl rounded-full flex flex-col items-center py-2.5 gap-2 shadow-2xl border border-zinc-800/80">
          {/* Notifications Bell (compact) */}
          <NavButton 
            icon={Bell} 
            label="Notifications & Inbox" 
            onClick={() => setIsInboxOpen(true)}
            badge={unreadCount}
            size="sm"
          />
          {/* Logout Button (compact) */}
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
