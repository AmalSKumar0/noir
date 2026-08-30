import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Folder, Code2, Users, LogOut, Bell, Building2 } from 'lucide-react';
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
  const isCompany = role === 'company' || location.pathname.startsWith('/company');

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
    badge
  }: { 
    to?: string, 
    icon: any, 
    label: string, 
    onClick?: () => void,
    badge?: number
  }) => {
    const active = to ? isActive(to) : false;
    
    const content = (
      <div 
        className="relative group flex items-center justify-center"
        onMouseEnter={() => setHoveredLabel(label)}
        onMouseLeave={() => setHoveredLabel(null)}
      >
        <div className={`
          p-2.5 rounded-full transition-all duration-300 backdrop-blur-md cursor-pointer relative
          ${active 
            ? 'bg-white text-violet-600 shadow-lg scale-105' 
            : 'bg-transparent text-white/60 hover:bg-white/10 hover:text-white'}
        `}>
          <Icon className="w-5 h-5" strokeWidth={1.5} />
          
          {badge !== undefined && badge > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 bg-rose-500 text-white text-[9px] font-bold font-mono rounded-full flex items-center justify-center border-2 border-[#0A0718] animate-pulse shadow-lg">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </div>
        
        <AnimatePresence>
          {hoveredLabel === label && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute left-full ml-4 px-3 py-1.5 bg-[#100C1F]/90 backdrop-blur-md border border-white/10 text-white text-xs font-medium rounded-lg whitespace-nowrap z-50 shadow-xl"
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
      <div className="fixed left-4 md:left-6 top-0 bottom-0 py-6 flex flex-col justify-between w-14 z-50">
        <div className="bg-[#0A0718]/40 backdrop-blur-xl rounded-full flex flex-col items-center py-4 gap-4 shadow-2xl border border-white/10">
          {isCompany ? (
            <>
              <NavButton to="/company/dashboard" icon={Home} label="Overview" />
              <NavButton to="/company/projects" icon={Folder} label="Projects" />
              <NavButton to="/company/developers" icon={Users} label="Add & Manage Devs" />
            </>
          ) : (
            <>
              <NavButton to="/dashboard" icon={Home} label="Overview" />
              <NavButton to="/dashboard/projects" icon={Folder} label="Projects" />
              <NavButton to="/organization" icon={Building2} label="Organization & Teams" />
              <NavButton to="/dashboard#quickstart" icon={Code2} label="Quick Start" />
            </>
          )}
        </div>

        <div className="bg-[#0A0718]/40 backdrop-blur-xl rounded-full flex flex-col items-center py-4 gap-4 shadow-2xl border border-white/10">
          {/* Notifications Bell */}
          <NavButton 
            icon={Bell} 
            label="Notifications & Inbox" 
            onClick={() => setIsInboxOpen(true)}
            badge={unreadCount}
          />
          {/* Logout Button */}
          <NavButton icon={LogOut} label="Log Out" onClick={handleLogout} />
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
