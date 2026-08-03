import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Clock, Users, Wallet, Hexagon, HelpCircle, LogOut, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AdminNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    navigate('/logout');
  };

  const NavButton = ({ to, icon: Icon, label, onClick }: { to?: string, icon: any, label: string, onClick?: () => void }) => {
    const active = to ? isActive(to) : false;
    
    const content = (
      <div 
        className="relative group flex items-center justify-center"
        onMouseEnter={() => setHoveredLabel(label)}
        onMouseLeave={() => setHoveredLabel(null)}
      >
        <div className={`
          p-2.5 rounded-full transition-all duration-300 backdrop-blur-md
          ${active 
            ? 'bg-white text-violet-600 shadow-lg' 
            : 'bg-transparent text-white/60 hover:bg-white/10 hover:text-white'}
        `}>
          <Icon className="w-5 h-5" strokeWidth={1.5} />
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
      <button onClick={onClick} className="w-full">
        {content}
      </button>
    );
  };

  return (
    <div className="fixed left-4 md:left-6 top-0 bottom-0 py-6 flex flex-col justify-between w-14 z-50">
      <div className="bg-[#0A0718]/40 backdrop-blur-xl rounded-full flex flex-col items-center py-4 gap-4 shadow-2xl border border-white/10">
        <NavButton to="/admin/dashboard" icon={Home} label="Overview" />
        {/* <NavButton to="/admin/dashboard" icon={Clock} label="Recent Activity" /> */}
        <NavButton to="/admin/users" icon={Users} label="Manage Users" />
        <NavButton to="/admin/projects" icon={Wallet} label="Manage Projects" />
        {/* <NavButton to="#" icon={Hexagon} label="Integrations" /> */}
      </div>

      <div className="bg-[#0A0718]/40 backdrop-blur-xl rounded-full flex flex-col items-center py-4 gap-4 shadow-2xl border border-white/10">
        {/* <NavButton to="#" icon={HelpCircle} label="Help & Support" /> */}
        <NavButton icon={LogOut} label="Log Out" onClick={handleLogout} />
      </div>
    </div>
  );
}
