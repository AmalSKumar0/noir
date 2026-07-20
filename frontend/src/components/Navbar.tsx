import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Menu, X, User, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Navbar({ isMenuOpen, setIsMenuOpen }: { isMenuOpen: boolean, setIsMenuOpen: (v: boolean) => void }) {
  const links = ['About', 'Contact', 'Workflow', 'Docs', 'Download Agent'];
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    setIsAuthenticated(!!token);
  }, []);

  const handleLogout = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (refreshToken) {
        await fetch(`${baseUrl}/api/accounts/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          },
          body: JSON.stringify({ refresh: refreshToken }),
        });
      }
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setIsAuthenticated(false);
      navigate('/');
    }
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

      <nav className="absolute top-full left-0 right-0 flex items-center justify-between px-6 md:px-12 py-4 md:py-6 w-full max-w-[1400px] mx-auto z-40">
        {/* Left: Logo */}
        <Link
          to="/"
          className="flex items-center"
        >
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

        {/* Center: Menu Button */}
        <motion.button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(124,58,237,0.2)" }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-5 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10 transition-all font-semibold uppercase tracking-widest text-xs md:text-sm text-stone-200 hover:text-white cursor-pointer shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5)]"
        >
          {isMenuOpen ? (
            <>Close <X className="w-4 h-4 text-violet-400" /></>
          ) : (
            <>Menu <Menu className="w-4 h-4 text-violet-400" /></>
          )}
        </motion.button>

        {/* Right: Accessories */}
        <div className="flex items-center gap-4 md:gap-6">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <Link to="/dashboard">
                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(124,58,237,0.2)" }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 px-5 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10 transition-all font-semibold uppercase tracking-widest text-xs text-stone-200 hover:text-white cursor-pointer shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5)]"
                >
                  <User className="w-4 h-4 text-violet-400" />
                  <span className="hidden sm:inline">Dashboard</span>
                </motion.button>
              </Link>
              <motion.button
                onClick={handleLogout}
                whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(124,58,237,0.2)" }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10 transition-all font-semibold uppercase tracking-widest text-xs text-stone-200 hover:text-white cursor-pointer shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5)]"
              >
                <LogOut className="w-4 h-4 text-red-400" />
              </motion.button>
            </div>
          ) : (
            <Link to="/login">
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(124,58,237,0.2)" }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-5 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10 transition-all font-semibold uppercase tracking-widest text-xs text-stone-200 hover:text-white cursor-pointer shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5)]"
              >
                <User className="w-4 h-4 text-violet-400" />
                <span className="hidden sm:inline">Login</span>
              </motion.button>
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
