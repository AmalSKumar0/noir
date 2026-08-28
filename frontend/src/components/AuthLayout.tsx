import React, { useRef, MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Github } from 'lucide-react';
import BackgroundBoids from './BackgroundBoids';

interface AuthLayoutProps {
  title: React.ReactNode;
  description: string;
  children: React.ReactNode;
  isGithubLoading?: boolean;
  isGoogleLoading?: boolean;
  onGithubLogin?: () => void;
  onGoogleLogin?: () => void;
}

export default function AuthLayout({
  title,
  description,
  children,
  isGithubLoading = false,
  isGoogleLoading = false,
  onGithubLogin,
  onGoogleLogin,
}: AuthLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  const handleMouseMove = (e: MouseEvent) => {
    if (!containerRef.current) return;
    const { left, top } = containerRef.current.getBoundingClientRect();
    mouseRef.current = {
      x: e.clientX - left,
      y: e.clientY - top
    };
  };

  const handleMouseLeave = () => {
    mouseRef.current = { x: -1000, y: -1000 };
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#000000] text-white font-sans selection:bg-violet-600 selection:text-white"
    >
      {/* Background Boids */}
      <BackgroundBoids mouseRef={mouseRef} />

      {/* Ambient Glows */}
      <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-600/15 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-900/20 blur-[120px] rounded-full"></div>
      </div>

      {/* Back to Home Button */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.05, delay: 0.02 }}
        className="absolute top-8 left-8 z-50"
      >
        <Link to="/" className="flex items-center gap-2 text-stone-400 hover:text-white transition-colors text-sm font-mono tracking-wide">
          <ArrowLeft className="w-4 h-4" />
          BACK TO HOME
        </Link>
      </motion.div>

      <div className="w-full max-w-[1400px] mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center min-h-screen py-24 z-20">
        
        {/* Left Side: Branding & OAuth */}
        <motion.div 
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.08, ease: "easeOut" }}
          className="flex flex-col justify-center h-full relative z-20"
        >
          <div className="relative z-10 w-full max-w-lg">
            {/* Logo / Brand */}
            <div className="flex flex-col text-white font-bold leading-[0.8] tracking-tighter mb-8 w-fit" style={{ fontSize: '32px' }}>
              <div className="relative">
                <div className="absolute -top-2 left-0 w-4 h-[3px] bg-violet-600"></div>
                NO
              </div>
              <div className="flex items-end">
                IR<div className="w-4 h-[3px] bg-violet-600 ml-1 mb-1"></div>
              </div>
            </div>
            
            <h1 className="text-5xl sm:text-6xl xl:text-7xl font-light tracking-tighter leading-[1.1] mb-6 text-white font-sans">
              {title}
            </h1>
            <p className="text-stone-400 text-base md:text-lg max-w-md leading-relaxed font-sans font-light tracking-wide mb-12">
              {description}
            </p>

            {/* Horizontal OAuth Buttons */}
            {(onGithubLogin || onGoogleLogin) && (
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md">
                {onGithubLogin && (
                  <motion.button
                    whileHover={{ y: -2, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    onClick={onGithubLogin}
                    disabled={isGithubLoading}
                    type="button"
                    className="w-full py-3.5 rounded-full bg-stone-900/40 backdrop-blur-md border border-white/10 hover:bg-white/10 hover:border-white/20 text-white font-medium text-sm flex items-center justify-center gap-3 transition-colors duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isGithubLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin shrink-0"></div>
                        <span className="truncate">Connecting to GitHub...</span>
                      </>
                    ) : (
                      <>
                        <Github className="w-5 h-5 shrink-0" />
                        <span>GitHub</span>
                      </>
                    )}
                  </motion.button>
                )}

                {onGoogleLogin && (
                  <motion.button
                    whileHover={{ y: -2, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    onClick={onGoogleLogin}
                    type="button"
                    disabled={isGoogleLoading}
                    className="w-full py-3.5 rounded-full bg-stone-900/40 backdrop-blur-md border border-white/10 hover:bg-white/10 hover:border-white/20 text-white font-medium text-sm flex items-center justify-center gap-3 transition-colors duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isGoogleLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin shrink-0"></div>
                        <span className="truncate">Connecting to Google...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Google
                      </>
                    )}
                  </motion.button>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Right Side Card Slot */}
        <div className="flex justify-center lg:justify-end w-full relative z-20">
          {children}
        </div>

      </div>
    </div>
  );
}
