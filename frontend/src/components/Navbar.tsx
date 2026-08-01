import { useState } from 'react';
import { motion } from 'motion/react';
import { Menu, X, User, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthState, logout } from '../utils/auth';

export default function Navbar({ isMenuOpen, setIsMenuOpen }: { isMenuOpen: boolean, setIsMenuOpen: (v: boolean) => void }) {
  const links = ['About', 'Contact', 'Workflow', 'Docs', 'Download Agent'];
  const isAuthenticated = useAuthState();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navigate = useNavigate();

  const handleLogoutClick = async () => {
    setIsLoggingOut(true);
    await logout(navigate);
    setIsLoggingOut(false);
  };

  return (
    <div className="w-full flex flex-col font-sans transition-colors duration-500 bg-transparent text-white relative z-50">
      {/* Top Sliding Tray */}
      <div
        className={`w-full overflow-hidden transition-all duration-500 ease-in-out z-30 bg-black/40 backdrop-blur-2xl ${
          isMenuOpen
            ? 'h-[260px] md:h-16 border-b border-white/10 pointer-events-auto'
            : 'h-0 pointer-events-none'
        }`}
      >
        <div className="w-full h-full max-w-[1400px] mx-auto px-6 md:px-12 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 pt-6 md:pt-0">
          {links.map((link, idx) => (
            <div key={link} className="flex items-center">
              <motion.a
                href={`#${link.toLowerCase().replace(' ', '-')}`}
                onClick={() => setIsMenuOpen(false)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="font-semibold uppercase tracking-widest text-xs md:text-sm transition-colors text-stone-300 hover:text-violet-400"
              >
                {link}
              </motion.a>
              {idx < links.length - 1 && (
                <span className="hidden md:block text-white/20 ml-8">|</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Nav Container */}
      <nav className="absolute top-full left-0 right-0 flex items-center px-6 md:px-12 py-4 md:py-6 w-full max-w-[1400px] mx-auto z-40">
        
        {/* Left: Logo (flex-1 forces it to take equal space as the right side) */}
        <div className="flex-1 flex justify-start">
          <Link to="/" className="flex items-center">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex flex-col text-white font-bold leading-[0.8] tracking-tighter" style={{ fontSize: '28px' }}
            >
              <div className="relative">
                <div className="absolute -top-2 left-0 w-4 h-[3px] bg-violet-600"></div>
                NO
              </div>
              <div className="flex items-end">
                IR<div className="w-4 h-[3px] bg-violet-600 ml-1 mb-1"></div>
              </div>
            </motion.div>
          </Link>
        </div>

        {/* Center: Menu Button (Perfectly centered due to flex-1 on siblings) */}
        <div className="flex shrink-0 justify-center">
          <motion.button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-transparent border border-white/10 hover:border-white/20 hover:bg-black/60 transition-all font-medium uppercase tracking-widest text-[10px] md:text-xs text-stone-400 hover:text-white cursor-pointer"
          >
            {isMenuOpen ? (
              <>Close <X className="w-3.5 h-3.5" /></>
            ) : (
              <>Menu <Menu className="w-3.5 h-3.5" /></>
            )}
          </motion.button>
        </div>

        {/* Right: Actions (flex-1 pushes everything to the right) */}
        <div className="flex-1 flex items-center justify-end gap-3 md:gap-4">
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <Link to="/dashboard">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-transparent border border-white/10 hover:border-white/20 hover:bg-black/60 transition-all font-medium uppercase tracking-widest text-[10px] md:text-xs text-stone-400 hover:text-white cursor-pointer"
                >
                  <User className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Dashboard</span>
                </motion.button>
              </Link>
              <motion.button
                onClick={handleLogoutClick}
                disabled={isLoggingOut}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center justify-center p-2 rounded-full bg-transparent border border-white/10 hover:border-red-500/30 hover:bg-black/60 transition-all text-stone-400 hover:text-red-400 cursor-pointer disabled:opacity-50"
                title="Log out"
              >
                {isLoggingOut ? (
                  <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <LogOut className="w-3.5 h-3.5" />
                )}
              </motion.button>
            </div>
          ) : (
            <Link to="/login">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-transparent border border-white/10 hover:border-white/20 hover:bg-black/60 transition-all font-medium uppercase tracking-widest text-[10px] md:text-xs text-stone-400 hover:text-white cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Login</span>
              </motion.button>
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}