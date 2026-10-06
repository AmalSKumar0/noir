import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, User, LogOut, ArrowRight, Shield, Terminal, BookOpen, Send, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthState, logout, getRoleHomePath } from '../utils/auth';

export default function Navbar({ isMenuOpen, setIsMenuOpen }: { isMenuOpen: boolean, setIsMenuOpen: (v: boolean) => void }) {
  const links = ['About', 'Contact', 'Join as a Company', 'Workflow', 'Docs', 'Download Agent'];
  const isAuthenticated = useAuthState();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navigate = useNavigate();

  const handleLogoutClick = async () => {
    setIsLoggingOut(true);
    await logout(navigate);
    setIsLoggingOut(false);
  };

  const getLinkIcon = (name: string) => {
    switch (name) {
      case 'About': return Sparkles;
      case 'Contact': return Send;
      case 'Join as a Company': return Shield;
      case 'Workflow': return ArrowRight;
      case 'Docs': return BookOpen;
      case 'Download Agent': return Terminal;
      default: return ArrowRight;
    }
  };

  return (
    <div className="w-full flex flex-col font-sans transition-colors duration-500 bg-transparent text-white relative z-50">
      {/* Desktop Top Sliding Tray (>= md only) */}
      <div
        className={`hidden md:block w-full overflow-hidden transition-all duration-500 ease-in-out z-30 bg-black/50 backdrop-blur-2xl ${
          isMenuOpen
            ? 'h-16 border-b border-white/10 pointer-events-auto'
            : 'h-0 pointer-events-none'
        }`}
      >
        <div className="w-full h-full max-w-[1400px] mx-auto px-6 md:px-12 flex items-center justify-center gap-8">
          {links.map((link, idx) => (
            <div key={link} className="flex items-center">
              {link === 'Contact' ? (
                <Link
                  to="/contact"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <motion.span
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="font-semibold uppercase tracking-widest text-xs md:text-sm transition-colors text-stone-300 hover:text-violet-400 block cursor-pointer"
                  >
                    {link}
                  </motion.span>
                </Link>
              ) : link === 'Join as a Company' ? (
                <Link
                  to="/register/company"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <motion.span
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="font-semibold uppercase tracking-widest text-xs md:text-sm transition-colors text-violet-400 hover:text-white block cursor-pointer"
                  >
                    {link}
                  </motion.span>
                </Link>
              ) : (
                <motion.a
                  href={`#${link.toLowerCase().replace(' ', '-')}`}
                  onClick={() => setIsMenuOpen(false)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="font-semibold uppercase tracking-widest text-xs md:text-sm transition-colors text-stone-300 hover:text-violet-400"
                >
                  {link}
                </motion.a>
              )}
              {idx < links.length - 1 && (
                <span className="text-white/20 ml-8">|</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Nav Header */}
      <nav className="flex items-center justify-between px-5 sm:px-8 md:px-12 py-4 md:py-6 w-full max-w-[1400px] mx-auto z-40">
        {/* Left: Logo */}
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

        {/* Center: Desktop Menu Toggle Button (hidden on mobile) */}
        <div className="hidden md:flex shrink-0 justify-center">
          <motion.button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-transparent border border-white/10 hover:border-white/20 hover:bg-black/60 transition-all font-medium uppercase tracking-widest text-xs text-stone-400 hover:text-white cursor-pointer"
          >
            {isMenuOpen ? (
              <>Close <X className="w-3.5 h-3.5" /></>
            ) : (
              <>Menu <Menu className="w-3.5 h-3.5" /></>
            )}
          </motion.button>
        </div>

        {/* Right: Desktop Actions & Mobile Hamburger Controls */}
        <div className="flex-1 flex items-center justify-end gap-2 sm:gap-3 md:gap-4">
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <Link to={getRoleHomePath()}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-600/10 border border-violet-500/30 hover:border-violet-500/50 hover:bg-violet-600/20 transition-all font-medium uppercase tracking-widest text-[10px] md:text-xs text-violet-300 hover:text-white cursor-pointer"
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
                className="hidden sm:flex items-center justify-center p-2 rounded-full bg-transparent border border-white/10 hover:border-red-500/30 hover:bg-black/60 transition-all text-stone-400 hover:text-red-400 cursor-pointer disabled:opacity-50"
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
            <Link to="/login" className="hidden sm:block">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-transparent border border-white/10 hover:border-white/20 hover:bg-black/60 transition-all font-medium uppercase tracking-widest text-[10px] md:text-xs text-stone-400 hover:text-white cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                <span>Login</span>
              </motion.button>
            </Link>
          )}

          {/* Mobile Hamburger Button (Top Right on mobile) */}
          <motion.button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-900/90 border border-white/15 text-stone-200 hover:text-white hover:bg-zinc-800/90 transition-all shadow-lg focus:outline-none"
            aria-label="Toggle navigation menu"
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? (
              <X className="w-5 h-5 text-violet-400" />
            ) : (
              <Menu className="w-5 h-5 text-stone-200" />
            )}
          </motion.button>
        </div>
      </nav>

      {/* Mobile Navigation Drawer / Dropdown (< md) */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMenuOpen(false)}
              className="md:hidden fixed inset-0 top-[72px] bg-black/70 backdrop-blur-md z-40"
            />

            {/* Mobile Sheet Menu */}
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="md:hidden absolute top-full left-0 right-0 mx-4 mt-2 bg-[#090A0F]/95 backdrop-blur-2xl border border-white/15 rounded-2xl p-5 shadow-[0_24px_50px_rgba(0,0,0,0.85),0_0_40px_rgba(139,92,246,0.12)] z-50 flex flex-col gap-4 overflow-hidden"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-stone-400">Navigation</span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
                  Noir Reliability
                </span>
              </div>

              {/* Navigation Links */}
              <div className="flex flex-col gap-1.5">
                {links.map((link) => {
                  const Icon = getLinkIcon(link);
                  const isSpecial = link === 'Join as a Company';

                  if (link === 'Contact') {
                    return (
                      <Link
                        key={link}
                        to="/contact"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] hover:bg-violet-600/10 border border-transparent hover:border-violet-500/20 text-stone-200 hover:text-white transition-all text-sm font-medium"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-4 h-4 text-violet-400" />
                          <span>{link}</span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-stone-500" />
                      </Link>
                    );
                  }

                  if (link === 'Join as a Company') {
                    return (
                      <Link
                        key={link}
                        to="/register/company"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center justify-between p-3 rounded-xl bg-violet-600/15 hover:bg-violet-600/25 border border-violet-500/30 text-violet-200 hover:text-white transition-all text-sm font-medium"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-4 h-4 text-violet-400" />
                          <span>{link}</span>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-violet-500/30 text-violet-200">
                          Register
                        </span>
                      </Link>
                    );
                  }

                  return (
                    <a
                      key={link}
                      href={`#${link.toLowerCase().replace(' ', '-')}`}
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] hover:bg-violet-600/10 border border-transparent hover:border-violet-500/20 text-stone-200 hover:text-white transition-all text-sm font-medium"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 text-stone-400" />
                        <span>{link}</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-stone-500" />
                    </a>
                  );
                })}
              </div>

              {/* Actions Divider & Buttons */}
              <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
                {isAuthenticated ? (
                  <>
                    <Link
                      to={getRoleHomePath()}
                      onClick={() => setIsMenuOpen(false)}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium text-sm shadow-lg shadow-violet-600/25 hover:opacity-95 transition-all"
                    >
                      <User className="w-4 h-4" />
                      <span>Open Dashboard</span>
                    </Link>
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        handleLogoutClick();
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white/5 border border-white/10 text-stone-400 hover:text-red-400 hover:border-red-500/30 transition-all text-sm font-medium"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Log Out</span>
                    </button>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      to="/login"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-white/5 border border-white/10 text-stone-200 hover:text-white hover:bg-white/10 transition-all text-sm font-medium"
                    >
                      <User className="w-4 h-4" />
                      <span>Login</span>
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-all text-sm font-medium shadow-md shadow-violet-600/30"
                    >
                      <span>Sign Up</span>
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}