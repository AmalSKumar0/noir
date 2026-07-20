import React, { useState, useEffect, useRef, MouseEvent } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Github, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import BackgroundBoids from '../components/BackgroundBoids';
import { setAuthTokens } from '../utils/auth';
import { initiateGithubOAuth, initiateGoogleOAuth } from '../utils/oauth';

const processedCodes = new Set<string>();

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Initialize isGithubLoading to true if code or tokens are present in the URL on mount
  const [isGithubLoading, setIsGithubLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return !!(params.get('code') || params.get('access') || params.get('access_token'));
    }
    return false;
  });

  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessParam = params.get('access') || params.get('access_token');
    const refreshParam = params.get('refresh') || params.get('refresh_token');
    const code = params.get('code');

    if (accessParam) {
      setAuthTokens(accessParam, refreshParam || undefined);
      navigate('/dashboard', { replace: true });
      return;
    }

    if (code) {
      if (processedCodes.has(code)) return;
      processedCodes.add(code);

      const exchangeCode = async () => {
        setIsGithubLoading(true);
        setError('');
        try {
          const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
          const response = await fetch(`${baseUrl}/api/accounts/github/callback/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code }),
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || errData.error || 'Failed to exchange GitHub authorization code.');
          }

          const data = await response.json();
          if (data.access) {
            setAuthTokens(data.access, data.refresh);
          }

          navigate('/dashboard', { replace: true });
        } catch (err: any) {
          setError(`Error in authentication using GitHub: ${err.message || 'Verification failed.'}`);
          setIsGithubLoading(false);
        }
      };

      exchangeCode();
    }
  }, [navigate]);

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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const endpoint = `${baseUrl}/api/accounts/login/`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || errData.error || 'Invalid credentials');
      }

      const data = await response.json();
      
      // Store tokens
      if (data.access) {
        setAuthTokens(data.access, data.refresh);
      }

      // Navigate to dashboard
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGithubLogin = () => {
    setIsGithubLoading(true);
    setError('');
    initiateGithubOAuth();
  };

  const handleGoogleLogin = () => {
    initiateGoogleOAuth();
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
        transition={{ duration: 0.5, delay: 0.2 }}
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
          transition={{ duration: 0.8, ease: "easeOut" }}
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
              Welcome back to <br />
              <span className="font-medium text-white drop-shadow-[0_0_30px_rgba(139,92,246,0.15)]">your workspace.</span>
            </h1>
            <p className="text-stone-400 text-base md:text-lg max-w-md leading-relaxed font-sans font-light tracking-wide mb-12">
              The autonomous reliability engineer for modern applications. Sign in to monitor cascades and access telemetry.
            </p>

            {/* Horizontal OAuth Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md">
              <motion.button
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                onClick={handleGithubLogin}
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

              <motion.button
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                onClick={handleGoogleLogin}
                type="button"
                className="w-full py-3.5 rounded-full bg-stone-900/40 backdrop-blur-md border border-white/10 hover:bg-white/10 hover:border-white/20 text-white font-medium text-sm flex items-center justify-center gap-3 transition-colors duration-300"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Right Side: Login Card */}
        <div className="flex justify-center lg:justify-end w-full relative z-20">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
            className="relative w-full max-w-[440px] p-8 md:p-12 rounded-[2rem] bg-white/5 backdrop-blur-3xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col"
          >
            <div className="flex flex-col mb-10">
               <h2 className="text-2xl font-medium tracking-tight text-white mb-2">
                 Sign in with email
               </h2>
               <p className="text-stone-400 text-sm font-mono tracking-wide">
                 Enter your credentials to continue
               </p>
            </div>

            {/* Error Banner */}
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono flex items-center gap-3"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </motion.div>
            )}

            <form onSubmit={handleAuth} className="flex flex-col gap-4 w-full">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-stone-900/50 border border-white/5 rounded-full py-3.5 pl-12 pr-6 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-violet-500/50 focus:bg-stone-900/80 transition-all font-mono"
                />
              </div>
              
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-stone-900/50 border border-white/5 rounded-full py-3.5 pl-12 pr-12 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-violet-500/50 focus:bg-stone-900/80 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <motion.button
                whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(124,58,237,0.2)" }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isLoading || isGithubLoading}
                className="w-full mt-4 py-3.5 rounded-full bg-white text-black font-semibold text-xs uppercase tracking-widest hover:bg-stone-200 transition-colors shadow-[0_5px_20px_rgba(139,92,246,0.15)] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                    <span>Signing In...</span>
                  </>
                ) : (
                  'Sign In'
                )}
              </motion.button>
              
              <div className="mt-4 text-center">
                <Link to="/register" className="text-stone-400 hover:text-white text-sm font-mono tracking-wide transition-colors">
                  Don't have an account? Register
                </Link>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
